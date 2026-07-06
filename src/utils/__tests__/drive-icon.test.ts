// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { HardDriveIcon, NetworkIcon, UsbIcon } from '@lucide/vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { getDriveIconComponent } from '@/utils/drive-icon';
import type { DriveEntryMetadata } from '@/types/drive-info';

function createDriveMetadata(
  driveType: string,
  isRemovable: boolean,
): DriveEntryMetadata {
  return {
    drive_type: driveType,
    is_removable: isRemovable,
    is_mounted: true,
    mount_point: '',
    device_path: '',
  };
}

describe('getDriveIconComponent', () => {
  it('returns the wsl icon for wsl drives', () => {
    expect(getDriveIconComponent(createDriveMetadata('WSL', false))).toBe(UbuntuWslIcon);
  });

  it('returns the network icon for network drives', () => {
    expect(getDriveIconComponent(createDriveMetadata('Network', false))).toBe(NetworkIcon);
  });

  it('returns the usb icon for removable drives', () => {
    expect(getDriveIconComponent(createDriveMetadata('SSD', true))).toBe(UsbIcon);
  });

  it('returns the hard drive icon for fixed local drives', () => {
    expect(getDriveIconComponent(createDriveMetadata('SSD', false))).toBe(HardDriveIcon);
  });
});
