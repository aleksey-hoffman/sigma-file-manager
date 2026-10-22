// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 「比较并同步」对话框里有两处不能靠肉眼保证的不变量：
 * 「取消」按钮在后台任务真正注册之前必须禁用；任务结束后必须复位。
 *
 * 这里用**源码断言**而不是组件挂载 —— 这个对话框依赖 tauri 的 invoke/event、
 * vue-i18n 和一整套 UI 组件，挂起来的代价远大于它能多覆盖的东西。
 * 仓库里 `remote-nav-panel.test.ts` 也是同一套路。
 *
 * 2026-10-22 真机验收实测过这个窗口：点「开始同步」后 6 毫秒点「取消」，
 * 取消失败（「没有正在跑的比较同步任务」），任务照跑完 3000 个文件。
 */
const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/navigator/components/compare-sync/compare-sync-dialog.vue',
  ),
  'utf8',
);

describe('比较并同步对话框的取消按钮', () => {
  it('「取消」按钮在没有后台任务时必须禁用', () => {
    expect(source).toContain(':disabled="!jobStarted"');
  });

  it('任务真正跑起来之后才把 jobStarted 打开', () => {
    // start_compare_sync_job 的 IPC 返回 = Rust 侧已把任务写进注册表。
    const startCall = source.indexOf('await invoke(\'start_compare_sync_job\'');
    const jobStartedTrue = source.indexOf('jobStarted.value = true;', startCall);

    expect(startCall).toBeGreaterThan(-1);
    expect(jobStartedTrue).toBeGreaterThan(startCall);
  });

  it('任务结束后要复位，否则再来一轮会点不动取消', () => {
    const finishedHandler = source.indexOf('\'compare-sync-job-finished\'');
    const reset = source.indexOf('jobStarted.value = false;', finishedHandler);

    expect(finishedHandler).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(finishedHandler);
  });

  it('打开对话框时也要复位', () => {
    const openWatcher = source.indexOf('watch(() => props.open');
    const reset = source.indexOf('jobStarted.value = false;', openWatcher);

    expect(openWatcher).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(openWatcher);
  });
});
