// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 「点导航栏里的一条远程连接」这件事本身。
//
// **从 nav-sidebar.vue 里抽出来，只为了能测。** 留在组件里的话，
// 「有没有切到导航器页」「切页和开标签组的先后」这两条就只能靠读源码断言 ——
// 而它们恰恰是最容易在重构中被悄悄弄坏的：切页挪到开标签之后，看起来没差别，
// 但 FileBrowser 那时还没挂载，`init()` 读不到新建的 tab，那一格会停在空路径上。
//
// 依赖用参数注入而不是直接 import router / workspaces store：
// 本仓的 router 会把整张路由表拖进来，在没有完整应用上下文的测试环境里
// `routes is not iterable` 直接崩（`remote-category.test.ts` 顶部有同样的说明）。

import type { RemoteConnection } from '@/types/remote';
import { buildRemotePath, normalizeRemotePath } from '@/utils/remote-paths';
import { resolveRemoteOpenPanes } from './remote-panes';

/** 抽出来是为了能在测试里断言顺序与参数，同时把真实实现留在组件那边。 */
export interface RemoteOpenActions {
  /** 切到导航器页。必须被 await。 */
  navigateToNavigator: () => Promise<unknown>;
  /** 开一组标签页，paths 的顺序即左右。 */
  openPanes: (paths: string[]) => Promise<void>;
}

/**
 * 连一个远程连接：先切到导航器页，再开一组标签页。
 *
 * 用户 2026-10-18 的三条要求都在这里：
 * 1. 远端那一格必须真的指向远端 —— 摆几格由 `resolveRemoteOpenPanes` 判定。
 * 2. 在其他页面点菜单也要切到导航器 —— 所以**无条件**先导航。
 * 3. 没有保存或录入密码时同样要切页、同样开两格 —— 所以**不看密码**。
 *    远端那一格自己去要凭据，而不是在这里静默不开。
 *
 * 连接 id 非法时什么都不做：那不是一个能构造出路径的 id，硬开只会得到一格
 * 打不开的远程路径。
 *
 * 远端那一格落在连接配置的 `initialPath` 上，**不是**连接根。
 * 这一点在 2026-10-19 之前是错的：`buildRemoteConnectionPath` 只吃 `id`，
 * 产出恒为 `sfm://remote/<id>`，`initialPath` 存了但没人读 ——
 * 用户在设置里填好路径，连接后照样落在远程根，每次都得手动翻进去。
 * `buildRemotePath(id, '/')` 的产出与旧的连接根**逐字相同**，
 * 所以改成它对 `initialPath` 为 `/` 的连接没有任何行为变化。
 */
export async function openRemoteConnection(
  connection: RemoteConnection,
  actions: RemoteOpenActions,
): Promise<void> {
  // 存储侧保存时已经规范化过，这里再过一次是因为 `RemoteConnection`
  // 可以从别的构造路径进来（导入、测试、未来的迁移脚本），
  // 而 `buildRemotePath` 碰到 `.` / `..` 段会直接返回 `null` ——
  // 那会让「初始路径非法」变成「点了连接什么都没发生」，比落到根更难查。
  const initialPath = normalizeRemotePath(connection.initialPath) ?? '/';
  const remotePath = buildRemotePath(connection.id, initialPath);

  if (!remotePath) {
    return;
  }

  // 单传当前这一条：判定只看「这个连接有没有本地目录」，
  // 把整个列表塞进去不会让结果不同，却会让读代码的人以为还有别的用途。
  const panes = resolveRemoteOpenPanes(remotePath, [connection]);

  await actions.navigateToNavigator();
  await actions.openPanes(panes.map(pane => pane.path));
}

/**
 * 从悬停面板直接进某条连接的编辑表单：先记下请求，再跳设置页。
 *
 * 顺序**不能反**：设置页的远程分类靠 `onMounted` 消费这个请求，
 * 反过来就是「点了设置只是跳到了远程分类，表单不打开」。
 */
export async function editRemoteConnection(
  connection: RemoteConnection,
  actions: {
    requestEdit: (id: string) => void;
    openSettingsTab: (tab: string) => Promise<void>;
  },
): Promise<void> {
  actions.requestEdit(connection.id);
  await actions.openSettingsTab('remote');
}
