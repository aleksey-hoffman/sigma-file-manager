// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 目录树在焦点处于远程目录时切到远程目录树（用户 2026-10-19 反馈第 3 条，
// 以及同日第二次要求「根用设置里的远程目录、标签用连接名」）。

import { describe, expect, it } from 'vitest';
import { resolveRemoteTreeRoot, resolveTreeRoots } from '../remote-tree-roots';

const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
const REMOTE_ROOT = `sfm://remote/${CONN}`;
/** 用户这条连接在设置里的初始目录（WordPress 站点根）。 */
const INITIAL = '/vol1/@team/study_platform/wp_root';
const REMOTE_INITIAL = `${REMOTE_ROOT}/vol1/@team/study_platform/wp_root`;

const DRIVE_PATHS = ['C:/', 'D:/'];
const DRIVE_LABELS = {
  'C:/': 'Win (C:)',
  'D/': 'Program (D:)',
};
const CONNECTIONS = {
  [CONN]: {
    name: '速豹堂',
    initialPath: INITIAL,
  },
};

function resolve(activePath: string | undefined) {
  return resolveTreeRoots({
    activePath,
    drivePaths: DRIVE_PATHS,
    driveLabels: DRIVE_LABELS,
    connectionsById: CONNECTIONS,
  });
}

describe('焦点在本地时：行为一个字没变', () => {
  it.each([
    ['本地盘符', 'C:/Users/Duanyi'],
    ['本地子目录', 'E:/website_sbt/wp-content'],
    ['没有焦点路径', undefined],
    ['空串', ''],
  ])('%s → 树根是盘符，标签原样透传', (_label, activePath) => {
    const result = resolve(activePath);

    expect(result.rootPaths).toEqual(['C:/', 'D:/']);
    // 卷标是 Rust 侧 DriveInfo.name 给的，必须原样传下去。
    expect(result.rootLabels).toEqual({
      'C:/': 'Win (C:)',
      'D/': 'Program (D:)',
    });
  });

  it('本地根的标签是独立副本，改它不影响调用方传进来的对象', () => {
    const result = resolve('C:/');
    result.rootLabels['C:/'] = 'tampered';

    expect(DRIVE_LABELS['C:/']).toBe('Win (C:)');
  });
});

describe('焦点在远程时：根是设置里的那个目录，标签是连接名', () => {
  it('根取 initialPath，不是连接根', () => {
    const result = resolve(`sfm://remote/${CONN}/vol1`);

    // 上一轮这里取的是连接根，理由是「根跟着焦点换会不停重建」。
    // 那个顾虑针对的是「当前目录」；initialPath 是连接配置里的固定值，
    // 只在换连接时才变，重建问题不存在。
    expect(result.rootPaths).toEqual([REMOTE_INITIAL]);
  });

  it('根不随焦点在远端深处移动', () => {
    // 焦点走到 wp_root 下面的第三层，根仍然停在配置目录 ——
    // 这正是「不重建」的保证。
    const deep = `${REMOTE_INITIAL}/wp-content/themes/twentytwentyone`;

    expect(resolve(deep).rootPaths).toEqual([REMOTE_INITIAL]);
  });

  it('标签用连接名，不是连接 id', () => {
    const result = resolve(`sfm://remote/${CONN}/vol1`);

    expect(result.rootLabels).toEqual({ [REMOTE_INITIAL]: '速豹堂' });
  });

  it('盘符此时不再作为根', () => {
    const result = resolve(`sfm://remote/${CONN}/vol1`);

    expect(result.rootPaths).not.toContain('C:/');
    expect(result.rootLabels['C:/']).toBeUndefined();
  });

  it('连接名缺失时退回连接 id，不显示空白', () => {
    const result = resolveTreeRoots({
      activePath: `sfm://remote/${CONN}/vol1`,
      drivePaths: DRIVE_PATHS,
      driveLabels: DRIVE_LABELS,
      connectionsById: {
        [CONN]: {
          name: '',
          initialPath: INITIAL,
        },
      },
    });

    expect(result.rootLabels).toEqual({ [REMOTE_INITIAL]: CONN });
  });

  it('连接名是空白串时也退回连接 id', () => {
    const result = resolveTreeRoots({
      activePath: `sfm://remote/${CONN}/vol1`,
      drivePaths: DRIVE_PATHS,
      driveLabels: DRIVE_LABELS,
      connectionsById: {
        [CONN]: {
          name: '   ',
          initialPath: INITIAL,
        },
      },
    });

    expect(result.rootLabels).toEqual({ [REMOTE_INITIAL]: CONN });
  });
});

describe('resolveRemoteTreeRoot · initialPath 各种拿不到的情况都退回连接根', () => {
  it('配置里没有 initialPath（连接表还没加载完）', () => {
    expect(resolveRemoteTreeRoot(CONN, undefined)).toBe(REMOTE_ROOT);
  });

  it.each([
    ['空串', ''],
    ['远端根', '/'],
    ['多余斜杠', '///'],
    ['词法逃逸 ..', '/vol1/../etc'],
    ['词法逃逸 .', '/vol1/./etc'],
  ])('initialPath = %s 退回连接根', (_label, initialPath) => {
    // 宁可根浅一点，也不要树变成空的。
    expect(resolveRemoteTreeRoot(CONN, initialPath)).toBe(REMOTE_ROOT);
  });

  it('没有尾斜杠的正常值原样接上去', () => {
    expect(resolveRemoteTreeRoot(CONN, '/vol1/@team/study_platform/wp_root'))
      .toBe(REMOTE_INITIAL);
  });

  it('有尾斜杠也归一成同一个根', () => {
    expect(resolveRemoteTreeRoot(CONN, `${INITIAL}/`)).toBe(REMOTE_INITIAL);
  });

  it('非法连接 id 返回 null，由调用方退回盘符', () => {
    expect(resolveRemoteTreeRoot('', '/vol1')).toBeNull();
  });
});

describe('非法连接 id 退回盘符，而不是让树变空', () => {
  it.each([
    ['空连接 id', 'sfm://remote/'],
    ['只有 scheme 没有 id', 'sfm://remote'],
    ['空串', ''],
  ])('%s → 退回盘符', (_label, activePath) => {
    const result = resolveTreeRoots({
      activePath,
      drivePaths: DRIVE_PATHS,
      driveLabels: DRIVE_LABELS,
      connectionsById: CONNECTIONS,
    });

    expect(result.rootPaths).toEqual(['C:/', 'D:/']);
    expect(result.rootLabels).toEqual({
      'C:/': 'Win (C:)',
      'D/': 'Program (D:)',
    });
  });

  it('连接 id 里带斜杠不是非法 —— 它是「另一个连接」', () => {
    // `sfm://remote/a/b` 解析成连接 `a` 的 `/b`，`parseRemotePath` 按首个斜杠切分。
    // 写成「非法」会逼着实现去拒绝一条合法路径，那是把解析器的职责抢过来。
    const result = resolveTreeRoots({
      activePath: 'sfm://remote/a/b',
      drivePaths: DRIVE_PATHS,
      driveLabels: DRIVE_LABELS,
      connectionsById: {
        a: {
          name: 'A 连接',
          initialPath: '/data',
        },
      },
    });

    expect(result.rootPaths).toEqual(['sfm://remote/a/data']);
    expect(result.rootLabels).toEqual({ 'sfm://remote/a/data': 'A 连接' });
  });

  it('连接表里根本没有这条连接时退回连接根，而不是空树', () => {
    const result = resolveTreeRoots({
      activePath: `sfm://remote/${CONN}/vol1`,
      drivePaths: DRIVE_PATHS,
      driveLabels: DRIVE_LABELS,
      connectionsById: {},
    });

    expect(result.rootPaths).toEqual([REMOTE_ROOT]);
    expect(result.rootLabels).toEqual({ [REMOTE_ROOT]: CONN });
  });
});
