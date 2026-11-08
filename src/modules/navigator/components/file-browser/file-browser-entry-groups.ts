// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { FILE_EXTENSIONS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';
import type { NavigatorGrouping } from '@/types/user-settings';
import type { GroupedEntries } from './types';

export type { NavigatorGrouping };

export const FILE_BROWSER_SECTION_HEADER_PADDING_TOP = 8;
export const FILE_BROWSER_UNGROUPED_GRID_PADDING_TOP = 16;

export type FileBrowserSectionIcon = 'folder' | 'image' | 'video' | 'file' | 'none';

export type FileBrowserSectionCardHeight = 'dir' | 'file' | 'split';

export type FileBrowserKindSectionId = 'dirs' | 'images' | 'videos' | 'others';

export type FileBrowserModifiedSectionId = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';

export type FileBrowserSectionId = 'all' | FileBrowserKindSectionId | FileBrowserModifiedSectionId;

export interface FileBrowserEntrySection {
  id: FileBrowserSectionId;
  showHeader: boolean;
  labelKey: string | null;
  icon: FileBrowserSectionIcon;
  entries: DirEntry[];
  cardHeight: FileBrowserSectionCardHeight;
  headerPaddingTop: number;
  gridLeadingPaddingTop: number;
}

const MODIFIED_SECTION_ORDER: readonly FileBrowserModifiedSectionId[] = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'older',
];

const MODIFIED_SECTION_LABEL_KEYS: Record<FileBrowserModifiedSectionId, string> = {
  today: 'settings.navigator.groupingToday',
  yesterday: 'settings.navigator.groupingYesterday',
  thisWeek: 'settings.navigator.groupingThisWeek',
  thisMonth: 'settings.navigator.groupingThisMonth',
  older: 'settings.navigator.groupingOlder',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFileBrowserImageEntry(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.IMAGE.includes(extension) : false;
}

export function isFileBrowserVideoEntry(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.VIDEO.includes(extension) : false;
}

export function getFileBrowserGridEntryVariant(entry: DirEntry): 'dir' | 'image' | 'video' | 'other' {
  if (entry.is_dir) {
    return 'dir';
  }

  if (isFileBrowserImageEntry(entry)) {
    return 'image';
  }

  if (isFileBrowserVideoEntry(entry)) {
    return 'video';
  }

  return 'other';
}

export function groupFileBrowserEntries(entries: readonly DirEntry[]): GroupedEntries {
  const dirs: DirEntry[] = [];
  const images: DirEntry[] = [];
  const videos: DirEntry[] = [];
  const others: DirEntry[] = [];

  for (const entry of entries) {
    const variant = getFileBrowserGridEntryVariant(entry);

    switch (variant) {
      case 'dir':
        dirs.push(entry);
        break;
      case 'image':
        images.push(entry);
        break;
      case 'video':
        videos.push(entry);
        break;
      case 'other':
        others.push(entry);
        break;

      default: {
        const unhandledVariant: never = variant;
        return unhandledVariant;
      }
    }
  }

  return {
    dirs,
    images,
    videos,
    others,
  };
}

function startOfLocalDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfLocalWeek(dayStart: number): number {
  const date = new Date(dayStart);
  const weekday = date.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return dayStart - (daysSinceMonday * DAY_MS);
}

export function getFileBrowserModifiedSectionId(
  modifiedTime: number,
  now: number,
): FileBrowserModifiedSectionId {
  if (!Number.isFinite(modifiedTime) || modifiedTime <= 0) {
    return 'older';
  }

  const todayStart = startOfLocalDay(now);
  const entryDayStart = startOfLocalDay(modifiedTime);
  const dayDelta = Math.round((todayStart - entryDayStart) / DAY_MS);

  if (dayDelta <= 0) {
    return 'today';
  }

  if (dayDelta === 1) {
    return 'yesterday';
  }

  if (entryDayStart >= startOfLocalWeek(todayStart)) {
    return 'thisWeek';
  }

  const today = new Date(todayStart);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  if (entryDayStart >= monthStart) {
    return 'thisMonth';
  }

  return 'older';
}

function putDirectoriesFirst(entries: readonly DirEntry[]): DirEntry[] {
  const directories: DirEntry[] = [];
  const files: DirEntry[] = [];

  for (const entry of entries) {
    if (entry.is_dir) {
      directories.push(entry);
    }
    else {
      files.push(entry);
    }
  }

  return [...directories, ...files];
}

function createGroupedSection(
  id: FileBrowserKindSectionId | FileBrowserModifiedSectionId,
  labelKey: string,
  icon: FileBrowserSectionIcon,
  entries: DirEntry[],
  cardHeight: FileBrowserSectionCardHeight,
): FileBrowserEntrySection {
  return {
    id,
    showHeader: true,
    labelKey,
    icon,
    entries,
    cardHeight,
    headerPaddingTop: FILE_BROWSER_SECTION_HEADER_PADDING_TOP,
    gridLeadingPaddingTop: 0,
  };
}

function createKindSections(entries: readonly DirEntry[]): FileBrowserEntrySection[] {
  const groupedEntries = groupFileBrowserEntries(entries);
  const sections: FileBrowserEntrySection[] = [
    createGroupedSection('dirs', 'fileBrowser.folders', 'folder', groupedEntries.dirs, 'dir'),
    createGroupedSection('images', 'fileBrowser.images', 'image', groupedEntries.images, 'file'),
    createGroupedSection('videos', 'fileBrowser.videos', 'video', groupedEntries.videos, 'file'),
    createGroupedSection('others', 'fileBrowser.otherFiles', 'file', groupedEntries.others, 'file'),
  ];

  return sections.filter(section => section.entries.length > 0);
}

function createModifiedSections(entries: readonly DirEntry[], now: number): FileBrowserEntrySection[] {
  const entriesBySection = new Map<FileBrowserModifiedSectionId, DirEntry[]>();

  for (const entry of entries) {
    const sectionId = getFileBrowserModifiedSectionId(Number(entry.modified_time), now);
    const sectionEntries = entriesBySection.get(sectionId) ?? [];
    sectionEntries.push(entry);
    entriesBySection.set(sectionId, sectionEntries);
  }

  return MODIFIED_SECTION_ORDER.flatMap((sectionId) => {
    const sectionEntries = entriesBySection.get(sectionId);

    if (!sectionEntries || sectionEntries.length === 0) {
      return [];
    }

    return [createGroupedSection(
      sectionId,
      MODIFIED_SECTION_LABEL_KEYS[sectionId],
      'none',
      putDirectoriesFirst(sectionEntries),
      'split',
    )];
  });
}

function createUngroupedSection(entries: readonly DirEntry[]): FileBrowserEntrySection[] {
  if (entries.length === 0) {
    return [];
  }

  return [{
    id: 'all',
    showHeader: false,
    labelKey: null,
    icon: 'none',
    entries: [...entries],
    cardHeight: 'file',
    headerPaddingTop: 0,
    gridLeadingPaddingTop: FILE_BROWSER_UNGROUPED_GRID_PADDING_TOP,
  }];
}

export function getFileBrowserEntrySections(
  entries: readonly DirEntry[],
  grouping: NavigatorGrouping,
  now = Date.now(),
): FileBrowserEntrySection[] {
  switch (grouping) {
    case 'none':
      return createUngroupedSection(entries);
    case 'kind':
      return createKindSections(entries);
    case 'modified':
      return createModifiedSections(entries, now);

    default: {
      const unhandledGrouping: never = grouping;
      return unhandledGrouping;
    }
  }
}

export function getFileBrowserEntryOrder(
  entries: readonly DirEntry[],
  grouping: NavigatorGrouping,
  now = Date.now(),
): DirEntry[] {
  return getFileBrowserEntrySections(entries, grouping, now).flatMap(section => section.entries);
}
