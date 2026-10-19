// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-19：目录树的「根」与「选中路径」必须同源。
//
// 用户第三次反馈（2026-10-19 19:47 之后）：「远程目录树仍然不正常」。
// 真机装包实测抓到的画面是：**远程格已经激活**（右格面包屑是
// `y_platform / wp_root`），可**树里还是 Win (C:) / Program (D:) / Office (E:) …，
// 一个都没展开**。
//
// 根因是接线分家：
//   - 根       → `activeFolderSettingsPath`（tab 上的**存档**路径）
//   - 选中路径 → `activePaneLivePath`（窗格的**实时**路径）
// 两者不一致时，树会自相矛盾：根是本地盘符，选中路径却是远程的，
// 远程那一层**根本不在树里** —— 展开、定位全都无从谈起。
//
// 这组测试钉两件事：
//   1. 行为：统一取源后，远程格激活时根是远程根、选中路径落在那棵树上；
//   2. 接线：`navigator.vue` 里两处消费者读的是**同一个**变量（源码级守卫）。
//      纯函数测不出「谁把谁换了」，而这正是这次翻车的形式。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveTreeActivePath,
  resolveTreeRoots,
  shouldDriveTreeSelection,
} from '@/modules/navigator/utils/remote-tree-roots';

const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
const REMOTE_INITIAL = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
const REMOTE_CWD = `${REMOTE_INITIAL}/wp-content`;

const DRIVE_PATHS = ['C:/', 'D:/', 'E:/'];
const DRIVE_LABELS = {
  'C:/': 'Win (C:)',
  'D:/': 'Program (D:)',
  'E:/': 'Office (E:)',
};
const CONNECTIONS = {
  [CONN]: {
    name: '速豹堂',
    initialPath: '/vol1/@team/study_platform/wp_root',
  },
};

function rootsFor(activePath: string | undefined) {
  return resolveTreeRoots({
    activePath,
    drivePaths: DRIVE_PATHS,
    driveLabels: DRIVE_LABELS,
    connectionsById: CONNECTIONS,
  });
}

describe('统一取源：树的根与选中路径必须落在同一棵树上', () => {
  it('实时路径优先于 tab 的存档路径（存档路径还没追上时尤其重要）', () => {
    // 真机画面：远程格是实时的，tab 上存的却还是本地路径。
    const live = REMOTE_CWD;
    const stale = 'E:/website_sbt/wp-content';

    expect(resolveTreeActivePath(live, stale)).toBe(live);
  });

  it('远程格激活时：根是远程根，且选中路径就在那棵树上', () => {
    const active = resolveTreeActivePath(REMOTE_CWD, 'E:/website_sbt/wp-content');
    const roots = rootsFor(active);

    expect(roots.rootPaths).toEqual([REMOTE_INITIAL]);
    expect(roots.rootLabels).toEqual({ [REMOTE_INITIAL]: '速豹堂' });

    // ⭐ 关键：选中路径必须落在根之下 —— 否则树里根本没有这一层，
    // 展开与定位都无从谈起（这正是真机看到的症状）。
    expect(active!.startsWith(`${REMOTE_INITIAL}/`)).toBe(true);
  });

  it('反过来：统一取源之前的老行为，根是本地盘符、选中路径却不在树上', () => {
    // 这是「修之前」的样子，把它钉在这里当反面教材：
    // 根按存档路径算（本地），选中路径按实时路径算（远程）→ 两棵树。
    const stale = 'E:/website_sbt/wp-content';
    const roots = rootsFor(stale);

    expect(roots.rootPaths).toEqual(DRIVE_PATHS);

    const live = REMOTE_CWD;
    const liveIsUnderAnyRoot = roots.rootPaths.some(
      root => live === root || live.startsWith(`${root}/`),
    );

    expect(liveIsUnderAnyRoot, '选中路径不在树里 —— 树必然自相矛盾').toBe(false);
  });

  it('单格模式（没有实时路径）退回 tab 路径，行为与改动前一致', () => {
    expect(resolveTreeActivePath(null, 'E:/website_sbt/wp-content'))
      .toBe('E:/website_sbt/wp-content');
    expect(resolveTreeActivePath(undefined, undefined)).toBeUndefined();
  });

  it('本地格：根仍是盘符，行为一个字没变', () => {
    const active = resolveTreeActivePath('E:/website_sbt/wp-content', null);
    const roots = rootsFor(active);

    expect(roots.rootPaths).toEqual(DRIVE_PATHS);
    expect(roots.rootLabels).toEqual(DRIVE_LABELS);
  });
});

describe('接线守卫：navigator.vue 里两处消费者读同一个变量', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/navigator/pages/navigator.vue'),
    'utf8',
  );

  it('根用 treeActivePath（不是 activeFolderSettingsPath）', () => {
    expect(source).toMatch(/resolveTreeRoots\(\{[\s\S]*?activePath:\s*treeActivePath\.value/);
    expect(source).not.toMatch(/resolveTreeRoots\(\{[\s\S]*?activePath:\s*activeFolderSettingsPath\.value/);
  });

  it('选中路径也用 treeActivePath', () => {
    expect(source).toMatch(/setSelectedPath\(treeActivePath\.value/);
  });

  it('treeActivePath 优先取窗格实时路径', () => {
    expect(source).toMatch(
      /resolveTreeActivePath\(activePaneLivePath\.value,\s*activeFolderSettingsPath\.value\)/,
    );
  });

  it('treeActivePath 声明在用它的那两个 watcher / computed 之前（TDZ 安全）', () => {
    const decl = source.indexOf('const treeActivePath = computed');
    const watch = source.indexOf('watch([isSplitView, treeActivePath]');
    const roots = source.indexOf('resolveTreeRoots({');

    expect(decl).toBeGreaterThan(-1);
    expect(watch).toBeGreaterThan(decl);
    expect(roots).toBeGreaterThan(decl);
  });
});

describe('分屏时只有当前格能改写树的选中路径', () => {
  it('当前格：可以改写', () => {
    expect(shouldDriveTreeSelection(true, 'pane-a', 'pane-a')).toBe(true);
  });

  it('非当前格（远程格后到的事件）：不能改写', () => {
    // 真机画面：切到远程格后树里是本地盘符、全部折叠 ——
    // 远程格的 current-dir-entry 比本地格晚到，把树的选中路径顶成了远程的，
    // 而树的根跟着当前格（本地）走 → 两者矛盾 → 一层都展不开。
    expect(shouldDriveTreeSelection(true, 'pane-remote', 'pane-local')).toBe(false);
  });

  it('单格模式：只有一个窗格，恒可以改写', () => {
    expect(shouldDriveTreeSelection(false, 'pane-a', 'pane-b')).toBe(true);
    expect(shouldDriveTreeSelection(false, undefined, null)).toBe(true);
  });

  it('拿不到窗格 id 时不拦 —— 拦掉会让树彻底不动', () => {
    expect(shouldDriveTreeSelection(true, undefined, 'pane-a')).toBe(true);
  });
});

describe('接线守卫：只有当前格能改写树的选中路径', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/modules/navigator/pages/navigator.vue'),
    'utf8',
  );

  it('分屏的窗格把 tab.id 一起传进去', () => {
    expect(source).toMatch(
      /@update:current-dir-entry="\(entry\) => handleCurrentDirChange\(entry, tab\.id\)"/,
    );
  });

  it('判定走纯函数 shouldDriveTreeSelection', () => {
    expect(source).toMatch(
      /shouldDriveTreeSelection\(isSplitView\.value, paneId, activeTabId\.value\)/,
    );
  });
});
