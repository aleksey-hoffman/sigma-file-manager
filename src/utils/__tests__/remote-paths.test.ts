// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 本文件是 `src-tauri/src/remote/path.rs` 里同名测试的逐条镜像。
// 两边必须同时通过同一组断言 —— 这是整个功能唯一的跨语言共享契约，
// 任何一侧改了规范化规则而另一侧没跟上，阶段 2 之后才会以「点不进去」的形式暴露。

import { describe, expect, it } from 'vitest';
import {
  buildRemoteConnectionPath,
  buildRemotePath,
  getRemoteParentPath,
  isRemoteConnectionRootPath,
  isRemotePath,
  normalizeRemotePath,
  parseRemotePath,
  REMOTE_SCHEME,
} from '@/utils/remote-paths';

describe('remote-paths', () => {
  it('parses connection root and nested paths', () => {
    expect(parseRemotePath('sfm://remote/conn-a')).toEqual({
      connectionId: 'conn-a',
      remotePath: '/',
    });
    expect(parseRemotePath('sfm://remote/conn-a/')).toEqual({
      connectionId: 'conn-a',
      remotePath: '/',
    });
    expect(parseRemotePath('sfm://remote/conn-a/pub')).toEqual({
      connectionId: 'conn-a',
      remotePath: '/pub',
    });
    expect(parseRemotePath('sfm://remote/conn-a/pub/docs/')).toEqual({
      connectionId: 'conn-a',
      remotePath: '/pub/docs',
    });
  });

  it('collapses repeated slashes', () => {
    expect(parseRemotePath('sfm://remote/conn-a/pub//docs'))
      .toEqual({
        connectionId: 'conn-a',
        remotePath: '/pub/docs',
      });
  });

  it('rejects dot and dot-dot segments', () => {
    expect(parseRemotePath('sfm://remote/conn-a/pub/./docs')).toBeNull();
    expect(parseRemotePath('sfm://remote/conn-a/pub/../etc')).toBeNull();
  });

  it('rejects scheme root and empty connection id', () => {
    expect(parseRemotePath('sfm://remote')).toBeNull();
    expect(parseRemotePath('sfm://remote/')).toBeNull();
    expect(parseRemotePath('sfm://remote//pub')).toBeNull();
    expect(parseRemotePath('sfm://remotex/conn-a')).toBeNull();
    expect(parseRemotePath('C:/Users')).toBeNull();
  });

  it('detects the scheme prefix independently of validity', () => {
    expect(isRemotePath('sfm://remote')).toBe(true);
    expect(isRemotePath('sfm://remote/conn-a/pub/../x')).toBe(true);
    expect(isRemotePath('sfm://locations')).toBe(false);
    expect(isRemotePath('C:/Users')).toBe(false);
  });

  it('builds canonical paths', () => {
    expect(buildRemotePath('conn-a', '')).toBe('sfm://remote/conn-a');
    expect(buildRemotePath('conn-a', '/')).toBe('sfm://remote/conn-a');
    expect(buildRemotePath('conn-a', '/pub/docs/')).toBe('sfm://remote/conn-a/pub/docs');
    expect(buildRemotePath('', '/pub')).toBeNull();
    expect(buildRemotePath('a/b', '/pub')).toBeNull();
    expect(buildRemotePath('a\\b', '/pub')).toBeNull();
    expect(buildRemoteConnectionPath('conn-a')).toBe('sfm://remote/conn-a');
    expect(buildRemoteConnectionPath('')).toBeNull();
  });

  it('normalizes remote paths without a connection id', () => {
    expect(normalizeRemotePath('')).toBe('/');
    expect(normalizeRemotePath('/')).toBe('/');
    expect(normalizeRemotePath('pub')).toBe('/pub');
    expect(normalizeRemotePath('/pub/docs/')).toBe('/pub/docs');
    expect(normalizeRemotePath('pub//docs')).toBe('/pub/docs');
    expect(normalizeRemotePath('/中文目录/')).toBe('/中文目录');
    expect(normalizeRemotePath('/pub/../etc')).toBeNull();
    expect(normalizeRemotePath('./x')).toBeNull();
  });

  it('round trips build and parse', () => {
    for (const remote of ['/', '/pub', '/pub/docs', '/中文目录/文件 1.txt']) {
      const built = buildRemotePath('conn-a', remote);
      expect(built).not.toBeNull();
      expect(parseRemotePath(built as string)).toEqual({
        connectionId: 'conn-a',
        remotePath: remote,
      });
    }
  });

  it('keeps unicode and spaces verbatim', () => {
    expect(buildRemotePath('conn-a', '/中文目录/文件 1.txt')).toBe('sfm://remote/conn-a/中文目录/文件 1.txt');
    expect(parseRemotePath('sfm://remote/conn-a/中文目录/文件 1.txt'))
      .toEqual({
        connectionId: 'conn-a',
        remotePath: '/中文目录/文件 1.txt',
      });
  });

  it('walks up to the scheme root', () => {
    expect(getRemoteParentPath('sfm://remote/conn-a/pub/docs')).toBe('sfm://remote/conn-a/pub');
    expect(getRemoteParentPath('sfm://remote/conn-a/pub')).toBe('sfm://remote/conn-a');
    expect(getRemoteParentPath('sfm://remote/conn-a')).toBe('sfm://remote');
    expect(getRemoteParentPath('sfm://remote')).toBeNull();
    expect(getRemoteParentPath('C:/Users')).toBeNull();
  });

  it('detects connection roots', () => {
    expect(isRemoteConnectionRootPath('sfm://remote/conn-a')).toBe(true);
    expect(isRemoteConnectionRootPath('sfm://remote/conn-a/')).toBe(true);
    expect(isRemoteConnectionRootPath('sfm://remote')).toBe(false);
    expect(isRemoteConnectionRootPath('sfm://remote/conn-a/pub')).toBe(false);
    expect(isRemoteConnectionRootPath('C:/Users')).toBe(false);
  });

  it('exposes the same scheme string the backend uses', () => {
    expect(REMOTE_SCHEME).toBe('sfm://remote');
  });
});
