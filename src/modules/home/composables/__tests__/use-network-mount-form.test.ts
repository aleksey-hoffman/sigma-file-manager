// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import {
  deriveMountName,
  useNetworkMountForm,
} from '../use-network-mount-form';

describe('deriveMountName', () => {
  it('takes the last segment of a posix style remote path', () => {
    expect(deriveMountName('/home/user', 'example.com')).toBe('user');
  });

  it('takes the last segment of a windows style remote path', () => {
    // SMB 的远程路径是 `share\dir` 这种 Windows 风格，分隔符不认就会推导出整串。
    expect(deriveMountName('share\\dir', 'localhost')).toBe('dir');
  });

  it('falls back to the host name when the path is empty', () => {
    expect(deriveMountName('', '192.168.1.100')).toBe('192_168_1_100');
  });

  it('returns an empty string when neither path nor host is filled', () => {
    expect(deriveMountName('   ', '   ')).toBe('');
  });
});

describe('useNetworkMountForm', () => {
  it('keeps the derived name in sync when the host is filled before the path', async () => {
    // 2026-10-21 真机验收踩到的坑：先填主机（路径还空着）会推导出 `localhost`，
    // 再填远程路径本该变成 `AFMDrv`，但旧判据「当前值 == 当前推导值」此时不成立，
    // 于是名字永远停在 `localhost`。
    const form = useNetworkMountForm();

    form.networkHost.value = 'localhost';
    await nextTick();

    expect(form.networkMountName.value).toBe('localhost');

    form.networkRemotePath.value = 'AFMDrv';
    await nextTick();

    expect(form.networkMountName.value).toBe('AFMDrv');
  });

  it('does not overwrite a name the user has edited', async () => {
    const form = useNetworkMountForm();

    form.networkHost.value = 'localhost';
    await nextTick();

    form.networkMountName.value = 'my-own-name';
    form.markMountNameTouched();

    form.networkRemotePath.value = 'AFMDrv';
    await nextTick();

    expect(form.networkMountName.value).toBe('my-own-name');
  });

  it('clears the touched flag on reset so the next round derives again', async () => {
    const form = useNetworkMountForm();

    form.networkHost.value = 'localhost';
    await nextTick();
    form.markMountNameTouched();
    form.resetNetworkForm();

    expect(form.networkHost.value).toBe('');
    expect(form.networkMountName.value).toBe('');
    expect(form.mountNameTouched.value).toBe(false);

    form.networkRemotePath.value = 'AFMDrv';
    await nextTick();

    expect(form.networkMountName.value).toBe('AFMDrv');
  });
});
