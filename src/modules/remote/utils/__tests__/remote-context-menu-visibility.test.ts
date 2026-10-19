// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import type { RemoteProtocol } from '@/types/remote';
import {
  areAllLocalEntries,
  areAllRemoteEntries,
  isRemoteTransferActionVisible,
  protocolSupportsPermissions,
  resolveSelectionProtocol,
} from '../remote-context-menu-visibility';

// 这三个动作的前提不是「选中的是不是远程条目」，而是**对面还有没有一格**。
// 判错了两种后果都很难看：不该出现的出现了（点了没反应），
// 该出现的没出现（用户找不到功能）。

function makeEntry(path: string, isDir = false): DirEntry {
  return {
    name: path.split('/').pop() ?? path,
    ext: null,
    path,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: !isDir,
    is_dir: isDir,
    is_symlink: false,
    is_hidden: false,
  };
}

const LOCAL_FILE = makeEntry('C:/Users/Duanyi/notes.txt');
const LOCAL_DIR = makeEntry('C:/Users/Duanyi/project', true);
const REMOTE_FILE = makeEntry('sfm://remote/conn-1/docs/readme.md');
const REMOTE_DIR = makeEntry('sfm://remote/conn-1/docs', true);

describe('protocolSupportsPermissions', () => {
  it('只有 SFTP 支持改权限', () => {
    expect(protocolSupportsPermissions('sftp')).toBe(true);
  });

  it('FTP 与两种 FTPS 都不支持', () => {
    expect(protocolSupportsPermissions('ftp')).toBe(false);
    expect(protocolSupportsPermissions('ftps_explicit')).toBe(false);
    expect(protocolSupportsPermissions('ftps_implicit')).toBe(false);
  });

  it('协议未知时按不支持处理', () => {
    expect(protocolSupportsPermissions(undefined)).toBe(false);
  });
});

describe('areAllRemoteEntries / areAllLocalEntries', () => {
  it('全远程 / 全本地分别判定', () => {
    expect(areAllRemoteEntries([REMOTE_FILE, REMOTE_DIR])).toBe(true);
    expect(areAllRemoteEntries([REMOTE_FILE, LOCAL_FILE])).toBe(false);
    expect(areAllLocalEntries([LOCAL_FILE, LOCAL_DIR])).toBe(true);
    expect(areAllLocalEntries([LOCAL_FILE, REMOTE_FILE])).toBe(false);
  });

  it('空选区不算「全是」—— 没有条目就没法谈方向', () => {
    expect(areAllRemoteEntries([])).toBe(false);
    expect(areAllLocalEntries([])).toBe(false);
  });
});

describe('isRemoteTransferActionVisible', () => {
  it('本地条目 + 对面有远程格 —— 上传出现', () => {
    expect(
      isRemoteTransferActionVisible(
        'upload-to-remote',
        [LOCAL_FILE, LOCAL_DIR],
        {
          hasRemoteCounterpart: true,
          hasLocalCounterpart: false,
        },
      ),
    ).toBe(true);
  });

  it('对面没有远程格 —— 上传不出现', () => {
    expect(
      isRemoteTransferActionVisible('upload-to-remote', [LOCAL_FILE], {
        hasRemoteCounterpart: false,
        hasLocalCounterpart: true,
      }),
    ).toBe(false);
  });

  it('选中的是远程条目 —— 上传不出现', () => {
    expect(
      isRemoteTransferActionVisible('upload-to-remote', [REMOTE_FILE], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
      }),
    ).toBe(false);
  });

  it('远程条目 + 对面有本地格 —— 下载出现', () => {
    expect(
      isRemoteTransferActionVisible('download-to-local', [REMOTE_FILE, REMOTE_DIR], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
      }),
    ).toBe(true);
  });

  it('对面没有本地格 —— 下载不出现', () => {
    expect(
      isRemoteTransferActionVisible('download-to-local', [REMOTE_FILE], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: false,
      }),
    ).toBe(false);
  });

  it('远程条目 + SFTP —— 权限设置出现', () => {
    expect(
      isRemoteTransferActionVisible('remote-permissions', [REMOTE_FILE], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
        selectionProtocol: 'sftp',
      }),
    ).toBe(true);
  });

  it('远程条目 + FTP —— 权限设置不出现（置灰而不是点了报错）', () => {
    expect(
      isRemoteTransferActionVisible('remote-permissions', [REMOTE_FILE], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
        selectionProtocol: 'ftp',
      }),
    ).toBe(false);
  });

  it('本地条目 —— 权限设置不出现', () => {
    expect(
      isRemoteTransferActionVisible('remote-permissions', [LOCAL_FILE], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
        selectionProtocol: 'sftp',
      }),
    ).toBe(false);
  });

  it('多选远程条目 —— 权限设置不出现（后端只收一个路径）', () => {
    expect(
      isRemoteTransferActionVisible('remote-permissions', [REMOTE_FILE, REMOTE_DIR], {
        hasRemoteCounterpart: true,
        hasLocalCounterpart: true,
        selectionProtocol: 'sftp',
      }),
    ).toBe(false);
  });

  it('本地与远程混选 —— 三个动作全部不出现', () => {
    const options = {
      hasRemoteCounterpart: true,
      hasLocalCounterpart: true,
      selectionProtocol: 'sftp' as RemoteProtocol,
    };

    expect(isRemoteTransferActionVisible('upload-to-remote', [LOCAL_FILE, REMOTE_FILE], options)).toBe(false);
    expect(isRemoteTransferActionVisible('download-to-local', [LOCAL_FILE, REMOTE_FILE], options)).toBe(false);
    expect(isRemoteTransferActionVisible('remote-permissions', [LOCAL_FILE, REMOTE_FILE], options)).toBe(false);
  });

  it('空选区 —— 三个动作全部不出现', () => {
    const options = {
      hasRemoteCounterpart: true,
      hasLocalCounterpart: true,
      selectionProtocol: 'sftp' as RemoteProtocol,
    };

    expect(isRemoteTransferActionVisible('upload-to-remote', [], options)).toBe(false);
    expect(isRemoteTransferActionVisible('download-to-local', [], options)).toBe(false);
    expect(isRemoteTransferActionVisible('remote-permissions', [], options)).toBe(false);
  });
});

describe('resolveSelectionProtocol', () => {
  it('同一连接返回该连接的协议', () => {
    const protocols: Record<string, RemoteProtocol> = { 'conn-1': 'sftp' };

    expect(resolveSelectionProtocol([REMOTE_FILE, REMOTE_DIR], id => protocols[id])).toBe('sftp');
  });

  it('混了不同协议时取最严格的那个 —— 只要有一个不能改权限，整体就不能改', () => {
    const protocols: Record<string, RemoteProtocol> = {
      'conn-1': 'sftp',
      'conn-2': 'ftp',
    };

    expect(
      resolveSelectionProtocol(
        [REMOTE_FILE, makeEntry('sfm://remote/conn-2/a.txt')],
        id => protocols[id],
      ),
    ).toBe('ftp');
  });

  it('本地条目不参与判定', () => {
    const protocols: Record<string, RemoteProtocol> = { 'conn-1': 'sftp' };

    expect(resolveSelectionProtocol([LOCAL_FILE, REMOTE_FILE], id => protocols[id])).toBe('sftp');
  });

  it('全部是本地条目时返回 undefined', () => {
    expect(resolveSelectionProtocol([LOCAL_FILE], () => 'sftp')).toBeUndefined();
  });

  it('连接 id 查不到协议时跳过该条目', () => {
    expect(resolveSelectionProtocol([REMOTE_FILE], () => undefined)).toBeUndefined();
  });
});
