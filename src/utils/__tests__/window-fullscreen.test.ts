// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { toggleMainWindowFullscreen, toggleMainWindowMaximized } from '@/utils/window-fullscreen';

const isFullscreenMock = vi.fn();
const setFullscreenMock = vi.fn();
const toggleMaximizeMock = vi.fn();

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isFullscreen: isFullscreenMock,
    setFullscreen: setFullscreenMock,
    toggleMaximize: toggleMaximizeMock,
  }),
}));

describe('window-fullscreen', () => {
  beforeEach(() => {
    isFullscreenMock.mockReset();
    setFullscreenMock.mockReset();
    toggleMaximizeMock.mockReset();
  });

  it('toggles fullscreen to the opposite of the native state', async () => {
    isFullscreenMock.mockResolvedValue(false);

    await expect(toggleMainWindowFullscreen()).resolves.toBe(true);
    expect(setFullscreenMock).toHaveBeenCalledWith(true);
  });

  it('toggles maximize when the window is not fullscreen', async () => {
    isFullscreenMock.mockResolvedValue(false);

    await toggleMainWindowMaximized();

    expect(toggleMaximizeMock).toHaveBeenCalledOnce();
    expect(setFullscreenMock).not.toHaveBeenCalled();
  });

  it('exits fullscreen instead of maximizing a fullscreen window', async () => {
    isFullscreenMock.mockResolvedValue(true);

    await toggleMainWindowMaximized();

    expect(setFullscreenMock).toHaveBeenCalledWith(false);
    expect(toggleMaximizeMock).not.toHaveBeenCalled();
  });
});
