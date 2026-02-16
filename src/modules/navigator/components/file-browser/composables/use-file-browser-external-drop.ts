// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DragOperationType } from './use-file-browser-drag';

interface DropTargetInfo {
  path: string;
  element: Element;
}

export function useFileBrowserExternalDrop(options: {
  componentRef: Ref<Element | null>;
  currentPath: Ref<string>;
  entriesContainerRef: Ref<Element | null>;
  onDrop: (sourcePaths: string[], targetPath: string, operation: DragOperationType) => void;
}) {
  const isExternalDragActive = ref(false);
  const externalDragItemCount = ref(0);
  const externalDragOperationType = ref<DragOperationType>('move');
  const isCurrentDirLocked = ref(false);
  const isTargetingEntry = ref(false);
  let dropTargets: DropTargetInfo[] = [];
  let currentDropTargetPath = '';
  let unlistenDrop: (() => void) | null = null;

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

  function isPositionWithinComponent(physicalX: number, physicalY: number): boolean {
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
    const container = options.entriesContainerRef.value;
    if (!container) return;

    const elements = container.querySelectorAll('[data-drop-target]');
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

  function findDropTarget(clientX: number, clientY: number): DropTargetInfo | null {
    for (const target of dropTargets) {
      const rect = target.element.getBoundingClientRect();

      if (
        clientX >= rect.left
        && clientX <= rect.right
        && clientY >= rect.top
        && clientY <= rect.bottom
      ) {
        return target;
      }
    }

    return null;
  }

  function updateDropTargetAttributes(targetPath: string) {
    const container = options.entriesContainerRef.value;
    if (!container) return;

    container.querySelectorAll('[data-drag-over]').forEach((element) => {
      element.removeAttribute('data-drag-over');
    });

    if (targetPath) {
      const targetElement = container.querySelector(
        `[data-entry-path="${CSS.escape(targetPath)}"]`,
      );

      if (targetElement) {
        targetElement.setAttribute('data-drag-over', '');
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') {
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
    if (event.key === 'Shift') {
      externalDragOperationType.value = 'move';
    }

    if (event.key === 'Control') {
      isCurrentDirLocked.value = false;
    }
  }

  function deactivatePane() {
    isExternalDragActive.value = false;
    externalDragOperationType.value = 'move';
    isCurrentDirLocked.value = false;
    isTargetingEntry.value = false;
    currentDropTargetPath = '';
    dropTargets = [];
    updateDropTargetAttributes('');
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  function resetState() {
    deactivatePane();
    externalDragItemCount.value = 0;
  }

  function activateDrag() {
    isExternalDragActive.value = true;
    collectDropTargets();
    getCurrentWindow().setFocus();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  onMounted(() => {
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'enter') {
          const paths = (event.payload.paths as string[]) ?? [];
          const position = event.payload.position as {
            x: number;
            y: number;
          };

          externalDragItemCount.value = paths.length;

          if (isPositionWithinComponent(position.x, position.y)) {
            activateDrag();
          }
        }
        else if (event.payload.type === 'over') {
          const position = event.payload.position as {
            x: number;
            y: number;
          };

          if (!isPositionWithinComponent(position.x, position.y)) {
            if (isExternalDragActive.value) {
              deactivatePane();
            }

            return;
          }

          if (!isExternalDragActive.value) {
            activateDrag();
          }

          if (!isCurrentDirLocked.value) {
            const logicalPosition = toLogicalPosition(position.x, position.y);
            const target = findDropTarget(logicalPosition.x, logicalPosition.y);
            const newTargetPath = target ? target.path : '';

            isTargetingEntry.value = !!newTargetPath;

            if (currentDropTargetPath !== newTargetPath) {
              currentDropTargetPath = newTargetPath;
              updateDropTargetAttributes(newTargetPath);
            }
          }
          else if (currentDropTargetPath) {
            currentDropTargetPath = '';
            isTargetingEntry.value = false;
            updateDropTargetAttributes('');
          }
        }
        else if (event.payload.type === 'leave') {
          resetState();
        }
        else if (event.payload.type === 'drop') {
          const paths = (event.payload.paths as string[]) ?? [];

          const wasActive = isExternalDragActive.value;
          const targetPath = currentDropTargetPath || options.currentPath.value;
          const operation = externalDragOperationType.value;

          resetState();

          if (wasActive && paths.length > 0 && targetPath) {
            options.onDrop(paths, targetPath, operation);
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
  });

  return {
    isExternalDragActive,
    externalDragItemCount,
    externalDragOperationType,
    isCurrentDirLocked,
    isTargetingEntry,
  };
}
