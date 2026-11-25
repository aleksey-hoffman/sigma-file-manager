// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type NavigatorPaneSwitchTarget
  = | { kind: 'navigation-panel' }
    | {
      kind: 'pane';
      paneIndex: number;
    };

export function getNavigatorPaneSwitchTarget(options: {
  direction: 'left' | 'right';
  paneCount: number;
  activePaneIndex: number;
  isNavigationPanelOpen: boolean;
  isNavigationPanelFocused: boolean;
}): NavigatorPaneSwitchTarget | null {
  if (options.isNavigationPanelFocused) {
    return options.direction === 'right'
      ? {
          kind: 'pane',
          paneIndex: 0,
        }
      : null;
  }

  if (options.direction === 'left' && options.activePaneIndex === 0 && options.isNavigationPanelOpen) {
    return { kind: 'navigation-panel' };
  }

  if (options.paneCount < 2) {
    return null;
  }

  return {
    kind: 'pane',
    paneIndex: options.direction === 'left' ? 0 : 1,
  };
}
