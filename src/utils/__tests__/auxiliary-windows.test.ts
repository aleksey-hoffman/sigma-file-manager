// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const getAllWindowsMock = vi.fn();
const closeMock = vi.fn();
const destroyMock = vi.fn();
const hideMock = vi.fn();
const isVisibleMock = vi.fn();
const emitMock = vi.fn();
const emitToMock = vi.fn();
const listenMock = vi.fn();
const webviewWindowOnceMock = vi.fn();
const getCurrentWebviewWindowMock = vi.fn();

const performanceSettings = {
  prelaunchQuickViewWindow: true,
  prelaunchPrintViewWindow: false,
};

let readyEventHandler: ((event: { payload: { generation: number } }) => void) | null = null;

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      performance: performanceSettings,
    },
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getAllWindows: () => getAllWindowsMock(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  emitTo: (...args: unknown[]) => emitToMock(...args),
  listen: (...args: unknown[]) => listenMock(...args),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => getCurrentWebviewWindowMock(),
  WebviewWindow: class {
    label: string;

    constructor(label: string, options?: { url?: string }) {
      this.label = label;
      queueMicrotask(() => {
        webviewWindowOnceMock(label);
        const url = options?.url ?? '';
        const generationMatch = url.match(/aux-generation=(\d+)/);
        const generation = generationMatch
          ? Number.parseInt(generationMatch[1], 10)
          : 1;

        readyEventHandler?.({
          payload: {
            generation,
          },
        });
      });
    }

    once(eventName: string, handler: () => void) {
      if (eventName === 'tauri://created') {
        queueMicrotask(handler);
      }
    }
  },
}));

function createQuickViewWindowStub() {
  return {
    label: 'quick-view',
    close: closeMock,
    destroy: destroyMock,
    hide: hideMock,
    isVisible: isVisibleMock,
  };
}

describe('auxiliary-windows', () => {
  beforeEach(() => {
    vi.resetModules();
    readyEventHandler = null;
    performanceSettings.prelaunchQuickViewWindow = true;
    performanceSettings.prelaunchPrintViewWindow = false;
    getAllWindowsMock.mockReset();
    closeMock.mockReset();
    destroyMock.mockReset();
    hideMock.mockReset();
    isVisibleMock.mockReset();
    emitMock.mockReset();
    emitToMock.mockReset();
    listenMock.mockReset();
    webviewWindowOnceMock.mockReset();
    getCurrentWebviewWindowMock.mockReset();
    closeMock.mockResolvedValue(undefined);
    destroyMock.mockResolvedValue(undefined);
    hideMock.mockResolvedValue(undefined);
    isVisibleMock.mockResolvedValue(false);
    emitToMock.mockResolvedValue(undefined);
    emitMock.mockResolvedValue(undefined);
    listenMock.mockImplementation((_eventName: string, handler: (event: { payload: { generation: number } }) => void) => {
      readyEventHandler = handler;
      return Promise.resolve(vi.fn());
    });
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
  });

  it('hides quick view window when prelaunch is enabled', async () => {
    const quickViewWindow = createQuickViewWindowStub();
    getAllWindowsMock.mockResolvedValue([quickViewWindow]);

    const { releaseAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    await releaseAuxiliaryWindow('quick-view');

    expect(hideMock).toHaveBeenCalledTimes(1);
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('closes quick view window from main when prelaunch is disabled', async () => {
    performanceSettings.prelaunchQuickViewWindow = false;
    const quickViewWindow = createQuickViewWindowStub();
    getAllWindowsMock
      .mockResolvedValueOnce([quickViewWindow])
      .mockResolvedValue([]);

    vi.useFakeTimers();
    const { releaseAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    const releasePromise = releaseAuxiliaryWindow('quick-view');

    await vi.advanceTimersByTimeAsync(200);
    await releasePromise;

    vi.useRealTimers();

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(hideMock).toHaveBeenCalledTimes(1);
    expect(closeMock).not.toHaveBeenCalled();
  });

  it('requests main release when closing from an auxiliary webview', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'quick-view' });

    const { releaseAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    await releaseAuxiliaryWindow('quick-view');

    expect(emitToMock).toHaveBeenCalledWith(
      {
        kind: 'WebviewWindow',
        label: 'main',
      },
      'auxiliary-window:release',
      { label: 'quick-view' },
    );
    expect(emitMock).not.toHaveBeenCalled();
    expect(hideMock).not.toHaveBeenCalled();
    expect(destroyMock).not.toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();
    expect(getAllWindowsMock).not.toHaveBeenCalled();
  });

  it('waits for the matching ready event before returning a recreated window', async () => {
    performanceSettings.prelaunchQuickViewWindow = false;
    const quickViewWindow = createQuickViewWindowStub();
    getAllWindowsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([quickViewWindow])
      .mockResolvedValue([quickViewWindow]);

    const { acquireAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    const window = await acquireAuxiliaryWindow('quick-view');

    expect(window?.label).toBe('quick-view');
    expect(listenMock).toHaveBeenCalledWith('quick-view:window-ready', expect.any(Function));
  });

  it('reuses an existing reachable window when prelaunch is disabled', async () => {
    performanceSettings.prelaunchQuickViewWindow = false;
    const quickViewWindow = createQuickViewWindowStub();
    getAllWindowsMock.mockResolvedValue([quickViewWindow]);

    const { acquireAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    const window = await acquireAuxiliaryWindow('quick-view');

    expect(window?.label).toBe('quick-view');
    expect(destroyMock).not.toHaveBeenCalled();
    expect(webviewWindowOnceMock).not.toHaveBeenCalled();
  });

  it('serializes rapid release and acquire operations', async () => {
    performanceSettings.prelaunchQuickViewWindow = false;
    const quickViewWindow = createQuickViewWindowStub();
    let windows: ReturnType<typeof createQuickViewWindowStub>[] = [quickViewWindow];

    getAllWindowsMock.mockImplementation(async () => windows);
    destroyMock.mockImplementation(async () => {
      windows = [];
    });

    vi.useFakeTimers();
    const { acquireAuxiliaryWindow, releaseAuxiliaryWindow } = await import('@/utils/auxiliary-windows');

    const releaseTask = releaseAuxiliaryWindow('quick-view');
    const acquireTask = acquireAuxiliaryWindow('quick-view');

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([releaseTask, acquireTask]);

    vi.useRealTimers();

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(webviewWindowOnceMock).toHaveBeenCalledWith('quick-view');
  });

  it('drops queued open work when a newer release is requested', async () => {
    const quickViewWindow = createQuickViewWindowStub();
    let queuedOpenRan = false;

    getAllWindowsMock.mockResolvedValue([quickViewWindow]);

    const { releaseAuxiliaryWindow, runAuxiliaryWindowTask } = await import('@/utils/auxiliary-windows');

    const queuedOpenTask = runAuxiliaryWindowTask('quick-view', async () => {
      queuedOpenRan = true;
      return true;
    });
    const releaseTask = releaseAuxiliaryWindow('quick-view');

    const [queuedOpenResult] = await Promise.all([queuedOpenTask, releaseTask]);

    expect(queuedOpenResult).toBeNull();
    expect(queuedOpenRan).toBe(false);
    expect(hideMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when acquire is called outside the main webview', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'quick-view' });

    const { acquireAuxiliaryWindow } = await import('@/utils/auxiliary-windows');
    const window = await acquireAuxiliaryWindow('quick-view');

    expect(window).toBeNull();
    expect(getAllWindowsMock).not.toHaveBeenCalled();
  });

  it('skips emit when the target auxiliary window is unreachable', async () => {
    const quickViewWindow = {
      ...createQuickViewWindowStub(),
    };
    isVisibleMock.mockRejectedValue(new Error('Invalid window handle'));

    getAllWindowsMock.mockResolvedValue([quickViewWindow]);

    const { emitAuxiliaryWindowEvent } = await import('@/utils/auxiliary-windows');
    const didEmit = await emitAuxiliaryWindowEvent('quick-view', 'quick-view:load-file', {
      path: 'C:/image.png',
      siblingPaths: null,
    });

    expect(didEmit).toBe(false);
    expect(emitToMock).not.toHaveBeenCalled();
  });
});
