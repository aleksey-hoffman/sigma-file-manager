// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirContents, DirEntry } from '@/types/dir-entry';
import type { DriveInfo } from '@/types/drive-info';
import type { HistoryItem, ItemTag, TaggedItem } from '@/types/user-stats';
import normalizePath, {
  getParentPath,
  getPathDisplayName,
  isUncPath,
  isWindowsDriveRootPath,
} from '@/utils/normalize-path';

export type AddressBarEditorMode = 'path' | 'entry';

export type AddressBarSuggestionSource = 'directory' | 'recent' | 'tagged' | 'exact' | 'userDirectory' | 'systemDrive';

export interface AddressBarSuggestion {
  id: string;
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  source: AddressBarSuggestionSource;
  entry: DirEntry;
  tag?: ItemTag;
  historyOpenedAt?: number;
}

export interface AddressBarSuggestionGroup {
  id: string;
  label: string;
  items: AddressBarSuggestion[];
  collapsible: boolean;
  tag?: ItemTag;
}

export type AddressBarSuggestionStateKind = 'empty' | 'directory' | 'exact' | 'search';

export interface AddressBarSuggestionState {
  kind: AddressBarSuggestionStateKind;
  groups: AddressBarSuggestionGroup[];
  exactEntry: DirEntry | null;
  directoryPath: string | null;
}

export interface AddressBarUserDirectorySuggestionInput {
  path: string;
  displayName: string;
}

export interface AddressBarSuggestionLookup {
  readDir: (path: string) => Promise<DirContents>;
  getDirEntry: (path: string) => Promise<DirEntry>;
}

export interface ResolveAddressBarSuggestionsOptions {
  query: string;
  mode: AddressBarEditorMode;
  currentPath: string;
  directoryGroupLabel: string;
  exactGroupLabel: string;
  resultsGroupLabel: string;
  entryModeGroups: AddressBarSuggestionGroup[];
  lastDirectoryEntries: DirEntry[];
  lookup: AddressBarSuggestionLookup;
  createSearchMatcher: (query: string) => (entry: DirEntry) => boolean;
}

export function createAddressBarUserDirectoryEntry(path: string, displayName: string): DirEntry {
  const normalizedPath = normalizePath(path);

  return {
    name: displayName,
    path: normalizedPath,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
  };
}

export function createAddressBarFallbackEntry(path: string, isFile: boolean): DirEntry {
  const normalizedPath = normalizePath(path);
  const name = getPathDisplayName(normalizedPath) || normalizedPath;
  const extensionSeparatorIndex = name.lastIndexOf('.');

  return {
    name,
    path: normalizedPath,
    is_file: isFile,
    is_dir: !isFile,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: isFile && extensionSeparatorIndex > 0
      ? name.slice(extensionSeparatorIndex + 1).toLowerCase()
      : null,
    mime: null,
  };
}

export function createAddressBarSuggestion(
  entry: DirEntry,
  source: AddressBarSuggestionSource,
  tag?: ItemTag,
): AddressBarSuggestion {
  return {
    id: tag ? `${source}:${tag.id}:${entry.path}` : `${source}:${entry.path}`,
    path: normalizePath(entry.path),
    name: entry.name || getPathDisplayName(entry.path) || entry.path,
    isFile: entry.is_file,
    isDirectory: entry.is_dir,
    isSymlink: entry.is_symlink,
    source,
    entry,
    tag,
  };
}

export function createDirectorySuggestionGroup(
  entries: DirEntry[],
  label: string,
  source: AddressBarSuggestionSource,
  collapsible = false,
): AddressBarSuggestionGroup {
  return {
    id: source === 'exact' ? 'exact' : `directory:${label}`,
    label,
    collapsible,
    items: entries.map(entry => createAddressBarSuggestion(entry, source)),
  };
}

export function createUserDirectoriesSuggestionGroup(
  directories: AddressBarUserDirectorySuggestionInput[],
  label: string,
): AddressBarSuggestionGroup {
  return {
    id: 'userDirectories',
    label,
    collapsible: true,
    items: directories.map(directory =>
      createAddressBarSuggestion(
        createAddressBarUserDirectoryEntry(directory.path, directory.displayName),
        'userDirectory',
      ),
    ),
  };
}

export function createSystemDrivesSuggestionGroup(drives: DriveInfo[], label: string): AddressBarSuggestionGroup {
  return {
    id: 'systemDrives',
    label,
    collapsible: true,
    items: drives.map((drive) => {
      const displayName = drive.name.trim() || getPathDisplayName(drive.path) || drive.path;

      return createAddressBarSuggestion(
        createAddressBarUserDirectoryEntry(drive.path, displayName),
        'systemDrive',
      );
    }),
  };
}

export function createRecentSuggestionGroup(
  history: HistoryItem[],
  label: string,
  maxItems: number,
): AddressBarSuggestionGroup {
  const items = history.slice(0, maxItems).map(item => ({
    ...createAddressBarSuggestion(createAddressBarFallbackEntry(item.path, item.isFile), 'recent'),
    historyOpenedAt: item.openedAt,
  }));

  return {
    id: 'recent',
    label,
    items,
    collapsible: true,
  };
}

export function createTaggedSuggestionGroups(
  taggedItems: TaggedItem[],
  tags: ItemTag[],
  fallbackLabel: string,
): AddressBarSuggestionGroup[] {
  const groups: AddressBarSuggestionGroup[] = [];
  const knownTagIds = new Set(tags.map(tag => tag.id));

  for (const tag of tags) {
    const items = taggedItems
      .filter(item => item.tagIds.includes(tag.id))
      .map(item =>
        createAddressBarSuggestion(createAddressBarFallbackEntry(item.path, item.isFile), 'tagged', tag),
      );

    if (items.length === 0) {
      continue;
    }

    groups.push({
      id: `tag:${tag.id}`,
      label: tag.name,
      items,
      collapsible: true,
      tag,
    });
  }

  const orphanedItems = taggedItems
    .filter(item => !item.tagIds.some(tagId => knownTagIds.has(tagId)))
    .map(item =>
      createAddressBarSuggestion(createAddressBarFallbackEntry(item.path, item.isFile), 'tagged'),
    );

  if (orphanedItems.length > 0) {
    groups.push({
      id: 'tag:unknown',
      label: fallbackLabel,
      items: orphanedItems,
      collapsible: true,
    });
  }

  return groups;
}

export function flattenAddressBarSuggestionGroups(groups: AddressBarSuggestionGroup[]): AddressBarSuggestion[] {
  return groups.flatMap(group => group.items);
}

export function isAddressBarDirectoryShortcutCandidate(entry: DirEntry): boolean {
  return entry.is_file && entry.path.toLowerCase().endsWith('.lnk');
}

export function ensureAddressBarDirectoryQuery(path: string): string {
  const normalizedPath = normalizePath(path);
  return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
}

export function addressBarPathHasNoParentDirectory(trimmedNormalizedQuery: string): boolean {
  if (!trimmedNormalizedQuery) {
    return false;
  }

  let pathStem = trimmedNormalizedQuery.replace(/\/+$/, '');

  if (pathStem === '') {
    pathStem = trimmedNormalizedQuery;
  }

  return getParentPath(pathStem) === null;
}

export function addressBarTrimmedQueryLooksLikeFilesystemPath(trimmedNormalizedQuery: string): boolean {
  if (!trimmedNormalizedQuery) {
    return false;
  }

  const normalized = normalizePath(trimmedNormalizedQuery);

  if (normalized.startsWith('//')) {
    return true;
  }

  if (normalized.startsWith('/')) {
    return true;
  }

  if (/^[A-Za-z]:/.test(normalized)) {
    return true;
  }

  if (normalized.includes('/')) {
    return true;
  }

  return false;
}

export function getAddressBarRevealTarget(path: string): {
  parentPath: string;
  entryPath: string;
} | null {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');
  const parentPath = getParentPath(normalizedPath);

  if (!parentPath) {
    return null;
  }

  return {
    parentPath,
    entryPath: normalizedPath,
  };
}

function resolveAddressBarPathForBrowse(normalizedTrimmedQuery: string): string {
  const trimmedSeparators = normalizedTrimmedQuery.replace(/\/+$/, '');

  if (trimmedSeparators === '') {
    return '/';
  }

  if (isWindowsDriveRootPath(trimmedSeparators)) {
    return `${trimmedSeparators}/`;
  }

  return trimmedSeparators;
}

function getImplicitAddressBarAbsoluteDirectoryBrowsePath(normalizedQuery: string): string | null {
  const trim = normalizePath(normalizedQuery).replace(/\/+$/, '');

  if (!trim) {
    return null;
  }

  if (isWindowsDriveRootPath(trim)) {
    return `${trim}/`;
  }

  if (!isUncPath(trim)) {
    return null;
  }

  const segments = trim.slice(2).split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return trim.endsWith('/') ? trim : `${trim}/`;
}

function addressBarQueryMeansBrowseInsideDirectory(normalizedTrimmedQuery: string): boolean {
  return normalizedTrimmedQuery.endsWith('/');
}

function shouldAvoidAddressBarSearchCurrentDirectoryFallback(normalizedQuery: string): boolean {
  const trimmed = normalizePath(normalizedQuery).replace(/\/+$/, '');

  if (!trimmed) {
    return false;
  }

  if (isUncPath(trimmed)) {
    return true;
  }

  if (/^[A-Za-z]:/.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith('/')) {
    return true;
  }

  return false;
}

async function resolveAddressBarDirectoryListingOrExactOrSearch(
  options: ResolveAddressBarSuggestionsOptions,
  pathForReadDir: string,
  fallbackNormalizedQuery: string,
): Promise<AddressBarSuggestionState> {
  try {
    const directoryContents = await options.lookup.readDir(pathForReadDir);
    return {
      kind: 'directory',
      groups: [
        createDirectorySuggestionGroup(
          directoryContents.entries,
          options.directoryGroupLabel,
          'directory',
        ),
      ],
      exactEntry: createAddressBarFallbackEntry(directoryContents.path, false),
      directoryPath: directoryContents.path,
    };
  }
  catch {
    try {
      let exactPath = pathForReadDir.replace(/\/+$/, '');
      exactPath = exactPath === ''
        ? '/'
        : isWindowsDriveRootPath(exactPath)
          ? `${exactPath}/`
          : exactPath;
      const exactEntry = await options.lookup.getDirEntry(exactPath);
      return {
        kind: 'exact',
        groups: [createDirectorySuggestionGroup([exactEntry], options.exactGroupLabel, 'exact')],
        exactEntry,
        directoryPath: exactEntry.is_dir ? exactEntry.path : null,
      };
    }
    catch {
      return resolveSearchSuggestions(options, fallbackNormalizedQuery);
    }
  }
}

export async function resolveAddressBarSuggestions(
  options: ResolveAddressBarSuggestionsOptions,
): Promise<AddressBarSuggestionState> {
  const normalizedQuery = normalizePath(options.query).trim();

  if (!normalizedQuery) {
    return {
      kind: 'empty',
      groups: options.mode === 'entry' ? options.entryModeGroups : [],
      exactEntry: null,
      directoryPath: null,
    };
  }

  if (addressBarQueryMeansBrowseInsideDirectory(normalizedQuery)) {
    const pathForReadDir = resolveAddressBarPathForBrowse(normalizedQuery);

    return resolveAddressBarDirectoryListingOrExactOrSearch(
      options,
      pathForReadDir,
      normalizedQuery,
    );
  }

  const implicitBrowsePath = getImplicitAddressBarAbsoluteDirectoryBrowsePath(normalizedQuery);

  if (implicitBrowsePath !== null) {
    return resolveAddressBarDirectoryListingOrExactOrSearch(
      options,
      implicitBrowsePath,
      normalizedQuery,
    );
  }

  return resolveSearchSuggestions(options, normalizedQuery);
}

function addressBarEntryPathDedupeKey(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function deduplicateDirEntriesByPath(entries: DirEntry[]): DirEntry[] {
  const seenKeys = new Set<string>();
  const uniqueEntries: DirEntry[] = [];

  for (const candidate of entries) {
    const dedupeKey = addressBarEntryPathDedupeKey(candidate.path);

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    uniqueEntries.push(candidate);
  }

  return uniqueEntries;
}

async function resolveSearchSuggestions(
  options: ResolveAddressBarSuggestionsOptions,
  normalizedQuery: string,
): Promise<AddressBarSuggestionState> {
  let searchEntries = options.mode === 'entry'
    ? flattenAddressBarSuggestionGroups(options.entryModeGroups).map(suggestion => suggestion.entry)
    : options.lastDirectoryEntries;
  let searchQuery = normalizedQuery;
  const parentPath = getParentPath(normalizedQuery);

  if (parentPath && parentPath !== normalizedQuery) {
    try {
      const parentContents = await options.lookup.readDir(parentPath);
      searchEntries = parentContents.entries;
      searchQuery = getPathDisplayName(normalizedQuery);
    }
    catch {
      if (
        searchEntries.length === 0
        && !shouldAvoidAddressBarSearchCurrentDirectoryFallback(normalizedQuery)
      ) {
        try {
          const currentContents = await options.lookup.readDir(options.currentPath);
          searchEntries = currentContents.entries;
        }
        catch {
          searchEntries = [];
        }
      }
    }
  }

  const matchesSearch = options.createSearchMatcher(searchQuery);
  const matchingEntries = deduplicateDirEntriesByPath(searchEntries.filter(matchesSearch));

  return {
    kind: 'search',
    groups: [
      createDirectorySuggestionGroup(
        matchingEntries,
        options.resultsGroupLabel,
        'directory',
      ),
    ],
    exactEntry: null,
    directoryPath: null,
  };
}
