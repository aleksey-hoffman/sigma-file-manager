// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  LOCATIONS_VIRTUAL_PATH,
  createLocationsDirEntry,
  driveInfoToDirEntry,
  getNavigableParentPath,
  getVirtualLocationDisplayName,
  isVirtualLocationPath,
  shouldPrependLocationsCrumb,
  virtualLocationPathExists,
} from '@/utils/virtual-locations';
import type { DriveInfo } from '@/types/drive-info';

describe('virtual-locations', () => {
  it('detects the locations virtual path', () => {
    expect(isVirtualLocationPath('sfm://locations')).toBe(true);
    expect(virtualLocationPathExists('sfm://locations')).toBe(true);
    expect(isVirtualLocationPath('C:/Users')).toBe(false);
  });

  it('returns the localized display name for virtual locations', () => {
    expect(getVirtualLocationDisplayName('sfm://locations', key => `t:${key}`)).toBe('t:locations');
    expect(getVirtualLocationDisplayName('C:/', key => `t:${key}`)).toBeNull();
  });

  it('creates a locations dir entry and drive dir entries', () => {
    const locationsEntry = createLocationsDirEntry();
    expect(locationsEntry.path).toBe(LOCATIONS_VIRTUAL_PATH);
    expect(locationsEntry.is_dir).toBe(true);

    const drivePayload: DriveInfo = {
      name: 'Local Disk (C:)',
      path: 'C:/',
      mount_point: 'C:\\',
      file_system: 'NTFS',
      drive_type: 'SSD',
      total_space: 1000,
      available_space: 500,
      used_space: 500,
      percent_used: 50,
      is_removable: false,
      is_read_only: false,
      is_mounted: true,
      device_path: '\\\\.\\C:',
    };

    const driveEntry = driveInfoToDirEntry(drivePayload);
    expect(driveEntry.path).toBe('C:/');
    expect(driveEntry.name).toBe('Local Disk (C:)');
    expect(driveEntry.is_dir).toBe(true);
    expect(driveEntry.size).toBe(1000);
    expect(driveEntry.drive_metadata).toEqual({
      drive_type: 'SSD',
      is_removable: false,
    });
    expect(driveEntry.item_count).toBeNull();
  });

  describe('getNavigableParentPath', () => {
    it('returns null for the virtual locations path', () => {
      expect(getNavigableParentPath('sfm://locations', 'windows')).toBeNull();
    });

    it('maps windows drive roots and wsl mount roots to locations', () => {
      expect(getNavigableParentPath('C:/', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('C:/Users', 'windows')).toBe('C:/');
      expect(getNavigableParentPath('//wsl.localhost', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('//wsl.localhost/Ubuntu', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('//wsl.localhost/Ubuntu/home', 'windows')).toBe('//wsl.localhost/Ubuntu');
    });

    it('maps unix mount roots to locations', () => {
      expect(getNavigableParentPath('/Volumes/MyDisk', 'macos')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('/Volumes/MyDisk/Documents', 'macos')).toBe('/Volumes/MyDisk');
      expect(getNavigableParentPath('/home/user', 'linux')).toBe('/home');
    });

    it('keeps unc network paths outside locations', () => {
      expect(getNavigableParentPath('//server/share', 'windows')).toBe('//server');
      expect(getNavigableParentPath('//server/share/docs', 'windows')).toBe('//server/share');
    });
  });

  describe('shouldPrependLocationsCrumb', () => {
    it('prepends for locations and windows drive paths', () => {
      expect(shouldPrependLocationsCrumb('sfm://locations', 'windows')).toBe(true);
      expect(shouldPrependLocationsCrumb('C:/Users', 'windows')).toBe(true);
      expect(shouldPrependLocationsCrumb('//wsl.localhost/Ubuntu/home', 'windows')).toBe(true);
    });

    it('does not prepend for unc network paths or unix home paths', () => {
      expect(shouldPrependLocationsCrumb('//server/share/docs', 'windows')).toBe(false);
      expect(shouldPrependLocationsCrumb('/home/user', 'linux')).toBe(false);
    });

    it('prepends for unix system mount paths', () => {
      expect(shouldPrependLocationsCrumb('/Volumes/MyDisk', 'macos')).toBe(true);
      expect(shouldPrependLocationsCrumb('/media/user/disk', 'linux')).toBe(true);
    });
  });
});
