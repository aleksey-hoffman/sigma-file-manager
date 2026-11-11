// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ClipboardSettings } from '@/types/user-settings';
import { arePathsEquivalent } from '@/utils/file-operation-paths';

export type ClipboardOrigin = 'internal' | 'external' | '';
export type ClipboardUiKind = 'toolbar' | 'external-widget' | null;
type FileClipboardOperationType = 'copy' | 'move' | '';

export function hasSameFileClipboardContent(
  localItems: DirEntry[],
  localType: FileClipboardOperationType,
  systemPaths: string[],
  systemOperation: 'copy' | 'move',
): boolean {
  if (localType !== systemOperation || localItems.length !== systemPaths.length) {
    return false;
  }

  const unmatchedSystemPaths = [...systemPaths];

  for (const localItem of localItems) {
    const matchingPathIndex = unmatchedSystemPaths.findIndex(systemPath =>
      arePathsEquivalent(localItem.path, systemPath),
    );

    if (matchingPathIndex === -1) {
      return false;
    }

    unmatchedSystemPaths.splice(matchingPathIndex, 1);
  }

  return unmatchedSystemPaths.length === 0;
}

type ClipboardUiOptions = {
  hasItems: boolean;
  origin: ClipboardOrigin;
  hasImageContent: boolean;
  hasFileItems: boolean;
  settings: ClipboardSettings;
};

export function getClipboardUiKind(options: ClipboardUiOptions): ClipboardUiKind {
  if (!shouldShowClipboardUi(options)) {
    return null;
  }

  return options.origin === 'internal' ? 'toolbar' : 'external-widget';
}

export function shouldShowClipboardUi(options: ClipboardUiOptions): boolean {
  if (!options.hasItems) {
    return false;
  }

  if (options.origin === 'internal') {
    return true;
  }

  if (options.hasImageContent) {
    return options.settings.showToolbarForExternalImages;
  }

  if (options.hasFileItems) {
    return options.settings.showToolbarForExternalPaths;
  }

  return false;
}
