// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc } from '@tauri-apps/api/core';
import {
  FolderIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileArchiveIcon,
} from '@lucide/vue';
import { FILE_EXTENSIONS } from '@/constants';
import type { DirEntry } from '@/types/dir-entry';
import { i18n } from '@/localization';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { formatDateTimeDisplay } from '@/utils/date-time';

export function isImageFile(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.IMAGE.includes(extension) : false;
}

export function isVideoFile(entry: DirEntry): boolean {
  if (entry.is_dir) return false;
  const extension = entry.ext?.toLowerCase();
  return extension ? FILE_EXTENSIONS.VIDEO.includes(extension) : false;
}

export function getImageSrc(entry: DirEntry): string {
  return convertFileSrc(entry.path);
}

export function getFileIcon(entry: DirEntry) {
  if (entry.is_dir) return FolderIcon;

  const extension = entry.ext?.toLowerCase();
  if (!extension) return FileIcon;

  if (FILE_EXTENSIONS.IMAGE.includes(extension)) return FileImageIcon;
  if (FILE_EXTENSIONS.VIDEO.includes(extension)) return FileVideoIcon;
  if (FILE_EXTENSIONS.AUDIO.includes(extension)) return FileAudioIcon;
  if (FILE_EXTENSIONS.CODE.includes(extension)) return FileCodeIcon;
  if (FILE_EXTENSIONS.ARCHIVE.includes(extension)) return FileArchiveIcon;
  if (FILE_EXTENSIONS.TEXT.includes(extension)) return FileTextIcon;

  return FileIcon;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';

  const userSettingsStore = useUserSettingsStore();
  const locale = i18n.global.locale.value as string;

  return formatDateTimeDisplay(
    new Date(timestamp),
    userSettingsStore.userSettings.dateTime,
    locale,
  );
}

export interface RelativeTimeTranslations {
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;
}

export function formatRelativeTime(timestamp: number, translations: RelativeTimeTranslations): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return translations.justNow;
  if (minutes < 60) return translations.minutesAgo(minutes);
  if (hours < 24) return translations.hoursAgo(hours);
  if (days < 7) return translations.daysAgo(days);

  const userSettingsStore = useUserSettingsStore();
  const locale = i18n.global.locale.value as string;

  return formatDateTimeDisplay(
    new Date(timestamp),
    userSettingsStore.userSettings.dateTime,
    locale,
    false,
  );
}
