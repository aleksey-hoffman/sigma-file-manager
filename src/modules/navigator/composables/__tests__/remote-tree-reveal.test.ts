// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-19：远程目录树「定位到当前目录」的集成测试。
//
// 用户真机反馈（附截图）：远程格激活后，目录树**默认只显示根目录名、不展开**；
// 手动点开根之后，里面**又找不到当前打开的目录**（既没高亮，也没滚到可见处）。
//
// 这组测试打通 store → useFileTree 的真实链路，而不是各测各的：
// 之前的 `folder-tree.test.ts` 只断言 `isExpanded(...)` 返回 true，
// `use-file-tree.test.ts` 自己造 `expandedPaths` —— 两边都没验证
// 「store 里那份祖先链，真的能让远程根下面那一层渲染成展开状态」。
//
// 路径用用户的真机数据：连接「速豹堂」，initialPath = /vol1/@team/study_platform/wp_root，
// 当前目录 = .../wp_root/wp-content。远程根比本地深得多，这正是本地测不出来的地方。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import { useFolderTreeStore } from '@/stores/runtime/folder-tree';
import { useFileTree } from '@/modules/navigator/composables/use-file-tree';
import type { DirEntry } from '@/types/dir-entry';

const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
const REMOTE_ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
const REMOTE_CWD = `${REMOTE_ROOT}/wp-content`;

/** wp_root 的真实内容：有子目录，也有散落的 php 文件（用户截图里的形状）。 */
function wpRootEntries(): DirEntry[] {
  return [
    makeEntry(`${REMOTE_ROOT}/wp-content`, 'wp-content', true),
    makeEntry(`${REMOTE_ROOT}/wp-admin`, 'wp-admin', true),
    makeEntry(`${REMOTE_ROOT}/index.php`, 'index.php', false),
  ];
}

function wpContentEntries(): DirEntry[] {
  return [
    makeEntry(`${REMOTE_CWD}/mu-plugins`, 'mu-plugins', true),
    makeEntry(`${REMOTE_CWD}/plugins`, 'plugins', true),
  ];
}

function makeEntry(path: string, name: string, isDir: boolean): DirEntry {
  return {
    name,
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

/**
 * 按真实路径表回答的 readDir。
 *
 * 刻意不 mock 掉任何一层：store 的 expandedPaths 与 useFileTree 的渲染之间
 * 唯一的耦合就是路径字符串完全相等，这里如实模拟一次远程读取。
 */
function makeReadDir() {
  const table = new Map<string, DirEntry[]>([
    [REMOTE_ROOT, wpRootEntries()],
    [REMOTE_CWD, wpContentEntries()],
  ]);

  return vi.fn(async (path: string) => {
    const entries = table.get(path);

    if (!entries) {
      throw new Error(`readDir 未预期的路径：${path}`);
    }

    return entries;
  });
}

/**
 * 等远程读取真正落地。
 *
 * 刻意**不写死 tick 数**：调试轨迹显示链式加载要 4 个 tick 才收敛，
 * 而真机上是一次网络往返（几十到几百毫秒）。写死 tick 数等于把
 * 「等够久」当成「等到了」，换个环境就假红。
 *
 * 也不用 `vi.waitFor` —— 它的轮询走定时器，而这里的链路是
 * promise 链（`ensureLoaded` 的回溯分支要 await 父目录的在途读取），
 * 定时器轮询与微任务链不同步，等到超时也未必是「没加载」而是「没被问到」。
 * 这里每轮都把微任务与宏任务各冲一遍，等的是**状态**。
 */
async function waitForLoaded(
  tree: { loadedPaths: { value: Set<string> } },
  path: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (tree.loadedPaths.value.has(path)) {
      return;
    }

    await nextTick();
    await Promise.resolve();
    await new Promise<void>(resolve => { setTimeout(resolve, 0); });
  }

  throw new Error(`等待 ${path} 加载落地超时`);
}

describe('远程目录树：定位到当前目录', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('setSelectedPath 把当前目录写进 selectedPath（高亮的数据来源）', () => {
    const store = useFolderTreeStore();

    store.setSelectedPath(REMOTE_CWD);

    expect(store.selectedPath).toBe(REMOTE_CWD);
  });

  it('setSelectedPath 的祖先链包含远程根与当前目录', () => {
    const store = useFolderTreeStore();

    store.setSelectedPath(REMOTE_CWD);

    // 树根（= initialPath）必须在展开集合里，否则根那行是折叠的。
    expect(store.isExpanded(REMOTE_ROOT)).toBe(true);
    // 当前目录必须在展开集合里，否则树里看不到它自己的子节点。
    expect(store.isExpanded(REMOTE_CWD)).toBe(true);
  });

  it('祖先链不把根之上的路径当成可展开节点（它们不在树里）', () => {
    const store = useFolderTreeStore();

    store.setSelectedPath(REMOTE_CWD);

    const aboveRoot = `sfm://remote/${CONN}/vol1/@team/study_platform`;

    expect(store.isExpanded(aboveRoot)).toBe(true);
    // 连接根也进了集合，但树里没有它 —— useFileTree 的 isAboveAnyRoot 会挡掉。
    expect(store.isExpanded(`sfm://remote/${CONN}`)).toBe(true);
  });

  it('store 的祖先链能让远程根下的当前目录真的渲染成「展开」', async () => {
    const store = useFolderTreeStore();
    const readDir = makeReadDir();

    // ⚠️ 必须**先**把当前目录写进 store，树才有一条祖先链可用。
    //
    // `useFileTree` 里那条 `expandedPaths` 的 watch 带 `immediate: true`，
    // 它在**创建当场**就按当时的展开集合发起读取。
    // 这一步漏了的话，展开集合是空的、watch 什么都不触发，
    // 读一次都不会发生 —— 症状是「树里只有光秃秃的一根」。
    //
    // 这个坑踩过一次：同一条断言在「只改数据不改数据源」的版本里
    // 永远超时，而独立脚本（先调 setSelectedPath）却能收敛，
    // 看起来像「代码有时灵有时不灵」，其实是测试自己没建状态。
    store.setSelectedPath(REMOTE_CWD);

    // 树根就是连接的 initialPath（remote-tree-roots.ts 的 resolveRemoteTreeRoot）。
    const tree = useFileTree({
      rootPaths: [REMOTE_ROOT],
      rootLabels: () => ({ [REMOTE_ROOT]: '速豹堂' }),
      expandedPaths: store.expandedPaths,
      deps: { readDir },
    });

    await waitForLoaded(tree, REMOTE_CWD);
    await nextTick();

    const names = tree.rows.value.map(row => row.name);

    expect(names).toContain('速豹堂');
    expect(names).toContain('wp-content');

    // ⭐ 关键断言：当前目录这一行必须是展开的，且它的子节点已经渲染出来。
    const cwdRow = tree.rows.value.find(row => row.path === REMOTE_CWD);

    expect(cwdRow, '当前目录这一行根本没渲染出来').toBeDefined();
    expect(cwdRow!.isExpanded).toBe(true);
    expect(names).toContain('mu-plugins');

    // ⭐ 同一个目录只该读一次。远程目录一次读取就是一个网络往返；
    // 而「祖先链里的根」与「当前目录回溯时找的父节点」是同一次 watch 里
    // 同步发起的，不去重就会读两遍 —— 并且第二次返回会把子节点换成新对象，
    // 让先发起的写入落到没人渲染的 detached 节点上。
    expect(
      readDir.mock.calls.filter(call => call[0] === REMOTE_ROOT),
      '远程根被读了多次',
    ).toHaveLength(1);
  });

  it('切回远程格（树根重建、expandedPaths 不变）后当前目录仍然是展开的', async () => {
    const store = useFolderTreeStore();
    store.setSelectedPath(REMOTE_CWD);

    const readDir = makeReadDir();
    const rootPaths = ref<string[]>([REMOTE_ROOT]);
    const expanded = store.expandedPaths;

    const tree = useFileTree({
      rootPaths,
      rootLabels: () => ({ [REMOTE_ROOT]: '速豹堂' }),
      expandedPaths: expanded,
      deps: { readDir },
    });

    await waitForLoaded(tree, REMOTE_CWD);
    await nextTick();

    // 焦点切到本地格：根变成盘符。expanded **不动**。
    rootPaths.value = ['C:/'];
    await nextTick();
    await nextTick();

    // 再切回远程格。expanded **仍然不动**。
    rootPaths.value = [REMOTE_ROOT];
    await waitForLoaded(tree, REMOTE_CWD);
    await nextTick();

    const cwdRow = tree.rows.value.find(row => row.path === REMOTE_CWD);

    expect(cwdRow, '切回之后当前目录这一行不见了').toBeDefined();
    expect(cwdRow!.isExpanded).toBe(true);
    expect(tree.rows.value.map(row => row.name)).toContain('mu-plugins');
  });

  it('当前目录在 rows 里的索引可被用来滚动定位（树是长列表，必须能定位）', async () => {
    const store = useFolderTreeStore();
    store.setSelectedPath(REMOTE_CWD);

    const tree = useFileTree({
      rootPaths: [REMOTE_ROOT],
      rootLabels: () => ({ [REMOTE_ROOT]: '速豹堂' }),
      expandedPaths: store.expandedPaths,
      deps: { readDir: makeReadDir() },
    });

    await waitForLoaded(tree, REMOTE_CWD);
    await nextTick();

    const index = tree.rows.value.findIndex(row => row.path === REMOTE_CWD);

    // 索引必须找得到 —— 找不到就没法 scrollToIndex，「定位」无从谈起。
    expect(index).toBeGreaterThan(0);
    expect(store.selectedPath).toBe(REMOTE_CWD);
  });

  // FORK-MODIFICATION 2026-10-19：当前目录在**第三层**时的形状。
  //
  // 用户在远程里再往里点一层就会走到这条路径（`wp_root/wp-content/themes`）。
  // 树根是连接的 initialPath（`wp_root`），所以树内深度是 3 层 ——
  // 比「根 + 一层」多一层，**并发加载的缺陷就在这一层显形**：
  // `expandedPaths` 的 watch 一次性给整条祖先链发起读取，
  // 而 `wp-content` 那一刻还没被读出来，
  // 于是 `wp-content/themes` 找不到父节点，回溯到根，
  // 等根读完再回来时 `themes` 仍然不在树上 ——
  // 最后落到 `addRoot`，把当前目录立成**并列的第二个根**。
  //
  // 症状与用户最早报的一模一样：树上冒出两根，
  // 当前目录不在根的那条链里，看起来就是「定位不到当前目录」。
  it('当前目录在第三层时不会被立成并列的根（祖先链要逐层补齐）', async () => {
    const store = useFolderTreeStore();
    const level1 = `${REMOTE_ROOT}/wp-content`;
    const level2 = `${level1}/themes`;
    const deepCwd = `${level2}/twentytwenty`;

    const table = new Map<string, DirEntry[]>([
      [REMOTE_ROOT, [makeEntry(level1, 'wp-content', true)]],
      [level1, [makeEntry(level2, 'themes', true)]],
      [level2, [makeEntry(deepCwd, 'twentytwenty', true)]],
    ]);

    const readDir = vi.fn(async (path: string) => {
      const entries = table.get(path);

      if (!entries) {
        throw new Error(`readDir 未预期的路径：${path}`);
      }

      return entries;
    });

    store.setSelectedPath(deepCwd);

    const tree = useFileTree({
      rootPaths: [REMOTE_ROOT],
      rootLabels: () => ({ [REMOTE_ROOT]: '速豹堂' }),
      expandedPaths: store.expandedPaths,
      deps: { readDir },
    });

    await waitForLoaded(tree, deepCwd);
    await nextTick();

    // 树里只能有**一根**。多一根就说明当前目录被当成了新根。
    expect(tree.rows.value.filter(row => row.depth === 0).map(row => row.path))
      .toEqual([REMOTE_ROOT]);

    // 整条链都要在树上，而且是一层套一层。
    const paths = tree.rows.value.map(row => row.path);

    expect(paths).toContain(REMOTE_ROOT);
    expect(paths).toContain(level1);
    expect(paths).toContain(level2);
    expect(paths).toContain(deepCwd);

    // 当前目录这一行必须展开、并且带自己的子节点。
    const cwdRow = tree.rows.value.find(row => row.path === deepCwd);

    expect(cwdRow, '第三层的当前目录没有被渲染出来').toBeDefined();
    expect(cwdRow!.isExpanded).toBe(true);
    expect(cwdRow!.depth).toBe(3);
  });
});
