// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import {
  computed, defineComponent, h, nextTick, ref, type Ref,
} from 'vue';
import { mount } from '@vue/test-utils';
import type { DirEntry } from '@/types/dir-entry';
import {
  createFileBrowserVirtualRows,
  getFileBrowserGridNavigationEntry,
  getGridColumnCount,
  resolveViewportContentWidth,
  useFileBrowserVirtualLayout,
} from '../use-file-browser-virtual-layout';
import type { ThumbnailSize } from '../../types';
import { resolveThumbnailMetrics } from '../../utils/file-browser-thumbnail-sizes';

function createEntry(name: string, options: Partial<DirEntry> = {}): DirEntry {
  const isDirectory = options.is_dir ?? false;

  return {
    name,
    path: `/${name}`,
    is_dir: isDirectory,
    is_file: !isDirectory,
    is_hidden: false,
    is_symlink: false,
    size: 100,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: isDirectory ? 0 : null,
    ext: null,
    mime: null,
    ...options,
  };
}

describe('createFileBrowserVirtualRows', () => {
  it('creates fixed list rows with larger rows for descriptions', () => {
    const entries = [
      createEntry('first'),
      createEntry('second'),
      createEntry('third'),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'list',
      viewportWidth: 500,
      entryDescription: entry => (entry.name === 'second' ? 'Description' : undefined),
    });

    expect(rows.map(row => row.start)).toEqual([0, 64, 142]);
    expect(rows.map(row => row.size)).toEqual([64, 78, 64]);
  });

  // FORK-MODIFICATION: 需求 3.6 四档重定 32/48/64/80，行高 = 缩略图 + 16（带说明行 +14）。
  describe('thumbnailSize', () => {
    it('medium (default): list rows are 64 / 78', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'medium',
      });
      expect(rows.map(row => row.size)).toEqual([64, 78, 64]);
    });

    it('small: list rows shrink to 48 / 62', () => {
      const entries = [createEntry('a'), createEntry('b')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'small',
      });
      expect(rows.map(row => row.size)).toEqual([48, 62]);
    });

    it('large: list rows grow to 80 / 94', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'large',
      });
      expect(rows.map(row => row.size)).toEqual([80, 94, 80]);
    });

    it('xlarge: list rows grow to 96 / 110', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'xlarge',
      });
      expect(rows.map(row => row.size)).toEqual([96, 110, 96]);
    });

    // FORK-MODIFICATION: 需求 3.6.3 —— 档位以前对网格完全无效，
    // createGridRows 根本没收到 thumbnailSize。
    // 1 个目录 + 7 张图片，viewportWidth 固定 2000：
    //   列数 = floor((2000 + 0) / (gridMinColumnWidth + 12))（GRID_VIEW_PADDING_X = 0，gridGap = 12）
    //     small 113 → 16 列 / medium 170 → 11 列 / large 227 → 8 列 / xlarge 283 → 6 列
    //   段头行 = 42 + 12 = 54；目录行 = gridDirEntryHeight + 12；图片行 = gridEntryHeight + 12。
    // 图片数必须是 7 而不是 3：只有 xlarge（6 列）会把 7 个条目折成两行，
    // 换句话说只有 xlarge 这一档会因为「最小列宽被硬编码成 170」而算错。
    // 用 3 张图的话四档都只有一行，无论第三参数写什么都全绿，这段断言等于没有保护。
    it.each([
      ['small', 16, [0, 54, 101, 155], [54, 47, 54, 92], 2],
      ['medium', 11, [0, 54, 118, 172], [54, 64, 54, 132], 2],
      ['large', 8, [0, 54, 135, 189], [54, 81, 54, 172], 2],
      ['xlarge', 6, [0, 54, 153, 207, 419], [54, 99, 54, 212, 212], 3],
    ] as Array<[ThumbnailSize, number, number[], number[], number]>)(
      'grid rows scale with thumbnailSize %s',
      (thumbnailSize, columns, expectedStarts, expectedSizes, expectedGridItemsRows) => {
        const entries = [
          createEntry('dir-1', {
            is_dir: true,
            is_file: false,
          }),
          ...Array.from({ length: 7 }, (_unused, index) => createEntry(`image-${index + 1}`, {
            ext: 'jpg',
            mime: 'image/jpeg',
          })),
        ];
        const rows = createFileBrowserVirtualRows({
          entries,
          layout: 'grid',
          viewportWidth: 2000,
          thumbnailSize,
        });

        expect(
          getGridColumnCount(
            2000,
            12,
            resolveThumbnailMetrics(thumbnailSize).gridMinColumnWidth,
          ),
        ).toBe(columns);
        expect(rows.map(row => row.start)).toEqual(expectedStarts);
        expect(rows.map(row => row.size)).toEqual(expectedSizes);
        expect(rows.filter(row => row.type === 'grid-items')).toHaveLength(expectedGridItemsRows);
      },
    );
  });

  it('creates grid section and item rows from responsive columns', () => {
    const entries = [
      createEntry('dir-1', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-2', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-3', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-4', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('image-1', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-2', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-3', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 500,
    });

    expect(rows.map(row => row.type)).toEqual([
      'grid-section',
      'grid-items',
      'grid-items',
      'grid-section',
      'grid-items',
      'grid-items',
    ]);
    expect(rows.map(row => row.start)).toEqual([0, 54, 118, 182, 236, 368]);
    expect(rows.map(row => row.size)).toEqual([54, 64, 64, 54, 132, 132]);
  });
});

describe('getFileBrowserGridNavigationEntry', () => {
  it('moves vertically through grid rows by column', () => {
    const entries = [
      createEntry('dir-1', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-2', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-3', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('dir-4', {
        is_dir: true,
        is_file: false,
      }),
      createEntry('image-1', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
      createEntry('image-2', {
        ext: 'jpg',
        mime: 'image/jpeg',
      }),
    ];

    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 500,
    });

    expect(getFileBrowserGridNavigationEntry(rows, '/dir-2', 'down')?.path).toBe('/dir-4');
    expect(getFileBrowserGridNavigationEntry(rows, '/dir-4', 'down')?.path).toBe('/image-2');
    expect(getFileBrowserGridNavigationEntry(rows, '/image-2', 'up')?.path).toBe('/dir-4');
  });
});

describe('getGridColumnCount', () => {
  it('derives column count from minimum card width and gap', () => {
    expect(getGridColumnCount(500, 12, 170)).toBe(2);
    expect(getGridColumnCount(850, 12, 170)).toBe(4);
    expect(getGridColumnCount(950, 12, 170)).toBe(5);
  });

  // FORK-MODIFICATION: 列数必须随缩略图档位变化，否则大卡片会被挤成窄条。
  it('derives fewer columns as the minimum column width grows', () => {
    expect(getGridColumnCount(2000, 12, 113)).toBe(16);
    expect(getGridColumnCount(2000, 12, 170)).toBe(11);
    expect(getGridColumnCount(2000, 12, 227)).toBe(8);
    expect(getGridColumnCount(2000, 12, 283)).toBe(6);
  });
});

describe('resolveViewportContentWidth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers entries container content-box width over viewport width', () => {
    const viewport = document.createElement('div');
    const contentInner = document.createElement('div');
    const entriesContainer = document.createElement('div');

    contentInner.className = 'file-browser__content-inner';
    entriesContainer.className = 'file-browser__entries-container';
    contentInner.appendChild(entriesContainer);
    viewport.appendChild(contentInner);

    Object.defineProperty(viewport, 'clientWidth', {
      value: 950,
      configurable: true,
    });
    Object.defineProperty(contentInner, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(entriesContainer, 'clientWidth', {
      value: 850,
      configurable: true,
    });

    expect(resolveViewportContentWidth(viewport)).toBe(850);
  });

  it('subtracts horizontal padding from the entries container width', () => {
    const viewport = document.createElement('div');
    const contentInner = document.createElement('div');
    const entriesContainer = document.createElement('div');

    contentInner.className = 'file-browser__content-inner';
    entriesContainer.className = 'file-browser__entries-container';
    contentInner.appendChild(entriesContainer);
    viewport.appendChild(contentInner);

    Object.defineProperty(entriesContainer, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === entriesContainer) {
        return {
          paddingLeft: '20px',
          paddingRight: '20px',
        } as CSSStyleDeclaration;
      }

      return {
        paddingLeft: '0px',
        paddingRight: '0px',
      } as CSSStyleDeclaration;
    });

    expect(resolveViewportContentWidth(viewport)).toBe(860);
    expect(getGridColumnCount(resolveViewportContentWidth(viewport), 12, 170)).toBe(4);
    expect(getGridColumnCount(entriesContainer.clientWidth, 12, 170)).toBe(5);
  });

  it('falls back to content inner width while entries container is absent', () => {
    const viewport = document.createElement('div');
    const contentInner = document.createElement('div');

    contentInner.className = 'file-browser__content-inner';
    viewport.appendChild(contentInner);

    Object.defineProperty(viewport, 'clientWidth', {
      value: 950,
      configurable: true,
    });
    Object.defineProperty(contentInner, 'clientWidth', {
      value: 850,
      configurable: true,
    });

    expect(resolveViewportContentWidth(viewport)).toBe(850);
    expect(getGridColumnCount(resolveViewportContentWidth(viewport), 12, 170)).toBe(4);
    expect(getGridColumnCount(viewport.clientWidth, 12, 170)).toBe(5);
  });

  it('updates content width when increased gaps change entry padding', async () => {
    const viewport = document.createElement('div');
    const contentInner = document.createElement('div');
    const entriesContainer = document.createElement('div');
    let increaseFileViewGaps!: Ref<boolean>;
    let viewportWidth!: Ref<number>;

    contentInner.className = 'file-browser__content-inner';
    entriesContainer.className = 'file-browser__entries-container';
    contentInner.appendChild(entriesContainer);
    viewport.appendChild(contentInner);

    Object.defineProperty(viewport, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(entriesContainer, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const padding = element === entriesContainer && increaseFileViewGaps.value ? '20px' : '0px';

      return {
        paddingLeft: padding,
        paddingRight: padding,
      } as CSSStyleDeclaration;
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const wrapper = mount(defineComponent({
      setup() {
        increaseFileViewGaps = ref(false);
        const virtualLayout = useFileBrowserVirtualLayout({
          entries: computed(() => []),
          layout: () => 'list',
          increaseFileViewGaps: () => increaseFileViewGaps.value,
        });

        viewportWidth = virtualLayout.viewportWidth;
        virtualLayout.setScrollViewportRef(viewport);

        return () => h('div');
      },
    }));

    expect(viewportWidth.value).toBe(900);

    increaseFileViewGaps.value = true;
    await nextTick();
    await nextTick();

    expect(viewportWidth.value).toBe(860);
    wrapper.unmount();
  });
});
