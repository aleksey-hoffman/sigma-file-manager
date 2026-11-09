// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { CopyMoveJobOutcome } from '@/utils/copy-move-operation';

const { performCopyMoveWithConflictsMock, refreshSizesAfterCopyMoveMock } = vi.hoisted(() => ({
  performCopyMoveWithConflictsMock: vi.fn(),
  refreshSizesAfterCopyMoveMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/stores/runtime/dir-sizes', () => ({
  useDirSizesStore: () => ({
    refreshSizesAfterCopyMove: refreshSizesAfterCopyMoveMock,
  }),
}));

vi.mock('@/composables/use-copy-move-with-conflicts', () => ({
  useCopyMoveWithConflicts: () => ({
    performCopyMoveWithConflicts: performCopyMoveWithConflictsMock,
  }),
}));

import { useFileDropOperation } from '@/composables/use-file-drop-operation';

function createOutcome(overrides: Partial<CopyMoveJobOutcome>): CopyMoveJobOutcome {
  return {
    success: true,
    copiedCount: 1,
    cancelled: false,
    sourcePathIsDir: [true],
    ...overrides,
  };
}

describe('useFileDropOperation', () => {
  beforeEach(() => {
    performCopyMoveWithConflictsMock.mockReset();
    refreshSizesAfterCopyMoveMock.mockClear();
  });

  it('refreshes sizes and reports a transfer after a successful drop', async () => {
    performCopyMoveWithConflictsMock.mockResolvedValue(createOutcome({}));
    const { performDrop } = useFileDropOperation();

    const didTransferAnyItem = await performDrop(['C:/Source/folder'], 'C:/Target', 'copy');

    expect(didTransferAnyItem).toBe(true);
    expect(refreshSizesAfterCopyMoveMock).toHaveBeenCalledWith(
      [{
        path: 'C:/Source/folder',
        is_dir: true,
      }],
      'C:/Target',
      ['C:/Target'],
    );
  });

  it('refreshes sizes and reports a transfer when only some items were copied', async () => {
    performCopyMoveWithConflictsMock.mockResolvedValue(createOutcome({
      success: false,
      copiedCount: 2,
    }));
    const { performDrop } = useFileDropOperation();

    const didTransferAnyItem = await performDrop(['C:/Source/folder'], 'C:/Target', 'copy');

    expect(didTransferAnyItem).toBe(true);
    expect(refreshSizesAfterCopyMoveMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when nothing was copied', async () => {
    performCopyMoveWithConflictsMock.mockResolvedValue(createOutcome({
      success: false,
      copiedCount: 0,
    }));
    const { performDrop } = useFileDropOperation();

    const didTransferAnyItem = await performDrop(['C:/Source/folder'], 'C:/Target', 'copy');

    expect(didTransferAnyItem).toBe(false);
    expect(refreshSizesAfterCopyMoveMock).not.toHaveBeenCalled();
  });

  it('does not refresh when the drop was cancelled', async () => {
    performCopyMoveWithConflictsMock.mockResolvedValue(createOutcome({ cancelled: true }));
    const { performDrop } = useFileDropOperation();

    const didTransferAnyItem = await performDrop(['C:/Source/folder'], 'C:/Target', 'copy');

    expect(didTransferAnyItem).toBe(false);
    expect(refreshSizesAfterCopyMoveMock).not.toHaveBeenCalled();
  });
});
