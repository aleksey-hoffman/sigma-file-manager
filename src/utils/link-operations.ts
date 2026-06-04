// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Platform } from '@tauri-apps/plugin-os';
import type { DirEntry } from '@/types/dir-entry';

export type LinkCreationKind = 'symlink' | 'shortcut' | 'hardlink' | 'junction';

export interface LinkCreationOption {
  kind: LinkCreationKind;
  labelKey: string;
}

export interface CreateLinksResult {
  success: boolean;
  createdPaths: string[];
  failedItems: {
    sourcePath: string;
    error: string;
  }[];
}

function getShortcutLinkCreationOption(platform: Platform | null): LinkCreationOption {
  if (platform === 'windows') {
    return {
      kind: 'shortcut',
      labelKey: 'fileBrowser.linkTypes.shortcutWindows',
    };
  }

  if (platform === 'macos') {
    return {
      kind: 'shortcut',
      labelKey: 'fileBrowser.linkTypes.shortcutMacos',
    };
  }

  if (platform === 'linux') {
    return {
      kind: 'shortcut',
      labelKey: 'fileBrowser.linkTypes.shortcutLinux',
    };
  }

  return {
    kind: 'shortcut',
    labelKey: 'fileBrowser.linkTypes.shortcut',
  };
}

const BASE_LINK_OPTIONS: LinkCreationOption[] = [
  {
    kind: 'symlink',
    labelKey: 'fileBrowser.linkTypes.symlink',
  },
];

export function getAvailableLinkCreationOptions(
  entries: DirEntry[],
  platform: Platform | null,
): LinkCreationOption[] {
  if (entries.length === 0) {
    return [];
  }

  const allEntriesAreFiles = entries.every(entry => entry.is_file);
  const allEntriesAreDirectories = entries.every(entry => entry.is_dir);
  const options = [getShortcutLinkCreationOption(platform), ...BASE_LINK_OPTIONS];

  if (allEntriesAreFiles) {
    options.push({
      kind: 'hardlink',
      labelKey: 'fileBrowser.linkTypes.hardlink',
    });
  }

  if (platform === 'windows' && allEntriesAreDirectories) {
    options.push({
      kind: 'junction',
      labelKey: 'fileBrowser.linkTypes.junction',
    });
  }

  return options;
}
