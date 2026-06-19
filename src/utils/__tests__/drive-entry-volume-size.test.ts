// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { getDriveEntryVolumeSizeBytes } from '@/utils/drive-icon';
import { driveInfoToDirEntry } from '@/utils/virtual-locations';
import type { DriveInfo } from '@/types/drive-info';

describe('getDriveEntryVolumeSizeBytes', () => {
  it('returns total space for drive dir entries', () => {
    const drivePayload: DriveInfo = {
      name: 'Storage (D:)',
      path: 'D:/',
      mount_point: 'D:\\',
      file_system: 'NTFS',
      drive_type: 'SSD',
      total_space: 1_000_000_000_000,
      available_space: 500_000_000_000,
      used_space: 500_000_000_000,
      percent_used: 50,
      is_removable: false,
      is_read_only: false,
      is_mounted: true,
      device_path: '\\\\.\\D:',
    };

    const driveEntry = driveInfoToDirEntry(drivePayload);

    expect(getDriveEntryVolumeSizeBytes(driveEntry)).toBe(1_000_000_000_000);
  });

  it('returns null for regular directories and drives without space data', () => {
    const regularDirectory: DirEntry = {
      name: 'Apps',
      path: 'D:/Apps',
      is_file: false,
      is_dir: true,
      is_hidden: false,
      is_symlink: false,
      size: 0,
      item_count: null,
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
      ext: null,
      mime: null,
    };

    const directoryWithSizeButNoDriveMetadata: DirEntry = {
      ...regularDirectory,
      size: 1_000_000_000_000,
    };

    const wslDrive = driveInfoToDirEntry({
      name: 'Ubuntu-24.04',
      path: '//wsl.localhost/Ubuntu-24.04/',
      mount_point: '//wsl.localhost/Ubuntu-24.04/',
      file_system: 'WSL',
      drive_type: 'WSL',
      total_space: 0,
      available_space: 0,
      used_space: 0,
      percent_used: 0,
      is_removable: false,
      is_read_only: false,
      is_mounted: true,
      device_path: '',
    });

    expect(getDriveEntryVolumeSizeBytes(regularDirectory)).toBeNull();
    expect(getDriveEntryVolumeSizeBytes(directoryWithSizeButNoDriveMetadata)).toBeNull();
    expect(getDriveEntryVolumeSizeBytes(wslDrive)).toBeNull();
  });
});
