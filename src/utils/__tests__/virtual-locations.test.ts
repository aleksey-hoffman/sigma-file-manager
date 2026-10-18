// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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
  resolveDirEntry,
  resolveDirectoryContents,
  shouldPrependLocationsCrumb,
  virtualLocationPathExists,
} from '@/utils/virtual-locations';
import type { DriveInfo } from '@/types/drive-info';

// FORK-MODIFICATION 2026-10-18：远程分支的判别点全在「invoke 了哪个 command」上，
// 所以这里必须把 `@tauri-apps/api/core` 换成桩 —— 真实模块在测试环境里没有 IPC。
const { invokeMock } = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

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
      // FORK-MODIFICATION: 验收反馈 2026-10-13 — drive_metadata 补两个字段:
      //   available_space  → UI 显示"磁盘空余空间"(替代 "X 项 · 总容量")
      //   drive_letter_index → 'C:' → 3,供 locations 视图按盘符排序
      available_space: 500,
      drive_letter_index: 3,
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
      expect(getNavigableParentPath('/', 'linux')).toBe(LOCATIONS_VIRTUAL_PATH);
    });

    it('keeps unc network paths outside locations', () => {
      expect(getNavigableParentPath('//server/share', 'windows')).toBe('//server');
      expect(getNavigableParentPath('//server/share/docs', 'windows')).toBe('//server/share');
    });

    it('walks up the remote path family', () => {
      // 改动前：sfm://remote 的父级是本地 getParentPath 算出来的 'sfm:/'，
      // 含 .. 的路径会原样带出 'sfm://remote/conn-a/pub/..' —— 两条都是垃圾路径。
      // 简单嵌套路径改动前碰巧是对的（字符串切分刚好切对），所以下面两条才是判别点。
      expect(getNavigableParentPath('sfm://remote/conn-a/pub/docs', 'windows')).toBe('sfm://remote/conn-a/pub');
      expect(getNavigableParentPath('sfm://remote/conn-a/pub', 'windows')).toBe('sfm://remote/conn-a');
      expect(getNavigableParentPath('sfm://remote/conn-a', 'windows')).toBe('sfm://remote');
      expect(getNavigableParentPath('sfm://remote', 'windows')).toBeNull();
    });

    it('refuses to navigate up from an invalid remote path', () => {
      // `..` 段让 parseRemotePath 返回 null。刻意返回 null 而不是放行到本地解析：
      // canonicalizePath 会把 sfm://remote/... 拆成盘符路径，那是在编造一个
      // 用户从没去过的目录。宁可「无处可上」，阶段 1 的 command 会给出显式错误。
      expect(getNavigableParentPath('sfm://remote/conn-a/pub/../etc', 'windows')).toBeNull();
      expect(getNavigableParentPath('sfm://remote/conn-a/pub/./etc', 'windows')).toBeNull();
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
      expect(shouldPrependLocationsCrumb('/', 'linux')).toBe(true);
    });
  });

  // FORK-MODIFICATION 2026-10-18：远程目录的真实出口（阶段 2 需求 1）。
  //
  // 这是需求 1 的根因所在：改动前 `sfm://remote/...` 一律落到本地 `read_dir`，
  // Rust 拿它去 `fs::metadata` 必然失败，导航器再把失败静默兜底成默认目录 ——
  // 用户看到的就是「点远程连接，右栏变成 C:\Users\...」。
  describe('远程路径分发', () => {
    const remoteContents = {
      path: 'sfm://remote/conn-a',
      entries: [],
      total_count: 0,
      dir_count: 0,
      file_count: 0,
      opened_directory_times: {
        modified_time: 0,
        accessed_time: 0,
        created_time: 0,
      },
    };

    beforeEach(() => {
      invokeMock.mockReset();
    });

    it('远程目录走 remote_read_dir，不再走本地 read_dir', async () => {
      invokeMock.mockResolvedValue(remoteContents);

      const result = await resolveDirectoryContents('sfm://remote/conn-a');

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('remote_read_dir', {
        path: 'sfm://remote/conn-a',
      });
      expect(result).toBe(remoteContents);
    });

    it('remote_read_dir 的结果原样返回（字段名不做二次加工）', async () => {
      const payload = {
        ...remoteContents,
        path: 'sfm://remote/conn-a/pub',
        total_count: 1,
        dir_count: 1,
        entries: [{
          name: 'docs',
          path: 'sfm://remote/conn-a/pub/docs',
          is_file: false,
          is_dir: true,
          is_hidden: false,
          is_symlink: false,
          size: 0,
          item_count: null,
          created_time: 0,
          modified_time: 0,
          accessed_time: 0,
          ext: null,
          mime: null,
        }],
      };
      invokeMock.mockResolvedValue(payload);

      const result = await resolveDirectoryContents('sfm://remote/conn-a/pub');

      expect(result.entries[0]?.path).toBe('sfm://remote/conn-a/pub/docs');
      expect(result.total_count).toBe(1);
    });

    it('不把本地的 readDirOptions 塞给远程 command', async () => {
      // 这些开关（快捷方式目标 / 硬链接计数 / 条目数）远程一个都给不出。
      // 传过去只会让后端多出一堆「收到但必须忽略」的字段。
      invokeMock.mockResolvedValue(remoteContents);

      await resolveDirectoryContents('sfm://remote/conn-a', {
        includeShortcutTargets: true,
        includeHardLinkCounts: true,
      });

      expect(invokeMock).toHaveBeenCalledWith('remote_read_dir', {
        path: 'sfm://remote/conn-a',
      });
    });

    it('远程单个条目走 remote_stat_dir_entry', async () => {
      const entry = {
        name: 'readme.txt',
        path: 'sfm://remote/conn-a/readme.txt',
        is_file: true,
        is_dir: false,
      };
      invokeMock.mockResolvedValue(entry);

      const result = await resolveDirEntry('sfm://remote/conn-a/readme.txt');

      expect(invokeMock).toHaveBeenCalledWith('remote_stat_dir_entry', {
        path: 'sfm://remote/conn-a/readme.txt',
      });
      expect(result).toBe(entry);
    });

    it('远程条目取不到时返回 null，不抛错', async () => {
      // `resolveDirEntry` 的既有契约就是「拿不到给 null」，地址栏自动补全依赖它。
      invokeMock.mockRejectedValue({
        kind: 'not_found',
        message: '没有那个条目',
      });

      await expect(resolveDirEntry('sfm://remote/conn-a/nope')).resolves.toBeNull();
    });

    it('远程目录读失败时原样抛出 RemoteError 载荷', async () => {
      const remoteError = {
        kind: 'auth',
        message: '密码错误',
      };
      invokeMock.mockRejectedValue(remoteError);

      // 不吞错误：导航器要靠它把「密码错」显示给用户，而不是静默跳走。
      await expect(resolveDirectoryContents('sfm://remote/conn-a')).rejects.toBe(remoteError);
    });

    it('本地路径仍然走 read_dir（阳性对照）', async () => {
      // 没有这一条，上面五条全绿也可能是「所有路径都改走远程了」。
      invokeMock.mockResolvedValue(remoteContents);

      await resolveDirectoryContents('C:/Users');

      expect(invokeMock).toHaveBeenCalledWith('read_dir', {
        path: 'C:/Users',
        options: undefined,
      });
    });

    it('本地单个条目仍然走 get_dir_entry_with_timeout（阳性对照）', async () => {
      invokeMock.mockResolvedValue(null);

      await resolveDirEntry('C:/Users', 250);

      expect(invokeMock).toHaveBeenCalledWith('get_dir_entry_with_timeout', {
        path: 'C:/Users',
        timeoutMs: 250,
      });
    });

    it('位置与 WSL 虚拟目录不受远程分支影响（阳性对照）', async () => {
      invokeMock.mockResolvedValue([]);
      await resolveDirectoryContents(LOCATIONS_VIRTUAL_PATH);
      expect(invokeMock).toHaveBeenCalledWith('get_system_drives');

      invokeMock.mockReset();
      invokeMock.mockResolvedValue([]);
      await resolveDirectoryContents(WSL_HOST_VIRTUAL_PATH);
      expect(invokeMock).toHaveBeenCalledWith('get_system_drives');
    });
  });
});
