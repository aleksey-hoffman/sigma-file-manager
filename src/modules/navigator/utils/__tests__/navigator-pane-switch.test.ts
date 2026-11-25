// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getNavigatorPaneSwitchTarget } from '@/modules/navigator/utils/navigator-pane-switch';

type SwitchOptions = Parameters<typeof getNavigatorPaneSwitchTarget>[0];

function getTarget(options: Partial<SwitchOptions>) {
  return getNavigatorPaneSwitchTarget({
    direction: 'left',
    paneCount: 1,
    activePaneIndex: 0,
    isNavigationPanelOpen: true,
    isNavigationPanelFocused: false,
    ...options,
  });
}

describe('getNavigatorPaneSwitchTarget', () => {
  it('moves left from the right pane to the left pane and then to the navigation panel', () => {
    expect(getTarget({
      paneCount: 2,
      activePaneIndex: 1,
    })).toEqual({
      kind: 'pane',
      paneIndex: 0,
    });
    expect(getTarget({ paneCount: 2 })).toEqual({ kind: 'navigation-panel' });
  });

  it('moves right from the navigation panel to the left pane and then to the right pane', () => {
    expect(getTarget({
      direction: 'right',
      paneCount: 2,
      activePaneIndex: 1,
      isNavigationPanelFocused: true,
    })).toEqual({
      kind: 'pane',
      paneIndex: 0,
    });
    expect(getTarget({
      direction: 'right',
      paneCount: 2,
    })).toEqual({
      kind: 'pane',
      paneIndex: 1,
    });
  });

  it('moves between the navigation panel and a single pane', () => {
    expect(getTarget({})).toEqual({ kind: 'navigation-panel' });
    expect(getTarget({
      direction: 'right',
      isNavigationPanelFocused: true,
    })).toEqual({
      kind: 'pane',
      paneIndex: 0,
    });
  });

  it('stays in place when there is nothing in that direction', () => {
    expect(getTarget({ isNavigationPanelFocused: true })).toBeNull();
    expect(getTarget({ direction: 'right' })).toBeNull();
    expect(getTarget({ isNavigationPanelOpen: false })).toBeNull();
  });

  it('keeps the left pane as the target in split view when the navigation panel is closed', () => {
    expect(getTarget({
      paneCount: 2,
      isNavigationPanelOpen: false,
    })).toEqual({
      kind: 'pane',
      paneIndex: 0,
    });
  });
});
