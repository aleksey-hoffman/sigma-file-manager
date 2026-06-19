// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DriveEntryMetadata } from '@/types/drive-info';

export interface OpenedDirectoryTimes {
  modified_time: number;
  accessed_time: number;
  created_time: number;
}

export interface DirContents {
  path: string;
  entries: DirEntry[];
  total_count: number;
  dir_count: number;
  file_count: number;
  opened_directory_times: OpenedDirectoryTimes;
}

export interface ReadDirOptions {
  includeShortcutTargets: boolean;
  includeHardLinkCounts: boolean;
  includeItemCounts?: boolean;
}

export type ExtendedVirtualEntry = {
  type: 'dirs' | 'files' | 'dirs-divider' | 'files-divider' | 'top-spacer' | 'bottom-spacer';
  items: DirEntry[] | Divider[] | Spacer[];
  fullWidth?: boolean;
};

export type DirEntry = {
  name: string;
  ext: string | null;
  path: string;
  size: number;
  item_count: number | null;
  modified_time: number;
  accessed_time: number;
  created_time: number;
  mime: string | null;
  is_file: boolean;
  is_dir: boolean;
  is_symlink: boolean;
  is_hidden: boolean;
  drive_metadata?: DriveEntryMetadata | null;
  link_type?: DirEntryLinkType | null;
  link_target?: string | null;
  link_status?: DirEntryLinkStatus | null;
  hard_link_count?: number | null;
};

export type DirEntryLinkMetadata = {
  path: string;
  link_type?: DirEntryLinkType | null;
  link_target?: string | null;
  link_status?: DirEntryLinkStatus | null;
  hard_link_count?: number | null;
};

export type DirEntryItemCount = {
  path: string;
  item_count: number;
};

export type DirItemCountOptions = {
  includeHidden?: boolean;
};

export type DirEntryLinkType = 'symlink' | 'shortcut' | 'junction' | 'hardlink';

export type DirEntryLinkStatus = 'valid' | 'broken' | 'unknown' | 'unsupported';

export type Divider = {
  title: string;
  type: string;
};

export type Spacer = {
  type: string;
  showScrollTopButton?: boolean;
  props?: { [key: string]: unknown };
};
