// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import FileBrowserListEntryThumbnail from '../file-browser-list-entry-thumbnail.vue';
import type { DirEntry } from '@/types/dir-entry';

const getImageThumbnail = vi.fn();
const getVideoThumbnail = vi.fn();
const cancelImageThumbnail = vi.fn();
const cancelVideoThumbnail = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock('../composables/use-file-browser-context', () => ({
  useFileBrowserContext: () => ({
    getImageThumbnail,
    getVideoThumbnail,
    cancelImageThumbnail,
    cancelVideoThumbnail,
  }),
}));

// FORK-MODIFICATION: thumbnailSize 改由 navigator.thumbeded 设置驱动，测试需 mock。
let mockThumbnailSize: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: {
        get thumbnailSize() { return mockThumbnailSize; },
      },
    },
  }),
}));

vi.mock('../file-browser-entry-icon.vue', () => ({
  default: {
    name: 'FileBrowserEntryIcon',
    props: ['entry', 'size'],
    template: '<i class="entry-icon-fallback" />',
  },
}));

let intersectionCallback: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;
const observedTargets: Element[] = [];
let disconnected = false;

class FakeIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
    intersectionCallback = callback;
  }
  observe(target: Element) {
    observedTargets.push(target);
  }
  disconnect() {
    disconnected = true;
  }
  unobserve() {}
}

function createEntry(overrides: Partial<DirEntry> & Pick<DirEntry, 'path'>): DirEntry {
  return {
    name: 'item',
    is_dir: false,
    ext: '',
    ...overrides,
  } as DirEntry;
}

function enterViewport() {
  intersectionCallback?.(
    observedTargets.map(target => ({ isIntersecting: true, target })) as never,
  );
}

beforeEach(() => {
  getImageThumbnail.mockReset();
  getVideoThumbnail.mockReset();
  cancelImageThumbnail.mockReset();
  cancelVideoThumbnail.mockReset();
  intersectionCallback = null;
  observedTargets.length = 0;
  disconnected = false;
  mockThumbnailSize = 'medium';
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

describe('file-browser-list-entry-thumbnail', () => {
  it('renders the plain icon and creates no observer for a non-media entry', () => {
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/notes.txt', ext: 'txt' }) },
      global: { stubs: { Teleport: true } },
    });

    expect(wrapper.find('.file-browser-list-entry-thumbnail__image').exists()).toBe(false);
    expect(wrapper.find('.entry-icon-fallback').exists()).toBe(true);
    expect(observedTargets).toHaveLength(0);
    expect(getImageThumbnail).not.toHaveBeenCalled();
    expect(getVideoThumbnail).not.toHaveBeenCalled();
  });

  it('requests an image thumbnail only after the row enters the load range', async () => {
    const entry = createEntry({ path: 'C:/photo.jpg', ext: 'jpg' });
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    expect(getImageThumbnail).not.toHaveBeenCalled();

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(getImageThumbnail).toHaveBeenCalledWith(entry, 32);
  });

  // FORK-MODIFICATION: 验收反馈 2026-10-12 第二轮 — 缩略图 4 档加 xlarge=54 像素。
  it('uses 54 px when thumbnailSize is xlarge', async () => {
    mockThumbnailSize = 'xlarge';
    const entry = createEntry({ path: 'C:/photo-xl.jpg', ext: 'jpg' });
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(getImageThumbnail).toHaveBeenCalledWith(entry, 54);
  });

  it('swaps to the thumbnail image once the source resolves', async () => {
    getImageThumbnail.mockReturnValue('asset://thumb.jpg');
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/photo.jpg', ext: 'jpg' }) },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    const image = wrapper.find('img.file-browser-list-entry-thumbnail__image');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toBe('asset://thumb.jpg');
  });

  it('falls back to the icon when the thumbnail never resolves', async () => {
    getImageThumbnail.mockReturnValue(undefined);
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/broken.jpg', ext: 'jpg' }) },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('img.file-browser-list-entry-thumbnail__image').exists()).toBe(false);
    expect(wrapper.find('.entry-icon-fallback').exists()).toBe(true);
  });

  it('requests a video thumbnail for video entries', async () => {
    const entry = createEntry({ path: 'C:/clip.mp4', ext: 'mp4' });
    getVideoThumbnail.mockReturnValue('asset://video.jpg');
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(getVideoThumbnail).toHaveBeenCalledWith(entry);
    expect(getImageThumbnail).not.toHaveBeenCalled();
  });

  it('cancels the request and disconnects the observer on unmount', async () => {
    const entry = createEntry({ path: 'C:/photo.jpg', ext: 'jpg' });
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();
    wrapper.unmount();

    expect(disconnected).toBe(true);
    expect(cancelImageThumbnail).toHaveBeenCalledWith(entry, 32);
    expect(cancelVideoThumbnail).not.toHaveBeenCalled();
  });
});