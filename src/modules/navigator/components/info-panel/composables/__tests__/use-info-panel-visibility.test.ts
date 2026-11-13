// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  effectScope,
  nextTick,
  reactive,
  ref,
  type EffectScope,
} from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useInfoPanelVisibility } from '../use-info-panel-visibility';

const setUserSettingMock = vi.hoisted(() => vi.fn());

let userSettingsMock: {
  navigator: {
    infoPanel: {
      show: boolean;
    };
  };
};

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    get userSettings() {
      return userSettingsMock;
    },
    set: setUserSettingMock,
  }),
}));

let visibilityScope: EffectScope | undefined;

function createVisibility(isSmallScreen = ref(false)) {
  visibilityScope?.stop();
  visibilityScope = effectScope();
  const isInfoPanelVisibilityAnimating = ref(false);
  const showInfoPanelAnimated = vi.fn(async () => {});
  const hideInfoPanelAnimated = vi.fn(async () => {});
  const visibility = visibilityScope.run(() => useInfoPanelVisibility({
    isSmallScreen,
    showInfoPanelAnimated,
    hideInfoPanelAnimated,
    isInfoPanelVisibilityAnimating,
  }));

  if (!visibility) {
    throw new Error('Info panel visibility scope did not start');
  }

  return {
    ...visibility,
    isSmallScreen,
    isInfoPanelVisibilityAnimating,
    showInfoPanelAnimated,
    hideInfoPanelAnimated,
  };
}

describe('useInfoPanelVisibility', () => {
  afterEach(() => {
    visibilityScope?.stop();
    visibilityScope = undefined;
  });

  beforeEach(() => {
    userSettingsMock = reactive({
      navigator: {
        infoPanel: {
          show: true,
        },
      },
    });
    setUserSettingMock.mockReset().mockImplementation(async (key: string, value: boolean) => {
      if (key !== 'navigator.infoPanel.show') {
        return;
      }

      userSettingsMock.navigator.infoPanel.show = value;
    });
  });

  it('starts open when the setting is shown', () => {
    const visibility = createVisibility();

    expect(visibility.showInfoPanel.value).toBe(true);
    expect(visibility.infoPanelSlideVisible.value).toBe(true);
  });

  it('starts closed when the setting is hidden', () => {
    userSettingsMock.navigator.infoPanel.show = false;
    const visibility = createVisibility();

    expect(visibility.showInfoPanel.value).toBe(false);
    expect(visibility.infoPanelSlideVisible.value).toBe(false);
  });

  it('persists a close before the hide animation and does not animate twice', async () => {
    const visibility = createVisibility();

    visibility.hideInfoPanelAnimated.mockImplementation(async () => {
      expect(visibility.showInfoPanel.value).toBe(true);
      expect(visibility.infoPanelSlideVisible.value).toBe(false);
      expect(userSettingsMock.navigator.infoPanel.show).toBe(false);
    });

    await visibility.handleToggleInfoPanel();

    expect(setUserSettingMock).toHaveBeenCalledTimes(1);
    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.infoPanel.show', false);
    expect(visibility.hideInfoPanelAnimated).toHaveBeenCalledOnce();
    expect(visibility.showInfoPanelAnimated).not.toHaveBeenCalled();
    expect(visibility.showInfoPanel.value).toBe(false);
    expect(visibility.infoPanelSlideVisible.value).toBe(false);
  });

  it('persists an open before the show animation', async () => {
    userSettingsMock.navigator.infoPanel.show = false;
    const visibility = createVisibility();

    visibility.showInfoPanelAnimated.mockImplementation(async () => {
      expect(visibility.showInfoPanel.value).toBe(true);
      expect(visibility.infoPanelSlideVisible.value).toBe(true);
      expect(userSettingsMock.navigator.infoPanel.show).toBe(true);
    });

    await visibility.handleToggleInfoPanel();

    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.infoPanel.show', true);
    expect(visibility.showInfoPanelAnimated).toHaveBeenCalledOnce();
    expect(visibility.hideInfoPanelAnimated).not.toHaveBeenCalled();
    expect(visibility.showInfoPanel.value).toBe(true);
    expect(visibility.infoPanelSlideVisible.value).toBe(true);
  });

  it('toggles without the width animation on a small screen', async () => {
    const visibility = createVisibility(ref(true));

    await visibility.handleToggleInfoPanel();

    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.infoPanel.show', false);
    expect(visibility.showInfoPanelAnimated).not.toHaveBeenCalled();
    expect(visibility.hideInfoPanelAnimated).not.toHaveBeenCalled();
    expect(visibility.showInfoPanel.value).toBe(false);
    expect(visibility.infoPanelSlideVisible.value).toBe(false);
  });

  it('follows a setting change from elsewhere with the same animation', async () => {
    const visibility = createVisibility();

    userSettingsMock.navigator.infoPanel.show = false;
    await nextTick();
    await vi.waitFor(() => {
      expect(visibility.hideInfoPanelAnimated).toHaveBeenCalledOnce();
    });

    expect(setUserSettingMock).not.toHaveBeenCalled();
    expect(visibility.showInfoPanel.value).toBe(false);
    expect(visibility.infoPanelSlideVisible.value).toBe(false);

    userSettingsMock.navigator.infoPanel.show = true;
    await vi.waitFor(() => {
      expect(visibility.showInfoPanelAnimated).toHaveBeenCalledOnce();
    });

    expect(setUserSettingMock).not.toHaveBeenCalled();
    expect(visibility.showInfoPanel.value).toBe(true);
    expect(visibility.infoPanelSlideVisible.value).toBe(true);
  });

  it('lets the close animation finish before an external open starts', async () => {
    function finishHidePlaceholder() {}

    let finishHide = finishHidePlaceholder;
    const visibility = createVisibility();

    visibility.hideInfoPanelAnimated.mockImplementation(() => new Promise<void>((resolve) => {
      finishHide = resolve;
    }));

    const togglePromise = visibility.handleToggleInfoPanel();
    await vi.waitFor(() => {
      expect(visibility.hideInfoPanelAnimated).toHaveBeenCalledOnce();
    });
    expect(visibility.showInfoPanel.value).toBe(true);
    expect(visibility.infoPanelSlideVisible.value).toBe(false);

    userSettingsMock.navigator.infoPanel.show = true;
    await nextTick();
    expect(visibility.showInfoPanelAnimated).not.toHaveBeenCalled();

    finishHide();
    await togglePromise;
    await vi.waitFor(() => {
      expect(visibility.showInfoPanelAnimated).toHaveBeenCalledOnce();
    });

    expect(visibility.showInfoPanel.value).toBe(true);
    expect(visibility.infoPanelSlideVisible.value).toBe(true);
    expect(setUserSettingMock).toHaveBeenCalledTimes(1);
    expect(setUserSettingMock).toHaveBeenCalledWith('navigator.infoPanel.show', false);
  });
});
