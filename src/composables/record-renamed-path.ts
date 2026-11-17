// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useClipboardStore, type FileOperationResult } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useItemCountsStore } from '@/stores/runtime/item-counts';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { getParentDirectory } from '@/utils/normalize-path';

export async function recordRenamedPath(oldPath: string, newPath: string): Promise<void> {
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const dirSizesStore = useDirSizesStore();
  const itemCountsStore = useItemCountsStore();
  const linkMetadataStore = useLinkMetadataStore();
  const clipboardStore = useClipboardStore();

  workspacesStore.handlePathRenamed(oldPath, newPath);
  await userStatsStore.handlePathRenamed(oldPath, newPath);
  await userSettingsStore.handlePathRenamed(oldPath, newPath);
  dirSizesStore.remapPath(oldPath, newPath);
  itemCountsStore.remapPath(oldPath, newPath);
  linkMetadataStore.remapPath(oldPath, newPath);
  clipboardStore.remapPaths(oldPath, newPath);
  workspacesStore.handleDirectoryContentsChanged([getParentDirectory(oldPath)]);
}

export async function recordStrandedRename(result: FileOperationResult): Promise<void> {
  const stranded = result.moved_paths?.[0];

  if (!stranded?.from || !stranded.to || stranded.from === stranded.to) {
    return;
  }

  await recordRenamedPath(stranded.from, stranded.to);
}
