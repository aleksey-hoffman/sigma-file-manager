/**
 * Focus Sync — Sigma FM extension entry point.
 *
 * Sends the active folder to a local sidecar process over HTTP.
 * Sandbox constraints: see scripts/scan-sandbox-dynamic.cjs
 * Changelog: docs/extension-changelog.md (NOT in this file — comments are sandbox-scanned)
 */

// ============================================================================
// DIAGNOSTIC TRACE (focus-21 Phase 5, 2026-10-07)
// ============================================================================
// Purpose: every debug session must be able to answer "which node broke?"
// from PERSISTENT evidence, not from a DevTools console that is gone after restart.
//
// Storage: sigma.storage (customSettings key) — no manifest permission required.
// Read it back with:  powershell -File scripts\read-focus-trace.ps1
//
// WHY NUMBERS, NOT STRINGS: the live bug under investigation is a mojibake
// (UTF-8 bytes decoded as GBK). Storing the raw string would let the very bug
// we are chasing corrupt the evidence. So for every path-bearing node we also
// store UTF-16 code units as NUMBERS, which survive any charset round-trip.
// Offline, [System.Text.Encoding]::GetEncoding(936) can then decide, with
// certainty, whether the received text is genuine or GBK-mojibake.
// ============================================================================

const TRACE_KEY = '__focus_sync_trace';
const TRACE_MAX = 300;
const TRACE_FLUSH_MS = 800;
const TRACE_SESSION = 's' + Date.now().toString(36);

/**
 * v0.5.7 G-7 — decode an HTTP response body that is NOT a string.
 *
 * `sigma.http.request` returns `{ok, status, headers, body}` where `body` is a
 * **Uint8Array**, not a string. `JSON.parse()` on it coerces via `String()`,
 * producing "123,34,115,116,..." — JSON.parse reads `123` as a complete number
 * and dies at the first comma:
 *
 *   SyntaxError: Unexpected non-whitespace character after JSON at position 3
 *
 * That throw made `parsed` ALWAYS null in checkHealth(), so the whole
 * unsupported-count notification path — and the G-6 restart re-push — never
 * ran. This is the root cause of "the dialog jumps to a stale Sigma path":
 * the sidecar kept whatever path it had last received.
 */
function decodeHttpBody(b) {
    if (b === null || b === undefined) return '';
    if (typeof b === 'string') return b;
    try {
        // ArrayBuffer.isView covers EVERY typed-array view (Uint8Array,
        // Uint16Array, DataView, ...) and, unlike `instanceof`, keeps working
        // across the worker/main-window realm boundary that structured clone
        // creates. The first attempt at this fix used `b instanceof Uint8Array`
        // and it did NOT match in the worker.
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(b)) {
            return new TextDecoder('utf-8').decode(
                new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
            );
        }
        if (typeof ArrayBuffer !== 'undefined' && b instanceof ArrayBuffer) {
            return new TextDecoder('utf-8').decode(new Uint8Array(b));
        }
        if (Array.isArray(b)) {
            return new TextDecoder('utf-8').decode(new Uint8Array(b));
        }
        if (typeof b === 'object') {
            // axios-style envelopes, in case the client shape changes.
            if (b.data !== undefined) return decodeHttpBody(b.data);
            if (b.body !== undefined) return decodeHttpBody(b.body);
        }
    } catch (e) {
        return '';
    }
    return String(b);
}

/** Human-readable runtime type of a value, safe to log. */
function typeTag(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t !== 'object') return t;
    try { return Object.prototype.toString.call(v).slice(8, -1); } catch (e) { return 'object?'; }
}

let traceBuf = [];
let traceDirty = false;
let traceTimer = null;
let traceSeq = 0;

/** UTF-16 code-unit fingerprint — encoding-immune evidence. */
function traceFingerprint(s) {
    if (typeof s !== 'string') return { type: typeof s, value: String(s) };
    const n = Math.min(s.length, 32);
    const codes = [];
    for (let i = 0; i < n; i++) codes.push(s.charCodeAt(i));
    let nonAscii = false;
    for (let i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) > 127) { nonAscii = true; break; }
    }
    return { len: s.length, nonAscii: nonAscii, codes: codes };
}

function traceFlushNow() {
    if (!traceDirty) return Promise.resolve();
    traceDirty = false;
    if (traceTimer !== null) { clearTimeout(traceTimer); traceTimer = null; }
    try {
        return Promise.resolve(sigma.storage.set(TRACE_KEY, traceBuf.slice(-TRACE_MAX)))
            .catch(() => {});
    } catch (e) {
        // storage unavailable — trace is best-effort, must never break sync.
        return Promise.resolve();
    }
}

/** node: stable short ID. detail: must be JSON-serialisable and SMALL. */
function trace(node, detail) {
    try {
        traceSeq += 1;
        const entry = { seq: traceSeq, t: new Date().toISOString(), s: TRACE_SESSION, node: node };
        if (detail) {
            for (const k in detail) {
                if (Object.prototype.hasOwnProperty.call(detail, k)) entry[k] = detail[k];
            }
        }
        traceBuf.push(entry);
        if (traceBuf.length > TRACE_MAX) traceBuf = traceBuf.slice(-TRACE_MAX);
        traceDirty = true;
        // Throttled flush; also flushed explicitly at completion nodes.
        if (traceTimer === null) {
            traceTimer = setTimeout(() => { traceTimer = null; traceFlushNow(); }, TRACE_FLUSH_MS);
        }
    } catch (e) { /* never let diagnostics break the product */ }
}

/** Report whether sigma.storage is usable at all — N02 depends on it. */
async function traceProbeStorage() {
    let ok = false;
    let err = null;
    try {
        const probe = '__probe_' + Date.now();
        await sigma.storage.set(probe, 1);
        const back = await sigma.storage.get(probe);
        await sigma.storage.remove(probe);
        ok = (back === 1);
    } catch (e) {
        err = String(e).slice(0, 120);
    }
    trace('N02.storage.probe', { ok: ok, err: err });
    return ok;
}


const SIDECAR_HTTP = 'http://127.0.0.1:37421';
const HEALTH_CHECK_INTERVAL_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const UNSUPPORTED_NOTIFY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

// v0.3.5 (Mavis N2): boot grace period — after activate(), suppress
// error/warning notifications for 30s. Reason: Scheduled Task mode means
// sidecar may take 5-15s to bind 37421, AND the first periodic health
// check fires at t=15s, AND checkHealth may surface an
// unsupported_dialog_count notification on the very first observation.
// Without this gate, first-activation UX was "Edge tip + Sidecar not
// reachable + unsupported count" = 3 notifications in 30s. With grace
// period: only the Edge tip shows, the others wait until stable.
//
// User actions still work during grace period (Sync Now, Auto-Confirm toggle,
// resetEdgeTip) — only the auto-fired error/warning banners are suppressed.
const BOOT_GRACE_MS = 30_000;
let bootStartedAt = 0; // set in activate()
function inGracePeriod() {
    if (bootStartedAt === 0) return false;
    return (Date.now() - bootStartedAt) < BOOT_GRACE_MS;
}

let enabled = true;
let autoConfirm = false; // focus-18: default OFF (safe)
let pushTimer = null;
let healthCheckTimer = null;
let notifiedSinceLastFailure = false;
// v0.5.11: require N consecutive transport failures before raising the red banner.
//
// WHY: the banner used to fire on the FIRST failed /health probe after the 30s
// boot grace. Measured 2026-10-13 during an install: Alpha started 15:10:49,
// PREINSTALL killed the sidecar, the task only came back at 15:11:33 — a ~45s
// window with 37421 closed, longer than BOOT_GRACE_MS. The grace expired while
// the sidecar was still legitimately being replaced, one poll failed, and the
// user got "Sidecar not reachable. Open Task Scheduler -> ... Run, or restart
// your PC." — a false alarm we caused ourselves with our own installer.
//
// A single dropped poll is not evidence of a broken sidecar; three in a row
// (45s at the 15s cadence) is. Suppressing the transient case is the fix; the
// banner still appears quickly when the sidecar is genuinely gone.
const HEALTH_FAILURES_BEFORE_NOTIFY = 3;
let consecutiveHealthFailures = 0;
// focus-19: track the last-seen unsupported_dialog_count from /health so we
// only notify on INCREASE (sidecar's counter is monotonic for the process
// lifetime). Initial value -1 means "never observed"; first poll establishes
// the baseline and never notifies.
let lastUnsupportedDialogCount = -1;
let lastUnsupportedNotifyTs = 0;
// v0.5.7 G-6: last path Sigma FM told us about.
// The sidecar forgets everything on restart (current_path = "", first_push_received
// = false) but we only push on path CHANGE, so after a sidecar restart nothing is
// ever pushed until the user happens to navigate. A download dialog opened during
// that window finds nothing to sync ("sentinel; skipping until first push
// received", 2026-10-07 22:49). checkHealth() re-pushes from this when it sees
// the sidecar has never received a path.
let lastKnownPath = null;

function normalizePath(p) {
    if (typeof p !== 'string') return p;
    let stripped = p.replace(/^sfm:\/?/i, '');
    return stripped.replace(/\//g, '\\');
}

function schedulePush(path) {
    // v0.5.8 (P1) — trace at the ENTRY of the scheduling step, unconditionally
    // and before any timer exists. P1 was "the push path produces no trace at
    // all", and this is the only place that distinguishes "the callback never
    // fired" from "the timer never fired" from "pushNow ran but its traces were
    // evicted". Without it those three look identical from the outside.
    trace('N18.schedule', { fp: traceFingerprint(path), hadTimer: pushTimer !== null });
    if (pushTimer !== null) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        pushTimer = null;
        void pushNow(path);
    }, 100);
}

async function pushNow(path) {
    // v0.5.8 (P1): first line, before the `enabled` check, so an entry is
    // recorded even when the push is deliberately skipped.
    trace('N19.push.enter', { fp: traceFingerprint(path), enabled: enabled });
    if (!enabled) {
        trace('N07.push.skip', { why: 'disabled', fp: traceFingerprint(path) });
        return;
    }
    const normalized = normalizePath(path);
    trace('N06.push.normalized', { rawFp: traceFingerprint(path), normFp: traceFingerprint(normalized) });
    console.log('[focus-sync] PUSH raw=' + JSON.stringify(path) + ' normalized=' + JSON.stringify(normalized));

    try {
        // v0.3.0: NO retry with backoff. Previous v0.2.0 retries were a
        // workaround for Tauri callback race after extension runtime reload.
        // Now that the sidecar is independent of Sigma FM lifecycle, the
        // push either works (sidecar alive) or doesn't (sidecar down).
        // Retries would just spam the dying sidecar. One shot, log if failed.
        const body = JSON.stringify({ path: normalized, auto_confirm: autoConfirm });
        trace('N07.push.req', { bodyFp: traceFingerprint(normalized), bodyLen: body.length });
        const r = await sigma.http.request({
            url: `${SIDECAR_HTTP}/set_path`,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body,
        });
        trace('N08.push.resp', { status: r.status });
        console.log('[focus-sync] PUSH response status=' + r.status);
        traceFlushNow();
    } catch (e) {
        trace('N09.push.err', { msg: String(e).slice(0, 160) });
        console.warn('[focus-sync] push failed:', String(e).slice(0, 200));
        // Notification handled by health check; don't double-notify here.
        traceFlushNow();
    }
}

/**
 * v0.3.0 health check. Uses sigma.http.request (sandbox-safe; NOT fetch).
 * Returns true if sidecar is reachable and healthy, false otherwise.
 */
async function pingSidecar() {
    trace('N03.health.req', { t: 0 });
    try {
        const r = await sigma.http.request({
            url: `${SIDECAR_HTTP}/health`,
            method: 'GET',
            timeout: HEALTH_CHECK_TIMEOUT_MS,
        });
        trace('N04.health.resp', { status: r.status });
        if (r.status !== 200) return false;
        const body = JSON.parse(decodeHttpBody(r.body) || '{}');
        // v0.3.0: status field semantics
        //   "ok"       → fully operational
        //   "degraded" → process alive but UIA may be broken or session 0
        //   "down"     → unreachable
        return body.status !== 'down' && body.status !== undefined;
    } catch (e) {
        trace('N04.health.err', { msg: String(e).slice(0, 160) });
        return false;
    }
}

/**
 * Health check + notification on first failure.
 *
 * v0.3.0 H1.1: notify on FIRST failure (not after N consecutive). User
 * should see the problem as soon as sync breaks.
 *
 * v0.3.0 V3.8: setInterval fallback → chain of setTimeout. Defensive against
 * sandbox possibly blocking setInterval.
 *
 * focus-19: ALSO checks the new `unsupported_dialog_count` field and shows
 * a notification when it increases since the last poll (throttled to once
 * per UNSUPPORTED_NOTIFY_THROTTLE_MS so a stream of WinUI Save As dialogs
 * does not spam the user).
 */
async function checkHealth() {
    const r = await pingSidecarWithBody();
    if (!r || !r.body) {
        // Ping failed entirely — handled below by treating as failure.
        return;
    }
    notifiedSinceLastFailure = false;
    consecutiveHealthFailures = 0;

    // focus-19: parse unsupported_dialog_count and notify on increase.
    let parsed = null;
    try {
        parsed = JSON.parse(decodeHttpBody(r.body));
        // Successful parses are NOT traced: health polls every 15s would flush the ring
    } catch (e) {
        parsed = null;
        // N12 — parse failure silently disables the ENTIRE unsupported-count
        // notification block below. That is why "dialog not supported" can
        // never fire when the body is unparseable. Fingerprint the raw body
        // so we can see exactly what the http client handed us.
        trace('N12.health.parse.err', {
            msg: String(e).slice(0, 200),
            bodyLen: (typeof r.body === 'string' ? r.body.length : -1),
            bodyFp: traceFingerprint(r.body),
        });
    }
    // v0.5.7 G-6: re-push after a sidecar restart.
        //
        // The sidecar clears `current_path` and `first_push_received` on every
        // start, but we only push on path CHANGE. So after a sidecar restart
        // (deploy, crash, logon) it can sit with no path until the user happens
        // to navigate — and any download dialog opened in that window has
        // nothing to sync. Observed 2026-10-07 22:49:57:
        //   "dialog path='11.politics' current='' (sentinel); skipping until
        //    first push received"
        //
        // checkHealth() already polls /health every 15s, so re-push from here
        // when the sidecar reports it has never received a path. Self-healing,
        // no extra endpoint, no user action needed.
        if (parsed && parsed.first_push_received === false && lastKnownPath) {
            trace('N15.repush.after_restart', { path: lastKnownPath });
            schedulePush(lastKnownPath);
        }

        if (parsed && typeof parsed.unsupported_dialog_count === 'number') {
        const newCount = parsed.unsupported_dialog_count;
        const now = Date.now();
        // N13 — record the notification DECISION explicitly. Previously the
        // only reason "dialog not supported" never appeared was invisible:
        // every early-return below was silent.
        //
        // v0.5.8 (P1) — this node used to fire on EVERY 15s poll, and its
        // payload is constant noise: `increased:false, willNotify:false`.
        // Measured over the live ring on 2026-10-08, that made 150 of the 300
        // stored entries this single node, which together with N03 filled the
        // ring completely — so the push-path nodes were evicted before anyone
        // could read them. That is the mechanical reason P1 was "unexplained":
        // the evidence was being overwritten by the act of observing it.
        //
        // The decision is now recorded only when it is a decision worth
        // re-reading: the count moved, a notification was actually shown, a
        // show was suppressed, or the baseline was first established. A quiet
        // poll still leaves N03, so liveness remains observable.
        if (newCount !== lastUnsupportedDialogCount || lastUnsupportedDialogCount === -1) {
            trace('N13.notify.decide', {
                baseline: lastUnsupportedDialogCount,
                current: newCount,
                increased: newCount > lastUnsupportedDialogCount,
                inGrace: inGracePeriod(),
                throttleLeftMs: Math.max(0, UNSUPPORTED_NOTIFY_THROTTLE_MS - (now - lastUnsupportedNotifyTs)),
                willNotify: (newCount > lastUnsupportedDialogCount)
                    && !inGracePeriod()
                    && (now - lastUnsupportedNotifyTs >= UNSUPPORTED_NOTIFY_THROTTLE_MS),
            });
        }
        if (lastUnsupportedDialogCount === -1) {
            // First observation: establish baseline, never notify.
            lastUnsupportedDialogCount = newCount;
        } else if (newCount > lastUnsupportedDialogCount) {
            // v0.3.5 (Mavis N2): suppress during boot grace period so
            // first-activation UX isn't a cascade of banners.
            if (!inGracePeriod() && now - lastUnsupportedNotifyTs >= UNSUPPORTED_NOTIFY_THROTTLE_MS) {
                try {
                    sigma.ui.showNotification({
                        title: 'Focus Sync',
                        description:
                            'Detected ' + (newCount - lastUnsupportedDialogCount) +
                            ' Save As dialog(s) the sidecar could not navigate ' +
                            '(e.g. Edge Win11 WinUI). Path sync skipped to avoid ' +
                            'polluting the filename field. See focus-19 plan.',
                        type: 'warning',
                        duration: 8000,
                    });
                    trace('N14.notify.shown', { delta: newCount - lastUnsupportedDialogCount });
                } catch (e) {
                    trace('N14.notify.err', { msg: String(e).slice(0, 200) });
                }
                lastUnsupportedNotifyTs = now;
            } else {
                trace('N14.notify.suppressed', {
                    inGrace: inGracePeriod(),
                    waitMs: now - lastUnsupportedNotifyTs,
                });
            }
            lastUnsupportedDialogCount = newCount;
        }
    }
}

/**
 * Ping sidecar and return the full response object (not just ok bool).
 * focus-19: callers need the body to read `unsupported_dialog_count`.
 * Returns null on transport failure (used by checkHealth above to decide
 * whether to notify the sidecar-unreachable banner).
 */
async function pingSidecarWithBody() {
    // v0.5.8: liveness ping on a DEDICATED endpoint.
    //
    // The sidecar uses "did the extension ping recently" to decide whether the
    // path it holds is still worth injecting (stale-path gate). That signal
    // used to come from `GET /health` — which is wrong, because /health is the
    // shared diagnostic endpoint: `read-sidecar-log.ps1`, ad-hoc
    // `Invoke-WebRequest` and every debugging session call it, so a single
    // diagnostic read kept the gate open and stale paths kept being injected.
    // Verified 2026-10-08 by watching the sidecar's own `last_health_poll_age_ms`
    // track this agent's polling while Sigma FM was closed.
    //
    // `/ext_alive` is called by nothing but us, so a ping there genuinely means
    // "the extension is alive". Fire-and-forget: we do not read the body, and a
    // failure here must never affect the health check below.
    try {
        await sigma.http.request({
            url: `${SIDECAR_HTTP}/ext_alive`,
            method: 'GET',
            timeout: HEALTH_CHECK_TIMEOUT_MS,
        });
    } catch (e) {
        trace('N20.ext_alive.err', { msg: String(e).slice(0, 160) });
    }
    try {
        const r = await sigma.http.request({
            url: `${SIDECAR_HTTP}/health`,
            method: 'GET',
            timeout: HEALTH_CHECK_TIMEOUT_MS,
        });
        // v0.5.8 (P1): `bodyFp` is intentionally NOT recorded on the healthy
        // path. It expands every response into ~250 chars of comma-separated
        // code units, and at one entry per 15s that alone filled a large share
        // of the 300-entry ring, evicting the push-path nodes P1 was about.
        // `bodyType` is what actually carried the G-7 diagnosis (it is what
        // proved `body` arrives as a Uint8Array, not a string) and it is a few
        // bytes. The full fingerprint is still captured whenever parsing fails,
        // which is the only time its content is diagnostically load-bearing —
        // see N12 below.
        trace('N03.health.resp', {
            status: r.status,
            keys: Object.keys(r).join(','),
            bodyType: typeTag(r.body),
            bodyLen: (typeof r.body === 'string' ? r.body.length : -1),
        });
        if (r.status !== 200) return null;
        return r;
    } catch (e) {
        trace('N04.health.err', { msg: String(e).slice(0, 200) });
        // Transport failure: notify only after N consecutive failures.
        // v0.5.11: see HEALTH_FAILURES_BEFORE_NOTIFY — one dropped poll during
        // an install-time sidecar restart must not raise a red banner.
        consecutiveHealthFailures += 1;
        trace('N04.health.consecutive', { n: consecutiveHealthFailures });
        if (
            consecutiveHealthFailures >= HEALTH_FAILURES_BEFORE_NOTIFY &&
            !notifiedSinceLastFailure &&
            !inGracePeriod()
        ) {
            try {
                sigma.ui.showNotification({
                    title: 'Focus Sync',
                    description:
                        'Sidecar not reachable on 127.0.0.1:37421.\n' +
                        'Open Task Scheduler → KizemoFocusSync → Run, or restart your PC.',
                    type: 'error',
                    duration: 15000,
                });
            } catch (e2) {}
            notifiedSinceLastFailure = true;
        }
        return null;
    }
}

function startHealthCheck() {
    if (healthCheckTimer !== null) return; // already running
    if (typeof setInterval === 'function') {
        healthCheckTimer = setInterval(() => { void checkHealth(); }, HEALTH_CHECK_INTERVAL_MS);
    } else {
        // Fallback: chain of setTimeout
        const tick = () => {
            void checkHealth().finally(() => {
                healthCheckTimer = setTimeout(tick, HEALTH_CHECK_INTERVAL_MS);
            });
        };
        healthCheckTimer = setTimeout(tick, HEALTH_CHECK_INTERVAL_MS);
    }
}

function stopHealthCheck() {
    if (healthCheckTimer === null) return;
    if (typeof clearInterval === 'function') clearInterval(healthCheckTimer);
    else clearTimeout(healthCheckTimer);
    healthCheckTimer = null;
}

/**
 * v0.5.8 (P3) — resolve the current folder, with a fallback that actually works.
 *
 * `sigma.context.getCurrentPath()` returns null in this build (recorded P3 in
 * the known-limitations table: outside `onPathChange` there was no second way
 * to learn the path). Left as-is that made the "Sync Now" toolbar button dead
 * on arrival — it always toasted "No current folder." even while the user was
 * demonstrably sitting in a folder.
 *
 * `lastKnownPath` is kept current by two independent sources, so falling back
 * to it is not a guess:
 *   1. every `onPathChange` payload, and
 *   2. the startup read below (when that read does succeed).
 * It is null only if Sigma FM has never told us a path since activation.
 *
 * Returns the path to push, or null when we genuinely have nothing.
 * The caller decides how to report that; this function only reports truth.
 */
async function resolveCurrentPath() {
    try {
        const p = await sigma.context.getCurrentPath();
        if (p) {
            return p;
        }
        trace('N16.ctx.null.fallback', { fp: traceFingerprint(lastKnownPath) });
    } catch (e) {
        trace('N16.ctx.err.fallback', { msg: String(e).slice(0, 160) });
    }
    if (lastKnownPath) {
        return lastKnownPath;
    }
    return null;
}

async function syncNow() {
    const path = await resolveCurrentPath();
    if (!path) {
        try {
            sigma.ui.showNotification({
                title: 'Focus Sync',
                description: 'No current folder. Open a folder in Sigma FM first, then try again.',
                type: 'warning',
            });
        } catch (e) {}
        trace('N17.syncNow.noPath', {});
        return;
    }
    trace('N17.syncNow.push', { fp: traceFingerprint(path) });
    await pushNow(path);
    try {
        sigma.ui.showNotification({ title: 'Focus Sync', description: 'Synced: ' + path, type: 'success' });
    } catch (e) {}
}

/**
 * v0.3.5 (Mavis N7): unified storage getter for boolean flags. Returns the
 * stored value if present (must be exactly `true`/`false`, not e.g. string),
 * otherwise the default. Catches any storage error (sandbox / not-allowed)
 * and falls back to the default — same defensive behavior as the inline
 * try/catches it replaces.
 *
 * Use for: enabled / autoConfirm / edgeLegacyFilePickerTipShown. Do NOT use
 * for path-like strings (normalizePath-style) where `?? default` semantics
 * would mask a missing entry as the default path.
 */
async function loadBool(key, defaultValue) {
    try {
        const v = await sigma.storage.get(key);
        // Only treat literal `true` / `false` as overrides; if sigma.storage
        // returns something else (undefined / null / string), use default.
        return (v === true || v === false) ? v : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

async function toggle() {
    try {
        enabled = !enabled;
        await sigma.storage.set('enabled', enabled);
        try {
            sigma.ui.showNotification({ title: 'Focus Sync', description: enabled ? 'Enabled' : 'Disabled', type: 'info' });
        } catch (e) {}
    } catch (e) {}
}

/**
 * focus-18: Toggle Auto-Confirm. When ON, the next PUSH carries
 * auto_confirm=true and the sidecar Invoke Save on the first push to a
 * given dialog. Per-dialog dedup is on the sidecar (state.committed_hwnds).
 */
async function toggleAutoConfirm() {
    try {
        autoConfirm = !autoConfirm;
        await sigma.storage.set('autoConfirm', autoConfirm);
        try {
            sigma.ui.showNotification({
                title: 'Focus Sync',
                description: 'Auto-Confirm: ' + (autoConfirm
                    ? 'ON (Save button auto-clicked after sync — v0.3.8 default)'
                    : 'OFF (filename written + Save button auto-clicked, v0.3.8 always commits)'),
                type: autoConfirm ? 'warning' : 'info',
                duration: 5000,
            });
        } catch (e) {}
    } catch (e) {}
}

/**
 * focus-21 Bug B + v0.3.5 (Mavis N5) fix: durable re-trigger for the Edge tip.
 *
 * The notification is one-shot (gated by `edgeLegacyFilePickerTipShown`) so
 * users who missed the 8s toast have no way to see it again. This toolbar
 * entry IMMEDIATELY re-shows the full tip (12s duration — slightly longer
 * than the default 8s because the user explicitly asked for it) and re-sets
 * the storage flag to true to prevent double-show on the next activate().
 *
 * v0.3.4 had this say "Edge tip will show on next activation" — but
 * activate() only runs on Sigma FM restart, so users had to bounce Sigma FM
 * to see the tip. Confusing UX. v0.3.5 shows it inline.
 */
async function resetEdgeTip() {
    try {
        // Re-show the full tip immediately (12s; longer than the 8s default
        // because the user actively asked for it).
        try {
            sigma.ui.showNotification({
                title: 'Focus Sync — Edge Save As tip',
                description:
                    'Edge "Modern Save As" (Win11 22H2+) has limited path sync.\n' +
                    '\n' +
                    'To enable full sync:\n' +
                    '1. Open Edge, type edge://flags/#edge-legacy-file-picker in address bar\n' +
                    '2. Find "Legacy File Picker" → set to "Enabled"\n' +
                    '3. Restart Edge\n' +
                    '\n' +
                    'After restart, Save As uses the classic IFileDialog and focus-sync fully supports it.\n' +
                    '\n' +
                    'To revert: same URL → set to "Default" → restart Edge.',
                type: 'info',
                duration: 12000,
            });
        } catch (e) {}
        // Re-set the flag so the next activate() does NOT show the tip
        // again (avoid double-notification on Sigma FM restart).
        try {
            await sigma.storage.set('edgeLegacyFilePickerTipShown', true);
        } catch (e) {}
    } catch (e) {
        // Storage may be unavailable in some sandbox contexts; non-fatal.
    }
}

const activate = async () => {
    // v0.3.5 (Mavis N2): stamp boot start so the 30s grace period gate works.
    bootStartedAt = Date.now();
    trace('N01.activate.start', { ver: 'v0.5.5', traceSession: TRACE_SESSION });
    console.log('[focus-sync] v0.5.5 activate START (H1 SendInput abort if !foreground + H2 UIA SetValue fallback + L1 .no_proxy() + find_ifiledialog_edit 1001/1148 + should_commit=true (unused per Rule 47) + verify + path tolerance)');
    void traceProbeStorage();
    try { await sigma.i18n.mergeFromPath('locales'); } catch (e) {}
    // v0.3.5 (N7): unified loadBool for storage reads. Was 2 inline try/catch
    // blocks; Bug B reset adds a 3rd (`edgeLegacyFilePickerTipShown`).
    enabled = await loadBool('enabled', true);
    autoConfirm = await loadBool('autoConfirm', false);
    const tipShown = await loadBool('edgeLegacyFilePickerTipShown', false);

    // v0.3.0: NO sidecar spawn. Sidecar runs as Windows Scheduled Task
    // 'KizemoFocusSync' (AtLogOn, --service flag). We only connect via HTTP.

    // focus-20 (2026-10-02): show Edge legacy file picker flag tip ONCE on
    // first activation. Per retrospective review §2.2 [P0-2]: this is the
    // PRIMARY workaround for Edge Modern Save As (WinUI 3) which the
    // spike sidecar's UIA path cannot fully navigate. Enabling the flag
    // makes Edge use the classic IFileDialog (`#32770` with full COM
    // ServiceProvider) which focus-sync supports end-to-end.
    //
    // Shown once via storage flag (`edgeLegacyFilePickerTipShown`) so the
    // user sees it on first install but is not re-bombarded on every
    // Sigma FM restart.
    //
    // focus-21 (2026-10-02) updates:
    //   - duration: 25s → 8s (per §10.2). 25s was too long; the toolbar
    //     "🔁 Re-show Edge tip" entry (below) is the durable way to revisit.
    //   - The toolbar reset button (resetEdgeTip) sets the storage flag
    //     back to false so the tip shows again on next activation.
    try {
        // tipShown loaded via loadBool at the top of activate() (N7).
        if (tipShown !== true) {
            sigma.ui.showNotification({
                title: 'Focus Sync — Edge Save As tip',
                description:
                    'Edge "Modern Save As" (Win11 22H2+) is NOT auto-navigated by focus-sync v0.3.6 — ' +
                    'the filename field is yours, we will not write into it.\n' +
                    '\n' +
                    'To enable full sync (focus-sync auto-fills path and you click Save):\n' +
                    '1. Open Edge, type edge://flags/#edge-legacy-file-picker in address bar\n' +
                    '2. Find "Legacy File Picker" → set to "Enabled"\n' +
                    '3. Restart Edge\n' +
                    '\n' +
                    'After restart, Save As uses the classic IFileDialog and focus-sync ' +
                    'fully supports it (path auto-filled, no manual edits).\n' +
                    '\n' +
                    'To revert: same URL → set to "Default" → restart Edge.\n' +
                    '\n' +
                    'Missed this? Use the Focus Sync toolbar menu → "🔁 Re-show Edge tip".',
                type: 'info',
                duration: 12000,
            });
            await sigma.storage.set('edgeLegacyFilePickerTipShown', true);
        }
    } catch (e) {
        // sigma.ui / storage may be unavailable in some sandbox contexts;
        // non-fatal — health check will still warn on sidecar failure.
    }


    // Initial ping (non-blocking) DELAYED 5s + schedule periodic health check.
    //
    // focus-21 Bug C fix: in Scheduled Task mode the sidecar takes a few
    // seconds to come up. Without the delay, first-activate UX was two
    // notifications fired back-to-back:
    //   1. Edge tip (info, 8s now)
    //   2. Sidecar not reachable (error, 15s)
    // The red "not reachable" banner right next to the new-tip notification
    // made users panic on first install. Delaying the initial ping by 5s
    // gives the Scheduled Task enough room to bind 37421 before we check.
    //
    // Periodic health check (startHealthCheck) keeps its normal cadence;
    // this delay ONLY applies to the very first ping.
    setTimeout(() => {
        void pingSidecar().then((ok) => {
            // v0.5.11: this first ping must NOT raise the banner on its own.
            //
            // It is a single sample taken 5s after activation, i.e. exactly the
            // moment an in-progress install or a just-restarted Scheduled Task
            // can still have 37421 closed. Raising a red banner from one sample
            // is what produced the false alarm measured on 2026-10-13. Count it
            // and let the periodic check decide (it needs 3 consecutive
            // failures, which a genuinely dead sidecar will reach in ~45s).
            consecutiveHealthFailures = ok ? 0 : consecutiveHealthFailures + 1;
            trace('N01.initialPing', { ok, consecutive: consecutiveHealthFailures });
        });
    }, 5000);
    startHealthCheck();

    try {
        sigma.commands.registerCommand({ id: 'focus-sync.syncNow', title: 'Sync Now' }, syncNow);
        sigma.commands.registerCommand({ id: 'focus-sync.toggle', title: 'Enable / Disable' }, toggle);
        sigma.commands.registerCommand({ id: 'focus-sync.toggleAutoConfirm', title: 'Toggle Auto-Confirm' }, toggleAutoConfirm);
        // focus-21 Bug B: durable entry point to re-trigger the Edge tip
        // notification. Resets the storage flag so the next activate()
        // shows the tip again.
        sigma.commands.registerCommand({ id: 'focus-sync.resetEdgeTip', title: 'Re-show Edge tip' }, resetEdgeTip);
    } catch (e) {}

    try {
        sigma.toolbar.registerDropdown({
            id: 'focus-sync.toolbar',
            title: 'Focus Sync',
            icon: 'mdi-target',
            items: [
                { id: 'syncNow', title: 'Sync Now', commandId: 'focus-sync.syncNow' },
                { id: 'separator', title: '', separator: true },
                { id: 'toggle', title: 'Enable / Disable', commandId: 'focus-sync.toggle' },
                { id: 'separator2', title: '', separator: true },
                // focus-18: toolbar title cannot be dynamically updated (Sigma FM
                // freezes labels at registerDropdown time). The notification
                // after toggling carries the current state — user remembers.
                { id: 'toggleAutoConfirm', title: 'Auto-Confirm (currently: ' + (autoConfirm ? 'ON' : 'OFF') + ')', commandId: 'focus-sync.toggleAutoConfirm' },
                { id: 'separator3', title: '', separator: true },
                // focus-21 Bug B: durable entry to re-show Edge tip. Users who
                // missed the 8s toast (or have reinstalled) get a one-shot
                // "Edge tip will show on next activation" confirmation.
                { id: 'resetEdgeTip', title: '🔁 Re-show Edge tip', commandId: 'focus-sync.resetEdgeTip' }
            ]
        }, { syncNow, toggle, toggleAutoConfirm, resetEdgeTip });
    } catch (e) {}

    try {
        sigma.context.onPathChange((path) => {
            console.log('[focus-sync] onPathChange raw=' + JSON.stringify(path));
            // N05 — THE decisive node for the mojibake investigation.
            // Records what Sigma FM hands us, before ANY normalisation.
            trace('N05.path.raw', { src: 'onPathChange', fp: traceFingerprint(path) });
            if (path) {
                lastKnownPath = normalizePath(path);
                schedulePush(path);
            }
        });
    } catch (e) {
        trace('N05.path.err', { msg: String(e).slice(0, 160) });
    }

    // v0.5.8 (P3): read the startup path through the same fallback the
    // toolbar uses. Previously a null from getCurrentPath() silently left
    // `lastKnownPath` null, which meant the N15 after-restart re-push had
    // nothing to re-push with and `syncNow` could never recover — the
    // extension went permanently blind until Sigma FM restarted.
    const initialPath = await resolveCurrentPath();
    trace('N10.ctx.initialPath', { fp: traceFingerprint(initialPath) });
    if (initialPath) {
        lastKnownPath = normalizePath(initialPath);
        schedulePush(initialPath);
    } else {
        trace('N10.ctx.empty', { why: 'no path from context and no lastKnownPath yet' });
    }
    traceFlushNow();
};

const deactivate = async () => {
    trace('N11.deactivate', {});
    await traceFlushNow();
    if (pushTimer !== null) { clearTimeout(pushTimer); pushTimer = null; }
    stopHealthCheck();
    // v0.3.0: do NOT call /quit — the sidecar is owned by Task Scheduler,
    // not by us. Shutting it down here would defeat the whole point of
    // Scheduled Task mode.
};

var index = { activate, deactivate };
export { activate, deactivate, index as default };
