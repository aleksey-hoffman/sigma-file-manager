// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  createMoveUndo,
  createRenameUndo,
  createTrashUndo,
} from '@/composables/file-operation-undo';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  startJob: vi.fn(),
  recordMovedPaths: vi.fn(),
  recordRenamedPath: vi.fn(),
  recordStrandedRename: vi.fn(),
  handleDirectoryContentsChanged: vi.fn(),
  restoreItems: vi.fn(),
  restoreFolderSettings: vi.fn(),
  platform: { isMacOS: false },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@/localization', () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock('@/utils/operation-toast', () => ({ showOperationToast: vi.fn() }));
vi.mock('@/composables/record-moved-paths', () => ({ recordMovedPaths: mocks.recordMovedPaths }));
vi.mock('@/composables/record-renamed-path', () => ({
  recordRenamedPath: mocks.recordRenamedPath,
  recordStrandedRename: mocks.recordStrandedRename,
}));
vi.mock('@/stores/runtime/copy-move-jobs', () => ({
  useCopyMoveJobsStore: () => ({ startJob: mocks.startJob }),
}));
vi.mock('@/stores/runtime/dir-sizes', () => ({
  useDirSizesStore: () => ({ invalidate: vi.fn() }),
}));
vi.mock('@/stores/runtime/platform', () => ({ usePlatformStore: () => mocks.platform }));
vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    handleDirectoryContentsChanged: mocks.handleDirectoryContentsChanged,
  }),
}));
vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => ({
    getItemsUnderPaths: () => 'stored items',
    restoreItems: mocks.restoreItems,
  }),
}));
vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    getFolderSettingsUnderPaths: () => 'folder settings',
    restoreFolderSettings: mocks.restoreFolderSettings,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.isMacOS = false;
});

describe('rename undo', () => {
  it('renames the item back', async () => {
    mocks.invoke.mockResolvedValue({ success: true });

    await createRenameUndo('/docs/old.txt', '/docs/new.txt')();

    expect(mocks.invoke).toHaveBeenCalledWith('rename_item', {
      sourcePath: '/docs/new.txt',
      newName: 'old.txt',
    });
    expect(mocks.recordRenamedPath).toHaveBeenCalledWith('/docs/new.txt', '/docs/old.txt');
  });

  it('reports a failed rename without recording it', async () => {
    mocks.invoke.mockResolvedValue({
      success: false,
      error: 'taken',
    });

    await expect(createRenameUndo('/docs/old.txt', '/docs/new.txt')()).rejects.toThrow('taken');
    expect(mocks.recordRenamedPath).not.toHaveBeenCalled();
  });
});

describe('move undo', () => {
  it('moves items back to their original folders without overwriting', async () => {
    mocks.startJob.mockImplementation(async (_kind, paths: string[], destination: string) => ({
      success: true,
      moved_paths: paths.map(path => ({
        from: path,
        to: `${destination}/${path.split('/').pop()}`,
      })),
    }));

    await createMoveUndo([
      {
        from: '/one/a.txt',
        to: '/target/a.txt',
      },
      {
        from: '/one/b.txt',
        to: '/target/b.txt',
      },
      {
        from: '/two/c.txt',
        to: '/target/c.txt',
      },
    ])?.();

    const jobArguments = mocks.startJob.mock.calls.map(call => call.slice(0, 4));
    expect(jobArguments).toEqual([
      ['move', ['/target/a.txt', '/target/b.txt'], '/one', 'skip'],
      ['move', ['/target/c.txt'], '/two', 'skip'],
    ]);
    expect(mocks.recordMovedPaths).toHaveBeenCalledTimes(2);
    expect(mocks.handleDirectoryContentsChanged).toHaveBeenCalledWith(['/one', '/target', '/two']);
  });

  it('is not offered when a move had to rename an item', () => {
    expect(createMoveUndo([{
      from: '/one/a.txt',
      to: '/target/a (1).txt',
    }])).toBeNull();
    expect(createMoveUndo([])).toBeNull();
  });
});

describe('trash undo', () => {
  it('restores the items and what was stored about them', async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await createTrashUndo(['/docs/a.txt'])?.();

    expect(mocks.invoke).toHaveBeenCalledWith('restore_trashed_items', { paths: ['/docs/a.txt'] });
    expect(mocks.restoreItems).toHaveBeenCalledWith('stored items');
    expect(mocks.restoreFolderSettings).toHaveBeenCalledWith('folder settings');
    expect(mocks.handleDirectoryContentsChanged).toHaveBeenCalledWith(['/docs']);
  });

  it('keeps stored data removed when the restore fails', async () => {
    mocks.invoke.mockRejectedValue('not found');

    await expect(createTrashUndo(['/docs/a.txt'])?.()).rejects.toBe('not found');
    expect(mocks.restoreItems).not.toHaveBeenCalled();
  });

  it('is not offered on macOS', () => {
    mocks.platform.isMacOS = true;

    expect(createTrashUndo(['/docs/a.txt'])).toBeNull();
  });
});
