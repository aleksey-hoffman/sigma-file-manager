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
import {
  GRID_DIR_ENTRY_HEIGHT,
  GRID_FILE_ENTRY_HEIGHT,
  LIST_FILE_ENTRY_HEIGHT,
  resolveThumbnailCssVariables,
  resolveThumbnailMetrics,
} from '../../utils/file-browser-thumbnail-sizes';

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

/**
 * 带缩略图的行。判定与渲染侧同源：
 * file-browser-entry-groups 的 isFileBrowserImageEntry 读的是 ext 列表，
 * file-browser-list-entry-thumbnail.vue 也用它决定要不要出图。
 */
function image(name: string, options: Partial<DirEntry> = {}): DirEntry {
  return createEntry(name, {
    ext: 'png',
    ...options,
  });
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
  // 下面这四条量的是**有缩略图的行**（ext: 'png'）—— 只有它们才跟着档位缩放。
  // 目录 / 非媒体行的行为在下一个 describe 里，那是反馈 4 的要求。
  describe('thumbnailSize', () => {
    it('medium (default): media list rows are 64 / 78', () => {
      const entries = [image('a'), image('b'), image('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'medium',
      });
      expect(rows.map(row => row.size)).toEqual([64, 78, 64]);
    });

    it('small: media list rows shrink to 48 / 62', () => {
      const entries = [image('a'), image('b')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'small',
      });
      expect(rows.map(row => row.size)).toEqual([48, 62]);
    });

    it('large: media list rows grow to 80 / 94', () => {
      const entries = [image('a'), image('b'), image('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'large',
      });
      expect(rows.map(row => row.size)).toEqual([80, 94, 80]);
    });

    it('xlarge: media list rows grow to 96 / 110', () => {
      const entries = [image('a'), image('b'), image('c')];
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
    //   列数 = floor((2000 + gridGap) / (gridMinColumnWidth + gridGap))，gridGap = 12
    //     small 170 → 11 列 / medium 225 → 8 列 / large 300 → 6 列 / xlarge 420 → 4 列
    //   段头行 = 42 + 12 = 54；目录行 = gridDirEntryHeight + 12；图片行 = gridEntryHeight + 12。
    // 图片数必须是 7 而不是 3：large（6 列）和 xlarge（4 列）都会把 7 个条目折成两行，
    // 换句话说只有这两档会因为「最小列宽被硬编码成 170」而算错。
    // 用 3 张图的话四档都只有一行，无论第三参数写什么都全绿，这段断言等于没有保护。
    // 2026-10-15：网格四档整体上移一档后，小档的 170 恰好等于旧 medium 的 170，
    // 所以对小档而言「写死 170」是平凡的 —— 判别力由 large / xlarge 两档承担。
    // 2026-10-15 反馈 2 续：目录卡高度也固定成 52 了，所以四档的段头/目录行
    // 都一样，差异只在图片行 —— 这正是用户要的「只有媒体跟着档位变」。
    it.each([
      ['small', 11, [0, 54, 118, 172], [54, 64, 54, 132], 2],
      ['medium', 8, [0, 54, 118, 172], [54, 64, 54, 192], 2],
      ['large', 6, [0, 54, 118, 172, 424], [54, 64, 54, 252, 252], 3],
      ['xlarge', 4, [0, 54, 118, 172, 484], [54, 64, 54, 312, 312], 3],
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

    // FORK-MODIFICATION: 反馈 2（2026-10-15）——网格视图区分媒体与非媒体，
    // 调缩略图档位时非媒体**只改宽度、高度不变**。
    //
    // 为什么这条断言不能省：卡片高度是 CSS 变量定的，而虚拟滚动按
    // `section.entryHeight` 算 offset 和滚动条总高。两者是**两条独立路径** ——
    // 只改 CSS 变量会让行高停在 240/300，卡与卡之间裂开缝、滚到底对不齐，
    // 而这类错位在纯 CSS 断言里完全看不见。反过来只改 JS 也一样坏。
    // 所以这里必须从「虚拟行」这一侧钉住数值。
    it('keeps non-media grid rows one height while media rows still scale', () => {
      const sizes: ThumbnailSize[] = ['small', 'medium', 'large', 'xlarge'];
      const otherRowSizes: number[] = [];
      const imageRowSizes: number[] = [];
      const dirRowSizes: number[] = [];

      for (const thumbnailSize of sizes) {
        const entries = [
          createEntry('dir-1', {
            is_dir: true,
            is_file: false,
          }),
          createEntry('photo-1', { ext: 'jpg' }),
          createEntry('note-1', { ext: 'txt' }),
        ];
        const rows = createFileBrowserVirtualRows({
          entries,
          layout: 'grid',
          viewportWidth: 2000,
          thumbnailSize,
        });
        const itemRows = rows.filter(row => row.type === 'grid-items');

        otherRowSizes.push(itemRows.find(row => row.variant === 'other')?.size ?? -1);
        imageRowSizes.push(itemRows.find(row => row.variant === 'image')?.size ?? -1);
        dirRowSizes.push(itemRows.find(row => row.variant === 'dir')?.size ?? -1);
      }

      // 非媒体：四档同一个行高（GRID_FILE_ENTRY_HEIGHT + gridGap 12）。
      expect(new Set(otherRowSizes).size).toBe(1);
      expect(otherRowSizes[0]).toBe(GRID_FILE_ENTRY_HEIGHT + 12);

      // 目录（反馈 2 续）：同样四档同高。目录卡里没有缩略图，
      // 长出来的那截全是空白 —— 用户实测发现并要求「保持和小的时候一致」。
      expect(new Set(dirRowSizes).size).toBe(1);
      expect(dirRowSizes[0]).toBe(GRID_DIR_ENTRY_HEIGHT + 12);

      // 媒体：四档各不相同 —— 否则「非媒体固定高」就变成了「所有卡都固定高」。
      expect(new Set(imageRowSizes).size).toBe(4);
      expect(imageRowSizes).toEqual(
        sizes.map(size => resolveThumbnailMetrics(size).gridEntryHeight + 12),
      );
    });
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

    // 上面没传 thumbnailSize，落默认 medium：列数 = floor((500 + 12) / (225 + 12)) = 2 列，
    // 所以 4 个目录与 3 张图片各自折成两行。2026-10-15 网格四档整体上移之前，
    // 默认档是 170，同样是 2 列 —— 行形没变，但这组数字以前是写死的，
    // 改档位时不会跟着动，现在改成跟着档位推导。
    expect(rows.map(row => row.type)).toEqual([
      'grid-section',
      'grid-items',
      'grid-items',
      'grid-section',
      'grid-items',
      'grid-items',
    ]);
    expect(rows.map(row => row.start)).toEqual([0, 54, 118, 182, 236, 428]);
    expect(rows.map(row => row.size)).toEqual([54, 64, 64, 54, 192, 192]);
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

// FORK-MODIFICATION: 反馈 4（2026-10-15）——列表视图的目录 / 非媒体文件行
// 「在修改缩略图大小时，也不要更改高度，保持默认高度」。
// 判别力来源：下面用同一批条目跑四档，只要有一档的行高不同断言就红；
// 若实现退回到「所有行都按 listRowHeight 分档」，四档会变成 48/64/80/96 而全红。
describe('list rows without a thumbnail', () => {
  const SIZES: ThumbnailSize[] = ['small', 'medium', 'large', 'xlarge'];

  function listSizes(entries: DirEntry[], size: ThumbnailSize): number[] {
    return createFileBrowserVirtualRows({
      entries,
      layout: 'list',
      viewportWidth: 500,
      thumbnailSize: size,
    }).map(row => row.size);
  }

  it('keeps directory rows at one height across all four sizes', () => {
    const entries = [
      createEntry('folder-a', { is_dir: true }),
      createEntry('folder-b', { is_dir: true }),
    ];

    for (const size of SIZES) {
      expect(listSizes(entries, size), `${size} 的目录行高变了`).toEqual([64, 64]);
    }
  });

  it('keeps non-media file rows at one height across all four sizes', () => {
    const entries = [
      createEntry('notes.txt', { ext: 'txt' }),
      createEntry('report.pdf', { ext: 'pdf' }),
      createEntry('script.ts', { ext: 'ts' }),
    ];

    for (const size of SIZES) {
      expect(listSizes(entries, size), `${size} 的非媒体行高变了`).toEqual([64, 64, 64]);
    }
  });

  // 非媒体行的高宽比与「小」档不同，所以这条能区分「只是碰巧等于某一档」。
  // 若有人把常量改成 48，这条红，而上面两条照样绿。
  it('uses the default-size height, not the small-size height', () => {
    expect(LIST_FILE_ENTRY_HEIGHT).toBe(64);
    expect(LIST_FILE_ENTRY_HEIGHT).not.toBe(
      resolveThumbnailMetrics('small').listRowHeight,
    );
  });

  it('still scales media rows so thumbnails are not clipped', () => {
    const entries = [image('a.png'), image('b.mp4', { ext: 'mp4' })];

    expect(listSizes(entries, 'small')).toEqual([48, 48]);
    expect(listSizes(entries, 'medium')).toEqual([64, 64]);
    expect(listSizes(entries, 'large')).toEqual([80, 80]);
    expect(listSizes(entries, 'xlarge')).toEqual([96, 96]);
  });

  // CSS 的 min-height 与虚拟行高必须同源且方向正确，否则两种错法都会出现：
  //   地板取无缩略图行高 → small 档媒体行 height=48 被顶回 64（缩略图档位静默失效）
  //   地板取媒体行高     → xlarge 档无缩略图行 height=64 被顶回 96（反馈 4 直接回归）
  it('never lets the row min-height CSS variable floor a row back up', () => {
    for (const size of SIZES) {
      const metrics = resolveThumbnailMetrics(size);
      const floor = Number(
        resolveThumbnailCssVariables(size)['--navigator-list-view-entry-height'].replace('px', ''),
      );
      const rows = listSizes([image('a.png'), createEntry('dir', { is_dir: true })], size);

      expect(floor, `${size} 的 min-height 地板高于该档任何一行`).toBeLessThanOrEqual(
        Math.min(...rows),
      );
      expect(rows).toContain(metrics.listRowHeight);
      expect(rows).toContain(metrics.listFileEntryHeight);
    }
  });
});
