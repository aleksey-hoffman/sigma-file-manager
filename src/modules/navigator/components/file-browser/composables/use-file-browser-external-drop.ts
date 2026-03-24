// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { storeToRefs } from 'pinia';
import type { DragOperationType } from './use-file-browser-drag';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useDropOverlayStore } from '@/stores/runtime/drop-overlay';
import { getDropTargetRegistry } from '@/composables/use-drop-target-registry';

interface DropTargetInfo {
  path: string;
  element: Element;
}

export function useFileBrowserExternalDrop(options: {
  componentRef: Ref<Element | null>;
  currentPath: Ref<string>;
  entriesContainerRef: Ref<Element | null>;
  onDrop: (sourcePaths: string[], targetPath: string, operation: DragOperationType) => void;
  onUrlDrop: (urls: string[], targetPath: string) => void;
  disableBackgroundDrop?: boolean;
}) {
  const dismissalLayerStore = useDismissalLayerStore();
  const dropOverlayStore = useDropOverlayStore();
  const { isBackgroundManagerOpen } = storeToRefs(dropOverlayStore);
  const isExternalDragActive = ref(false);
  const externalDragItemCount = ref(0);
  const externalDragOperationType = ref<DragOperationType>('move');
  const isUrlDrop = ref(false);
  const isCurrentDirLocked = ref(false);
  const isTargetingEntry = ref(false);
  let dropTargets: DropTargetInfo[] = [];
  let currentDropTargetPath = '';
  let unlistenDrop: (() => void) | null = null;
  let unlistenUrlDragEnter: UnlistenFn | null = null;
  let unlistenUrlDrop: UnlistenFn | null = null;
  let dismissalLayerId: string | null = null;
  let currentDragHasPaths = false;

  function toLogicalPosition(physicalX: number, physicalY: number): {
    x: number;
    y: number;
  } {
    const scaleFactor = window.devicePixelRatio || 1;
    return {
      x: physicalX / scaleFactor,
      y: physicalY / scaleFactor,
    };
  }

  function isPhysicalPositionWithinComponent(physicalX: number, physicalY: number): boolean {
    const element = options.componentRef.value;
    if (!element) return false;

    const { x, y } = toLogicalPosition(physicalX, physicalY);
    const rect = element.getBoundingClientRect();
    return (
      x >= rect.left
      && x <= rect.right
      && y >= rect.top
      && y <= rect.bottom
    );
  }

  function collectDropTargets() {
    dropTargets = [];
    const dropTargetRegistry = getDropTargetRegistry();

    for (const container of dropTargetRegistry) {
      const containerElement = container.entriesContainerRef.value;
      if (!containerElement) continue;

      const elements = containerElement.querySelectorAll('[data-drop-target]');
      elements.forEach((element) => {
        const path = element.getAttribute('data-entry-path');

        if (path) {
          dropTargets.push({
            path,
            element,
          });
        }
      });
    }
  }

  function findDropTarget(logicalX: number, logicalY: number): DropTargetInfo | null {
    for (const target of dropTargets) {
      const rect = target.element.getBoundingClientRect();

      if (
        logicalX >= rect.left
        && logicalX <= rect.right
        && logicalY >= rect.top
        && logicalY <= rect.bottom
      ) {
        return target;
      }
    }

    return null;
  }

  function updateDropTargetAttributes(targetPath: string) {
    const dropTargetRegistry = getDropTargetRegistry();

    for (const container of dropTargetRegistry) {
      const containerElement = container.entriesContainerRef.value;
      if (!containerElement) continue;

      containerElement.querySelectorAll('[data-drag-over]').forEach((element) => {
        element.removeAttribute('data-drag-over');
      });
    }

    if (targetPath) {
      for (const container of dropTargetRegistry) {
        const containerElement = container.entriesContainerRef.value;
        if (!containerElement) continue;

        const targetElement = containerElement.querySelector(
          `[data-entry-path="${CSS.escape(targetPath)}"]`,
        );

        if (targetElement) {
          targetElement.setAttribute('data-drag-over', '');
          break;
        }
      }
    }
  }

  function updateTargetAtLogicalPosition(logicalX: number, logicalY: number) {
    if (!isCurrentDirLocked.value) {
      const target = findDropTarget(logicalX, logicalY);
      const newTargetPath = target ? target.path : '';

      isTargetingEntry.value = !!newTargetPath;

      if (currentDropTargetPath !== newTargetPath) {
        currentDropTargetPath = newTargetPath;
        updateDropTargetAttributes(newTargetPath);
      }

      return;
    }

    if (currentDropTargetPath) {
      currentDropTargetPath = '';
      updateDropTargetAttributes('');
    }

    isTargetingEntry.value = false;
  }

  function updateTargetAtPhysicalPosition(physicalX: number, physicalY: number) {
    const { x, y } = toLogicalPosition(physicalX, physicalY);
    updateTargetAtLogicalPosition(x, y);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift' && !isUrlDrop.value) {
      externalDragOperationType.value = 'copy';
    }

    if (event.key === 'Control') {
      isCurrentDirLocked.value = true;
      isTargetingEntry.value = false;
      currentDropTargetPath = '';
      updateDropTargetAttributes('');
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift' && !isUrlDrop.value) {
      externalDragOperationType.value = 'move';
    }

    if (event.key === 'Control') {
      isCurrentDirLocked.value = false;
    }
  }

  function deactivatePane() {
    isExternalDragActive.value = false;
    isUrlDrop.value = false;
    externalDragOperationType.value = 'move';
    isCurrentDirLocked.value = false;
    isTargetingEntry.value = false;
    currentDropTargetPath = '';
    dropTargets = [];

    if (dismissalLayerId) {
      dismissalLayerStore.unregisterLayer(dismissalLayerId);
      dismissalLayerId = null;
    }

    updateDropTargetAttributes('');
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  function resetState() {
    deactivatePane();
    externalDragItemCount.value = 0;
    currentDragHasPaths = false;
  }

  function activateDrag(urlDrop = false) {
    isExternalDragActive.value = true;
    isUrlDrop.value = urlDrop;
    externalDragOperationType.value = urlDrop ? 'copy' : 'move';
    collectDropTargets();
    getCurrentWindow().setFocus();
    dismissalLayerId = dismissalLayerStore.registerLayer('drag', () => resetState(), 300);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  function resolveDropTargetPath(): string {
    if (options.disableBackgroundDrop) {
      return currentDropTargetPath;
    }

    return currentDropTargetPath || options.currentPath.value;
  }

  type UrlDropEventPayload = {
    urls: string[];
    position: {
      x: number;
      y: number;
    };
  };

  onMounted(() => {
    listen<UrlDropEventPayload>(
      'app://url-drag-enter',
      (event) => {
        if (event.payload.urls.length > 0) {
          externalDragItemCount.value = event.payload.urls.length;
        }
      },
    ).then((unlisten) => {
      unlistenUrlDragEnter = unlisten;
    });

    listen<UrlDropEventPayload>(
      'app://url-drop',
      (event) => {
        if (!isUrlDrop.value || !isExternalDragActive.value) {
          return;
        }

        const urls = event.payload.urls;

        if (urls.length === 0) {
          return;
        }

        const targetPath = resolveDropTargetPath();

        resetState();

        if (targetPath) {
          options.onUrlDrop(urls, targetPath);
        }
      },
    ).then((unlisten) => {
      unlistenUrlDrop = unlisten;
    });

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (isBackgroundManagerOpen.value) {
          return;
        }

        if (event.payload.type === 'enter') {
          const paths = (event.payload.paths as string[]) ?? [];
          const position = event.payload.position as {
            x: number;
            y: number;
          };

          currentDragHasPaths = paths.length > 0;
          externalDragItemCount.value = currentDragHasPaths ? paths.length : 1;

          if (isPhysicalPositionWithinComponent(position.x, position.y)) {
            activateDrag(!currentDragHasPaths);
            updateTargetAtPhysicalPosition(position.x, position.y);
          }
        }
        else if (event.payload.type === 'over') {
          const position = event.payload.position as {
            x: number;
            y: number;
          };

          if (!isPhysicalPositionWithinComponent(position.x, position.y)) {
            if (isExternalDragActive.value) {
              deactivatePane();
            }

            return;
          }

          if (!isExternalDragActive.value) {
            activateDrag(!currentDragHasPaths);
          }

          updateTargetAtPhysicalPosition(position.x, position.y);
        }
        else if (event.payload.type === 'leave') {
          resetState();
        }
        else if (event.payload.type === 'drop') {
          const paths = (event.payload.paths as string[]) ?? [];

          if (paths.length > 0) {
            const wasActive = isExternalDragActive.value;
            const targetPath = resolveDropTargetPath();
            const operation = externalDragOperationType.value;

            resetState();

            if (wasActive && targetPath) {
              options.onDrop(paths, targetPath, operation);
            }
          }
          else if (isUrlDrop.value) {
            setTimeout(() => {
              if (isExternalDragActive.value) {
                resetState();
              }
            }, 500);
          }
          else {
            resetState();
          }
        }
      })
      .then((unlisten) => {
        unlistenDrop = unlisten;
      });
  });

  onUnmounted(() => {
    if (unlistenDrop) {
      unlistenDrop();
    }

    if (unlistenUrlDragEnter) {
      unlistenUrlDragEnter();
    }

    if (unlistenUrlDrop) {
      unlistenUrlDrop();
    }
  });

  return {
    isExternalDragActive,
    externalDragItemCount,
    externalDragOperationType,
    isUrlDrop,
    isCurrentDirLocked,
    isTargetingEntry,
  };
}
