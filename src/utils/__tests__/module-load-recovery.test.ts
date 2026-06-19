// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  MODULE_LOAD_RECOVERY_MESSAGE,
  MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS,
  MODULE_LOAD_RECOVERY_STORAGE_KEY,
  MODULE_LOAD_RECOVERY_WINDOW_MS,
} from '@/utils/module-load-recovery.constants';
import {
  installModuleLoadRecovery,
  isModuleLoadFailure,
  recoverFromModuleLoadFailure,
} from '@/utils/module-load-recovery';
import type { Router } from 'vue-router';

const startupRecoveryScript = readFileSync(
  resolve(process.cwd(), 'public/startup-recovery.js'),
  'utf8',
);

describe('module load recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    document.body.innerHTML = '<div id="app-splash"><div id="app-splash__spinner"></div></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('keeps startup-recovery.js aligned with shared constants', () => {
    expect(startupRecoveryScript).toContain(MODULE_LOAD_RECOVERY_STORAGE_KEY);
    expect(startupRecoveryScript).toContain(String(MODULE_LOAD_RECOVERY_WINDOW_MS));
    expect(startupRecoveryScript).toContain(String(MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS));
    expect(startupRecoveryScript).toContain(MODULE_LOAD_RECOVERY_MESSAGE);
  });

  it('detects failed dynamic import errors', () => {
    expect(isModuleLoadFailure(new TypeError(
      'Failed to fetch dynamically imported module: app://asset/assets/navigator.js',
    ))).toBe(true);
    expect(isModuleLoadFailure('error loading dynamically imported module')).toBe(true);
    expect(isModuleLoadFailure('Importing a module script failed.')).toBe(true);
  });

  it('detects failed Vite CSS preload errors', () => {
    expect(isModuleLoadFailure(new Error(
      'Unable to preload CSS for /assets/settings.css',
    ))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isModuleLoadFailure(new Error('Failed to read directory'))).toBe(false);
    expect(isModuleLoadFailure(null)).toBe(false);
  });

  it('reloads after the delay on the first recovery attempt', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    });

    recoverFromModuleLoadFailure();

    expect(reloadMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(document.getElementById('app-splash')?.textContent).not.toContain(
      MODULE_LOAD_RECOVERY_MESSAGE,
    );
  });

  it('shows a recovery message when throttled', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    });
    sessionStorage.setItem(
      MODULE_LOAD_RECOVERY_STORAGE_KEY,
      String(Date.now()),
    );

    recoverFromModuleLoadFailure();

    expect(reloadMock).not.toHaveBeenCalled();
    expect(document.getElementById('app-splash')?.textContent).toContain(
      MODULE_LOAD_RECOVERY_MESSAGE,
    );
  });

  it('shows a recovery message when session storage is unavailable', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    recoverFromModuleLoadFailure();

    expect(reloadMock).not.toHaveBeenCalled();
    expect(document.getElementById('app-splash')?.textContent).toContain(
      MODULE_LOAD_RECOVERY_MESSAGE,
    );
  });

  it('installs recovery handlers once and routes module load failures', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadMock },
    });
    const router = {
      onError: vi.fn((handler: (error: unknown) => void) => {
        handler(new TypeError('Failed to fetch dynamically imported module: /assets/navigator.js'));
      }),
    } as unknown as Router;

    installModuleLoadRecovery({ router });
    installModuleLoadRecovery({ router });

    expect(router.onError).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MODULE_LOAD_RECOVERY_RELOAD_DELAY_MS);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
