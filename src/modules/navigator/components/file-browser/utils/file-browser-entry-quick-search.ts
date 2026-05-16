// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { i18n } from '@/localization';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { formatBytes, formatDate, formatFileBrowserListModifiedDate } from '../utils';
import { isRelativeDateDisplayEnabled } from '@/utils/relative-date-display';
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

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const RECENT_RELATIVE_DATE_WINDOW_MS = 6 * HOUR_MS;

type QuickSearchParsedQuery = ReturnType<typeof parseQuickSearchQuery>;

interface FileBrowserQuickSearchCacheItem {
  signature: string;
  value: string;
}

export interface FileBrowserQuickSearchCache {
  haystacks: WeakMap<DirEntry, Map<string, FileBrowserQuickSearchCacheItem>>;
}

export interface FileBrowserQuickSearchContext {
  showRelativeDates: boolean;
  referenceNowMs: number;
  dateTimeSignature: string;
}

export function createFileBrowserQuickSearchCache(): FileBrowserQuickSearchCache {
  return {
    haystacks: new WeakMap(),
  };
}

function getFileBrowserItemCountForFilter(entry: DirEntry): number | null {
  if (!entry.is_dir) {
    return null;
  }

  if (entry.item_count !== null) {
    return entry.item_count;
  }

  return null;
}

function getQuickSearchContext(): FileBrowserQuickSearchContext {
  const dateTimeOptions = useUserSettingsStore().userSettings.dateTime;

  return {
    showRelativeDates: dateTimeOptions.showRelativeDates,
    referenceNowMs: Date.now(),
    dateTimeSignature: [
      i18n.global.locale.value,
      dateTimeOptions.month,
      dateTimeOptions.hour12,
      dateTimeOptions.autoDetectRegionalFormat,
      dateTimeOptions.regionalFormat?.code ?? '',
      dateTimeOptions.properties.showSeconds,
      dateTimeOptions.properties.showMilliseconds,
    ].join(':'),
  };
}

function getDirSizeSignature(entry: DirEntry, dirSizesStore: DirSizesStore): string {
  if (entry.is_file) {
    return '';
  }

  const sizeInfo = dirSizesStore.getSize(entry.path);

  if (!sizeInfo) {
    return '';
  }

  return [
    sizeInfo.status,
    sizeInfo.size,
    sizeInfo.fileCount,
    sizeInfo.dirCount,
    sizeInfo.calculatedAt,
  ].join(':');
}

function getRelativeModifiedDateCacheSignature(entry: DirEntry, context: FileBrowserQuickSearchContext): string {
  if (!entry.modified_time || !isRelativeDateDisplayEnabled(context.showRelativeDates)) {
    return '';
  }

  const elapsedMs = context.referenceNowMs - entry.modified_time;

  if (elapsedMs < 0) {
    return `future:${Math.floor(context.referenceNowMs / SECOND_MS)}`;
  }

  if (elapsedMs < MINUTE_MS) {
    return `seconds:${Math.floor(elapsedMs / SECOND_MS)}`;
  }

  if (elapsedMs < HOUR_MS) {
    return `minutes:${Math.floor(elapsedMs / MINUTE_MS)}`;
  }

  if (elapsedMs < RECENT_RELATIVE_DATE_WINDOW_MS) {
    return `hours:${Math.floor(elapsedMs / HOUR_MS)}`;
  }

  const referenceDate = new Date(context.referenceNowMs);
  return `calendar:${referenceDate.getFullYear()}:${referenceDate.getMonth()}:${referenceDate.getDate()}`;
}

function getEntrySignature(
  entry: DirEntry,
  dirSizesStore: DirSizesStore,
  context: FileBrowserQuickSearchContext,
): string {
  return [
    entry.name,
    entry.ext ?? '',
    entry.mime ?? '',
    entry.path,
    entry.size,
    entry.item_count ?? '',
    entry.modified_time,
    entry.accessed_time,
    entry.created_time,
    context.showRelativeDates,
    context.dateTimeSignature,
    getRelativeModifiedDateCacheSignature(entry, context),
    getDirSizeSignature(entry, dirSizesStore),
  ].join('|');
}

function getCachedHaystack(
  cache: FileBrowserQuickSearchCache | undefined,
  entry: DirEntry,
  cacheKey: string,
  signature: string,
  build: () => string,
): string {
  if (!cache) {
    return build();
  }

  let entryCache = cache.haystacks.get(entry);

  if (!entryCache) {
    entryCache = new Map();
    cache.haystacks.set(entry, entryCache);
  }

  const cachedItem = entryCache.get(cacheKey);

  if (cachedItem?.signature === signature) {
    return cachedItem.value;
  }

  const value = build();
  entryCache.set(cacheKey, {
    signature,
    value,
  });
  return value;
}

function entryNameHaystackIncludes(entry: DirEntry, valueNormalized: string): boolean {
  if (entry.name.toLowerCase().includes(valueNormalized)) {
    return true;
  }

  if (entry.ext) {
    const extensionLower = entry.ext.toLowerCase();

    if (extensionLower.includes(valueNormalized) || `.${extensionLower}`.includes(valueNormalized)) {
      return true;
    }
  }

  return false;
}

export function buildFileBrowserQuickSearchHaystack(
  entry: DirEntry,
  dirSizesStore: DirSizesStore,
  context: FileBrowserQuickSearchContext = getQuickSearchContext(),
): string {
  const { showRelativeDates, referenceNowMs } = context;
  const parts: string[] = [entry.name.toLowerCase()];

  if (entry.ext) {
    const extensionLower = entry.ext.toLowerCase();
    parts.push(extensionLower, `.${extensionLower}`);
  }

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

  if (entry.modified_time && isRelativeDateDisplayEnabled(showRelativeDates)) {
    parts.push(formatFileBrowserListModifiedDate(entry.modified_time, referenceNowMs).toLowerCase());
  }

  return parts.join(' ');
}

function buildHaystackForProperty(
  entry: DirEntry,
  property: QuickSearchProperty,
  dirSizesStore: DirSizesStore,
  context: FileBrowserQuickSearchContext,
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
    if (!entry.modified_time) return '';
    const absolute = formatDate(entry.modified_time).toLowerCase();

    if (!isRelativeDateDisplayEnabled(context.showRelativeDates)) {
      return absolute;
    }

    const listLabel = formatFileBrowserListModifiedDate(entry.modified_time, context.referenceNowMs).toLowerCase();
    return `${absolute} ${listLabel}`;
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
  return createFileBrowserQuickSearchMatcher(filterQueryRaw, dirSizesStore)(entry);
}

export function createFileBrowserQuickSearchMatcher(
  filterQueryRaw: string,
  dirSizesStore: DirSizesStore,
  cache?: FileBrowserQuickSearchCache,
): (entry: DirEntry) => boolean {
  const trimmed = filterQueryRaw.trim();

  if (!trimmed) {
    return () => true;
  }

  const parsed = parseQuickSearchQuery(trimmed);
  const valueRaw = parsed.property !== null ? parsed.value.trim() : trimmed;
  const valueNormalized = valueRaw.toLowerCase();
  const context = getQuickSearchContext();

  if (parsed.property !== null && !valueNormalized) {
    return () => true;
  }

  if (parsed.property === 'size') {
    const sizePredicate = parseQuickSearchSizePredicate(valueRaw);

    if (sizePredicate.kind !== 'substring') {
      return (entry) => {
        const sizeBytes = getFileBrowserEntryResolvedSizeBytes(entry, dirSizesStore);
        return evaluateQuickSearchSizePredicate(sizePredicate, sizeBytes);
      };
    }
  }

  if (parsed.property === 'items') {
    const itemsPredicate = parseQuickSearchItemsPredicate(valueRaw);

    if (itemsPredicate.kind !== 'substring') {
      return (entry) => {
        const itemCount = getFileBrowserItemCountForFilter(entry);

        if (itemCount === null) {
          return false;
        }

        return evaluateQuickSearchItemsPredicate(itemsPredicate, itemCount);
      };
    }
  }

  if (!valueNormalized) {
    return () => true;
  }

  return (entry) => {
    if ((parsed.property === null || parsed.property === 'name') && entryNameHaystackIncludes(entry, valueNormalized)) {
      return true;
    }

    const haystack = getQuickSearchHaystack(entry, parsed, dirSizesStore, context, cache);
    return haystack.includes(valueNormalized);
  };
}

function getQuickSearchHaystack(
  entry: DirEntry,
  parsed: QuickSearchParsedQuery,
  dirSizesStore: DirSizesStore,
  context: FileBrowserQuickSearchContext,
  cache?: FileBrowserQuickSearchCache,
): string {
  const propertyKey = parsed.property ?? 'all';
  const signature = getEntrySignature(entry, dirSizesStore, context);

  return getCachedHaystack(cache, entry, propertyKey, signature, () => {
    return parsed.property !== null
      ? buildHaystackForProperty(entry, parsed.property, dirSizesStore, context)
      : buildFileBrowserQuickSearchHaystack(entry, dirSizesStore, context);
  });
}
