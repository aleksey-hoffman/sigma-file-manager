// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface DirContents {
  path: string;
  entries: DirEntry[];
  total_count: number;
  dir_count: number;
  file_count: number;
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
};

export type Divider = {
  title: string;
  type: string;
};

export type Spacer = {
  type: string;
  showScrollTopButton?: boolean;
  props?: { [key: string]: unknown };
};
