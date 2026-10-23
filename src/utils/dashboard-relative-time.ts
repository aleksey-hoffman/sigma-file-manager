// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）。
//
// 本仓原来在 `dashboard.vue` 里内联了一份一模一样的 `formatRelativeTime`，
// 这里抽成纯模块，让「历史」页签和新的「条目添加时间」共用同一份实现 ——
// 两处各写一遍迟早漂移（upstream 就是因为新增了第二个使用点才把它抽出来的）。
//
// `translate` 由调用方注入，模块本身不依赖 i18n，方便直接单测。

export function formatDashboardRelativeTime(
  timestamp: number,
  translate: (key: string, count?: number) => string,
): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return translate('dashboard.justNow');
  }

  if (diffMinutes < 60) {
    return translate('dashboard.minutesAgo', diffMinutes);
  }

  if (diffHours < 24) {
    return translate('dashboard.hoursAgo', diffHours);
  }

  return translate('dashboard.daysAgo', diffDays);
}
