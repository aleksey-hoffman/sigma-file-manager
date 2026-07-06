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
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function createPointerDownEvent(target: Element): PointerEvent {
  return {
    altKey: false,
    button: 0,
    clientX: 10,
    clientY: 20,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: false,
    target,
  } as unknown as PointerEvent;
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
  let boxSelection: ReturnType<typeof useFileBrowserBoxSelection> | null = null;

  viewportElement.appendChild(entriesContainer);
  contentElement.appendChild(viewportElement);
  paneElement.appendChild(contentElement);
  document.body.appendChild(paneElement);

  const wrapper = mount(defineComponent({
    setup() {
      const paneElementRef: Ref<HTMLElement | null> = ref(paneElement);
      const viewportElementRef: Ref<HTMLElement | null> = ref(viewportElement);
      const entriesContainerRef: Ref<HTMLElement | null> = ref(entriesContainer);

      boxSelection = useFileBrowserBoxSelection({
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
        getSelectedEntries: () => [],
        applySelection: vi.fn<(entries: DirEntry[]) => void>(),
        clearSelection: vi.fn<() => void>(),
        isFileDragActive: computed(() => false),
      });

      return () => h('div');
    },
  }));

  if (!boxSelection) {
    throw new Error('Box selection composable was not initialized');
  }

  return {
    entriesContainer,
    handleEntriesContainerPointerDown: boxSelection.handleEntriesContainerPointerDown,
    paneElement,
    wrapper,
  };
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
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
});
