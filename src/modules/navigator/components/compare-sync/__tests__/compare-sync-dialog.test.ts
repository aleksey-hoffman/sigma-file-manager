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

/**
 * 2026-10-22 真机缺陷的第二组不变量。
 *
 * 背景：用户反馈「比较与同步」进度非常缓慢，最后变成报错页面。
 * 查下来是两件事：
 *   1. 后端撞上**任何一个读不了的子目录**就让整个比较失败
 *      （根因在 Rust 侧，由 `an_unreadable_directory_is_skipped…` 锁死）；
 *   2. 收集一棵大树的过程中**一点进度都没有**，界面看上去就是卡死了；
 *      而且结果树会一次性摊平渲染，条目一多 DOM 就胀到操作不动。
 *
 * 这里锁的是前端那半边：进度事件必须被订阅、必须按 jobId 对号入座、
 * 比较时必须把 jobId 传给后端（不传就收不到进度），以及结果行不能一次性全渲染。
 */
describe('比较与同步对话框的进度指示', () => {
  it('必须订阅 compare-progress 事件', () => {
    expect(source).toContain("'compare-progress'");
  });

  it('进度事件要按 jobId 对号入座，否则会串到别的任务上', () => {
    const listener = source.indexOf("'compare-progress'");
    const filter = source.indexOf('event.payload.jobId !== compareJobId.value', listener);

    expect(listener).toBeGreaterThan(-1);
    expect(filter).toBeGreaterThan(listener);
  });

  it('比较时要把 jobId 传给后端 —— 不传就收不到进度事件', () => {
    const compareCall = source.indexOf("invoke<CompareResponse>('compare_directories'");
    const jobId = source.indexOf('jobId: compareJobId.value', compareCall);

    expect(compareCall).toBeGreaterThan(-1);
    expect(jobId).toBeGreaterThan(compareCall);
  });

  it('预览也要传 jobId，否则预览阶段同样没有进度', () => {
    const previewCall = source.indexOf("invoke<ComparePlanResponse>('preview_compare_sync'");
    const jobId = source.indexOf('jobId: compareJobId.value', previewCall);

    expect(previewCall).toBeGreaterThan(-1);
    expect(jobId).toBeGreaterThan(previewCall);
  });

  it('进度条上要显示当前在干什么', () => {
    expect(source).toContain('compareProgressLabel');
    expect(source).toContain('compareProgressDetail');
  });
});

describe('比较与同步对话框的结果渲染上限', () => {
  it('结果行不能一次性全渲染出去', () => {
    expect(source).toContain('const RENDER_PAGE = 2000;');
    expect(source).toContain('allRows.value.slice(0, renderLimit.value)');
  });

  it('条目太多时必须明说一共多少条，不能让人以为那就是全部', () => {
    expect(source).toContain("t('compareSync.rowsTruncated'");
    expect(source).toContain('v-if="hasMoreRows"');
  });

  it('换了筛选条件要回到渲染上限的起点', () => {
    const watcher = source.indexOf('watch(filter,');
    const reset = source.indexOf('renderLimit.value = RENDER_PAGE;', watcher);

    expect(watcher).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(watcher);
  });
});
