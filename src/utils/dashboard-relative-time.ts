// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

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
