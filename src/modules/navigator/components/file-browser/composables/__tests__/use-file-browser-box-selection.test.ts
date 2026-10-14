// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  defineComponent,
  h,
  ref,
  type Ref,
} from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import {
  afterEach, describe, expect, it, vi, type Mock,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import type { FileBrowserVirtualRow } from '../../utils/file-browser-virtual-rows';
import { useFileBrowserBoxSelection } from '../use-file-browser-box-selection';

function createElementWithRect(className: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => new DOMRect(0, 0, 400, 300),
  });

  return element;
}

function createPointerDownEvent(target: Element, clientX = 10, clientY = 20): PointerEvent {
  return {
    altKey: false,
    button: 0,
    clientX,
    clientY,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: false,
    target,
  } as unknown as PointerEvent;
}

function createImageEntry(name: string): DirEntry {
  return {
    name,
    path: `/${name}`,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    size: 100,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    ext: 'jpg',
    mime: 'image/jpeg',
  };
}

// 固定的网格行数据：400 宽的中档网格（每行 2 个条目）。
// 段头 0~54 / 第 1 行 54~186（image-1、image-2）/ 第 2 行 186~318（image-3）。
// 故意写死而不是调 createFileBrowserVirtualRows：本用例要守的是
// 「composable 把 gridMinColumnWidth 透传给命中测试」，行数据一旦跟着别处变化，
// 断言的语义就跟着漂了。命中测试是拿 gridMinColumnWidth 重算列宽摆位的，
// 与行数据里的分块数无关，所以第 1 行放两个条目才能让两种列宽给出不同结果。
function createGridBoxSelectionRows(): FileBrowserVirtualRow[] {
  return [
    {
      type: 'grid-section',
      key: 'grid-section:images',
      sectionKey: 'images',
      variant: 'image',
      count: 3,
      stickyIndex: 11,
      start: 0,
      size: 54,
    },
    {
      type: 'grid-items',
      key: 'grid-items:images:0:/image-1|/image-2',
      sectionKey: 'images',
      variant: 'image',
      entries: [createImageEntry('image-1'), createImageEntry('image-2')],
      rowIndex: 0,
      start: 54,
      size: 132,
    },
    {
      type: 'grid-items',
      key: 'grid-items:images:1:/image-3',
      sectionKey: 'images',
      variant: 'image',
      entries: [createImageEntry('image-3')],
      rowIndex: 1,
      start: 186,
      size: 132,
    },
  ];
}

// tick() 走 window.requestAnimationFrame，这里换成可控队列并手动冲刷，
// 免得依赖 jsdom 的真实 rAF 时序（同步 mock 会让 animationFrameId 停在非空，
// 后续 pointermove 的 scheduleTick 会被静默吞掉）。
function installAnimationFrameQueue(): () => void {
  const pending: FrameRequestCallback[] = [];

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.push(callback);

    return pending.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

  return () => {
    const queued = pending.splice(0, pending.length);

    queued.forEach(callback => callback(0));
  };
}

function selectDocumentText(): Selection {
  const selectedTextElement = document.createElement('p');
  selectedTextElement.textContent = 'Selected text';
  document.body.appendChild(selectedTextElement);

  const selection = window.getSelection();

  if (!selection) {
    throw new Error('Document selection is unavailable');
  }

  const range = document.createRange();
  range.selectNodeContents(selectedTextElement);
  selection.removeAllRanges();
  selection.addRange(range);

  return selection;
}

function createBoxSelectionHarness(): {
  entriesContainer: HTMLElement;
  handleEntriesContainerPointerDown: (event: PointerEvent) => void;
  paneElement: HTMLElement;
  wrapper: VueWrapper;
} {
  const paneElement = createElementWithRect('file-browser');
  const contentElement = createElementWithRect('file-browser__content');
  const viewportElement = createElementWithRect('file-browser__scroll-area-viewport');
  const entriesContainer = createElementWithRect('file-browser__entries-container');
  let handleEntriesContainerPointerDown!: (event: PointerEvent) => void;

  viewportElement.appendChild(entriesContainer);
  contentElement.appendChild(viewportElement);
  paneElement.appendChild(contentElement);
  document.body.appendChild(paneElement);

  const wrapper = mount(defineComponent({
    setup() {
      const paneElementRef: Ref<HTMLElement | null> = ref(paneElement);
      const viewportElementRef: Ref<HTMLElement | null> = ref(viewportElement);
      const entriesContainerRef: Ref<HTMLElement | null> = ref(entriesContainer);

      const boxSelection = useFileBrowserBoxSelection({
        enabled: computed(() => true),
        layout: () => 'list',
        paneElementRef,
        scrollViewportRef: viewportElementRef,
        entriesContainerRef,
        viewportWidth: ref(400),
        virtualContentOffset: ref(0),
        scrollTop: ref(0),
        virtualRows: computed<FileBrowserVirtualRow[]>(() => []),
        increaseFileViewGaps: computed(() => false),
        gridMinColumnWidth: computed(() => 170),
        getSelectedEntries: () => [],
        applySelection: vi.fn<(entries: DirEntry[]) => void>(),
        clearSelection: vi.fn<() => void>(),
        isFileDragActive: computed(() => false),
      });

      handleEntriesContainerPointerDown = boxSelection.handleEntriesContainerPointerDown;

      return () => h('div');
    },
  }));

  return {
    entriesContainer,
    handleEntriesContainerPointerDown,
    paneElement,
    wrapper,
  };
}

// FORK-MODIFICATION: 需求 3.6.3 —— 网格框选的命中测试必须吃当前档位的最小列宽，
// 否则档位对框选完全无效（列宽永远按 medium 摆位）。见下面用例的说明。
function createGridBoxSelectionHarness(minColumnWidth: number): {
  applySelection: Mock<(entries: DirEntry[]) => void>;
  entriesContainer: HTMLElement;
  handleEntriesContainerPointerDown: (event: PointerEvent) => void;
  paneElement: HTMLElement;
  wrapper: VueWrapper;
} {
  const paneElement = createElementWithRect('file-browser');
  const contentElement = createElementWithRect('file-browser__content');
  const viewportElement = createElementWithRect('file-browser__scroll-area-viewport');
  const entriesContainer = createElementWithRect('file-browser__entries-container');
  let handleEntriesContainerPointerDown!: (event: PointerEvent) => void;
  const applySelection = vi.fn<(entries: DirEntry[]) => void>();

  viewportElement.appendChild(entriesContainer);
  contentElement.appendChild(viewportElement);
  paneElement.appendChild(contentElement);
  document.body.appendChild(paneElement);

  const wrapper = mount(defineComponent({
    setup() {
      const paneElementRef: Ref<HTMLElement | null> = ref(paneElement);
      const viewportElementRef: Ref<HTMLElement | null> = ref(viewportElement);
      const entriesContainerRef: Ref<HTMLElement | null> = ref(entriesContainer);

      const boxSelection = useFileBrowserBoxSelection({
        enabled: computed(() => true),
        layout: () => 'grid',
        paneElementRef,
        scrollViewportRef: viewportElementRef,
        entriesContainerRef,
        viewportWidth: ref(400),
        virtualContentOffset: ref(0),
        scrollTop: ref(0),
        virtualRows: computed<FileBrowserVirtualRow[]>(createGridBoxSelectionRows),
        increaseFileViewGaps: computed(() => false),
        gridMinColumnWidth: computed(() => minColumnWidth),
        getSelectedEntries: () => [],
        applySelection,
        clearSelection: vi.fn<() => void>(),
        isFileDragActive: computed(() => false),
      });

      handleEntriesContainerPointerDown = boxSelection.handleEntriesContainerPointerDown;

      return () => h('div');
    },
  }));

  return {
    applySelection,
    entriesContainer,
    handleEntriesContainerPointerDown,
    paneElement,
    wrapper,
  };
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
  document.body.style.userSelect = '';
  vi.restoreAllMocks();
});

describe('useFileBrowserBoxSelection', () => {
  it('clears document text selection when empty-space box selection starts', () => {
    const selection = selectDocumentText();
    const harness = createBoxSelectionHarness();
    const pointerDownEvent = createPointerDownEvent(harness.entriesContainer);

    try {
      expect(selection.rangeCount).toBe(1);

      harness.handleEntriesContainerPointerDown(pointerDownEvent);

      expect(selection.rangeCount).toBe(0);
      expect(pointerDownEvent.preventDefault).toHaveBeenCalledTimes(1);
    }
    finally {
      harness.wrapper.unmount();
      harness.paneElement.remove();
    }
  });

  // FORK-MODIFICATION: 这条断言只可能由「composable 真的把 gridMinColumnWidth 透传下去」满足。
  // 行数据固定是每行 2 个条目，选框从 (190,60) 拖到 (210,100)，
  // 横跨的正是中档两列之间的间隙（列宽 194 ⇒ 第 1 列 0~194、第 2 列 206~400）：
  //   最小列宽 170（2 列、列宽 194）⇒ image-1 与 image-2 各被切掉一角，两个都命中；
  //   最小列宽 283（1 列、列宽 400）⇒ image-2 被摆到 x = 412 之外，只剩 image-1。
  // 把透传那行换成硬编码常量（比如 170），第二条断言必然变红。
  it('hits different grid entries as the tier minimum column width changes', () => {
    const flushAnimationFrames = installAnimationFrameQueue();

    function collectSelectedPaths(minColumnWidth: number) {
      const harness = createGridBoxSelectionHarness(minColumnWidth);

      try {
        harness.handleEntriesContainerPointerDown(
          createPointerDownEvent(harness.entriesContainer, 190, 60),
        );
        flushAnimationFrames();

        window.dispatchEvent(new MouseEvent('pointermove', {
          bubbles: true,
          clientX: 210,
          clientY: 100,
        }));
        flushAnimationFrames();

        const calls = harness.applySelection.mock.calls;

        return (calls.length === 0 ? [] : calls[calls.length - 1][0]).map(entry => entry.path);
      }
      finally {
        harness.wrapper.unmount();
        harness.paneElement.remove();
      }
    }

    expect(collectSelectedPaths(170)).toEqual(['/image-1', '/image-2']);
    expect(collectSelectedPaths(283)).toEqual(['/image-1']);
  });
});
