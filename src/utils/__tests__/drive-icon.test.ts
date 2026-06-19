// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { HardDriveIcon, NetworkIcon, UsbIcon } from '@lucide/vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { getDriveIconComponent } from '@/utils/drive-icon';

describe('getDriveIconComponent', () => {
  it('returns the wsl icon for wsl drives', () => {
    expect(getDriveIconComponent({
      drive_type: 'WSL',
      is_removable: false,
    })).toBe(UbuntuWslIcon);
  });

  it('returns the network icon for network drives', () => {
    expect(getDriveIconComponent({
      drive_type: 'Network',
      is_removable: false,
    })).toBe(NetworkIcon);
  });

  it('returns the usb icon for removable drives', () => {
    expect(getDriveIconComponent({
      drive_type: 'SSD',
      is_removable: true,
    })).toBe(UsbIcon);
  });

  it('returns the hard drive icon for fixed local drives', () => {
    expect(getDriveIconComponent({
      drive_type: 'SSD',
      is_removable: false,
    })).toBe(HardDriveIcon);
  });
});
