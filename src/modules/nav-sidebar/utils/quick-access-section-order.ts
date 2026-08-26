// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { QuickAccessSectionId } from '@/types/user-settings';

export const DEFAULT_QUICK_ACCESS_SECTION_ORDER: QuickAccessSectionId[] = [
  'favorites',
  'tagged',
];

function isQuickAccessSectionId(value: unknown): value is QuickAccessSectionId {
  return value === 'favorites' || value === 'tagged';
}

export function normalizeQuickAccessSectionOrder(order: unknown): QuickAccessSectionId[] {
  const seen = new Set<QuickAccessSectionId>();
  const nextOrder: QuickAccessSectionId[] = [];

  if (Array.isArray(order)) {
    for (const value of order) {
      if (!isQuickAccessSectionId(value) || seen.has(value)) {
        continue;
      }

      seen.add(value);
      nextOrder.push(value);
    }
  }

  for (const sectionId of DEFAULT_QUICK_ACCESS_SECTION_ORDER) {
    if (!seen.has(sectionId)) {
      nextOrder.push(sectionId);
    }
  }

  return nextOrder;
}
