// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

declare module 'vue3-smooth-dnd' {
  import type { DefineComponent } from 'vue';

  export interface DropResult<T = unknown> {
    removedIndex: number | null;
    addedIndex: number | null;
    payload: T;
    element: Element;
  }

  export interface ContainerProps {
    orientation?: 'horizontal' | 'vertical';
    behaviour?: 'move' | 'copy' | 'drop-zone' | 'contain';
    groupName?: string;
    lockAxis?: 'x' | 'y';
    dragHandleSelector?: string;
    nonDragAreaSelector?: string;
    dragBeginDelay?: number;
    animationDuration?: number;
    autoScrollEnabled?: boolean;
    dragClass?: string;
    dropClass?: string;
    removeOnDropOut?: boolean;
    dropPlaceholder?: object | boolean;
    getChildPayload?: (index: number) => unknown;
    shouldAnimateDrop?: (sourceContainerOptions: object, payload: unknown) => boolean;
    shouldAcceptDrop?: (sourceContainerOptions: object, payload: unknown) => boolean;
    getGhostParent?: () => Element | null;
  }

  export const Container: DefineComponent<ContainerProps>;
  export const Draggable: DefineComponent<Record<string, unknown>>;
}
