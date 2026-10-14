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
import {
  WORKER_DIAGNOSTICS_SETTINGS_KEY,
  createPersistingWorkerDiagnosticSink,
} from '../worker-diagnostic-persistence';
import type { WorkerDiagnostic } from '@/modules/extensions/runtime/worker-diagnostics';

type GetSettings = (
  extensionId: string,
) => Promise<{ customSettings?: Record<string, unknown> } | null>;

type UpdateSettings = (
  extensionId: string,
  settings: { customSettings: Record<string, unknown> },
) => Promise<void>;

function createEntry(stage: string, extensionId = 'test.video'): WorkerDiagnostic {
  return {
    t: '2026-10-13T15:30:00.000Z',
    extensionId,
    stage,
    level: 'info',
    message: `${stage} happened`,
  };
}

describe('worker diagnostic persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves existing custom settings keys when persisting diagnostics', async () => {
    // `updateExtensionSettings` shallow-merges, so `customSettings` is replaced
    // wholesale. Regression guard: reading it without await yields a Promise and
    // would silently wipe the extension's own keys.
    const getExtensionSettings = vi.fn<GetSettings>(async () => ({
      customSettings: {
        __binaries: { ffmpeg: 'D:/tools/ffmpeg.exe' },
        __focus_sync_trace: [{
          node: 'N01.activate.start',
          seq: 1,
        }],
      },
    }));
    const updateExtensionSettings = vi.fn<UpdateSettings>(async () => {});
    const sink = createPersistingWorkerDiagnosticSink(
      {
        getExtensionSettings,
        updateExtensionSettings,
      },
      { flushDelayMs: 10 },
    );

    sink(createEntry('initialize.start'));
    await vi.advanceTimersByTimeAsync(20);

    expect(getExtensionSettings).toHaveBeenCalledWith('test.video');
    expect(updateExtensionSettings).toHaveBeenCalledTimes(1);

    const written = updateExtensionSettings.mock.calls[0][1] as {
      customSettings: Record<string, unknown>;
    };

    expect(written.customSettings.__binaries).toEqual({ ffmpeg: 'D:/tools/ffmpeg.exe' });
    expect(written.customSettings.__focus_sync_trace).toEqual([
      {
        node: 'N01.activate.start',
        seq: 1,
      },
    ]);
    expect(written.customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY]).toEqual([
      createEntry('initialize.start'),
    ]);
  });

  it('coalesces bursts into a single write', async () => {
    const getExtensionSettings = vi.fn<GetSettings>(async () => ({ customSettings: {} }));
    const updateExtensionSettings = vi.fn<UpdateSettings>(async () => {});
    const sink = createPersistingWorkerDiagnosticSink(
      {
        getExtensionSettings,
        updateExtensionSettings,
      },
      { flushDelayMs: 10 },
    );

    sink(createEntry('initialize.start'));
    sink(createEntry('initialize.ok'));
    sink(createEntry('activate.start'));
    await vi.advanceTimersByTimeAsync(20);

    expect(updateExtensionSettings).toHaveBeenCalledTimes(1);

    const written = updateExtensionSettings.mock.calls[0][1] as {
      customSettings: Record<string, unknown>;
    };

    expect(written.customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY]).toHaveLength(3);
  });

  it('still records diagnostics when the extension has no settings yet', async () => {
    const getExtensionSettings = vi.fn<GetSettings>(async () => null);
    const updateExtensionSettings = vi.fn<UpdateSettings>(async () => {});
    const sink = createPersistingWorkerDiagnosticSink(
      {
        getExtensionSettings,
        updateExtensionSettings,
      },
      { flushDelayMs: 10 },
    );

    sink(createEntry('load.fail', 'test.missing'));
    await vi.advanceTimersByTimeAsync(20);

    expect(updateExtensionSettings).toHaveBeenCalledTimes(1);

    const written = updateExtensionSettings.mock.calls[0][1] as {
      customSettings: Record<string, unknown>;
    };

    expect(written.customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY]).toEqual([
      createEntry('load.fail', 'test.missing'),
    ]);
  });

  it('never throws when the persistence write fails', async () => {
    const getExtensionSettings = vi.fn<GetSettings>(async () => ({ customSettings: {} }));
    const updateExtensionSettings = vi.fn<UpdateSettings>(async () => {
      throw new Error('disk full');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = createPersistingWorkerDiagnosticSink(
      {
        getExtensionSettings,
        updateExtensionSettings,
      },
      { flushDelayMs: 10 },
    );

    expect(() => sink(createEntry('load.fail'))).not.toThrow();
    await vi.advanceTimersByTimeAsync(20);

    expect(updateExtensionSettings).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('keeps only the most recent entries', async () => {
    const getExtensionSettings = vi.fn<GetSettings>(async () => ({ customSettings: {} }));
    const updateExtensionSettings = vi.fn<UpdateSettings>(async () => {});
    const sink = createPersistingWorkerDiagnosticSink(
      {
        getExtensionSettings,
        updateExtensionSettings,
      },
      {
        flushDelayMs: 10,
        maxPersistedEntries: 2,
      },
    );

    sink(createEntry('one'));
    await vi.advanceTimersByTimeAsync(20);
    sink(createEntry('two'));
    sink(createEntry('three'));
    await vi.advanceTimersByTimeAsync(20);

    const written = updateExtensionSettings.mock.calls[1][1] as {
      customSettings: Record<string, unknown>;
    };

    expect(written.customSettings[WORKER_DIAGNOSTICS_SETTINGS_KEY]).toEqual([
      createEntry('two'),
      createEntry('three'),
    ]);
  });
});
