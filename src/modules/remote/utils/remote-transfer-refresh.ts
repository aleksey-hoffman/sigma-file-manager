// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：传输完成后请「对面那一格」刷新。
//
// 用户反馈（2026-10-20）：远程文件点「下载到本地」之后，本地那一格**没有立刻**
// 出现刚下载的文件；上传同理 —— 远程那一格不刷新。
//
// 为什么是「通知 + 各自认领」，而不是「谁传的谁去刷新对面那一格」
// ------------------------------------------------------------------
// 执行传输的那一格是**源**，它并不知道对面是哪一格 —— 它只知道对面**在哪儿**
// （`remote-transfer-targets.ts` 里的路径登记表）。
// 让每一格自己认领「这个目录是不是我当前所在的」，有两个好处：
//
// - 不用在导航器里再登记一份「路径 → 刷新函数」的映射。那份映射会随窗格
//   重新挂载而失效（存进去的是旧组件实例的方法），而路径是稳定的。
// - 刷的是**自己**的当前目录，天然不会出现「刷的是上一处的目录」。
//
// 判定用**字符串全等**：路径的两端来自同一处 —— 传输目标取自
// `paneRefsMap` 里的窗格实时路径（`setRemoteTransferTargets` 登记的同一个值），
// 订阅方比对的也是自己窗格的 `currentPath`。两边逐字相同，
// 不需要再做一层路径归一化（而多一层归一化就多一处能写错的地方）。

/** 订阅者：收到「targetPath 这个目录里刚有东西进出」的信号。 */
export type RemoteTransferRefreshHandler = (targetPath: string) => void;

const handlers = new Set<RemoteTransferRefreshHandler>();

/**
 * 通知：「targetPath」这个目录里刚有东西进出。
 *
 * 没有订阅者时静默返回 —— 目标那一格没挂载（比如它在别的标签组里）时，
 * 用户切过去时自然会重新读目录，不需要在这里补偿。
 */
export function notifyRemoteTransferCompleted(targetPath: string): void {
  if (!targetPath) {
    return;
  }

  // 复制一份再遍历：处理函数里退订自己不会影响这一轮其它订阅者。
  for (const handler of [...handlers]) {
    try {
      handler(targetPath);
    }
    catch (error) {
      // 一个订阅者抛异常不能连累其它订阅者 —— 目标那一格刷不了是它的事，
      // 不能因为它而让这一格也刷不了。
      console.error('remote transfer refresh handler failed:', error);
    }
  }
}

/**
 * 订阅传输完成通知。返回**退订**函数，组件卸载时必须调用，
 * 否则退订不掉，处理器会一直留在模块级集合里。
 */
export function subscribeRemoteTransferCompleted(
  handler: RemoteTransferRefreshHandler,
): () => void {
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
  };
}

/**
 * 这一格是不是「目标那一格」。
 *
 * 刻意用**全等**而不是「归一化后比较」：两端的路径来自同一处
 * （窗格实例的 `currentPath`），逐字相同就是同一个目录。
 * 一旦开始做归一化，就得同时保证两边的归一化规则一致 ——
 * 而那正是最容易「一边改了另一边没改」的地方。
 */
export function isRemoteTransferTargetPane(
  targetPath: string,
  panePath: string | null | undefined,
): boolean {
  if (!targetPath || !panePath) {
    return false;
  }

  return targetPath === panePath;
}

/** 一次传输的结果汇总（只看「目标目录有没有可能变了」）。 */
export interface RemoteTransferOutcome {
  /** 成功传过去的文件数。 */
  transferredFiles: number;
  /** 成功建出来的目录数。 */
  transferredDirs: number;
  /** 因「目标已存在」而跳过的条目数。 */
  skippedCount: number;
  /** 失败的条目数。 */
  failureCount: number;
}

/**
 * 这一轮传输之后，目标那一格要不要重新读目录。
 *
 * 三种情况会改变目标目录的内容：
 * - 传过去了东西（文件或目录）—— 目录里多了条目；
 * - 传的过程中失败了 —— 目录上传是**递归**的，可能已经写进去一部分；
 * - 目标已存在而跳过 —— 目录内容**没变**，不刷新（刷新只是白读一次盘）。
 */
export function shouldRefreshTargetPane(outcome: RemoteTransferOutcome): boolean {
  return outcome.transferredFiles > 0
    || outcome.transferredDirs > 0
    || outcome.failureCount > 0;
}
