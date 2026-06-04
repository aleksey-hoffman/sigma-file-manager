// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry, DirEntryLinkStatus, DirEntryLinkType } from '@/types/dir-entry';

export function getDirEntryKindKeyFromFields(
  isDirectory: boolean,
  linkType: DirEntryLinkType | null | undefined,
): string {
  if (linkType === 'symlink') {
    return 'fileBrowser.kinds.symlink';
  }

  if (linkType === 'shortcut') {
    return 'fileBrowser.kinds.shortcut';
  }

  if (linkType === 'junction') {
    return 'fileBrowser.kinds.junction';
  }

  if (linkType === 'hardlink') {
    return 'fileBrowser.kinds.hardlinkedFile';
  }

  if (isDirectory) {
    return 'fileBrowser.kinds.folder';
  }

  return 'fileBrowser.kinds.file';
}

export function getDirEntryKindKey(entry: DirEntry): string {
  return getDirEntryKindKeyFromFields(entry.is_dir, entry.link_type);
}

export function getDirEntryKindSortValue(entry: DirEntry): string {
  return getDirEntryKindKey(entry);
}

export function getDirEntryLinksDisplayFromFields(
  isFile: boolean,
  hardLinkCount: number | null | undefined,
): string {
  if (
    isFile
    && typeof hardLinkCount === 'number'
    && hardLinkCount > 1
  ) {
    return String(hardLinkCount);
  }

  return '—';
}

export function getDirEntryLinksDisplay(entry: DirEntry): string {
  return getDirEntryLinksDisplayFromFields(entry.is_file, entry.hard_link_count);
}

export function getDirEntryLinksSortValueFromFields(
  isFile: boolean,
  hardLinkCount: number | null | undefined,
): number {
  if (
    isFile
    && typeof hardLinkCount === 'number'
    && hardLinkCount > 1
  ) {
    return hardLinkCount;
  }

  return -1;
}

export function getDirEntryLinksSortValue(entry: DirEntry): number {
  return getDirEntryLinksSortValueFromFields(entry.is_file, entry.hard_link_count);
}

export function getDirEntryLinkStatusKeyFromFields(
  linkType: DirEntryLinkType | null | undefined,
  linkStatus: DirEntryLinkStatus | null | undefined,
): string | null {
  if (!linkType || !linkStatus) {
    return null;
  }

  return linkStatusKey(linkStatus);
}

export function getDirEntryLinkStatusKey(entry: DirEntry): string | null {
  return getDirEntryLinkStatusKeyFromFields(entry.link_type, entry.link_status);
}

export function getDirEntryLinkStatusSortValue(entry: DirEntry): string {
  return getDirEntryLinkStatusKey(entry) ?? '';
}

function linkStatusKey(status: DirEntryLinkStatus): string {
  if (status === 'valid') {
    return 'fileBrowser.linkStatuses.valid';
  }

  if (status === 'broken') {
    return 'fileBrowser.linkStatuses.broken';
  }

  if (status === 'unsupported') {
    return 'fileBrowser.linkStatuses.unsupported';
  }

  return 'fileBrowser.linkStatuses.unknown';
}
