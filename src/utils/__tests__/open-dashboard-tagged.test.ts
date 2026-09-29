// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import { openDashboardTagged } from '@/utils/open-dashboard-tagged';
import { ORPHANED_TAG_ID } from '@/utils/tagged-sections';

describe('openDashboardTagged', () => {
  it('pushes the dashboard tagged query', () => {
    const router = {
      push: vi.fn().mockResolvedValue(undefined),
    } as unknown as Router;

    openDashboardTagged(router, 'tag-work');

    expect(router.push).toHaveBeenCalledWith({
      name: 'dashboard',
      query: {
        tab: 'tagged',
        tag: 'tag-work',
      },
    });
  });

  it('can open the orphaned tag row', () => {
    const router = {
      push: vi.fn().mockResolvedValue(undefined),
    } as unknown as Router;

    openDashboardTagged(router, ORPHANED_TAG_ID);

    expect(router.push).toHaveBeenCalledWith({
      name: 'dashboard',
      query: {
        tab: 'tagged',
        tag: ORPHANED_TAG_ID,
      },
    });
  });
});
