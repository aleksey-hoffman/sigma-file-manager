// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineComponent, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { useInfoPanelVideoPreview } from '../use-info-panel-video-preview';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {}

    async set(): Promise<void> {}

    async entries(): Promise<[string, unknown][]> {
      return [];
    }
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataSettingsPath: '/tmp/user-data/user-settings.json',
    },
  }),
}));

function createVideoEntry(): DirEntry {
  return {
    name: 'clip.mp4',
    ext: 'mp4',
    path: 'C:/media/clip.mp4',
    size: 4096,
    item_count: null,
    modified_time: 123,
    accessed_time: 123,
    created_time: 123,
    mime: 'video/mp4',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
  };
}

function mountInfoPanelVideoPreview(selectedEntry = ref<DirEntry | null>(null)) {
  let composable!: ReturnType<typeof useInfoPanelVideoPreview>;

  mount(defineComponent({
    setup() {
      composable = useInfoPanelVideoPreview(selectedEntry);
      return {};
    },
    template: '<div />',
  }));

  return composable;
}

describe('useInfoPanelVideoPreview', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    const userSettingsStore = useUserSettingsStore();
    userSettingsStore.userSettings.navigator.infoPanel.muteVideoPreviewByDefault = false;
    userSettingsStore.userSettings.navigator.infoPanel.autoplayVideoPreview = false;
  });

  it('reflects mute and autoplay settings from user settings', () => {
    const userSettingsStore = useUserSettingsStore();
    userSettingsStore.userSettings.navigator.infoPanel.muteVideoPreviewByDefault = true;
    userSettingsStore.userSettings.navigator.infoPanel.autoplayVideoPreview = true;

    const preview = mountInfoPanelVideoPreview(ref(createVideoEntry()));

    expect(preview.muteVideoPreviewByDefault.value).toBe(true);
    expect(preview.autoplayVideoPreview.value).toBe(true);
  });

  it('detects video entries', async () => {
    const selectedEntry = ref<DirEntry | null>(createVideoEntry());
    const preview = mountInfoPanelVideoPreview(selectedEntry);
    await nextTick();

    expect(preview.isVideoFile.value).toBe(true);
  });

  it('autoplays when enabled and a video is selected', async () => {
    const userSettingsStore = useUserSettingsStore();
    userSettingsStore.userSettings.navigator.infoPanel.autoplayVideoPreview = true;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const selectedEntry = ref<DirEntry | null>(null);
    const preview = mountInfoPanelVideoPreview(selectedEntry);
    preview.videoPreviewRef.value = { play: playMock } as unknown as HTMLVideoElement;

    selectedEntry.value = createVideoEntry();
    await nextTick();
    await nextTick();

    expect(playMock).toHaveBeenCalledOnce();
  });

  it('does not autoplay when the setting is disabled', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const selectedEntry = ref<DirEntry | null>(null);
    const preview = mountInfoPanelVideoPreview(selectedEntry);
    preview.videoPreviewRef.value = { play: playMock } as unknown as HTMLVideoElement;

    selectedEntry.value = createVideoEntry();
    await nextTick();
    await nextTick();

    expect(playMock).not.toHaveBeenCalled();
  });

  it('autoplays when the setting is enabled while a video is already selected', async () => {
    const userSettingsStore = useUserSettingsStore();
    const playMock = vi.fn().mockResolvedValue(undefined);
    const selectedEntry = ref<DirEntry | null>(createVideoEntry());
    const preview = mountInfoPanelVideoPreview(selectedEntry);
    preview.videoPreviewRef.value = { play: playMock } as unknown as HTMLVideoElement;

    await nextTick();

    userSettingsStore.userSettings.navigator.infoPanel.autoplayVideoPreview = true;
    await nextTick();
    await nextTick();

    expect(playMock).toHaveBeenCalledOnce();
  });

  it('does not autoplay for non-video entries', async () => {
    const userSettingsStore = useUserSettingsStore();
    userSettingsStore.userSettings.navigator.infoPanel.autoplayVideoPreview = true;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const selectedEntry = ref<DirEntry | null>({
      ...createVideoEntry(),
      ext: 'txt',
      name: 'notes.txt',
      path: 'C:/media/notes.txt',
      mime: 'text/plain',
    });
    const preview = mountInfoPanelVideoPreview(selectedEntry);
    preview.videoPreviewRef.value = { play: playMock } as unknown as HTMLVideoElement;

    await nextTick();

    expect(preview.isVideoFile.value).toBe(false);
    expect(playMock).not.toHaveBeenCalled();
  });
});
