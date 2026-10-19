// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: tree view. Keep during upstream sync.
// Tracking issue: aleksey-hoffman/sigma-file-manager#499
//
// v6 rewrite: expansion state is no longer owned by this composable. The
// caller (typically a Pinia store such as `useFolderTreeStore`) provides a
// reactive `expandedPaths: Ref<Set<string>>`, and `rows` is computed by
// intersecting the nodes tree with that set. Newly expanded paths trigger
// async `ensureLoaded` via a side-effect watch; failures are surfaced via
// `onLoadError` and the UI keeps rendering (the row stays visible, just with
// no children). This breaks the imperative "parent calls child.expandToPath"
// chain that was unfixable in v0..v5 — see handoff-2026-09-26-tree-sync-retro.
//
// v6.5: adds `invalidate(path)`. v6 made the tree permanently stale: nothing
// could ever clear `loadedSet` or `node.isLoaded`, so a directory read once
// was never read again and a folder created inside an already-expanded
// directory never appeared. `invalidate` is that missing escape hatch; the
// idempotent `ensureLoaded` early return is intentionally left alone (see
// handoff-2026-10-09-alpha-fm-brand-release.md §3.3).

import {
  computed,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
// FORK-MODIFICATION 2026-10-19：祖先回溯要认得 `sfm://remote/<id>` 这个根。
import {
  getRemoteParentPath,
  isRemoteConnectionRootPath,
  isRemotePath,
} from '@/utils/remote-paths';
import { resolveDirectoryContents } from '@/utils/virtual-locations';
import type { FileTreeNode, FileTreeFlatRow } from '../types/file-tree';

export interface UseFileTreeDeps {
  readDir: (path: string) => Promise<DirEntry[]>;
}

export interface UseFileTreeOptions {
  /**
   * Root directory paths. Can be reactive (Ref or getter) so the caller can
   * add or remove roots as navigation state changes. The composable rebuilds
   * its internal nodes tree when this changes; existing loaded children are
   * preserved by path key so a path that's still a root keeps its loaded
   * subtree.
   */
  rootPaths: MaybeRefOrGetter<string[]>;
  /**
   * Optional display labels for root paths (e.g. drive volume labels like
   * "Windows (C:)" instead of just "C:"). Keys are root paths, values are
   * the label to use as the row's `name`. Paths without a label fall back
   * to the path basename. v6.4: lets drives show their volume name in
   * the sidebar tree.
   */
  rootLabels?: MaybeRefOrGetter<Record<string, string>>;
  /**
   * Reactive set of currently expanded directory paths.
   * The caller owns this state — typically `storeToRefs(folderTreeStore).expandedPaths`.
   */
  expandedPaths: MaybeRefOrGetter<Set<string>>;
  /** Called when a directory's children start loading. */
  onLoadStart?: (path: string) => void;
  /** Called when a directory's children finish loading successfully. */
  onLoadEnd?: (path: string) => void;
  /** Called when a directory's children fail to load (e.g. permission denied). */
  onLoadError?: (path: string, err: unknown) => void;
  deps?: UseFileTreeDeps;
}

export interface UseFileTreeApi {
  /** Flat row list (for virtual scroll rendering). */
  rows: ComputedRef<FileTreeFlatRow[]>;
  /** Read-only view of which directory paths currently have their children loaded. */
  loadedPaths: ComputedRef<Set<string>>;
  /**
   * Ensure a directory's children are loaded. Idempotent — no-op if already
   * loaded. Errors are caught and reported via `onLoadError`. If `path` is
   * not in the current root set, it is added as a new root (ancestor
   * expansion case — store auto-expands an ancestor that's not yet a root).
   */
  ensureLoaded: (path: string) => Promise<void>;
  /** Sequentially `ensureLoaded` each ancestor path. Failures are isolated per-path. */
  ensureAncestorsLoaded: (ancestorPaths: string[]) => Promise<void>;
  /** Add a path as a root if it isn't already one. Returns true if added. */
  addRoot: (path: string) => boolean;
  /**
   * v6.5: forget the cached children of `path` **and its whole subtree**, then
   * immediately re-read whatever is still expanded.
   *
   * This is the only escape hatch from the two caches in this composable, and
   * both have to be cleared together:
   *   - `loadedSet` gates the early return at the top of `ensureLoaded`
   *   - `node.isLoaded` gates `loadChildren` and `loadChildrenOfNode`
   *
   * Filesystem mutations that happen outside the tree (create / rename /
   * delete) must reach the tree through this, otherwise a directory that was
   * read once can never be read again and the tree goes permanently stale.
   *
   * Deliberately additive: `ensureLoaded` keeps its idempotent early return
   * (locked by "ensureLoaded is idempotent on already-loaded paths"), because
   * expanding a folder should still never re-hit the disk on its own.
   */
  invalidate: (path: string) => Promise<void>;
}

export function useFileTree(options: UseFileTreeOptions): UseFileTreeApi {
  const deps = options.deps ?? defaultDeps();
  const nodes = ref<FileTreeNode[]>([]);
  const loadedSet = ref<Set<string>>(new Set());
  const rootSet = ref<Set<string>>(new Set());
  /**
   * FORK-MODIFICATION 2026-10-19：同一路径的并发读取只发一次。
   *
   * `rebuildRoots` 重建根之后要**主动补一次**读取（见该函数末尾），
   * 而 `expandedPaths` 的 watch 在同一轮里也可能对同一条路径发一次。
   * 两次都撞在 `loadedSet` 尚未记账的时刻（记账写在 `finally` 里），
   * 于是同一个目录会被读两遍 —— 远程目录一次读取就是一次网络往返，
   * 读两遍是白花的代价。
   *
   * ⚠️ 声明必须放在**所有 watcher 之前**：`expandedPaths` 的 watch 带
   * `immediate: true`，会在 `watch()` 调用当场同步执行 getter 与回调
   * （`@vue/reactivity` 的 `job(true)`）。声明在 watcher 后面就是 TDZ，
   * `ReferenceError` 又会被 `callWithErrorHandling` 吞成一条警告，
   * 页面照常渲染 —— 表现是「某个回调从来没生效」。
   * 同一个坑见交接文档 §13.1。
   */
  const inFlight = new Map<string, Promise<void>>();

  // Initialize nodes from current rootPaths value.
  initializeNodes(toValue(options.rootPaths));

  // Rebuild nodes if the caller's rootPaths changes (e.g. user navigates to a
  // new drive). Loaded children that are still reachable are preserved.
  watch(
    () => toValue(options.rootPaths),
    (next) => rebuildRoots(next),
    { flush: 'post' },
  );

  // FORK-MODIFICATION 2026-10-19：根的名字要能在 `rootLabels` 到位之后**重算**。
  //
  // 根名是在 `buildRoots` / `addRoot` 里一次性算好塞进 `node.name` 的，
  // 而上面那个 watch 只盯 `rootPaths`。远程树的两样东西**不是同时到的**：
  // 树根靠焦点路径立刻算出来，标签却要等 `remoteConnectionsStore.connections`
  // 异步加载完才有。两边不同步触发 `rootPaths` 就不变，`rebuildRoots` 也就不会跑，
  // 名字永远停在 `basename` —— 对远程根就是那串 32 位连接 id
  // （用户 2026-10-19 实测截图，标签显示 `e2b24ab5…` 而不是「速豹堂」）。
  //
  // 只改 depth 0：子节点的名字来自 DirEntry.name，与 rootLabels 无关。
  watch(
    () => toValue(options.rootLabels),
    () => {
      const labels = toValue(options.rootLabels);
      let touched = false;

      for (const node of nodes.value) {
        if (node.depth !== 0) continue;

        const name = deriveRootName(node.path, labels);

        if (node.name !== name) {
          node.name = name;
          touched = true;
        }
      }

      if (touched) nodes.value = [...nodes.value];
    },
    { flush: 'post' },
  );

  // Side-effect: any newly expanded path triggers an async load. Immediate
  // so that callers passing an initial expanded set get a sync first pass.
  watch(
    () => toValue(options.expandedPaths),
    (next) => {
      for (const p of next) {
        void ensureLoaded(p);
      }
    },
    { deep: true, flush: 'post', immediate: true },
  );

  function addRoot(path: string): boolean {
    if (rootSet.value.has(path)) return false;
    const newRoot: FileTreeNode = {
      path,
      name: deriveRootName(path, toValue(options.rootLabels)),
      isDirectory: true,
      isExpanded: false,
      isLoaded: false,
      depth: 0,
      children: null,
    };
    nodes.value = [...nodes.value, newRoot];
    rootSet.value = new Set(rootSet.value).add(path);
    return true;
  }

  function findNodeIndex(list: FileTreeNode[], path: string): number {
    return list.findIndex(n => n.path === path);
  }

  function findNode(list: FileTreeNode[], path: string): FileTreeNode | null {
    function walk(items: FileTreeNode[]): FileTreeNode | null {
      for (const n of items) {
        if (n.path === path) return n;
        if (n.children) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    }
    return walk(list);
  }

  async function loadChildren(node: FileTreeNode): Promise<void> {
    if (!node.isDirectory || node.isLoaded) return;
    const entries = await deps.readDir(node.path);
    node.children = entries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      isDirectory: entry.is_dir,
      isExpanded: false,
      isLoaded: !entry.is_dir,
      depth: node.depth + 1,
      children: null,
    }));
    node.isLoaded = true;
  }

  /** Pure helper: return parent directory of `path`, or null if root. */
  function parentDirectoryOfPath(path: string): string | null {
    if (!path) return null;
    if (path === '/') return null;
    if (/^[A-Z]:\/?$/i.test(path)) return null;

    // FORK-MODIFICATION 2026-10-19：远程路径的父级必须由 `parseRemotePath` 算。
    //
    // 下面那段纯字符串切分会把 `sfm://remote/<id>/vol1` 一路切成
    // `sfm://remote/<id>` → `sfm://remote` → `sfm:` —— 头两个都不是能列目录的路径，
    // 而最后一个连分隔符都没有，`path` 于是被当成根。祖先回溯会一路走空，
    // 最后落到 `addRoot`，把一条本该显示成子节点的路径立成并列的根。
    if (isRemotePath(path)) {
      return isRemoteConnectionRootPath(path) ? null : getRemoteParentPath(path);
    }

    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return null;
    if (lastSlash === 0) return '/';
    let parent = path.substring(0, lastSlash);
    if (/^[A-Z]:$/i.test(parent)) parent = `${parent}/`;
    return parent;
  }

  /**
   * `path` 是否**严格位于某个根之上**。
   *
   * FORK-MODIFICATION 2026-10-19：树根改用连接的 `initialPath` 之后，
   * `expandedPaths` 里会出现树根**上面**的祖先 —— 根是
   * `sfm://remote/<id>/vol1/@team/study_platform/wp_root` 时，
   * `sfm://remote/<id>`、`…/vol1`、`…/@team` 都在那个集合里
   * （`setSelectedPath` 把整条祖先链都放进去了，它并不知道树的根在哪）。
   *
   * 这些路径在树里**永远不该出现**：树从根起步，根之上的层不在树里。
   * 而 `ensureLoaded` 找不到节点就 `addRoot`，于是三个祖先会被立成三个并列的根 ——
   * v6.3 修过一次同形状的缺陷（见上面 `ensureLoaded` 的注释），这里是从另一头复发。
   */
  function isAboveAnyRoot(path: string): boolean {
    // 拼前缀前必须把尾斜杠去掉：盘符根 `C:/` 直接拼会得到 `C://`，
    // 而子路径是 `C:/Users/foo`，`startsWith('C://')` 恒假 —— 守卫会对
    // 本地盘符根整个失效。远程路径没有尾斜杠，所以这个坑只在本地显形。
    const prefix = path.replace(/[\\/]+$/, '');

    if (!prefix) {
      return false;
    }

    return nodes.value.some(node => node.path !== path && node.path.startsWith(`${prefix}/`));
  }

  /**
   * v6.3: ensure `path` is in the tree AND its children are loaded.
   *
   * The previous version called `addRoot` for any path that wasn't already
   * a root — that produced duplicate depth-0 nodes when ancestors got
   * auto-expanded (e.g. `selectedPath = "E:/办公文件/002内衣项目"`
   * caused `办公文件` and `002内衣项目` to be added as standalone roots
   * alongside `E:/`, breaking the depth display — see
   * handoff-2026-09-26-tree-sync-v6-3.md).
   *
   * New behavior: if `path` isn't in the tree, walk up to find the closest
   * ancestor that IS in the tree, then load that ancestor's children so
   * `path` gets discovered as a descendant. If no ancestor is in the
   * tree (genuinely new root, e.g. a path outside any drive), fall back
   * to `addRoot`.
   */
  async function ensureLoaded(path: string): Promise<void> {
    const pending = inFlight.get(path);

    if (pending) {
      return pending;
    }

    const run = ensureLoadedInner(path);

    inFlight.set(path, run);

    return run;
  }

  /**
   * 真正读目录的入口。与 `ensureLoaded` 分开是为了让 `invalidate` 能
   * **强制**再读一次（见该函数里对 `invalidate` 的处理）。
   */
  async function ensureLoadedInner(path: string): Promise<void> {
    // ⭐ 在途标记必须与「读取落地」**同步**清理，不能等 promise settle。
    //
    // 两者差一个微任务，而那一个微任务足以让 `invalidate` 撞上：
    // 子节点已经可见（读取已落地），在途表里却还留着这条路径 ——
    // `invalidate` 于是拿到一个**早已 resolve 的旧 promise**，
    // 重读没有发生，缓存也没清。实测症状：新建文件夹后目录树里不出现。
    try {
      if (loadedSet.value.has(path)) return;

      // 根之上的祖先不进树（见 `isAboveAnyRoot`）。
      if (isAboveAnyRoot(path)) return;

      let node = findNode(nodes.value, path);
      if (!node) {
        // 沿父链往上找，直到找到一个**已经在树里**的祖先。
        //
        // ⚠️ FORK-MODIFICATION 2026-10-19：中间**隔着的那些层**必须记下来。
        //
        // 只补「最上面那一层」是不够的。当前目录在树里第三层时
        // （`wp_root/wp-content/themes`，远程里再点一层就会到），
        // 那一刻 `wp-content` 还没被读出来，
        // 于是回溯到根、等根读完再回来 —— `themes` 仍然不在树上，
        // 最后落到 `addRoot`，把当前目录立成**并列的第二个根**。
        // 症状与用户最早报的一模一样：树上冒出好几根，
        // 当前目录不在根的那条链里，看起来就是「定位不到当前目录」。
        const missing: string[] = [];
        let cur = path;
        let anchor: FileTreeNode | null = null;

        while (true) {
          const parent = parentDirectoryOfPath(cur);
          if (parent === null || parent === cur) break;
          const parentNode = findNode(nodes.value, parent);
          if (parentNode) {
            anchor = parentNode;
            break;
          }

          missing.unshift(parent);
          cur = parent;
        }

        if (anchor) {
          await loadChain(anchor, missing);
          // Re-find `path` now that the chain has been loaded.
          node = findNode(nodes.value, path);
        }

        // If still not in tree, fall back to addRoot (genuinely new root).
        if (!node) {
          addRoot(path);
          node = findNode(nodes.value, path);
        }
      }

      if (!node?.isDirectory) return;

      let didLoad = false;
      options.onLoadStart?.(path);
      try {
        await loadChildren(node);
        didLoad = true;
        options.onLoadEnd?.(path);
      }
      catch (err) {
        options.onLoadError?.(path, err);
      }
      finally {
        // Always mark as "attempted" — successful load or surfaced error.
        loadedSet.value = new Set(loadedSet.value).add(path);
        // Ensure rows re-render even if load failed (so the user sees the row
        // without children rather than a permanent loading indicator).
        if (!didLoad) {
          nodes.value = [...nodes.value];
        }
      }
    }
    finally {
      // 与「读取落地」同刻清掉在途标记（理由见函数头）。
      inFlight.delete(path);
    }
  }

  /**
   * 把「锚点 → 缺失的中间层」这条链**逐层读出来**。
   *
   * FORK-MODIFICATION 2026-10-19。顺序是硬要求：
   * `loadChildren` 会把子节点整批换成**新对象**，
   * 所以下一层必须在自己的父节点读完之后**重新查一次**，
   * 否则拿到的是 detached 节点 —— 内容写进了没人渲染的旧对象，
   * 症状是「展开的目录里是空的」。
   *
   * 每一层都要先看 `inFlight`：父链上很可能已经有一次同路径的读取在飞
   * （`expandedPaths` 的 watch 会一次性给整条祖先链发起读取），
   * 那就**等它**而不是再读一遍 ——
   * 远程目录一次读取就是一次网络往返，读两遍是白花的代价；
   * 而且两次读取会互相把对方的子节点顶掉。
   */
  async function loadChain(anchor: FileTreeNode, missing: string[]): Promise<void> {
    const anchorPending = inFlight.get(anchor.path);

    if (anchorPending) {
      await anchorPending;
    }
    else {
      await loadChildrenOfNode(anchor);
    }

    for (const p of missing) {
      // 父节点刚读完，它的 children 是**新的一批对象** —— 必须重新查。
      const n = findNode(nodes.value, p);

      if (!n) {
        // 链断了（父目录里根本没有这一层）—— 交给 addRoot 兜底。
        return;
      }

      if (n.isLoaded) {
        continue;
      }

      const pending = inFlight.get(p);

      if (pending) {
        await pending;
        continue;
      }

      await loadChildrenOfNode(n);
    }
  }

  /** Internal: load children of an already-existing node, bypassing the
   *  ancestor walk. Used when ensureLoaded needs to populate a parent's
   *  children to discover the actual target path as a descendant. */
  async function loadChildrenOfNode(node: FileTreeNode): Promise<void> {
    if (node.isLoaded || !node.isDirectory) return;
    options.onLoadStart?.(node.path);
    try {
      await loadChildren(node);
      options.onLoadEnd?.(node.path);
    }
    catch (err) {
      options.onLoadError?.(node.path, err);
    }
    finally {
      loadedSet.value = new Set(loadedSet.value).add(node.path);
      // Trigger re-render so newly-discovered children appear in rows().
      nodes.value = [...nodes.value];
    }
  }

  async function ensureAncestorsLoaded(ancestorPaths: string[]): Promise<void> {
    for (const a of ancestorPaths) {
      await ensureLoaded(a);
    }
  }

  /** Pre-order DFS over the cached subtree. A directory always appears
   *  before its descendants — callers rely on that ordering. */
  function collectSubtreePaths(node: FileTreeNode): string[] {
    const out: string[] = [node.path];

    for (const child of node.children ?? []) {
      if (child.isDirectory) out.push(...collectSubtreePaths(child));
    }

    return out;
  }

  async function invalidate(path: string): Promise<void> {
    const node = findNode(nodes.value, path);
    const stale = node ? collectSubtreePaths(node) : [path];

    // Clear BOTH caches across the subtree. Clearing only one leaves the
    // directory unreadable forever — that pairing was the original bug.
    const nextLoaded = new Set(loadedSet.value);
    let touched = false;

    for (const p of stale) {
      if (nextLoaded.delete(p)) touched = true;
      const n = findNode(nodes.value, p);

      // `children` is deliberately kept: stale-while-revalidate, so the row
      // doesn't visibly empty out. loadChildren replaces the whole array
      // when the re-read succeeds.
      if (n?.isLoaded) {
        n.isLoaded = false;
        touched = true;
      }
    }

    if (touched) {
      loadedSet.value = nextLoaded;
      nodes.value = [...nodes.value];
    }

    // Re-read only what's visible. Sequential and parents-first, because a
    // parent's loadChildren replaces its children objects wholesale — a
    // descendant must look itself up again *after* that, or it would hold a
    // detached node and write its result somewhere nobody renders.
    const expanded = toValue(options.expandedPaths);

    for (const p of stale) {
      if (expanded.has(p)) {
        // ⭐ 绕过在途去重，直接强制重读。
        //
        // `invalidate` 的语义是「这份缓存作废，立刻再读一次」。
        // 走 `ensureLoaded` 的话，若这一刻恰好有一次读取正在飞，
        // 拿到的会是**那次读取**的 promise —— 等它结束并不等于重读，
        // 而那次读取用的还是作废之前的视图。
        inFlight.delete(p);
        await ensureLoadedInner(p);
      }
    }
  }

  const loadedPaths = computed<Set<string>>(() => loadedSet.value);

  const rows = computed<FileTreeFlatRow[]>(() => {
    const expanded = toValue(options.expandedPaths);
    const out: FileTreeFlatRow[] = [];
    function walk(list: FileTreeNode[]) {
      for (const n of list) {
        const isExpanded = expanded.has(n.path);
        out.push({
          path: n.path,
          name: n.name,
          depth: n.depth,
          isDirectory: n.isDirectory,
          hasChildren: n.isDirectory,
          isExpanded,
        });
        if (isExpanded && n.children) walk(n.children);
      }
    }
    walk(nodes.value);
    return out;
  });

  function initializeNodes(paths: string[]) {
    rootSet.value = new Set(paths);
    nodes.value = buildRoots(paths, toValue(options.rootLabels));
  }

  function rebuildRoots(paths: string[]) {
    const nextRoots = new Set(paths);
    const next: FileTreeNode[] = [];
    const previousRoots = rootSet.value;
    const labels = toValue(options.rootLabels);
    // FORK-MODIFICATION 2026-10-19：重建出来的根是**全新空节点**
    // （children: null / isLoaded: false），所以它的 `loadedSet` 记账必须一起清掉。
    //
    // 不清的后果（用户 2026-10-19 装机实测截图：根「速豹堂」展开着、下面什么都没有）：
    // 在本地格与远程格之间来回切过一次之后，第二次激活远程时根被重建，
    // 而 `ensureLoaded` 开头是 `if (loadedSet.has(path)) return;` ——
    // 节点是空的，「已经读过了」却是真的，于是永远读第二次。
    // 展开状态还在（它在 expandedPaths 里），children 永远是 null：
    // 表现就是「展开的根 + 空列表」，看起来像远程读不出来，其实是**没去读**。
    const recreated = new Set<string>();

    for (const p of paths) {
      if (previousRoots.has(p)) {
        // Preserve existing loaded root subtree.
        const idx = findNodeIndex(nodes.value, p);
        if (idx >= 0) {
          next.push(nodes.value[idx]);
          continue;
        }
      }

      next.push(...buildRoots([p], labels));
      recreated.add(p);
    }

    // ⭐ 记账（`loadedSet`）必须跟着**节点集合**一起变。
    //
    // 有两条路会让两者脱节：
    //   1. 根被**移除**（切到本地格）—— 整棵子树从 `nodes` 里消失，记账还在。
    //   2. 根被**重建**（切回远程格）—— 同上，而且这次连子树一起没了。
    //
    // 脱节的后果：重建出来的 `wp-content` 是个空壳（children: null），
    // 而 `ensureLoaded` 开头是 `if (loadedSet.has(path)) return;` ——
    // 「节点是空的」与「已经读过了」同时成立，于是永远不被重读。
    // 症状：当前目录那一行显示成展开、下面一个子节点都没有
    // （用户 2026-10-19 真机反馈「展开后里面是空的」）。
    //
    // 注意要清的是**整棵子树**，不只是根自己：根下面那些**已展开的后代**
    // 同样随着重建一起没了，它们的记账留着就会变成同样的空壳。
    const vanished = new Set<string>();

    for (const p of previousRoots) {
      if (!nextRoots.has(p)) vanished.add(p);
    }

    for (const p of recreated) vanished.add(p);

    if (vanished.size > 0) {
      const nextLoaded = new Set(loadedSet.value);
      let touched = false;

      for (const p of loadedSet.value) {
        if (isUnderAnyOf(p, vanished)) {
          nextLoaded.delete(p);
          touched = true;
        }
      }

      if (touched) {
        loadedSet.value = nextLoaded;
      }
    }

    rootSet.value = nextRoots;
    nodes.value = next;

    // FORK-MODIFICATION 2026-10-19：重建出来的根必须**重新读一次**，
    // 而且不止根 —— 根下面**已展开的后代**也一起没了，得一并补读。
    //
    // `ensureLoaded` 的自动触发器只有 `expandedPaths` 的 watch，而「切回远程格」
    // 这个动作**通常不会改变 `expandedPaths`** —— 用户只是把活动面板换回来，
    // 没有导航，也就没有新的 `setSelectedPath`，watch 不触发。
    // 于是重建出来的空根永远没人去读：根那一行标签正确、展开箭头在，
    // 下面一个子节点都没有（用户 2026-10-19 装机实测截图）。
    //
    // 上一轮（交接文档 §15.1）只清了 `loadedSet` 记账 —— 把「已经读过了」
    // 这个**障碍**拆掉了，却没让读取**重新发生**。障碍没了，读取依然没人发起。
    // 这与 §13.2「修一条没人走的链路，等于没修」是同一类错误。
    //
    // ⚠️ 顺序必须是**父先子后**，而且**一个读完再读下一个**：
    // `loadChildren` 会把子节点整批换成新对象，
    // 子目录必须在自己的父目录读完之后**重新查一次**，
    // 否则拿到的是 detached 节点（内容写进了没人渲染的旧对象）。
    // 远程目录一次读取就是一次网络往返，并发读还会互相把对方的结果顶掉。
    const expanded = toValue(options.expandedPaths);
    const rereadChain = collectRereadChain(recreated, expanded);

    void (async () => {
      for (const p of rereadChain) {
        await ensureLoaded(p);
      }
    })();
  }

  /**
   * `path` 是否在 `roots` 里任一根之下（根本身或根的后代）。
   *
   * 根要**去掉尾斜杠**再拼前缀：本地盘符根是 `C:/`，
   * 直接拼成 `C://` 的话 `C:/Users` 永远匹配不上。
   */
  function isUnderAnyOf(path: string, roots: Set<string>): boolean {
    for (const root of roots) {
      const prefix = root.replace(/[\\/]+$/, '');

      if (!prefix) continue;

      if (path === root || path.startsWith(`${prefix}/`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 重建之后需要重读的路径链：**父先子后**。
   *
   * 先是重建出来的根（且仍在展开集合里的），然后是它们下面**已展开的后代**。
   * 后代按深度排序 —— 深度小的先读，父目录的 children 才有内容可查。
   */
  function collectRereadChain(roots: Set<string>, expanded: Set<string>): string[] {
    const chain: string[] = [];

    for (const root of roots) {
      if (expanded.has(root)) {
        chain.push(root);
      }
    }

    const descendants = [...expanded]
      .filter(p => !roots.has(p) && isUnderAnyOf(p, roots))
      .sort((a, b) => pathDepth(a) - pathDepth(b));

    chain.push(...descendants);

    return chain;
  }

  return {
    rows,
    loadedPaths,
    ensureLoaded,
    ensureAncestorsLoaded,
    addRoot,
    invalidate,
  };
}

function buildRoots(paths: string[], labels?: Record<string, string>): FileTreeNode[] {
  return paths.map((p) => ({
    path: p,
    name: deriveRootName(p, labels),
    isDirectory: true,
    isExpanded: false,
    isLoaded: false,
    depth: 0,
    children: null,
  }));
}

/**
 * 路径的层级数 —— 用来把一组路径排成**父先子后**。
 *
 * 只数分隔符段数：`sfm://remote/<id>/vol1/@team/wp_root/wp-content`
 * 与 `C:/Users/foo` 都满足「父的段数比子少 1」，排序结果一致。
 * 用段数而不是「字符串长度」：远程路径的段名长度差异很大，
 * 用长度排会把 `.../wp-content` 排到 `.../wp-content/themes` 前面去。
 */
function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

/** v6.4: derive a display name for a root path. Order:
 *  1. Caller-provided label (e.g. drive volume name) for the exact path.
 *  2. Basename of the path, treating both `/` and `\` as separators and
 *     collapsing consecutive separators (so trailing slash / backslash
 *     doesn't produce an empty name). */
function deriveRootName(path: string, labels?: Record<string, string>): string {
  if (labels && labels[path]) return labels[path];
  const parts = path.split(/[\\/]+/).filter(Boolean);
  if (parts.length > 0) return parts[parts.length - 1];
  return path;
}

function defaultDeps(): UseFileTreeDeps {
  return {
    readDir: async (path: string): Promise<DirEntry[]> => {
      const contents = await resolveDirectoryContents(path);
      return contents.entries;
    },
  };
}
