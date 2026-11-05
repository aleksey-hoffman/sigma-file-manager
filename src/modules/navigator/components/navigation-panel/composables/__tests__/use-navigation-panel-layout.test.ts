// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { INFO_PANEL_LAYOUT } from '@/modules/navigator/constants/info-panel';

const {
  isSmallScreenMock,
  userSettingsMock,
  setUserSettingMock,
} = vi.hoisted(() => ({
  isSmallScreenMock: { value: false },
  userSettingsMock: {
    navigator: {
      navigationPanel: {
        show: false,
        widthPx: null as number | null,
      },
    },
  },
  setUserSettingMock: vi.fn(),
}));

vi.mock('@/composables/use-responsive-query', () => ({
  useIsSmallScreen: () => isSmallScreenMock,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: userSettingsMock,
    set: setUserSettingMock,
  }),
}));

import { useNavigationPanelLayout } from '../use-navigation-panel-layout';

describe('useNavigationPanelLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isSmallScreenMock.value = false;
    userSettingsMock.navigator.navigationPanel.show = false;
    userSettingsMock.navigator.navigationPanel.widthPx = null;
    setUserSettingMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed with no width by default', () => {
    const layout = useNavigationPanelLayout();

    expect(layout.showNavigationPanel.value).toBe(false);
    expect(layout.navigationPanelWidthPx.value).toBe(0);
    expect(layout.isNavigationPanelHandleCollapsed.value).toBe(true);
  });

  it('restores an open panel at the saved width', () => {
    userSettingsMock.navigator.navigationPanel.show = true;
    userSettingsMock.navigator.navigationPanel.widthPx = 320;

    const layout = useNavigationPanelLayout();

    expect(layout.showNavigationPanel.value).toBe(true);
    expect(layout.navigationPanelSlideVisible.value).toBe(true);
    expect(layout.navigationPanelUsesFixedWidth.value).toBe(false);
    expect(layout.navigationPanelWidthPx.value).toBe(320);
  });

  it('animates open to the default width and settles when the transition ends', () => {
    const layout = useNavigationPanelLayout();

    layout.toggleNavigationPanel();

    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.navigationPanel.show', true);
    expect(layout.showNavigationPanel.value).toBe(true);
    expect(layout.isNavigationPanelVisibilityAnimating.value).toBe(true);
    expect(layout.navigationPanelUsesFixedWidth.value).toBe(true);
    expect(layout.navigationPanelWidthPx.value).toBe(260);

    layout.handleNavigationPanelWidthTransitionEnd();

    expect(layout.isNavigationPanelVisibilityAnimating.value).toBe(false);
    expect(layout.navigationPanelUsesFixedWidth.value).toBe(false);
    expect(layout.isNavigationPanelHandleCollapsed.value).toBe(false);
  });

  it('ignores toggles while the panel is animating', () => {
    const layout = useNavigationPanelLayout();

    layout.toggleNavigationPanel();
    layout.toggleNavigationPanel();

    expect(layout.navigationPanelSlideVisible.value).toBe(true);
    expect(setUserSettingMock).toHaveBeenCalledTimes(1);
  });

  it('saves the closed state when closing starts and finishes on the fallback timer', () => {
    userSettingsMock.navigator.navigationPanel.show = true;
    const layout = useNavigationPanelLayout();

    layout.toggleNavigationPanel();

    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.navigationPanel.show', false);
    expect(layout.showNavigationPanel.value).toBe(true);
    expect(layout.navigationPanelSlideVisible.value).toBe(false);
    expect(layout.isNavigationPanelHandleCollapsed.value).toBe(true);

    vi.advanceTimersByTime(INFO_PANEL_LAYOUT.SIZE_TRANSITION_MS + 100);

    expect(layout.showNavigationPanel.value).toBe(false);
    expect(layout.navigationPanelWidthPx.value).toBe(0);
  });

  it('settles a running transition when disposed', () => {
    userSettingsMock.navigator.navigationPanel.show = true;
    const layout = useNavigationPanelLayout();

    layout.toggleNavigationPanel();
    layout.disposeNavigationPanelLayout();

    expect(layout.showNavigationPanel.value).toBe(false);
    expect(layout.isNavigationPanelVisibilityAnimating.value).toBe(false);
  });

  it('closes a zero-width panel without animating', () => {
    userSettingsMock.navigator.navigationPanel.show = true;
    const layout = useNavigationPanelLayout();

    layout.setNavigationPanelWidthPx(0);
    layout.toggleNavigationPanel();

    expect(layout.showNavigationPanel.value).toBe(false);
    expect(layout.isNavigationPanelVisibilityAnimating.value).toBe(false);
  });

  it('toggles without animating on small screens', () => {
    isSmallScreenMock.value = true;
    const layout = useNavigationPanelLayout();

    layout.toggleNavigationPanel();

    expect(layout.showNavigationPanel.value).toBe(true);
    expect(layout.isNavigationPanelVisibilityAnimating.value).toBe(false);
    expect(layout.navigationPanelWidthPx.value).toBe(260);
  });

  it('does not save a collapsed width', () => {
    const layout = useNavigationPanelLayout();

    layout.persistNavigationPanelWidth();

    expect(setUserSettingMock).not.toHaveBeenCalled();
  });
});
