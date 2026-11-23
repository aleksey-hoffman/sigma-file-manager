// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineComponent, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS,
  useInfoPanelPreviewGate,
} from '../use-info-panel-preview-gate';
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

const MEGABYTE = 1024 * 1024;

function createFileEntry(name: string, size: number): DirEntry {
  return {
    name,
    ext: name.split('.').pop() ?? null,
    path: `C:/docs/${name}`,
    size,
    item_count: null,
    modified_time: 123,
    accessed_time: 123,
    created_time: 123,
    mime: null,
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
  };
}

function mountPreviewGate(selectedEntry: ReturnType<typeof ref<DirEntry | null>>) {
  let composable!: ReturnType<typeof useInfoPanelPreviewGate>;

  mount(defineComponent({
    setup() {
      composable = useInfoPanelPreviewGate(() => selectedEntry.value ?? null);
      return {};
    },
    template: '<div />',
  }));

  return composable;
}

describe('useInfoPanelPreviewGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

    const infoPanelSettings = useUserSettingsStore().userSettings.navigator.infoPanel;
    infoPanelSettings.autoPreviewMaxSizeMb = 25;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads a small PDF only after the selection stays on it', async () => {
    const selectedEntry = ref<DirEntry | null>(createFileEntry('report.pdf', MEGABYTE));
    const gate = mountPreviewGate(selectedEntry);

    expect(gate.isPreviewReady.value).toBe(false);

    vi.advanceTimersByTime(INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS);
    await nextTick();

    expect(gate.isPreviewReady.value).toBe(true);
  });

  it('never loads a PDF the selection moved past', async () => {
    const selectedEntry = ref<DirEntry | null>(createFileEntry('first.pdf', MEGABYTE));
    const gate = mountPreviewGate(selectedEntry);

    vi.advanceTimersByTime(INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS - 50);
    selectedEntry.value = createFileEntry('second.pdf', MEGABYTE);
    await nextTick();
    vi.advanceTimersByTime(INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS - 50);
    await nextTick();

    expect(gate.isPreviewReady.value).toBe(false);
  });

  it('blocks a PDF over the size limit until the user loads it, then resets on the next file', async () => {
    const largePdf = createFileEntry('scan.pdf', 300 * MEGABYTE);
    const selectedEntry = ref<DirEntry | null>(largePdf);
    const gate = mountPreviewGate(selectedEntry);

    vi.advanceTimersByTime(INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS);
    await nextTick();

    expect(gate.previewBlockReason.value).toBe('tooLarge');
    expect(gate.isPreviewReady.value).toBe(false);

    gate.loadPreview();
    await nextTick();

    expect(gate.previewBlockReason.value).toBeNull();
    expect(gate.isPreviewReady.value).toBe(true);

    selectedEntry.value = createFileEntry('other-scan.pdf', 300 * MEGABYTE);
    await nextTick();

    expect(gate.previewBlockReason.value).toBe('tooLarge');
  });

  it('treats a zero size limit as no limit', async () => {
    useUserSettingsStore().userSettings.navigator.infoPanel.autoPreviewMaxSizeMb = 0;
    const gate = mountPreviewGate(ref<DirEntry | null>(createFileEntry('scan.pdf', 300 * MEGABYTE)));

    expect(gate.previewBlockReason.value).toBeNull();
  });

  it('blocks file types the user turned off', () => {
    useUserSettingsStore().userSettings.navigator.infoPanel.autoPreviewFileTypes.text = false;
    const gate = mountPreviewGate(ref<DirEntry | null>(createFileEntry('notes.txt', 100)));

    expect(gate.previewBlockReason.value).toBe('disabled');
    expect(gate.isPreviewReady.value).toBe(false);
  });

  it('applies the size limit to images only when the original file is loaded', () => {
    const infoPanelSettings = useUserSettingsStore().userSettings.navigator.infoPanel;
    const largeImage = ref<DirEntry | null>(createFileEntry('photo.png', 300 * MEGABYTE));

    infoPanelSettings.showFullSizeImagePreview = false;
    expect(mountPreviewGate(largeImage).previewBlockReason.value).toBeNull();

    infoPanelSettings.showFullSizeImagePreview = true;
    expect(mountPreviewGate(largeImage).previewBlockReason.value).toBe('tooLarge');
  });

  it('applies the size limit to SVG images, which always load the original file', () => {
    useUserSettingsStore().userSettings.navigator.infoPanel.showFullSizeImagePreview = false;
    const gate = mountPreviewGate(ref<DirEntry | null>(createFileEntry('diagram.svg', 300 * MEGABYTE)));

    expect(gate.previewBlockReason.value).toBe('tooLarge');
  });
});
