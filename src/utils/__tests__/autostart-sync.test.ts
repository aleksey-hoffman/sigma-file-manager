// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const {
  disableMock,
  enableMock,
  isEnabledMock,
} = vi.hoisted(() => ({
  disableMock: vi.fn(),
  enableMock: vi.fn(),
  isEnabledMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  disable: disableMock,
  enable: enableMock,
  isEnabled: isEnabledMock,
}));

import { applyLaunchAtStartupPreference } from '@/utils/autostart-sync';

describe('autostart-sync', () => {
  beforeEach(() => {
    disableMock.mockReset();
    enableMock.mockReset();
    isEnabledMock.mockReset();
  });

  it('disables autostart only when it is currently enabled', async () => {
    isEnabledMock.mockResolvedValueOnce(true);

    await applyLaunchAtStartupPreference(false);

    expect(disableMock).toHaveBeenCalledTimes(1);
    expect(enableMock).not.toHaveBeenCalled();
  });

  it('does not disable autostart when it is already disabled', async () => {
    isEnabledMock.mockResolvedValueOnce(false);

    await applyLaunchAtStartupPreference(false);

    expect(disableMock).not.toHaveBeenCalled();
    expect(enableMock).not.toHaveBeenCalled();
  });

  it('enables autostart only when it is currently disabled', async () => {
    isEnabledMock.mockResolvedValueOnce(false);

    await applyLaunchAtStartupPreference(true);

    expect(enableMock).toHaveBeenCalledTimes(1);
    expect(disableMock).not.toHaveBeenCalled();
  });

  it('does not enable autostart when it is already enabled', async () => {
    isEnabledMock.mockResolvedValueOnce(true);

    await applyLaunchAtStartupPreference(true);

    expect(enableMock).not.toHaveBeenCalled();
    expect(disableMock).not.toHaveBeenCalled();
  });
});
