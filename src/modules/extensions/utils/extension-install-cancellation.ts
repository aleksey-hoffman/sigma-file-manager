// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { isExtensionInstallCancelledError } from '@/modules/extensions/utils/install-cancellation-error';

type ExtensionInstallSession = {
  cancellationId: string;
  abortController: AbortController;
};

const sessions = new Map<string, ExtensionInstallSession>();

export async function beginExtensionInstall(extensionId: string): Promise<{
  cancellationId: string;
  signal: AbortSignal;
}> {
  const cancellationId = crypto.randomUUID();
  const abortController = new AbortController();
  sessions.set(extensionId, {
    cancellationId,
    abortController,
  });
  await invoke('register_extension_install_cancellation', { cancellationId });
  return {
    cancellationId,
    signal: abortController.signal,
  };
}

export async function endExtensionInstall(extensionId: string): Promise<void> {
  const session = sessions.get(extensionId);
  if (!session) return;
  sessions.delete(extensionId);
  await invoke('clear_extension_install_cancellation', { cancellationId: session.cancellationId });
}

export async function cancelExtensionInstall(extensionId: string): Promise<void> {
  const session = sessions.get(extensionId);
  if (!session) return;
  await invoke('cancel_extension_install_cancellation', { cancellationId: session.cancellationId });
  session.abortController.abort();
}

export function getExtensionInstallSession(extensionId: string): ExtensionInstallSession | undefined {
  return sessions.get(extensionId);
}

export function getExtensionInstallCancellationIdForExtension(extensionId: string): string | undefined {
  return sessions.get(extensionId)?.cancellationId;
}

export function isUserCancelledError(error: unknown): boolean {
  return isExtensionInstallCancelledError(error);
}

export function getInstallAbortPromise(extensionId: string): Promise<never> {
  return new Promise((_, reject) => {
    const session = getExtensionInstallSession(extensionId);

    if (!session) {
      reject(new Error('No install session'));
      return;
    }

    const signal = session.abortController.signal;

    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
}

export async function raceWithInstallAbort<T>(promise: Promise<T>, extensionId: string): Promise<T> {
  if (!getExtensionInstallSession(extensionId)) {
    return promise;
  }

  return Promise.race([promise, getInstallAbortPromise(extensionId)]);
}
