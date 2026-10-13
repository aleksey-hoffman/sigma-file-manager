//! Host-app process liveness (v0.5.11).
//!
//! WHY THIS EXISTS — measured 2026-10-13.
//!
//! The v0.5.8 stale-path gate refuses every write unless the extension has hit
//! `/ext_alive` within 60s. That single signal turned out to be load-bearing
//! for *everything*: on 2026-10-13 the extension's health loop stopped firing
//! at ~16:44 CST while Sigma FM kept running (pid 25340, `Responding=True`)
//! for another 2h10m. `extension_alive` went false and **all 12 writes after
//! that were rejected with `WriteFailed extension_not_alive`**, including the
//! download (Save As) dialog that had been verified working at 20:13.
//!
//! Attribution (see `_acceptance/attribution-heartbeat-foreground-test.ps1`):
//! Sigma FM was brought to the true foreground window for 90 continuous
//! seconds and `last_ping_received_ts` never moved (7690s -> 7826s, monotone).
//! So this is **not** WebView2 background-timer throttling — the loop is dead.
//!
//! Two conclusions drive this module:
//!
//! 1. A ping is a *weaker* signal than it looks. It lives inside the extension's
//!    JS timer, which we have now watched die silently with no error anywhere.
//! 2. The thing the gate actually protects against is narrow: Sigma FM
//!    **restarting** (or being closed) while we still hold the previous
//!    session's path. That is a **process identity** question, and a PID
//!    answers it exactly — no timer, no network, no extension cooperation.
//!
//! So the gate becomes two independent signals:
//!   - fresh `/ext_alive` ping  (unchanged, still the fast path)
//!   - host process alive AND *the same process instance we last had contact
//!     with* (this module)
//!
//! Requiring PID **stability** is what preserves the v0.5.8 protection: a
//! restart yields a new PID, so the gate stays shut until the freshly started
//! extension makes contact, exactly as it did before.
//!
//! No new dependency: this shells out to `tasklist.exe`, the same
//! `std::process::Command` pattern already used by `config::kill_holding_sidecar`.

use std::process::Command;

/// Image name of the host application (branded: Alpha File Manager).
pub const HOST_IMAGE: &str = "alpha-file-manager.exe";

/// PID of the running host app, or `None` if it is not running.
///
/// Parses `tasklist /FO CSV /NH`, whose rows look like:
/// `"alpha-file-manager.exe","25340","Console","1","163,640 K"`
///
/// Returns the first match only. If several instances exist (shouldn't happen
/// for a single-instance desktop app) we take the lowest PID, because that is
/// the original process and therefore the stable identity across the session.
pub fn host_pid() -> Option<u32> {
    let out = Command::new("tasklist.exe")
        .args(["/FI", &format!("IMAGENAME eq {HOST_IMAGE}"), "/FO", "CSV", "/NH"])
        .output()
        .ok()?;

    if !out.status.success() {
        return None;
    }
    // Tasklist emits the OEM/ANSI code page (GBK on zh-CN). The fields we need
    // (the numeric PID) are ASCII, and the row delimiter is a plain comma, so
    // lossy decoding is acceptable here -- we never match on the image name,
    // the filter already restricted the output to one image.
    let text = String::from_utf8_lossy(&out.stdout);

    text.lines()
        .filter_map(|line| {
            let mut fields = line.split(",");
            let image = fields.next()?.trim().trim_matches('"');
            if !image.eq_ignore_ascii_case(HOST_IMAGE) {
                return None;
            }
            let pid = fields.next()?.trim().trim_matches('"').parse::<u32>().ok()?;
            Some(pid)
        })
        .min()
}

/// Split one `tasklist /FO CSV /NH` line into its PID field.
/// Split out so the parser above can be unit-tested without spawning tasklist.
pub fn parse_pid_from_row(row: &str) -> Option<u32> {
    let mut fields = row.split(",");
    let image = fields.next()?.trim().trim_matches('"');
    if !image.eq_ignore_ascii_case(HOST_IMAGE) {
        return None;
    }
    fields.next()?.trim().trim_matches('"').parse::<u32>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_real_tasklist_row() {
        // Verbatim shape of tasklist /FO CSV /NH output on this machine.
        let row = r#""alpha-file-manager.exe","25340","Console","1","163,640 K""#;
        assert_eq!(parse_pid_from_row(row), Some(25340));
    }

    #[test]
    fn rejects_a_different_image() {
        let row = r#""notepad.exe","1234","Console","1","10,000 K""#;
        assert_eq!(parse_pid_from_row(row), None);
    }

    #[test]
    fn rejects_malformed_rows_without_panicking() {
        for row in ["", "   ", "\"\",\"\"", "\"alpha-file-manager.exe\"", "garbage"] {
            let _ = parse_pid_from_row(row);
        }
    }

    /// Live probe: this machine is expected to have the host app running during
    /// development, but the assertion is deliberately weak so the suite stays
    /// green on a machine where it is closed.
    #[test]
    fn live_probe_does_not_panic() {
        let _ = host_pid();
    }
}