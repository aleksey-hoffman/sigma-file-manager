// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import {
  getDisconnectDriveTarget,
  type DisconnectDriveResult,
  type DisconnectDriveTarget,
} from '@/utils/drive-disconnect-policy';

export async function disconnectDrive(target: DisconnectDriveTarget): Promise<DisconnectDriveResult> {
  try {
    await invoke('disconnect_drive', {
      devicePath: target.devicePath,
      mountPoint: target.mountPoint,
      driveType: target.driveType,
    });

    return { success: true };
  }
  catch (disconnectError) {
    return {
      success: false,
      error: disconnectError instanceof Error ? disconnectError.message : String(disconnectError),
    };
  }
}

export async function disconnectDriveForEntry(entry: DirEntry): Promise<DisconnectDriveResult> {
  const target = getDisconnectDriveTarget(entry);

  if (!target) {
    return {
      success: false,
      error: `Drive metadata is missing for ${entry.path}`,
    };
  }

  return disconnectDrive(target);
}
