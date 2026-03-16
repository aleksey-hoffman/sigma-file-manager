// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';

export interface DropTargetContainer {
  id: number;
  componentRef: Ref<Element | null>;
  entriesContainerRef: Ref<Element | null>;
  currentPath: Ref<string>;
  disableBackgroundDrop: boolean;
}

const registry: DropTargetContainer[] = [];
const crossPaneDropTargetPaneId = ref<number | null>(null);
let nextId = 0;

export function getDropTargetRegistry(): DropTargetContainer[] {
  return registry;
}

export function getCrossPaneDropTargetPaneId(): Ref<number | null> {
  return crossPaneDropTargetPaneId;
}

export function registerDropContainer(info: {
  componentRef: Ref<Element | null>;
  entriesContainerRef: Ref<Element | null>;
  currentPath?: Ref<string>;
  disableBackgroundDrop?: boolean;
}): number {
  const id = nextId++;

  registry.push({
    id,
    componentRef: info.componentRef,
    entriesContainerRef: info.entriesContainerRef,
    currentPath: info.currentPath ?? ref(''),
    disableBackgroundDrop: info.disableBackgroundDrop ?? true,
  });

  return id;
}

export function unregisterDropContainer(id: number): void {
  const index = registry.findIndex(entry => entry.id === id);

  if (index !== -1) {
    registry.splice(index, 1);
  }
}
