// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  canDisconnectDriveEntry,
  canDisconnectDriveMetadata,
  getDisconnectDriveTarget,
} from '@/utils/drive-disconnect-policy';

function createNetworkDriveEntry(path = 'Z:/'): DirEntry {
  return {
    name: 'test (Z:)',
    path,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 1000,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
    drive_metadata: {
      drive_type: 'Network',
      is_removable: false,
      is_mounted: true,
      mount_point: 'Z:\\',
      device_path: 'Z:\\',
    },
  };
}

describe('canDisconnectDriveEntry', () => {
  it('shows disconnect for network drive entries using metadata', () => {
    expect(canDisconnectDriveEntry(createNetworkDriveEntry(), 'windows')).toBe(true);
  });

  it('does not show disconnect for regular directories', () => {
    const entry: DirEntry = {
      ...createNetworkDriveEntry('D:/Apps'),
      drive_metadata: undefined,
    };

    expect(canDisconnectDriveEntry(entry, 'windows')).toBe(false);
  });
});

describe('getDisconnectDriveTarget', () => {
  it('builds a backend command target from entry metadata', () => {
    const entry = createNetworkDriveEntry();
    const target = getDisconnectDriveTarget(entry);

    expect(target).toEqual({
      devicePath: 'Z:\\',
      mountPoint: 'Z:\\',
      driveType: 'Network',
    });
  });
});

describe('canDisconnectDriveMetadata', () => {
  it('allows network metadata on every platform', () => {
    expect(canDisconnectDriveMetadata({
      drive_type: 'Network',
      is_removable: false,
      is_mounted: true,
      mount_point: 'Z:\\',
      device_path: 'Z:\\',
    }, 'windows')).toBe(true);
  });

  it('blocks unmounted metadata', () => {
    expect(canDisconnectDriveMetadata({
      drive_type: 'Network',
      is_removable: false,
      is_mounted: false,
      mount_point: 'Z:\\',
      device_path: 'Z:\\',
    }, 'windows')).toBe(false);
  });
});
