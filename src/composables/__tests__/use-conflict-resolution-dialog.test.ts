// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ConflictItem } from '@/stores/runtime/clipboard';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

import { useConflictResolutionDialog } from '@/composables/use-conflict-resolution-dialog';

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
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

function createConflictItem(): ConflictItem {
  return {
    source_path: '/source/file.txt',
    source_name: 'file.txt',
    source_is_dir: false,
    source_size: 12,
    source_modified_ms: 100,
    destination_path: '/target/file.txt',
    destination_is_dir: false,
    destination_size: 10,
    destination_modified_ms: 90,
    relative_path: 'file.txt',
  };
}

describe('useConflictResolutionDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not open the dialog when a no-conflict check finishes before the delay', async () => {
    const deferredConflicts = createDeferred<ConflictItem[]>();
    const { conflictDialogState, showConflictDialog } = useConflictResolutionDialog();

    const resolutionPromise = showConflictDialog('copy', () => deferredConflicts.promise);

    expect(conflictDialogState.value.isOpen).toBe(false);
    expect(conflictDialogState.value.isCheckingConflicts).toBe(true);

    await vi.advanceTimersByTimeAsync(149);
    expect(conflictDialogState.value.isOpen).toBe(false);

    deferredConflicts.resolve([]);

    await expect(resolutionPromise).resolves.toBeUndefined();
    expect(conflictDialogState.value.isOpen).toBe(false);
    expect(conflictDialogState.value.isCheckingConflicts).toBe(false);
  });

  it('shows a loading dialog when conflict detection takes longer than the delay', async () => {
    const deferredConflicts = createDeferred<ConflictItem[]>();
    const conflictItem = createConflictItem();
    const {
      conflictDialogState,
      showConflictDialog,
      handleConflictCancel,
    } = useConflictResolutionDialog();

    const resolutionPromise = showConflictDialog('move', () => deferredConflicts.promise);

    await vi.advanceTimersByTimeAsync(150);

    expect(conflictDialogState.value.isOpen).toBe(true);
    expect(conflictDialogState.value.isCheckingConflicts).toBe(true);

    deferredConflicts.resolve([conflictItem]);
    await Promise.resolve();

    expect(conflictDialogState.value.isOpen).toBe(true);
    expect(conflictDialogState.value.isCheckingConflicts).toBe(false);
    expect(conflictDialogState.value.conflicts).toEqual([conflictItem]);

    handleConflictCancel();

    await expect(resolutionPromise).resolves.toBeNull();
  });

  it('opens immediately with conflicts when the check finishes before the delay', async () => {
    const conflictItem = createConflictItem();
    const {
      conflictDialogState,
      showConflictDialog,
      handleConflictResolution,
    } = useConflictResolutionDialog();

    const resolutionPromise = showConflictDialog('copy', async () => [conflictItem]);

    await Promise.resolve();

    expect(conflictDialogState.value.isOpen).toBe(true);
    expect(conflictDialogState.value.isCheckingConflicts).toBe(false);
    expect(conflictDialogState.value.conflicts).toEqual([conflictItem]);

    handleConflictResolution({
      perPathResolutions: [
        {
          destination_path: conflictItem.destination_path,
          resolution: 'replace',
        },
      ],
    });

    await expect(resolutionPromise).resolves.toEqual({
      perPathResolutions: [
        {
          destination_path: conflictItem.destination_path,
          resolution: 'replace',
        },
      ],
    });
  });

  it('ignores stale async results after the dialog has been cancelled', async () => {
    const deferredConflicts = createDeferred<ConflictItem[]>();
    const { conflictDialogState, showConflictDialog, handleConflictCancel } = useConflictResolutionDialog();

    const resolutionPromise = showConflictDialog('copy', () => deferredConflicts.promise);

    await vi.advanceTimersByTimeAsync(150);
    handleConflictCancel();

    deferredConflicts.resolve([createConflictItem()]);
    await Promise.resolve();

    await expect(resolutionPromise).resolves.toBeNull();
    expect(conflictDialogState.value.isOpen).toBe(false);
    expect(conflictDialogState.value.conflicts).toEqual([]);
  });

  it('reports conflict check failures and resolves as cancelled', async () => {
    const { conflictDialogState, showConflictDialog } = useConflictResolutionDialog();
    const resolutionPromise = showConflictDialog('copy', async () => {
      throw new Error('failed');
    });

    await expect(resolutionPromise).resolves.toBeNull();
    expect(conflictDialogState.value.isOpen).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith('notifications.conflictCheckFailed');
  });
});
