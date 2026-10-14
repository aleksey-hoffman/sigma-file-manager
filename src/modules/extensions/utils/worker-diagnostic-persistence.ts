// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  WorkerDiagnostic,
  WorkerDiagnosticSink,
} from '@/modules/extensions/runtime/worker-diagnostics';

/**
 * Persists worker lifecycle diagnostics into the extension's own settings file.
 *
 * Webview console output never reaches the application log in this project, so
 * the only externally readable record of a failing extension worker is the
 * settings file it already owns. Writes are debounced per extension because the
 * startup path emits several `info` stages in a row and each write is a
 * read-modify-write of the whole settings document.
 */

export const WORKER_DIAGNOSTICS_SETTINGS_KEY = '__hostWorkerDiagnostics';

export type WorkerDiagnosticSettingsStore = {
  // Must stay async: `updateExtensionSettings` performs a SHALLOW merge, so
  // `customSettings` is replaced wholesale. Reading it without `await` would
  // yield a Promise, `customSettings` would resolve to undefined, and the
  // write would wipe the extension's own keys (`__focus_sync_trace`, `__binaries`).
  getExtensionSettings: (
    extensionId: string,
  ) => Promise<{ customSettings?: Record<string, unknown> } | null>;
  updateExtensionSettings: (
    extensionId: string,
    settings: { customSettings: Record<string, unknown> },
  ) => Promise<void>;
};

export type PersistingSinkOptions = {
  maxPersistedEntries?: number;
  flushDelayMs?: number;
};

export function createPersistingWorkerDiagnosticSink(
  store: WorkerDiagnosticSettingsStore,
  options: PersistingSinkOptions = {},
): WorkerDiagnosticSink {
  const maxPersistedEntries = options.maxPersistedEntries ?? 60;
  const flushDelayMs = options.flushDelayMs ?? 400;

  const pendingByExtension = new Map<string, WorkerDiagnostic[]>();
  const timerByExtension = new Map<string, ReturnType<typeof setTimeout>>();

  async function flush(extensionId: string): Promise<void> {
    const pending = pendingByExtension.get(extensionId);

    pendingByExtension.delete(extensionId);

    if (!pending || pending.length === 0) {
      return;
    }

    const settings = await store.getExtensionSettings(extensionId);
    const customSettings: Record<string, unknown> = { ...(settings?.customSettings ?? {}) };
    const existing = customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY];
    const previous = Array.isArray(existing) ? (existing as WorkerDiagnostic[]) : [];

    customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY] = [
      ...previous,
      ...pending,
    ].slice(-maxPersistedEntries);

    try {
      await store.updateExtensionSettings(extensionId, { customSettings });
    }
    catch (error) {
      // Never let diagnostics break loading, and never throw into the sink.
      console.error('[Extensions] failed to persist worker diagnostics:', error);
    }
  }

  return (entry: WorkerDiagnostic): void => {
    const queued = pendingByExtension.get(entry.extensionId) ?? [];
    queued.push(entry);
    pendingByExtension.set(entry.extensionId, queued);

    const existingTimer = timerByExtension.get(entry.extensionId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    timerByExtension.set(
      entry.extensionId,
      setTimeout(() => {
        timerByExtension.delete(entry.extensionId);
        void flush(entry.extensionId);
      }, flushDelayMs),
    );
  };
}
