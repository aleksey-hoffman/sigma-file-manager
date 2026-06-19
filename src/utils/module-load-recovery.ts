// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Router } from 'vue-router';
import { showModuleLoadRecoveryMessage } from '@/utils/app-splash';
import {
  MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS,
  MODULE_LOAD_RECOVERY_STORAGE_KEY,
  MODULE_LOAD_RECOVERY_WINDOW_MS,
} from '@/utils/module-load-recovery.constants';

const MODULE_LOAD_FAILURE_SNIPPETS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
];

let isModuleLoadRecoveryInstalled = false;

export type ModuleLoadRecoveryOptions = {
  router?: Router;
};

export function installModuleLoadRecovery(options: ModuleLoadRecoveryOptions = {}): void {
  if (isModuleLoadRecoveryInstalled || typeof window === 'undefined') {
    return;
  }

  isModuleLoadRecoveryInstalled = true;
  window.addEventListener('vite:preloadError', handleVitePreloadError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  if (options.router) {
    options.router.onError((error) => {
      if (isModuleLoadFailure(error)) {
        recoverFromModuleLoadFailure();
      }
    });
  }
}

export function isModuleLoadFailure(error: unknown): boolean {
  const message = getErrorMessage(error);

  return MODULE_LOAD_FAILURE_SNIPPETS.some(snippet => message.includes(snippet));
}

export function recoverFromModuleLoadFailure(): void {
  const lastRecoveryAt = getLastRecoveryAt();
  const currentTime = Date.now();

  if (currentTime - lastRecoveryAt < MODULE_LOAD_RECOVERY_WINDOW_MS) {
    showModuleLoadRecoveryMessage();
    return;
  }

  if (!setLastRecoveryAt(currentTime)) {
    showModuleLoadRecoveryMessage();
    return;
  }

  window.setTimeout(() => {
    window.location.reload();
  }, MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS);
}

function handleVitePreloadError(event: Event): void {
  event.preventDefault();
  recoverFromModuleLoadFailure();
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  if (!isModuleLoadFailure(event.reason)) {
    return;
  }

  event.preventDefault();
  recoverFromModuleLoadFailure();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '';
}

function getLastRecoveryAt(): number {
  let storedValue: string | null = null;

  try {
    storedValue = sessionStorage.getItem(MODULE_LOAD_RECOVERY_STORAGE_KEY);
  }
  catch {
    return 0;
  }

  if (!storedValue) {
    return 0;
  }

  const recoveryTime = Number(storedValue);

  if (!Number.isFinite(recoveryTime)) {
    return 0;
  }

  return recoveryTime;
}

function setLastRecoveryAt(recoveryTime: number): boolean {
  try {
    sessionStorage.setItem(MODULE_LOAD_RECOVERY_STORAGE_KEY, String(recoveryTime));
    return true;
  }
  catch {
    return false;
  }
}
