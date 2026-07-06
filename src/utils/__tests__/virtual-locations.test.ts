// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  LOCATIONS_VIRTUAL_PATH,
  WSL_HOST_VIRTUAL_PATH,
  buildLocationsDirectoryFromDrives,
  buildVirtualDirectoryFromDrives,
  buildWslHostDirectoryFromDrives,
  createLocationsDirEntry,
  driveInfoToDirEntry,
  getLocationsDriveListDisplaySignature,
  getLocationsEntriesDisplaySignature,
  getNavigableParentPath,
  getVirtualLocationDisplayName,
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  isWslHostVirtualPath,
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

  it('detects the wsl host virtual path', () => {
    expect(isWslHostVirtualPath('//wsl.localhost')).toBe(true);
    expect(isWslHostVirtualPath('//wsl.localhost/')).toBe(true);
    expect(isWslHostVirtualPath('//wsl$')).toBe(true);
    expect(isVirtualDirectoryPath('//wsl.localhost')).toBe(true);
    expect(isWslHostVirtualPath('//wsl.localhost/Ubuntu')).toBe(false);
    expect(virtualLocationPathExists('//wsl.localhost/')).toBe(true);
  });

  it('returns display names for virtual directories', () => {
    expect(getVirtualLocationDisplayName('sfm://locations', key => `t:${key}`)).toBe('t:locations');
    expect(getVirtualLocationDisplayName('//wsl.localhost', key => `t:${key}`)).toBe('wsl.localhost');
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
      is_mounted: true,
      mount_point: 'C:\\',
      device_path: '\\\\.\\C:',
    });
    expect(driveEntry.item_count).toBeNull();
  });

  it('builds locations directory contents from drive snapshots', () => {
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

    const contents = buildLocationsDirectoryFromDrives([drivePayload]);

    expect(contents.path).toBe(LOCATIONS_VIRTUAL_PATH);
    expect(contents.entries).toHaveLength(1);
    expect(contents.entries[0]?.path).toBe('C:/');
  });

  it('keeps wsl distribution drives flat in locations', () => {
    const localDrive: DriveInfo = {
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
    const wslDrive: DriveInfo = {
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
      device_path: '//wsl.localhost/Ubuntu-24.04/',
    };

    const contents = buildLocationsDirectoryFromDrives([localDrive, wslDrive]);

    expect(contents.entries.map(entry => entry.path)).toEqual([
      'C:/',
      '//wsl.localhost/Ubuntu-24.04/',
    ]);
    expect(contents.entries[1]?.item_count).toBeNull();
  });

  it('builds wsl host directory contents from wsl distribution drives only', () => {
    const localDrive: DriveInfo = {
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
    const wslDrive: DriveInfo = {
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
      device_path: '//wsl.localhost/Ubuntu-24.04/',
    };
    const contents = buildWslHostDirectoryFromDrives([localDrive, wslDrive]);

    expect(contents.path).toBe(WSL_HOST_VIRTUAL_PATH);
    expect(contents.entries).toHaveLength(1);
    expect(contents.entries[0]?.path).toBe('//wsl.localhost/Ubuntu-24.04/');
  });

  it('builds virtual directories from drive snapshots by path', () => {
    const wslDrive: DriveInfo = {
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
      device_path: '//wsl.localhost/Ubuntu-24.04/',
    };

    const locationsContents = buildVirtualDirectoryFromDrives(LOCATIONS_VIRTUAL_PATH, [wslDrive]);

    expect(locationsContents?.path).toBe(LOCATIONS_VIRTUAL_PATH);
    expect(locationsContents?.entries[0]?.path).toBe('//wsl.localhost/Ubuntu-24.04/');
    expect(buildVirtualDirectoryFromDrives(WSL_HOST_VIRTUAL_PATH, [wslDrive])?.path)
      .toBe(WSL_HOST_VIRTUAL_PATH);
    expect(buildVirtualDirectoryFromDrives('C:/', [wslDrive])).toBeNull();
  });

  it('detects drive metadata changes in locations display signatures', () => {
    const baseDrive: DriveInfo = {
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

    const renamedDrive = {
      ...baseDrive,
      name: 'System (C:)',
    };
    const resizedDrive = {
      ...baseDrive,
      total_space: 2000,
    };
    const entries = buildLocationsDirectoryFromDrives([baseDrive]).entries;
    const baseSignature = getLocationsDriveListDisplaySignature([baseDrive]);

    expect(getLocationsEntriesDisplaySignature(entries)).toBe(baseSignature);
    expect(getLocationsDriveListDisplaySignature([renamedDrive])).not.toBe(baseSignature);
    expect(getLocationsDriveListDisplaySignature([resizedDrive])).not.toBe(baseSignature);
  });

  describe('getNavigableParentPath', () => {
    it('returns null for the virtual locations path', () => {
      expect(getNavigableParentPath('sfm://locations', 'windows')).toBeNull();
    });

    it('maps windows drive roots and wsl mount roots to locations', () => {
      expect(getNavigableParentPath('C:/', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('C:/Users', 'windows')).toBe('C:/');
      expect(getNavigableParentPath('//wsl.localhost', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('//wsl$', 'windows')).toBe(LOCATIONS_VIRTUAL_PATH);
      expect(getNavigableParentPath('//wsl.localhost/Ubuntu', 'windows')).toBe('//wsl.localhost');
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
