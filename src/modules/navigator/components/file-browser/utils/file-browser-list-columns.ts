// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ListColumnFlexWeights,
  ListColumnOrder,
  ListColumnVisibility,
  ListColumnWidths,
  ListReorderableColumnId,
} from '@/types/user-settings';

export type FileBrowserListColumnId =
  | 'name'
  | ListReorderableColumnId;

export interface FileBrowserListColumnDefinition {
  id: FileBrowserListColumnId;
  visibilityKey: keyof ListColumnVisibility | null;
  defaultMin: number;
  defaultMax: number;
  isFlex?: boolean;
}

export const FILE_BROWSER_LIST_REORDERABLE_COLUMN_IDS: readonly ListReorderableColumnId[] = [
  'items',
  'size',
  'modified',
  'created',
  'tags',
  'kind',
  'links',
  'linkStatus',
];

export const FILE_BROWSER_LIST_COLUMN_DEFINITIONS: readonly FileBrowserListColumnDefinition[] = [
  { id: 'name', visibilityKey: null, defaultMin: 200, defaultMax: Number.POSITIVE_INFINITY, isFlex: true },
  { id: 'items', visibilityKey: 'items', defaultMin: 70, defaultMax: 90 },
  { id: 'size', visibilityKey: 'size', defaultMin: 50, defaultMax: 100 },
  { id: 'modified', visibilityKey: 'modified', defaultMin: 120, defaultMax: 160 },
  { id: 'created', visibilityKey: 'created', defaultMin: 120, defaultMax: 160 },
  { id: 'tags', visibilityKey: 'tags', defaultMin: 140, defaultMax: 180 },
  { id: 'kind', visibilityKey: 'kind', defaultMin: 90, defaultMax: 130 },
  { id: 'links', visibilityKey: 'links', defaultMin: 50, defaultMax: 80 },
  { id: 'linkStatus', visibilityKey: 'linkStatus', defaultMin: 90, defaultMax: 120 },
];

const DEFAULT_LIST_COLUMN_FLEX_WEIGHTS: Record<FileBrowserListColumnId, number> = {
  name: 4,
  items: 1,
  size: 1,
  modified: 1,
  created: 1,
  tags: 1,
  kind: 1,
  links: 1,
  linkStatus: 1,
};

const REORDERABLE_COLUMN_ID_SET = new Set<string>(FILE_BROWSER_LIST_REORDERABLE_COLUMN_IDS);

export interface ListColumnsGridTemplateOptions {
  fillWidth: boolean;
  columnWidths: ListColumnWidths;
  flexWeights: ListColumnFlexWeights;
  resizePreviewWidths: ListColumnWidths;
  resizePreviewFlexWeights: ListColumnFlexWeights;
  isResizing: boolean;
}

export function isListReorderableColumnId(value: string): value is ListReorderableColumnId {
  return REORDERABLE_COLUMN_ID_SET.has(value);
}

export function normalizeListColumnOrder(columnOrder: readonly string[] | undefined): ListColumnOrder {
  const normalizedOrder: ListReorderableColumnId[] = [];
  const seenColumnIds = new Set<ListReorderableColumnId>();

  if (Array.isArray(columnOrder)) {
    for (const columnId of columnOrder) {
      if (!isListReorderableColumnId(columnId) || seenColumnIds.has(columnId)) {
        continue;
      }

      normalizedOrder.push(columnId);
      seenColumnIds.add(columnId);
    }
  }

  for (const columnId of FILE_BROWSER_LIST_REORDERABLE_COLUMN_IDS) {
    if (!seenColumnIds.has(columnId)) {
      normalizedOrder.push(columnId);
    }
  }

  return normalizedOrder;
}

export function clampListColumnWidth(width: number, defaultMin: number): number {
  const roundedWidth = Math.round(width);

  if (!Number.isFinite(roundedWidth)) {
    return defaultMin;
  }

  return Math.max(defaultMin, roundedWidth);
}

export function getDefaultListColumnFlexWeight(definition: FileBrowserListColumnDefinition): number {
  return DEFAULT_LIST_COLUMN_FLEX_WEIGHTS[definition.id] ?? 1;
}

export function getListColumnGridTrack(
  definition: FileBrowserListColumnDefinition,
  resolvedWidth: number | undefined,
): string {
  if (resolvedWidth !== undefined) {
    return `${clampListColumnWidth(resolvedWidth, definition.defaultMin)}px`;
  }

  if (definition.isFlex) {
    return `minmax(${definition.defaultMin}px, 500px)`;
  }

  return `minmax(${definition.defaultMin}px, ${definition.defaultMax}px)`;
}

export function getListColumnFlexGridTrack(
  definition: FileBrowserListColumnDefinition,
  flexWeight: number | undefined,
): string {
  const resolvedWeight = flexWeight ?? getDefaultListColumnFlexWeight(definition);
  const safeWeight = Math.max(resolvedWeight, 0.01);

  return `minmax(${definition.defaultMin}px, ${safeWeight}fr)`;
}

function distributeListColumnRoundingDelta(
  widths: number[],
  minimumWidths: number[],
  pinnedColumnIndex: number,
  roundingDelta: number,
) {
  const adjustableColumnIndices = widths
    .map((width, index) => index)
    .filter(index => index !== pinnedColumnIndex);

  for (const index of adjustableColumnIndices) {
    if (roundingDelta === 0) {
      break;
    }

    const step = roundingDelta > 0 ? 1 : -1;
    const nextWidth = widths[index] + step;

    if (nextWidth >= minimumWidths[index]) {
      widths[index] = nextWidth;
      roundingDelta -= step;
    }
  }
}

export function redistributeListColumnWidths(
  definitions: readonly FileBrowserListColumnDefinition[],
  startWidths: ListColumnWidths,
  resizedColumnId: FileBrowserListColumnId,
  nextResizedWidth: number,
): ListColumnWidths {
  const columnIds = definitions.map(definition => definition.id);
  const minimumWidths = definitions.map(definition => definition.defaultMin);
  const resolvedStartWidths = columnIds.map((columnId, index) => {
    const startWidth = startWidths[columnId];

    if (startWidth === undefined) {
      return minimumWidths[index];
    }

    return clampListColumnWidth(startWidth, minimumWidths[index]);
  });
  const resizedColumnIndex = columnIds.indexOf(resizedColumnId);

  if (resizedColumnIndex === -1) {
    return startWidths;
  }

  const totalStartWidth = resolvedStartWidths.reduce((sum, width) => sum + width, 0);
  let clampedResizedWidth = clampListColumnWidth(nextResizedWidth, minimumWidths[resizedColumnIndex]);
  let widthDelta = clampedResizedWidth - resolvedStartWidths[resizedColumnIndex];
  const resultWidths = [...resolvedStartWidths];

  if (widthDelta > 0) {
    const shrinkableAmounts = resolvedStartWidths.map((width, index) => {
      if (index === resizedColumnIndex) {
        return 0;
      }

      return Math.max(0, width - minimumWidths[index]);
    });
    const totalShrinkable = shrinkableAmounts.reduce((sum, amount) => sum + amount, 0);
    const appliedDelta = Math.min(widthDelta, totalShrinkable);
    clampedResizedWidth = resolvedStartWidths[resizedColumnIndex] + appliedDelta;
    widthDelta = appliedDelta;
  }

  resultWidths[resizedColumnIndex] = clampedResizedWidth;

  if (widthDelta === 0) {
    return Object.fromEntries(columnIds.map((columnId, index) => [columnId, resultWidths[index]]));
  }

  if (widthDelta > 0) {
    const shrinkableAmounts = resolvedStartWidths.map((width, index) => {
      if (index === resizedColumnIndex) {
        return 0;
      }

      return Math.max(0, width - minimumWidths[index]);
    });
    const totalShrinkable = shrinkableAmounts.reduce((sum, amount) => sum + amount, 0);

    if (totalShrinkable <= 0) {
      return Object.fromEntries(columnIds.map((columnId, index) => [columnId, resultWidths[index]]));
    }

    for (let index = 0; index < columnIds.length; index += 1) {
      if (index === resizedColumnIndex || shrinkableAmounts[index] === 0) {
        continue;
      }

      const reduction = (shrinkableAmounts[index] / totalShrinkable) * widthDelta;
      resultWidths[index] = Math.round(resolvedStartWidths[index] - reduction);
      resultWidths[index] = Math.max(minimumWidths[index], resultWidths[index]);
    }
  }
  else {
    const expandableIndices = columnIds
      .map((columnId, index) => index)
      .filter(index => index !== resizedColumnIndex);
    const expansionWeights = expandableIndices.map((index) => {
      return Math.max(resolvedStartWidths[index] - minimumWidths[index], 1);
    });
    const totalExpansionWeight = expansionWeights.reduce((sum, weight) => sum + weight, 0);
    const expansionAmount = -widthDelta;

    for (let position = 0; position < expandableIndices.length; position += 1) {
      const index = expandableIndices[position];
      const addition = (expansionWeights[position] / totalExpansionWeight) * expansionAmount;
      resultWidths[index] = Math.round(resolvedStartWidths[index] + addition);
    }
  }

  const actualTotal = resultWidths.reduce((sum, width) => sum + width, 0);
  const roundingDelta = totalStartWidth - actualTotal;

  if (roundingDelta !== 0) {
    distributeListColumnRoundingDelta(resultWidths, minimumWidths, resizedColumnIndex, roundingDelta);
  }

  return Object.fromEntries(columnIds.map((columnId, index) => [columnId, resultWidths[index]]));
}

export function convertWidthsToFlexWeights(
  definitions: readonly FileBrowserListColumnDefinition[],
  widths: ListColumnWidths,
): ListColumnFlexWeights {
  const flexWeights: ListColumnFlexWeights = {};

  for (const definition of definitions) {
    const width = widths[definition.id];

    if (width === undefined) {
      continue;
    }

    flexWeights[definition.id] = Math.max(width - definition.defaultMin, 1);
  }

  return flexWeights;
}

export function measureHeaderColumnWidths(
  headerGridElement: HTMLElement,
  columnVisibility: ListColumnVisibility,
  columnOrder?: readonly string[],
): ListColumnWidths {
  const columnDefinitions = getVisibleListColumnDefinitions(columnVisibility, columnOrder);
  const headerCells = headerGridElement.querySelectorAll(':scope > .file-browser-list-view__header-cell');
  const measuredWidths: ListColumnWidths = {};

  columnDefinitions.forEach((definition, index) => {
    const headerCell = headerCells[index];

    if (!(headerCell instanceof HTMLElement)) {
      return;
    }

    const measuredWidth = Math.ceil(headerCell.getBoundingClientRect().width);

    if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
      measuredWidths[definition.id] = clampListColumnWidth(measuredWidth, definition.defaultMin);
    }
  });

  return measuredWidths;
}

export function getVisibleListColumnDefinitions(
  columnVisibility: ListColumnVisibility,
  columnOrder?: readonly string[],
): FileBrowserListColumnDefinition[] {
  const nameColumn = FILE_BROWSER_LIST_COLUMN_DEFINITIONS.find(definition => definition.id === 'name');

  if (!nameColumn) {
    throw new Error('Missing name column definition');
  }

  const orderedOptionalColumns = normalizeListColumnOrder(columnOrder)
    .map(columnId => FILE_BROWSER_LIST_COLUMN_DEFINITIONS.find(definition => definition.id === columnId))
    .filter((definition): definition is FileBrowserListColumnDefinition => {
      if (!definition || definition.visibilityKey === null) {
        return false;
      }

      return columnVisibility[definition.visibilityKey];
    });

  return [nameColumn, ...orderedOptionalColumns];
}

export function buildCompactListColumnWidths(
  columnVisibility: ListColumnVisibility,
  columnOrder?: readonly string[],
): ListColumnWidths {
  const compactWidths: ListColumnWidths = {};

  for (const definition of getVisibleListColumnDefinitions(columnVisibility, columnOrder)) {
    compactWidths[definition.id] = definition.defaultMin;
  }

  return compactWidths;
}

export function buildListColumnsGridTemplate(
  columnVisibility: ListColumnVisibility,
  options: ListColumnsGridTemplateOptions,
  columnOrder?: readonly string[],
): string {
  const definitions = getVisibleListColumnDefinitions(columnVisibility, columnOrder);
  const {
    fillWidth,
    columnWidths,
    flexWeights,
    resizePreviewWidths,
    resizePreviewFlexWeights,
    isResizing,
  } = options;

  const tracks = definitions.map((definition) => {
    if (fillWidth) {
      const previewFlexWeight = isResizing
        ? resizePreviewFlexWeights[definition.id]
        : undefined;

      return getListColumnFlexGridTrack(
        definition,
        previewFlexWeight ?? flexWeights[definition.id],
      );
    }

    if (isResizing && resizePreviewWidths[definition.id] !== undefined) {
      return getListColumnGridTrack(definition, resizePreviewWidths[definition.id]);
    }

    const savedWidth = columnWidths[definition.id];

    return getListColumnGridTrack(definition, savedWidth);
  });

  return tracks.join(' ');
}

export function getListColumnDefinition(columnId: FileBrowserListColumnId): FileBrowserListColumnDefinition {
  const definition = FILE_BROWSER_LIST_COLUMN_DEFINITIONS.find(entry => entry.id === columnId);

  if (!definition) {
    throw new Error(`Unknown list column id: ${columnId}`);
  }

  return definition;
}
