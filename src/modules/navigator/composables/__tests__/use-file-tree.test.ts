// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: test for use-file-tree (tree view, v6 reactive shared state).
// Tracking issue: aleksey-hoffman/sigma-file-manager#499

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useFileTree } from '@/modules/navigator/composables/use-file-tree';

function makeTree(opts: Parameters<typeof useFileTree>[0]) {
  return useFileTree(opts);
}

describe('useFileTree', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes a tree rooted at the given paths', () => {
    const expanded = ref<Set<string>>(new Set());
    const tree = makeTree({ rootPaths: ['C:/work'], expandedPaths: expanded });
    expect(tree.rows.value).toHaveLength(1);
    expect(tree.rows.value[0].path).toBe('C:/work');
    expect(tree.rows.value[0].isExpanded).toBe(false);
  });

  it('reflects expansion state from the caller-owned ref', async () => {
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([]);
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    expanded.value = new Set([...expanded.value, 'C:/work']);
    await nextTick();
    await nextTick();
    await tree.ensureLoaded('C:/work');

    expect(readDir).toHaveBeenCalledOnce();
    expect(tree.rows.value[0].isExpanded).toBe(true);
    expect(tree.rows.value).toHaveLength(1);
  });

  it('loads children lazily on first expand (via side-effect watch)', async () => {
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([
      { path: 'C:/work/a.md', name: 'a.md', isDirectory: false, size: 0, modifiedAt: 0 },
      { path: 'C:/work/sub', name: 'sub', isDirectory: true, size: 0, modifiedAt: 0 },
    ]);
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    expanded.value = new Set([...expanded.value, 'C:/work']);
    await nextTick();
    await nextTick();

    expect(readDir).toHaveBeenCalledOnce();
    expect(tree.rows.value).toHaveLength(3); // root + 2 children
    expect(tree.rows.value[1].depth).toBe(1);
  });

  it('ensureLoaded is idempotent on already-loaded paths', async () => {
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([]);
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    await tree.ensureLoaded('C:/work');
    await tree.ensureLoaded('C:/work');
    await tree.ensureLoaded('C:/work');

    expect(readDir).toHaveBeenCalledTimes(1);
  });

  // FORK-MODIFICATION 2026-10-19：这一条**反转了 v6.3 的契约**。
  //
  // 旧契约是「祖先不在树里就 addRoot 成新根」。树根改用连接的 `initialPath`
  // 之后（用户 2026-10-19 要求「根显示设置里的远程目录」），`setSelectedPath`
  // 放进 expandedPaths 的整条祖先链里就有了一批**位于根之上**的路径 ——
  // 根是 `…/wp_root` 时，`sfm://remote/<id>`、`…/vol1`、`…/@team` 都在它上面。
  // 按旧契约会把它们立成三个并列的根，正是用户不要的东西。
  //
  // 树从根起步，根之上的层不在树里，所以正确行为是跳过而不是补根。
  it('切走再切回远程：根被重建后必须重新读出子节点', async () => {
    // 用户 2026-10-19 装机实测截图：根「速豹堂」展开着、下面什么都没有。
    //
    // `rebuildRoots` 在根换了又换回来时会造一个**全新空节点**
    // （children: null / isLoaded: false），而 `loadedSet` 原本从不清空。
    // 于是第二次激活远程时 `ensureLoaded` 撞上
    // `if (loadedSet.has(path)) return;` —— 节点是空的、「已经读过了」却是真的，
    // 于是永远不去读第二次。展开状态还在（它在 expandedPaths 里），
    // children 永远是 null，看起来就像「远程目录读不出来」。
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
    const ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
    const rootPaths = ref<string[]>([ROOT]);
    const expanded = ref<Set<string>>(new Set([ROOT]));
    const readDir = vi.fn().mockResolvedValue([
      {
        path: `${ROOT}/wp-admin`,
        name: 'wp-admin',
        is_dir: true,
        size: 0,
        modified_time: 0,
      },
      {
        path: `${ROOT}/wp-content`,
        name: 'wp-content',
        is_dir: true,
        size: 0,
        modified_time: 0,
      },
    ]);
    const tree = makeTree({
      rootPaths,
      rootLabels: { [ROOT]: '速豹堂' },
      expandedPaths: expanded,
      deps: { readDir },
    });

    await nextTick();
    await nextTick();

    expect(tree.rows.value.map(row => row.name)).toEqual(['速豹堂', 'wp-admin', 'wp-content']);

    // 焦点切到本地格：根变成盘符。
    rootPaths.value = ['C:/'];
    expanded.value = new Set(['C:/']);
    await nextTick();
    await nextTick();

    // 再切回远程格。
    rootPaths.value = [ROOT];
    expanded.value = new Set([ROOT]);
    await nextTick();
    await nextTick();

    // 关键断言：子节点必须**重新出现**，而不是「展开的空根」。
    expect(tree.rows.value.map(row => row.name)).toEqual(['速豹堂', 'wp-admin', 'wp-content']);
    expect(readDir).toHaveBeenCalledWith(ROOT);
  });

  // FORK-MODIFICATION 2026-10-19：这一条钉的是**真机上真实发生的那次切换**。
  //
  // 上一条测试每次切换都顺手把 `expanded` 换成了一个**新的 Set**，
  // 于是 `expandedPaths` 的 watch 每次都会触发，读取总有人发起 —— 测试是绿的，
  // 真机却复现不出来。真实场景是：**只把活动面板换回来，不导航**，
  // `expandedPaths` 一个字都没变（`setSelectedPath` 只在导航时调用），
  // watch 不触发，于是没人发起读取。
  //
  // 判据：复现完整的**状态变迁史**，而不是只对终态断言。
  // 这里的变迁是「根换了两轮，而 expanded 自始至终是同一个 Set」。
  it('切回远程格时 expandedPaths 没变 —— 重建出来的根也必须重新读', async () => {
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
    const ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
    const rootPaths = ref<string[]>([ROOT]);
    // ⭐ 全程是**同一个 Set**，一个元素都不动 —— 这才是真机的行为。
    const expanded = ref<Set<string>>(new Set([ROOT]));
    const readDir = vi.fn().mockResolvedValue([
      {
        path: `${ROOT}/wp-admin`,
        name: 'wp-admin',
        is_dir: true,
        size: 0,
        modified_time: 0,
      },
      {
        path: `${ROOT}/wp-content`,
        name: 'wp-content',
        is_dir: true,
        size: 0,
        modified_time: 0,
      },
    ]);
    const tree = makeTree({
      rootPaths,
      rootLabels: { [ROOT]: '速豹堂' },
      expandedPaths: expanded,
      deps: { readDir },
    });

    await nextTick();
    await nextTick();

    expect(tree.rows.value.map(row => row.name)).toEqual(['速豹堂', 'wp-admin', 'wp-content']);

    // 焦点切到本地格：根变成盘符。**expanded 不动**。
    rootPaths.value = ['C:/'];
    await nextTick();
    await nextTick();

    // 再切回远程格：根换回来。**expanded 仍然不动**。
    rootPaths.value = [ROOT];
    await nextTick();
    await nextTick();

    // 关键断言：子节点必须重新出现。
    expect(tree.rows.value.map(row => row.name)).toEqual(['速豹堂', 'wp-admin', 'wp-content']);
    expect(readDir).toHaveBeenCalledWith(ROOT);
    // 读一次就够：重建补读与 expandedPaths 的 watch 不该各读一遍
    // （远程目录一次读取就是一次网络往返）。
    expect(readDir).toHaveBeenCalledTimes(2);
  });

  it('根被重建时不会连带清掉仍然保留的根的缓存', async () => {
    const rootPaths = ref<string[]>(['C:/', 'D:/']);
    const expanded = ref<Set<string>>(new Set(['C:/', 'D:/']));
    const readDir = vi.fn().mockResolvedValue([]);
    makeTree({
      rootPaths,
      expandedPaths: expanded,
      deps: { readDir },
    });

    await nextTick();
    await nextTick();
    expect(readDir).toHaveBeenCalledTimes(2);

    // C:/ 被换掉、D:/ 留着 —— 只有 C:/ 的记账该被清掉。
    rootPaths.value = ['D:/'];
    expanded.value = new Set(['D:/']);
    await nextTick();
    await nextTick();

    // D:/ 仍然保留，它命中缓存、没有重读。
    expect(readDir).toHaveBeenCalledTimes(2);

    // 再把 D:/ 也换掉：这时它必须重读。
    rootPaths.value = ['E:/'];
    expanded.value = new Set(['E:/']);
    await nextTick();
    await nextTick();

    expect(readDir).toHaveBeenCalledTimes(3);
  });

  it('ensureAncestorsLoaded skips ancestors that sit strictly above a root', async () => {
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([]);
    const tree = makeTree({
      rootPaths: ['C:/Users/foo'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    await tree.ensureAncestorsLoaded(['C:/', 'C:/Users']);

    expect(readDir).not.toHaveBeenCalled();
    expect(tree.rows.value.map(row => row.path)).toEqual(['C:/Users/foo']);
  });

  it('远程根取 initialPath 时，根之上的远程祖先不会被立成并列的根', async () => {
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
    const ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([
      { path: `${ROOT}/wp-admin`, name: 'wp-admin', is_dir: true, size: 0, modified_time: 0 },
    ]);
    const tree = makeTree({ rootPaths: [ROOT], expandedPaths: expanded, deps: { readDir } });

    await tree.ensureAncestorsLoaded([
      `sfm://remote/${CONN}`,
      `sfm://remote/${CONN}/vol1`,
      `sfm://remote/${CONN}/vol1/@team`,
      `sfm://remote/${CONN}/vol1/@team/study_platform`,
      ROOT,
    ]);

    // 只有根被读了一次（用户反馈「根下面没有子节点」）；根之上的四个一律不碰。
    expect(readDir).toHaveBeenCalledTimes(1);
    expect(readDir).toHaveBeenCalledWith(ROOT);

    expanded.value = new Set([ROOT]);
    await nextTick();
    await nextTick();

    expect(tree.rows.value.map(row => row.path)).toEqual([ROOT, `${ROOT}/wp-admin`]);
  });

  it('根名在 rootLabels 到位后重算，不再停在 basename', async () => {
    // 用户 2026-10-19 实测截图：远程根那一行显示的是连接 id
    // `e2b24ab5…`，而不是连接名「速豹堂」。
    //
    // 根名是在建节点时一次算好塞进 node.name 的，而树只盯 rootPaths。
    // 树根靠焦点路径立刻算出来，标签要等连接表异步加载完 ——
    // 两边不同步触发，rootPaths 不变，名字就永远停在 basename。
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
    const ROOT = `sfm://remote/${CONN}`;
    const labels = ref<Record<string, string>>({});
    const tree = makeTree({
      rootPaths: [ROOT],
      rootLabels: labels,
      expandedPaths: ref<Set<string>>(new Set()),
    });

    // 标签还没到位：回退到 basename，正好是那串连接 id。
    expect(tree.rows.value[0].name).toBe(CONN);

    labels.value = { [ROOT]: '速豹堂' };
    await nextTick();
    await nextTick();

    expect(tree.rows.value[0].name).toBe('速豹堂');
  });

  it('readDir failure surfaces via onLoadError and does not throw', async () => {
    const expanded = ref<Set<string>>(new Set());
    const boom = new Error('permission denied');
    const readDir = vi.fn().mockRejectedValue(boom);
    const onLoadError = vi.fn();
    const tree = makeTree({
      rootPaths: ['C:/locked'],
      expandedPaths: expanded,
      deps: { readDir },
      onLoadError,
    });

    await expect(tree.ensureLoaded('C:/locked')).resolves.toBeUndefined();
    expect(onLoadError).toHaveBeenCalledWith('C:/locked', boom);
    // Per handoff §8.3: load failure must not break the UI. The row stays
    // visible, just with no children.
    expect(tree.rows.value).toHaveLength(1);
    expect(tree.rows.value[0].isExpanded).toBe(false);
  });

  it('collapsing then re-expanding does not re-read (children stay loaded)', async () => {
    const expanded = ref<Set<string>>(new Set(['C:/work']));
    const readDir = vi.fn().mockResolvedValue([]);
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    await nextTick();
    await nextTick();
    expect(readDir).toHaveBeenCalledTimes(1);

    // Collapse then re-expand — should NOT re-read.
    expanded.value = new Set();
    await nextTick();
    expanded.value = new Set(['C:/work']);
    await nextTick();
    await nextTick();

    expect(readDir).toHaveBeenCalledTimes(1);
  });

  it('addRoot dynamically grows the tree (ancestor auto-expansion case)', () => {
    const expanded = ref<Set<string>>(new Set());
    const tree = makeTree({
      rootPaths: ['C:/Users/foo'],
      expandedPaths: expanded,
    });

    expect(tree.rows.value).toHaveLength(1);
    expect(tree.addRoot('C:/Users')).toBe(true);
    expect(tree.rows.value).toHaveLength(2);
    expect(tree.addRoot('C:/Users')).toBe(false); // idempotent
    expect(tree.rows.value).toHaveLength(2);
  });

  it('reactive rootPaths rebuilds the tree while preserving loaded subtrees', async () => {
    const rootPaths = ref(['C:/work']);
    const expanded = ref<Set<string>>(new Set(['C:/work']));
    const readDir = vi.fn().mockImplementation(async (p: string) => {
      if (p === 'C:/work') return [
        { path: 'C:/work/sub', name: 'sub', isDirectory: true, size: 0, modifiedAt: 0 },
      ];
      return [];
    });
    const tree = makeTree({ rootPaths, expandedPaths: expanded, deps: { readDir } });

    await nextTick();
    await nextTick();
    expect(tree.rows.value).toHaveLength(2); // root + sub

    // Switch to a different root — C:/work is no longer in the list, so its
    // subtree is dropped. D:/projects is the new sole root.
    rootPaths.value = ['D:/projects'];
    await nextTick();
    await nextTick();

    expect(tree.rows.value).toHaveLength(1);
    expect(tree.rows.value[0].path).toBe('D:/projects');
  });

  it('uses rootLabels for drive root display names (v6.4)', () => {
    // v6.4: drive roots show their volume label, not just "E:".
    const tree = makeTree({
      rootPaths: ['E:/'],
      rootLabels: { 'E:/': '系统盘 (E:)' },
      expandedPaths: ref(new Set()),
    });
    expect(tree.rows.value).toHaveLength(1);
    expect(tree.rows.value[0].name).toBe('系统盘 (E:)');
    expect(tree.rows.value[0].path).toBe('E:/');
  });

  it('falls back to path basename when rootLabels has no entry', () => {
    const tree = makeTree({
      rootPaths: ['C:/work'],
      rootLabels: {}, // empty
      expandedPaths: ref(new Set()),
    });
    expect(tree.rows.value[0].name).toBe('work');
  });

  it('handles trailing backslash / slash without producing an empty name', () => {
    // Regression guard: `E:\\` (Windows-style with trailing backslash) used
    // to render as an empty name because the basename split kept nothing.
    const tree = makeTree({
      rootPaths: ['E:\\'],
      expandedPaths: ref(new Set()),
    });
    expect(tree.rows.value[0].name).toBe('E:');
  });
});

describe('useFileTree — invalidate (v6.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidate lets ensureLoaded re-read a path that was already loaded', async () => {
    // The contract this preserves: `ensureLoaded` stays idempotent on its own
    // ("ensureLoaded is idempotent on already-loaded paths" above asserts
    // three calls produce one read). `invalidate` is the only way to buy a
    // second read.
    const newFolder = {
      path: 'C:/work/new',
      name: 'new',
      is_dir: true,
      size: 0,
      modifiedAt: 0,
    };
    const expanded = ref<Set<string>>(new Set());
    let readCount = 0;
    const readDir = vi.fn().mockImplementation(async () => {
      readCount++;

      if (readCount === 1) {
        return [];
      }

      return [newFolder];
    });
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    await tree.ensureLoaded('C:/work');
    expect(readDir).toHaveBeenCalledTimes(1);
    expect(tree.rows.value).toHaveLength(1); // no children yet

    expanded.value = new Set(['C:/work']);
    await nextTick();

    await tree.invalidate('C:/work');

    expect(readDir).toHaveBeenCalledTimes(2);
    expect(tree.rows.value.map(r => r.path)).toEqual(['C:/work', 'C:/work/new']);
  });

  it('surfaces a new child of an already-expanded dir without collapse/re-expand', async () => {
    // The exact user report: create a folder inside an expanded directory and
    // it never appears. Previously unreachable — no code path cleared the cache.
    const oldFile = {
      path: 'C:/work/a.md',
      name: 'a.md',
      is_dir: false,
      size: 0,
      modifiedAt: 0,
    };
    const freshFolder = {
      path: 'C:/work/fresh',
      name: 'fresh',
      is_dir: true,
      size: 0,
      modifiedAt: 0,
    };
    const expanded = ref<Set<string>>(new Set());
    let readCount = 0;
    const readDir = vi.fn().mockImplementation(async () => {
      readCount++;

      if (readCount === 1) {
        return [oldFile];
      }

      return [oldFile, freshFolder];
    });
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    expanded.value = new Set(['C:/work']);
    await nextTick();
    await nextTick();
    expect(tree.rows.value.map(r => r.path)).toEqual(['C:/work', 'C:/work/a.md']);

    // The filesystem mutation publishes the changed directory.
    await tree.invalidate('C:/work');

    // Expanded the whole time — no manual toggle, and invalidate had to
    // re-read on its own.
    expect(expanded.value.has('C:/work')).toBe(true);
    expect(readDir).toHaveBeenCalledTimes(2);
    expect(tree.rows.value.map(r => r.path)).toEqual([
      'C:/work',
      'C:/work/a.md',
      'C:/work/fresh',
    ]);
  });

  it('invalidate drops the loaded-subtree cache so expanded descendants re-read', async () => {
    // Guards the desync: reloading a parent replaces its child objects with
    // fresh, unloaded ones while `loadedSet` still claims they are loaded.
    // Without clearing the subtree, an expanded grandchild renders empty.
    const subEntry = {
      path: 'C:/work/sub',
      name: 'sub',
      is_dir: true,
      size: 0,
      modifiedAt: 0,
    };
    const leafEntry = {
      path: 'C:/work/sub/leaf.txt',
      name: 'leaf.txt',
      is_dir: false,
      size: 0,
      modifiedAt: 0,
    };
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockImplementation(async (p: string) => {
      if (p === 'C:/work') {
        return [subEntry];
      }

      if (p === 'C:/work/sub') {
        return [leafEntry];
      }

      return [];
    });
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    // Build the starting state through awaited, sequential loads rather than
    // the expansion watcher: the watcher fires its loads concurrently, which
    // would make the read-order assertion below meaningless.
    await tree.ensureLoaded('C:/work');
    expanded.value = new Set(['C:/work']);
    await nextTick();
    await tree.ensureLoaded('C:/work/sub');
    expanded.value = new Set(['C:/work', 'C:/work/sub']);
    await nextTick();

    expect(readDir.mock.calls.map(c => c[0])).toEqual(['C:/work', 'C:/work/sub']);
    expect(tree.rows.value.map(r => r.path)).toContain('C:/work/sub/leaf.txt');

    await tree.invalidate('C:/work');

    // Parent re-read, then the still-expanded child — in that order, or the
    // child would load a node object the parent is about to replace.
    expect(readDir.mock.calls.map(c => c[0])).toEqual([
      'C:/work',
      'C:/work/sub',
      'C:/work',
      'C:/work/sub',
    ]);
    expect(tree.rows.value.map(r => r.path)).toContain('C:/work/sub/leaf.txt');
  });

  it('invalidate on an unknown path is a no-op that does not throw', async () => {
    const expanded = ref<Set<string>>(new Set());
    const readDir = vi.fn().mockResolvedValue([]);
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    await expect(tree.invalidate('C:/never/existed')).resolves.toBeUndefined();
    expect(tree.rows.value).toHaveLength(1);
  });

  it('invalidate keeps stale children visible until the re-read lands (no flicker)', async () => {
    const oldChild = {
      path: 'C:/work/old',
      name: 'old',
      is_dir: false,
      size: 0,
      modifiedAt: 0,
    };
    const readGate: { resolve?: (value: unknown[]) => void } = {};
    const expanded = ref<Set<string>>(new Set());
    let readCount = 0;
    const readDir = vi.fn().mockImplementation(async () => {
      readCount++;

      if (readCount === 1) {
        return [oldChild];
      }

      return new Promise<unknown[]>((r) => {
        readGate.resolve = r;
      });
    });
    const tree = makeTree({
      rootPaths: ['C:/work'],
      expandedPaths: expanded,
      deps: { readDir },
    });

    expanded.value = new Set(['C:/work']);
    await nextTick();
    await nextTick();
    expect(tree.rows.value.map(r => r.path)).toEqual(['C:/work', 'C:/work/old']);

    const pending = tree.invalidate('C:/work');
    // Mid-flight: the old child is still rendered rather than a blank gap.
    expect(tree.rows.value.map(r => r.path)).toEqual(['C:/work', 'C:/work/old']);

    readGate.resolve?.([]);
    await pending;
    expect(tree.rows.value.map(r => r.path)).toEqual(['C:/work']);
  });
});
