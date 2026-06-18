// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DirEntry } from '@/types/dir-entry';

const invokeMock = vi.hoisted(() => vi.fn());
const copyMoveStartJobMock = vi.hoisted(() => vi.fn());
const handleDirectoryContentsChangedMock = vi.hoisted(() => vi.fn());
const invalidateDirSizesMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/runtime/copy-move-jobs', () => ({
  useCopyMoveJobsStore: () => ({
    startJob: copyMoveStartJobMock,
  }),
}));

vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    handleDirectoryContentsChanged: handleDirectoryContentsChangedMock,
  }),
}));

vi.mock('@/stores/runtime/dir-sizes', () => ({
  useDirSizesStore: () => ({
    invalidate: invalidateDirSizesMock,
  }),
}));

import { useClipboardStore } from '@/stores/runtime/clipboard';

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'file.txt',
    ext: 'txt',
    path: 'C:/Source/file.txt',
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
    ...overrides,
  };
}

function createDeferred<T = void>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('clipboard store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    copyMoveStartJobMock.mockReset();
    handleDirectoryContentsChangedMock.mockReset();
    invalidateDirSizesMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs local file clipboard entries to the system clipboard', async () => {
    invokeMock.mockResolvedValue(undefined);
    const store = useClipboardStore();

    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ]);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('set_system_clipboard_files', {
      paths: ['C:/Source/file.txt'],
      operation: 'copy',
    });
    expect(store.hasFileItems).toBe(true);
    expect(store.hasImageContent).toBe(false);
    expect(store.showToolbar).toBe(true);
  });

  it('waits for a pending system clipboard write before syncing from the system clipboard', async () => {
    const clipboardWrite = createDeferred();
    invokeMock.mockImplementation(async (commandName: string, args?: unknown) => {
      if (commandName === 'set_system_clipboard_files') {
        return await clipboardWrite.promise;
      }

      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: ['C:/Source/file.txt'],
          operation: 'copy',
        };
      }

      if (commandName === 'paths_are_directories') {
        return [false];
      }

      if (commandName === 'get_dir_entry_with_timeout') {
        return createEntry({
          path: (args as { path: string }).path,
        });
      }

      return undefined;
    });
    const store = useClipboardStore();

    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ]);
    const syncPromise = store.syncFromSystemClipboard();
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('set_system_clipboard_files', {
      paths: ['C:/Source/file.txt'],
      operation: 'copy',
    });

    clipboardWrite.resolve();
    await syncPromise;

    expect(invokeMock).toHaveBeenCalledWith('read_system_clipboard_files');
    expect(store.clipboardItems).toHaveLength(1);
    expect(store.clipboardItems[0].path).toBe('C:/Source/file.txt');
  });

  it('syncs file-list clipboard content from the system clipboard before checking for images', async () => {
    invokeMock.mockImplementation(async (commandName: string, args?: unknown) => {
      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: ['C:/External/photo.png'],
          operation: 'copy',
        };
      }

      if (commandName === 'paths_are_directories') {
        return [false];
      }

      if (commandName === 'get_dir_entry_with_timeout') {
        return createEntry({
          name: 'photo.png',
          ext: 'png',
          path: (args as { path: string }).path,
          mime: 'image/png',
        });
      }

      if (commandName === 'read_system_clipboard_image_info') {
        return {
          width: 200,
          height: 100,
        };
      }

      return undefined;
    });
    const store = useClipboardStore();

    await store.syncFromSystemClipboard();

    expect(store.hasFileItems).toBe(true);
    expect(store.hasImageContent).toBe(false);
    expect(store.clipboardItems[0].path).toBe('C:/External/photo.png');
    expect(invokeMock).not.toHaveBeenCalledWith('read_system_clipboard_image_info');
  });

  it('syncs image clipboard content when the system clipboard has no file list', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: [],
          operation: 'copy',
        };
      }

      if (commandName === 'read_system_clipboard_image_info') {
        return {
          width: 252,
          height: 358,
          sizeBytes: 360864,
          clipboardSequence: 12,
        };
      }

      if (commandName === 'save_system_clipboard_image_to_temp') {
        return {
          path: 'C:/Temp/clipboard-image.png',
          sizeBytes: 7864320,
        };
      }

      return undefined;
    });
    const store = useClipboardStore();

    await store.syncFromSystemClipboard();

    expect(store.hasItems).toBe(true);
    expect(store.hasFileItems).toBe(false);
    expect(store.hasImageContent).toBe(true);
    expect(store.itemCount).toBe(1);
    expect(store.clipboardImage).toEqual({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      clipboardSequence: 12,
    });
    expect(invokeMock).not.toHaveBeenCalledWith('save_system_clipboard_image_to_temp');

    await store.ensureSystemClipboardImageSaved();

    expect(store.clipboardImage).toEqual({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      clipboardSequence: 12,
      tempPath: 'C:/Temp/clipboard-image.png',
      tempVersion: expect.any(Number),
      savedSizeBytes: 7864320,
    });
    expect(store.canPasteTo('C:/Target')).toBe(true);
  });

  it('saves clipboard image before paste when temp file is missing', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'save_system_clipboard_image_to_temp') {
        return {
          path: 'C:/Temp/clipboard-image.png',
          sizeBytes: 12000,
        };
      }

      if (commandName === 'paste_saved_clipboard_image') {
        return {
          success: true,
          copied_count: 1,
          failed_count: 0,
          skipped_count: 0,
          path: 'C:/Target/clipboard-image.png',
        };
      }

      return undefined;
    });
    const store = useClipboardStore();
    store.setClipboardImage({
      width: 100,
      height: 50,
      sizeBytes: 20000,
      clipboardSequence: 3,
    });

    const result = await store.pasteItems('C:/Target');
    await flushPromises();

    expect(result.success).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('save_system_clipboard_image_to_temp');
    expect(invokeMock).toHaveBeenCalledWith('paste_saved_clipboard_image', {
      sourcePath: 'C:/Temp/clipboard-image.png',
      destinationPath: 'C:/Target',
    });
  });

  it('clears local and system clipboard state after a successful image paste', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'paste_saved_clipboard_image') {
        return {
          success: true,
          copied_count: 1,
          failed_count: 0,
          skipped_count: 0,
          path: 'C:/Target/clipboard-image.png',
        };
      }

      return undefined;
    });
    const store = useClipboardStore();
    store.setClipboardImage({
      width: 100,
      height: 50,
      sizeBytes: 20000,
      tempPath: 'C:/Temp/clipboard-image.png',
      tempVersion: 1,
      savedSizeBytes: 12000,
    });

    const result = await store.pasteItems('C:/Target');
    await flushPromises();

    expect(result.success).toBe(true);
    expect(store.hasItems).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('paste_saved_clipboard_image', {
      sourcePath: 'C:/Temp/clipboard-image.png',
      destinationPath: 'C:/Target',
    });
    expect(invokeMock).toHaveBeenCalledWith('clear_system_clipboard_files');
  });

  it('clears local and system clipboard state after a successful file paste', async () => {
    invokeMock.mockResolvedValue(undefined);
    copyMoveStartJobMock.mockResolvedValue({
      success: true,
      copied_count: 1,
      failed_count: 0,
      skipped_count: 0,
    });
    const store = useClipboardStore();
    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    const result = await store.pasteItems('C:/Target');
    await flushPromises();

    expect(result.success).toBe(true);
    expect(copyMoveStartJobMock).toHaveBeenCalledWith(
      'copy',
      ['C:/Source/file.txt'],
      'C:/Target',
      null,
      undefined,
      expect.objectContaining({
        displayPath: 'Target',
      }),
    );
    expect(store.hasItems).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('clear_system_clipboard_files');
  });

  it('restores file clipboard state when paste fails', async () => {
    copyMoveStartJobMock.mockResolvedValue({
      success: false,
      error: 'Copy failed',
    });
    const store = useClipboardStore();
    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    const result = await store.pasteItems('C:/Target');

    expect(result.success).toBe(false);
    expect(store.hasFileItems).toBe(true);
    expect(store.clipboardItems[0].path).toBe('C:/Source/file.txt');
  });

  it('does not log expected transient Windows clipboard access errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    invokeMock.mockRejectedValue('OpenClipboard failed: Access is denied. (0x80070005)');
    const store = useClipboardStore();

    await expect(store.readSystemClipboardFiles()).resolves.toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('keeps local clipboard state when syncing from the system clipboard fails', async () => {
    invokeMock.mockRejectedValue('OpenClipboard failed: Access is denied. (0x80070005)');
    const store = useClipboardStore();

    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    await store.syncFromSystemClipboard();

    expect(store.hasFileItems).toBe(true);
    expect(store.clipboardItems[0].path).toBe('C:/Source/file.txt');
  });

  it('dismisses move clipboard when external paste removed the source paths', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'path_exists') {
        return false;
      }

      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: ['C:/Source/file.txt'],
          operation: 'move',
        };
      }

      return undefined;
    });
    const store = useClipboardStore();

    store.setClipboard('move', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    const consumed = await store.checkExternalClipboardConsumption();

    expect(consumed).toBe(true);
    expect(store.hasItems).toBe(false);
    expect(handleDirectoryContentsChangedMock).toHaveBeenCalledWith(['C:/Source']);
    expect(invalidateDirSizesMock).toHaveBeenCalledWith(['C:/Source/file.txt']);
  });

  it('dismisses clipboard when the system clipboard no longer has file paths', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'path_exists') {
        return true;
      }

      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: [],
          operation: 'copy',
        };
      }

      if (commandName === 'read_system_clipboard_image_info') {
        return null;
      }

      return undefined;
    });
    const store = useClipboardStore();

    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    const consumed = await store.checkExternalClipboardConsumption();

    expect(consumed).toBe(true);
    expect(store.hasItems).toBe(false);
  });

  it('keeps copy clipboard when external apps leave the source paths and file list intact', async () => {
    invokeMock.mockImplementation(async (commandName: string) => {
      if (commandName === 'path_exists') {
        return true;
      }

      if (commandName === 'read_system_clipboard_files') {
        return {
          paths: ['C:/Source/file.txt'],
          operation: 'copy',
        };
      }

      return undefined;
    });
    const store = useClipboardStore();

    store.setClipboard('copy', [
      createEntry({ path: 'C:/Source/file.txt' }),
    ], {
      syncToSystemClipboard: false,
    });

    const consumed = await store.checkExternalClipboardConsumption();

    expect(consumed).toBe(false);
    expect(store.hasFileItems).toBe(true);
  });
});
