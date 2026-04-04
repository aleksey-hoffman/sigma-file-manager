// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { i18n } from '@/localization';
import { formatBytes, formatDate } from '../utils';
import { getFileBrowserEntryResolvedSizeBytes, type DirSizesStore } from './file-browser-sort';
import {
  parseQuickSearchQuery,
  type QuickSearchProperty,
} from './file-browser-quick-search-query';
import {
  evaluateQuickSearchItemsPredicate,
  evaluateQuickSearchSizePredicate,
  parseQuickSearchItemsPredicate,
  parseQuickSearchSizePredicate,
} from './file-browser-quick-search-numeric';

function getFileBrowserItemCountForFilter(entry: DirEntry): number | null {
  if (!entry.is_dir) {
    return null;
  }

  if (entry.item_count !== null) {
    return entry.item_count;
  }

  return null;
}

export function buildFileBrowserQuickSearchHaystack(entry: DirEntry, dirSizesStore: DirSizesStore): string {
  const parts: string[] = [entry.name.toLowerCase()];

  if (entry.ext) {
    const extensionLower = entry.ext.toLowerCase();
    parts.push(extensionLower, `.${extensionLower}`);
  }

  parts.push(entry.path.toLowerCase());

  if (entry.mime) {
    parts.push(entry.mime.toLowerCase());
  }

  const resolvedSizeBytes = getFileBrowserEntryResolvedSizeBytes(entry, dirSizesStore);
  parts.push(formatBytes(resolvedSizeBytes).toLowerCase());

  if (entry.item_count !== null) {
    const count = entry.item_count;
    parts.push(String(count));
    parts.push(i18n.global.t('fileBrowser.itemCount', { count }).toLowerCase());
  }

  const sizeInfo = dirSizesStore.getSize(entry.path);

  if (sizeInfo && (sizeInfo.status === 'Complete' || sizeInfo.status === 'Loading')) {
    parts.push(String(sizeInfo.fileCount));
    parts.push(String(sizeInfo.dirCount));
  }

  for (const timestamp of [entry.modified_time, entry.accessed_time, entry.created_time]) {
    if (timestamp) {
      parts.push(formatDate(timestamp).toLowerCase());
    }
  }

  return parts.join(' ');
}

function buildHaystackForProperty(
  entry: DirEntry,
  property: QuickSearchProperty,
  dirSizesStore: DirSizesStore,
): string {
  if (property === 'name') {
    const parts: string[] = [entry.name.toLowerCase()];

    if (entry.ext) {
      const extensionLower = entry.ext.toLowerCase();
      parts.push(extensionLower, `.${extensionLower}`);
    }

    return parts.join(' ');
  }

  if (property === 'path') {
    return entry.path.toLowerCase();
  }

  if (property === 'size') {
    const resolvedSizeBytes = getFileBrowserEntryResolvedSizeBytes(entry, dirSizesStore);
    return formatBytes(resolvedSizeBytes).toLowerCase();
  }

  if (property === 'items') {
    const parts: string[] = [];

    if (entry.item_count !== null) {
      const count = entry.item_count;
      parts.push(String(count));
      parts.push(i18n.global.t('fileBrowser.itemCount', { count }).toLowerCase());
    }

    const sizeInfo = dirSizesStore.getSize(entry.path);

    if (sizeInfo && (sizeInfo.status === 'Complete' || sizeInfo.status === 'Loading')) {
      parts.push(String(sizeInfo.fileCount));
      parts.push(String(sizeInfo.dirCount));
    }

    return parts.join(' ');
  }

  if (property === 'modified') {
    return entry.modified_time ? formatDate(entry.modified_time).toLowerCase() : '';
  }

  if (property === 'created') {
    return entry.created_time ? formatDate(entry.created_time).toLowerCase() : '';
  }

  if (property === 'accessed') {
    return entry.accessed_time ? formatDate(entry.accessed_time).toLowerCase() : '';
  }

  if (property === 'mime') {
    return entry.mime ? entry.mime.toLowerCase() : '';
  }

  return '';
}

export function fileBrowserEntryMatchesQuickSearch(
  entry: DirEntry,
  filterQueryRaw: string,
  dirSizesStore: DirSizesStore,
): boolean {
  const trimmed = filterQueryRaw.trim();

  if (!trimmed) {
    return true;
  }

  const parsed = parseQuickSearchQuery(trimmed);
  const valueRaw = parsed.property !== null ? parsed.value.trim() : trimmed;
  const valueNormalized = valueRaw.toLowerCase();

  if (parsed.property !== null && !valueNormalized) {
    return true;
  }

  if (parsed.property === 'size') {
    const sizePredicate = parseQuickSearchSizePredicate(valueRaw);

    if (sizePredicate.kind !== 'substring') {
      const sizeBytes = getFileBrowserEntryResolvedSizeBytes(entry, dirSizesStore);

      return evaluateQuickSearchSizePredicate(sizePredicate, sizeBytes);
    }
  }

  if (parsed.property === 'items') {
    const itemsPredicate = parseQuickSearchItemsPredicate(valueRaw);

    if (itemsPredicate.kind !== 'substring') {
      const itemCount = getFileBrowserItemCountForFilter(entry);

      if (itemCount === null) {
        return false;
      }

      return evaluateQuickSearchItemsPredicate(itemsPredicate, itemCount);
    }
  }

  if (!valueNormalized) {
    return true;
  }

  const haystack = parsed.property !== null
    ? buildHaystackForProperty(entry, parsed.property, dirSizesStore)
    : buildFileBrowserQuickSearchHaystack(entry, dirSizesStore);

  return haystack.includes(valueNormalized);
}
