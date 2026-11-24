// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { MovedPathPair } from '@/stores/runtime/clipboard';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';

export async function recordMovedPaths(movedPaths: MovedPathPair[]): Promise<void> {
  useWorkspacesStore().handlePathsMoved(movedPaths);
  await useUserStatsStore().handlePathsMoved(movedPaths);
  await useUserSettingsStore().handlePathsMoved(movedPaths);
}
