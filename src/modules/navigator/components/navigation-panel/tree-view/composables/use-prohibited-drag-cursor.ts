// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onScopeDispose } from 'vue';
import { UI_CONSTANTS } from '@/constants';

const PROHIBITED_DRAG_CURSOR_CLASS = 'tree-view-drag-prohibited';

export function useProhibitedDragCursor() {
  let stopTracking: (() => void) | null = null;

  function clearProhibitedDragCursor() {
    stopTracking?.();
    stopTracking = null;
  }

  function showProhibitedDragCursor(event: MouseEvent) {
    clearProhibitedDragCursor();

    const startX = event.clientX;
    const startY = event.clientY;

    function handlePointerMove(moveEvent: MouseEvent) {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);

      if (
        deltaX > UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
        || deltaY > UI_CONSTANTS.DRAG_ACTIVATION_THRESHOLD
      ) {
        document.documentElement.classList.add(PROHIBITED_DRAG_CURSOR_CLASS);
      }
    }

    stopTracking = () => {
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', clearProhibitedDragCursor);
      document.documentElement.classList.remove(PROHIBITED_DRAG_CURSOR_CLASS);
    };

    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', clearProhibitedDragCursor);
  }

  onScopeDispose(clearProhibitedDragCursor);

  return { showProhibitedDragCursor };
}
