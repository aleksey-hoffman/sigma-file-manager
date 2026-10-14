// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/**
 * Worker lifecycle diagnostics.
 *
 * Webview `console` output is NOT forwarded to the application log in this
 * project (`tauri_plugin_log` is registered without any console attachment,
 * and the app log contains zero frontend entries). So a failing extension
 * worker used to fail completely silently: `new Worker()` without an
 * `onerror` handler means a module-load failure rejects nobody, and
 * `postWorkerRequest()` promises stay pending forever.
 *
 * This module keeps a bounded in-memory ring of worker lifecycle events and
 * forwards each one to an optional sink. The app-level store installs a sink
 * that persists the ring into the extension's own settings file, which makes
 * worker failures readable from outside the webview.
 */

export type WorkerDiagnosticLevel = 'info' | 'error';

export type WorkerDiagnostic = {
  /** ISO-8601 timestamp. */
  t: string;
  extensionId: string;
  stage: string;
  level: WorkerDiagnosticLevel;
  message: string;
  detail?: string;
};

export type WorkerDiagnosticInput = {
  extensionId: string;
  stage: string;
  level?: WorkerDiagnosticLevel;
  message: string;
  detail?: string;
};

export type WorkerDiagnosticSink = (entry: WorkerDiagnostic) => void | Promise<void>;

/** Keep the ring small: it is persisted into the extension settings file. */
const MAX_ENTRIES = 60;

let buffer: WorkerDiagnostic[] = [];
let sink: WorkerDiagnosticSink | null = null;

export function setWorkerDiagnosticSink(next: WorkerDiagnosticSink | null): void {
  sink = next;
}

export function getWorkerDiagnostics(): WorkerDiagnostic[] {
  return [...buffer];
}

export function clearWorkerDiagnostics(): void {
  buffer = [];
}

export function recordWorkerDiagnostic(input: WorkerDiagnosticInput): void {
  const entry: WorkerDiagnostic = {
    t: new Date().toISOString(),
    extensionId: input.extensionId,
    stage: input.stage,
    level: input.level ?? 'info',
    message: input.message,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };

  buffer.push(entry);

  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(buffer.length - MAX_ENTRIES);
  }

  if (entry.level === 'error') {
    console.error(
      `[Extensions] ${entry.extensionId} ${entry.stage}: ${entry.message}`,
      entry.detail ?? '',
    );
  }

  try {
    void sink?.(entry);
  }
  catch {
    // Diagnostics must never break extension loading.
  }
}

export function describeError(error: unknown): {
  message: string;
  detail: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      detail: error.stack ?? '',
    };
  }

  return {
    message: String(error),
    detail: '',
  };
}
