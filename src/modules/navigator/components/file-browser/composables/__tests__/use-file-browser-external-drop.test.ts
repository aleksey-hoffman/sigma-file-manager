// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import type { Ref } from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  registerDropContainer,
  unregisterDropContainer,
} from '@/composables/use-drop-target-registry';
import { useFileBrowserExternalDrop } from '../use-file-browser-external-drop';
import type { DragOperationType } from '../use-file-browser-drag';

interface DragDropEventPayload {
  type: 'enter' | 'over' | 'leave' | 'drop';
  paths?: string[];
  position?: {
    x: number;
    y: number;
  };
}

const setFocusMock = vi.fn();
const registerLayerMock = vi.fn(() => 'drag-layer');
const unregisterLayerMock = vi.fn();
let dragDropHandler: ((event: { payload: DragDropEventPayload }) => void) | null = null;

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    isBackgroundManagerOpen: {
      value: false,
    },
  }),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (handler: (event: { payload: DragDropEventPayload }) => void) => {
      dragDropHandler = handler;
      return Promise.resolve(() => {
        dragDropHandler = null;
      });
    },
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setFocus: setFocusMock,
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}));

vi.mock('@/stores/runtime/dismissal-layer', () => ({
  useDismissalLayerStore: () => ({
    registerLayer: registerLayerMock,
    unregisterLayer: unregisterLayerMock,
  }),
}));

vi.mock('@/stores/runtime/drop-overlay', () => ({
  useDropOverlayStore: () => ({
    isBackgroundManagerOpen: false,
  }),
}));

let mountedWrapper: VueWrapper | null = null;
let registeredPaneIds: number[] = [];

function setElementRect(element: Element, rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...rect,
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      toJSON: () => ({}),
    }),
  });
}

function createDropTarget(path: string): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-drop-target', '');
  element.setAttribute('data-entry-path', path);
  setElementRect(element, {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
  });

  return element;
}

async function mountExternalDrop() {
  const componentRef = ref<Element | null>(null);
  const currentPath = ref('/current');
  const entriesContainerRef = ref<Element | null>(null);
  const onDrop = vi.fn<(sourcePaths: string[], targetPath: string, operation: DragOperationType) => void>();
  const onUrlDrop = vi.fn<(urls: string[], targetPath: string) => void>();
  let externalDrop = {} as ReturnType<typeof useFileBrowserExternalDrop>;

  const wrapper = mount(defineComponent({
    setup() {
      externalDrop = useFileBrowserExternalDrop({
        componentRef,
        currentPath,
        entriesContainerRef,
        onDrop,
        onUrlDrop,
      });

      return {
        componentRef,
        entriesContainerRef,
      };
    },
    template: '<div ref="componentRef"><div ref="entriesContainerRef" /></div>',
  }), {
    attachTo: document.body,
  });

  await nextTick();
  await Promise.resolve();

  const paneId = registerDropContainer({
    componentRef,
    currentPath,
    entriesContainerRef,
  });
  registeredPaneIds.push(paneId);

  return {
    wrapper,
    componentRef: componentRef as Ref<Element>,
    entriesContainerRef: entriesContainerRef as Ref<Element>,
    externalDrop,
    onDrop,
  };
}

describe('useFileBrowserExternalDrop', () => {
  beforeEach(() => {
    dragDropHandler = null;
    setFocusMock.mockClear();
    registerLayerMock.mockClear();
    unregisterLayerMock.mockClear();

    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: {
        escape: (value: string) => value,
      },
    });
  });

  afterEach(() => {
    mountedWrapper?.unmount();
    mountedWrapper = null;

    for (const paneId of registeredPaneIds) {
      unregisterDropContainer(paneId);
    }

    registeredPaneIds = [];
    document.body.replaceChildren();
  });

  it('recomputes the current target after mounted drop targets refresh', async () => {
    const mounted = await mountExternalDrop();
    mountedWrapper = mounted.wrapper;

    expect(mounted.componentRef.value).toBeTruthy();
    expect(mounted.entriesContainerRef.value).toBeTruthy();
    expect(mounted.externalDrop).toBeTruthy();
    expect(dragDropHandler).toBeTruthy();

    setElementRect(mounted.componentRef.value, {
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
    });

    const firstTarget = createDropTarget('folder-a');
    mounted.entriesContainerRef.value.append(firstTarget);

    dragDropHandler?.({
      payload: {
        type: 'enter',
        paths: ['source.txt'],
        position: {
          x: 50,
          y: 50,
        },
      },
    });

    expect(firstTarget.hasAttribute('data-drag-over')).toBe(true);

    firstTarget.remove();

    const secondTarget = createDropTarget('folder-b');
    mounted.entriesContainerRef.value.append(secondTarget);

    mounted.externalDrop.refreshDropTargets();

    expect(secondTarget.hasAttribute('data-drag-over')).toBe(true);

    dragDropHandler?.({
      payload: {
        type: 'drop',
        paths: ['source.txt'],
      },
    });

    expect(mounted.onDrop).toHaveBeenCalledWith(['source.txt'], 'folder-b', 'move');
  });
});
