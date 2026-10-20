// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DefaultDirectoryKind } from '@/types/user-settings';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import {
  createDefaultDirectoryResolveInput,
  DEFAULT_DIRECTORY_KIND,
  resolveDefaultDirectory,
  resolveDefaultDirectoryPath,
} from '@/utils/resolve-default-directory';

const HOME_DIR = 'C:/Users/aleks';

// FORK-MODIFICATION 2026-10-20（用户 2026-10-20 00:05 附图要求）：
// 新标签页默认打开「位置」。
//
// ⭐ 默认值原来在**三个地方**各写了一个字面量（user-settings 的存储默认、
// resolve-default-directory 的兜底、设置界面的兜底），改一处不改另两处
// 的现象就是「改了设置没反应」。这三条断言把三处钉在一起。
describe('默认目录的默认值是「位置」', () => {
  it('常量本身', () => {
    expect(DEFAULT_DIRECTORY_KIND).toBe('locations');
  });

  it('设置缺失时填 locations', () => {
    expect(createDefaultDirectoryResolveInput(undefined, HOME_DIR)).toEqual({
      kind: 'locations',
      customPath: '',
      homeDir: HOME_DIR,
    });
  });

  it('kind 缺失时解析成位置页，而不是用户主目录', () => {
    expect(resolveDefaultDirectoryPath({ homeDir: HOME_DIR })).toBe(LOCATIONS_VIRTUAL_PATH);
  });
});

describe('createDefaultDirectoryResolveInput', () => {
  it('fills defaults when the setting is missing', () => {
    expect(createDefaultDirectoryResolveInput(undefined, HOME_DIR)).toEqual({
      kind: 'locations',
      customPath: '',
      homeDir: HOME_DIR,
    });
  });

  it('passes through a saved custom directory', () => {
    expect(createDefaultDirectoryResolveInput({
      kind: 'custom',
      customPath: 'D:/Work',
    }, HOME_DIR)).toEqual({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
    });
  });

  it('已保存的 userHome 不被默认值覆盖（用户的选择优先于默认值）', () => {
    expect(createDefaultDirectoryResolveInput({
      kind: 'userHome',
      customPath: '',
    }, HOME_DIR).kind).toBe('userHome');
  });
});

describe('resolveDefaultDirectoryPath', () => {
  it('returns the user home directory for the userHome kind', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'userHome',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });

  it('returns the Locations virtual path', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'locations',
      homeDir: HOME_DIR,
    })).toBe(LOCATIONS_VIRTUAL_PATH);
  });

  it('returns a normalized custom path', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'custom',
      customPath: 'D:\\Work\\Projects',
      homeDir: HOME_DIR,
    })).toBe('D:/Work/Projects');
  });

  it('falls back to user home when the custom path is empty', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'custom',
      customPath: '   ',
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });

  it('falls back to user home for an unknown kind', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'desktop' as unknown as DefaultDirectoryKind,
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });
});

describe('resolveDefaultDirectory', () => {
  it('returns Locations without checking whether the path exists', async () => {
    const pathExists = vi.fn();

    await expect(resolveDefaultDirectory({
      kind: 'locations',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(LOCATIONS_VIRTUAL_PATH);

    expect(pathExists).not.toHaveBeenCalled();
  });

  it('returns the custom path when it exists', async () => {
    const pathExists = vi.fn().mockResolvedValue(true);

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe('D:/Work');

    expect(pathExists).toHaveBeenCalledWith('D:/Work');
  });

  it('falls back to user home when the custom path is missing', async () => {
    const pathExists = vi.fn().mockResolvedValue(false);

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Missing',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);
  });

  it('falls back to user home when the existence check fails', async () => {
    const pathExists = vi.fn().mockRejectedValue(new Error('unavailable'));

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);
  });

  it('does not check existence for an empty custom path', async () => {
    const pathExists = vi.fn();

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: '',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);

    expect(pathExists).not.toHaveBeenCalled();
  });
});
