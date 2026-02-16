// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type DropOperationType = 'move' | 'copy';

interface DropTargetInfo {
  path: string;
  element: Element;
}

export function usePageDropZone(options: {
  containerRef: Ref<Element | null>;
  onDrop: (sourcePaths: string[], targetPath: string, operation: DropOperationType) => void;
}) {
  const isActive = ref(false);
  const itemCount = ref(0);
  const operationType = ref<DropOperationType>('move');
  let dropTargets: DropTargetInfo[] = [];
  let currentDropTargetPath = '';
  let currentTargetElement: Element | null = null;
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

  function isPositionWithinContainer(physicalX: number, physicalY: number): boolean {
    const element = options.containerRef.value;
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
    const container = options.containerRef.value;
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

  function updateDropTargetAttributes(targetPath: string, targetElement?: Element | null) {
    const container = options.containerRef.value;
    if (!container) return;

    container.querySelectorAll('[data-drag-over]').forEach((element) => {
      element.removeAttribute('data-drag-over');
    });

    if (targetElement) {
      targetElement.setAttribute('data-drag-over', '');
    }
    else if (targetPath) {
      const foundElement = container.querySelector(
        `[data-entry-path="${CSS.escape(targetPath)}"]`,
      );

      if (foundElement) {
        foundElement.setAttribute('data-drag-over', '');
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      operationType.value = 'copy';
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      operationType.value = 'move';
    }
  }

  function resetState() {
    isActive.value = false;
    operationType.value = 'move';
    currentDropTargetPath = '';
    currentTargetElement = null;
    dropTargets = [];
    updateDropTargetAttributes('');
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  function activate() {
    isActive.value = true;
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

          itemCount.value = paths.length;

          if (isPositionWithinContainer(position.x, position.y)) {
            activate();
          }
        }
        else if (event.payload.type === 'over') {
          const position = event.payload.position as {
            x: number;
            y: number;
          };

          if (!isPositionWithinContainer(position.x, position.y)) {
            if (isActive.value) {
              resetState();
            }

            return;
          }

          if (!isActive.value) {
            activate();
          }

          const logicalPosition = toLogicalPosition(position.x, position.y);
          const target = findDropTarget(logicalPosition.x, logicalPosition.y);
          const newTargetPath = target ? target.path : '';
          const newTargetElement = target?.element ?? null;

          if (currentDropTargetPath !== newTargetPath || currentTargetElement !== newTargetElement) {
            currentDropTargetPath = newTargetPath;
            currentTargetElement = newTargetElement;
            updateDropTargetAttributes(newTargetPath, newTargetElement);
          }
        }
        else if (event.payload.type === 'leave') {
          resetState();
          itemCount.value = 0;
        }
        else if (event.payload.type === 'drop') {
          const paths = (event.payload.paths as string[]) ?? [];

          const wasActive = isActive.value;
          const targetPath = currentDropTargetPath;
          const operation = operationType.value;

          resetState();
          itemCount.value = 0;

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
    isActive,
    itemCount,
    operationType,
  };
}
