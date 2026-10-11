// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/**
 * 窄侧栏的分区短标签（2026-10-11 新增）。
 *
 * 左下角磁盘图标所在的那一栏只有 24px 宽，塞不下 `Win (C:)` 这样的
 * 完整卷标名，且多块磁盘的图标长得一模一样、无法区分。
 * 本函数负责压出一个「短但唯一」的标识，叠在图标下方显示。
 */

/** 短标签的最大字符数。超过则截断并加省略号。 */
const MAX_LABEL_LENGTH = 8;

/**
 * 从挂载点提取用于窄侧栏的短标签。
 *
 * 刻意用 `mount_point` 而不是 `name`：
 * - `name` 的格式是 `卷标 (盘符)`（Rust 侧 dir_reader/drives.rs 生成），
 *   解析它要处理「卷标里自带括号」「卷标为空」等边界情况；
 * - `mount_point` 本身形如 `C:\` / `\\server\share` / `/`，
 *   切出来的结果稳定，且跨平台表现一致。
 *
 * 盘符**不带冒号**（只留字母）。窄侧栏宽 24px，字高已放大到 12px，
 * 冒号在这个尺寸下既不增加辨识度、又把字宽撑大，挤掉描边的留白。
 * 去掉后同一个字母能被认得更准 —— 而认错分区是要付代价的。
 *
 * 截断是硬要求：网络路径可能非常长，绝不允许撑破侧栏布局。
 */
export function getDriveShortLabel(mountPoint: string | null | undefined): string {
  const value = mountPoint ?? '';

  if (value === '') {
    return '';
  }

  // UNC 与 Unix 挂载根：\\server\share -> share；/ -> /
  if (value.startsWith('\\\\')) {
    const segments = value.replace(/\\+$/, '').split('\\').filter(Boolean);
    const label = segments[segments.length - 1] ?? '';

    return truncate(label);
  }

  // Windows 盘符：C:\ -> C（去冒号）。同时兼容 `D:` 这种无尾反斜杠的写法。
  const windowsDrive = value.match(/^([A-Za-z]):/);

  if (windowsDrive) {
    return windowsDrive[1].toUpperCase();
  }

  // Unix 挂载点：/data -> data；根目录 / 原样返回。
  const trimmed = value.replace(/[/\\]+$/, '');
  const label = trimmed === '' ? value : (trimmed.split(/[/\\]/).pop() ?? '');

  return truncate(label);
}

function truncate(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}
