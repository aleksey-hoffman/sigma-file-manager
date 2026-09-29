// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { storeToRefs } from 'pinia';
import { useDropOverlayStore } from '@/stores/runtime/drop-overlay';
import {
  collectPageDropTargets,
  findPageDropTarget,
  getPageDropTargetKey,
  type PageDropTarget,
} from '@/utils/page-drop-targets';

export type DropOperationType = 'move' | 'copy';

export function usePageDropZone(options: {
  containerRef: Ref<Element | null>;
  onDrop: (sourcePaths: string[], targetPath: string, operation: DropOperationType) => void;
}) {
  const dropOverlayStore = useDropOverlayStore();
  const { isBackgroundManagerOpen } = storeToRefs(dropOverlayStore);
  const isActive = ref(false);
  const itemCount = ref(0);
  const operationType = ref<DropOperationType>('move');
  let dropTargets: PageDropTarget[] = [];
  let currentDropTarget: PageDropTarget | null = null;
  let currentDropTargetKey = '';
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
    const container = options.containerRef.value;
    dropTargets = container ? collectPageDropTargets(container) : [];
  }

  function updateDropTargetAttributes(target: PageDropTarget | null) {
    const container = options.containerRef.value;
    if (!container) return;

    container.querySelectorAll('[data-drag-over]').forEach((element) => {
      element.removeAttribute('data-drag-over');
    });

    if (target) {
      target.element.setAttribute('data-drag-over', '');
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
    currentDropTarget = null;
    currentDropTargetKey = '';
    dropTargets = [];
    updateDropTargetAttributes(null);
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
        if (isBackgroundManagerOpen.value) {
          return;
        }

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
          const target = findPageDropTarget(dropTargets, logicalPosition.x, logicalPosition.y);
          const nextTargetKey = getPageDropTargetKey(target);

          if (currentDropTargetKey !== nextTargetKey || currentDropTarget?.element !== target?.element) {
            currentDropTarget = target;
            currentDropTargetKey = nextTargetKey;
            updateDropTargetAttributes(target);
          }
        }
        else if (event.payload.type === 'leave') {
          resetState();
          itemCount.value = 0;
        }
        else if (event.payload.type === 'drop') {
          const paths = (event.payload.paths as string[]) ?? [];

          const wasActive = isActive.value;
          const target = currentDropTarget;
          const operation = operationType.value;

          resetState();
          itemCount.value = 0;

          if (!wasActive || paths.length === 0 || !target) {
            return;
          }

          options.onDrop(paths, target.path, operation);
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
