// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  buildRemotePath,
  getRemoteParentPath,
  isRemoteConnectionRootPath,
  isRemotePath,
  parseRemotePath,
} from '@/utils/remote-paths';

/** 一格窗格的当前位置。联动判定只认这两个字段。 */
export interface LinkedPanePosition {
  tabId: string;
  path: string;
}

/**
 * 联动导航的目标：一格窗格 + 它该去的目录。
 * 同时充当「我们自己刚让它去的地方」，用来识别回声、掐断互相触发。
 */
export type LinkedPaneTarget = LinkedPanePosition;

/** 路径的最后一段（目录名）。远程与本地各走各的切法。 */
export function getPathLastSegment(path: string): string {
  const parsed = parseRemotePath(path);

  if (parsed) {
    const segments = parsed.remotePath.split('/').filter(segment => segment.length > 0);

    return segments.length > 0 ? segments[segments.length - 1] : '';
  }

  const trimmed = path.replace(/[\\/]+$/, '');

  // 盘符根没有「目录名」可言。必须挡在「没有分隔符」的早退**之前** ——
  // `E:/` 剥掉尾斜杠就是 `E:`，它正好没有分隔符，先 return 就永远走不到这里。
  // 不挡的话 `E:` 会被当成目录名，接成 `…/wp_root/E:` —— 一个哪边都不存在的目录。
  if (/^[A-Z]:$/i.test(trimmed)) return '';

  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));

  return cut === -1 ? trimmed : trimmed.slice(cut + 1);
}

/**
 * 上级目录。已经在根上返回 `null` —— 对应关系不越出根。
 *
 * 「根」的两种：本地盘符根 `E:/`，远程连接根 `sfm://remote/<连接id>`。
 * 注意 `getRemoteParentPath` 在连接根上返回的是 `sfm://remote`（去掉 `/<连接id>`），
 * 那不是一条能进树的路径，所以这里要自己先挡一道。
 */
export function getPathParent(path: string): string | null {
  if (!path) return null;

  if (isRemotePath(path)) {
    return isRemoteConnectionRootPath(path) ? null : getRemoteParentPath(path);
  }

  if (/^[A-Z]:\/?$/i.test(path)) return null;

  // 反斜杠先归一：Rust 层的 `normalize_path` 产出的一律是 `/`，
  // 这里若原样切片就会冒出 `E:\website_sbt` 这种混合格式，
  // 拿去当对应表的 key 与应用里的 `E:/website_sbt` 对不上。
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const cut = trimmed.lastIndexOf('/');

  if (cut === -1) return null;
  if (cut === 0) return '/';

  const parent = trimmed.slice(0, cut);

  return /^[A-Z]:$/i.test(parent) ? `${parent}/` : parent;
}

/**
 * 把一段目录名接到当前路径上。本地与远程各走各的拼接规则 ——
 * 远程不能直接字符串拼 `a/b`，那会绕过 `parseRemotePath` 的规范化。
 */
export function appendPathSegment(currentPath: string, name: string): string | null {
  const parsed = parseRemotePath(currentPath);

  if (parsed) {
    return buildRemotePath(parsed.connectionId, `${parsed.remotePath}/${name}`);
  }

  // 本地：剥掉尾斜杠再接，盘符根 `E:/` 因此会得到 `E:/name` 而不是 `E:name`。
  return `${currentPath.replace(/[\\/]+$/, '')}/${name}`;
}

/**
 * 两格之间「哪条路径对应哪条路径」的表。
 *
 * FORK-MODIFICATION 2026-10-19，用户实测反馈 2：
 * 「从子目录提升到上一级目录时，由于建立关联的目录名称不同，无法同步切换」。
 *
 * 只按目录名对齐解决不了「上一级」：本地 `wp-content` 的父级是 `E:/website_sbt`，
 * 远端 `wp_root/wp-content` 的父级是 `…/wp_root`。两边名字根本不同，
 * 按名算出来的目标是 `…/wp_root/wp-content/website_sbt` —— 两边都不对。
 *
 * 所以每成功同步一次，就把这一对连同**它们的父级**一起记下来。
 * 这就是用户说的「建立固定的关联」：关联不是配置出来的，
 * 是两格真正同步成功过的事实 —— 那种对应关系才敢信。
 *
 * key 就是路径本身。远程路径带 `sfm://` 前缀，和本地路径不会撞。
 */
export type LinkedPanePairs = Map<string, string>;

/**
 * 对应表的 key 规范化。
 *
 * 应用里的路径本来就是 `/` 分隔（Rust 层 `normalize_path` 的产出），
 * 但用户可以在地址栏手输反斜杠，`E:\website_sbt` 和 `E:/website_sbt`
 * 指的是同一个目录却在表里占两个 key，关联就漏了。
 */
function pairKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');

  if (!normalized) return '/';
  // `E:` 和 `E:/` 是同一个盘符根，别让它俩各占一个 key。
  return /^[A-Z]:$/i.test(normalized) ? `${normalized}/` : normalized;
}

/**
 * 对应表上限。超了就整表清空 ——
 * 与其维护一个 LRU（还得保证两个方向的 key 一起淘汰），不如丢掉重来：
 * 用户再导航两三次就重新建立起来了，而长会话里无限增长才是真问题。
 */
export const LINKED_PANE_PAIR_LIMIT = 512;

/**
 * 记下一对跨族路径，并连带记下它们的父级。
 *
 * 父级那对才是「上一级」能同步的关键：进 `wp-content` 时记下
 * `wp-content ↔ wp_root/wp-content`，同时记下 `E:/website_sbt ↔ …/wp_root`，
 * 于是点「上一级」时左格报 `E:/website_sbt`，直接查到远端的 `…/wp_root`。
 */
export function recordLinkedPanePair(
  pairs: LinkedPanePairs,
  firstPath: string,
  secondPath: string,
  limit = LINKED_PANE_PAIR_LIMIT,
): void {
  if (!firstPath || !secondPath || pairKey(firstPath) === pairKey(secondPath)) {
    return;
  }

  pairs.set(pairKey(firstPath), pairKey(secondPath));
  pairs.set(pairKey(secondPath), pairKey(firstPath));

  const firstParent = getPathParent(firstPath);
  const secondParent = getPathParent(secondPath);

  if (firstParent && secondParent) {
    pairs.set(pairKey(firstParent), pairKey(secondParent));
    pairs.set(pairKey(secondParent), pairKey(firstParent));
  }

  if (pairs.size > limit) {
    pairs.clear();
  }
}

/** 查已建立的对应关系。没有返回 `null`。 */
export function lookupLinkedPanePair(
  pairs: ReadonlyMap<string, string> | undefined,
  path: string,
): string | null {
  if (!pairs || !path) return null;

  return pairs.get(pairKey(path)) ?? null;
}

/**
 * 联动闸门：这一次路径变化到底该不该联动。
 *
 * 抽出来是为了能测 —— 它在 `navigator.vue` 里，原地实现就只能靠肉眼。
 * 三条规则的判据都写在这里：
 *
 * - `blocked`：联动没开。这条是总的闸。
 * - `echo`：这一格就是被我们指挥过去的那一格 —— 不掐断就是两格无限互踩。
 * - `settle`：这一格的**首次**上报。打开连接时两格各自挂载、各自加载，
 *   先后顺序不定；先加载完的那一格会把「刚打开的路径」当成用户操作，
 *   指挥另一格跳到自己路径的最后一段，把两端都推离各自的默认目录
 *   （`localPath` / `initialPath`）。所以首次只记账。
 * - `wait`：还有格没就位。对方可能马上就会自己加载到它的默认路径，
 *   这时候指挥它跳转只会互相覆盖。
 */
export type LinkedPaneGateDecision = 'blocked' | 'echo' | 'settle' | 'wait' | 'sync';

export function decideLinkedPaneGate(options: {
  isLinkedMode: boolean;
  fromTabId: string;
  fromPath: string;
  allTabIds: readonly string[];
  settledTabIds: ReadonlySet<string>;
  pending: LinkedPaneTarget | null;
}): LinkedPaneGateDecision {
  if (!options.isLinkedMode) {
    return 'blocked';
  }

  if (options.pending?.tabId === options.fromTabId && options.pending.path === options.fromPath) {
    return 'echo';
  }

  if (!options.settledTabIds.has(options.fromTabId)) {
    return 'settle';
  }

  return options.allTabIds.every(tabId => options.settledTabIds.has(tabId))
    ? 'sync'
    : 'wait';
}

/**
 * 算出「这一格动了之后，另一格该去哪」。
 *
 * 三条规则，顺序不能换：
 *
 * 1. **回声直接丢掉。** 我们让右格导航之后，右格会再报一次路径变化；
 *    不挡就是无限互相触发。这里比对的是「我们自己刚下发的那个目标」，
 *    所以用户手动把那一格改回同一路径不会被误吞 —— 下发一次只认一次。
 * 2. **同族走绝对路径。** 本地 ↔ 本地、远程 ↔ 远程，另一格跳到**同一个绝对目录**。
 *    这是这个功能一直以来的行为，别顺手改成相对拼接。
 * 3. **跨族先查已建立的对应关系**，查不到才按目录名对齐。
 *    - 已建立的关系（`recordLinkedPanePair` 记下来的）优先级最高：
 *      它覆盖的是「目录名根本不同」的那一类，最典型的是点「上一级」。
 *    - 按名对齐覆盖的是「进同名子目录」：进 `wp-content` 时另一边也进 `wp-content`。
 *    跨族照搬绝对路径是错的：把 `E:/website_sbt/wp-content` 丢给远端格，
 *    那一格就整个变成本地目录。
 *
 * ⚠️ 跨族对齐有个已知后果：远端站点根 `wp_root` 里的 `wp-content` 是
 * WordPress 镜像自带的空残桩（只有一个 0 字节 `index.php`），
 * 真正的内容在同级的 `wp_content/`。所以从本地进 `wp-content` 时，
 * 远端那一格会停在一个看起来是空的目录 —— 那是数据布局本身如此，不是同步失败。
 */
export function planLinkedPaneNavigation(options: {
  fromTabId: string;
  fromPath: string;
  panes: readonly LinkedPanePosition[];
  pending: LinkedPaneTarget | null;
  /** 跨族对应关系表。可选 —— 没传就退回纯按名对齐（旧行为）。 */
  pairs?: ReadonlyMap<string, string>;
}): LinkedPaneTarget | null {
  const { fromTabId, fromPath, panes, pending } = options;

  // 规则 1：回声。
  if (pending && pending.tabId === fromTabId && pending.path === fromPath) {
    return null;
  }

  if (panes.length < 2) {
    return null;
  }

  const other = panes.find(pane => pane.tabId !== fromTabId);

  if (!other || !fromPath || !other.path) {
    return null;
  }

  // 规则 2：同族。
  if (isRemotePath(fromPath) === isRemotePath(other.path)) {
    return {
      tabId: other.tabId,
      path: fromPath,
    };
  }

  // 规则 3a：已建立的对应关系。目录名不同也能对上。
  const known = lookupLinkedPanePair(options.pairs, fromPath);

  if (known && known !== pairKey(fromPath)) {
    return {
      tabId: other.tabId,
      path: known,
    };
  }

  // 规则 3b：按目录名对齐，只带最后一段。
  const name = getPathLastSegment(fromPath);

  if (!name) {
    return null;
  }

  const target = appendPathSegment(other.path, name);

  return target
    ? {
        tabId: other.tabId,
        path: target,
      }
    : null;
}
