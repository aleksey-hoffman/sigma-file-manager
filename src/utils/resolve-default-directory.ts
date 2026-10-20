// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DefaultDirectoryKind, DefaultDirectorySettings } from '@/types/user-settings';
import normalizePath from '@/utils/normalize-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

export type ResolveDefaultDirectoryInput = {
  kind?: DefaultDirectoryKind | null;
  customPath?: string | null;
  homeDir: string;
};

/**
 * FORK-MODIFICATION 2026-10-20（用户 2026-10-20 00:05 附图要求）：
 * 新建标签页默认打开**位置**（分区列表），不是用户文件夹。
 *
 * 为什么改这里而不是「+」按钮里写死：默认目录本来就是一个设置
 * （设置 → 导航器 → 默认目录，可以在 locations / userHome / custom 之间选）。
 * 在按钮里写死等于把这个设置架空，用户在设置里选了也不生效。
 * 改**默认值**才既满足要求、又不夺走用户的选择权。
 *
 * 原来默认是 `userHome`，所以点「+」直接落在 `C:\Users\Duanyi`。
 */
export const DEFAULT_DIRECTORY_KIND: DefaultDirectoryKind = 'locations';

export function createDefaultDirectoryResolveInput(
  defaultDirectory: DefaultDirectorySettings | undefined,
  homeDir: string,
): ResolveDefaultDirectoryInput {
  return {
    kind: defaultDirectory?.kind ?? DEFAULT_DIRECTORY_KIND,
    customPath: defaultDirectory?.customPath ?? '',
    homeDir,
  };
}

export function resolveDefaultDirectoryPath(input: ResolveDefaultDirectoryInput): string {
  const kind = input.kind ?? DEFAULT_DIRECTORY_KIND;

  switch (kind) {
    case 'locations':
      return LOCATIONS_VIRTUAL_PATH;

    case 'custom': {
      const customPath = input.customPath?.trim() ?? '';

      if (customPath.length === 0) {
        return input.homeDir;
      }

      return normalizePath(customPath);
    }

    case 'userHome':
      return input.homeDir;

    default: {
      const exhaustiveCheck: never = kind;
      void exhaustiveCheck;
      return input.homeDir;
    }
  }
}

export async function resolveDefaultDirectory(
  input: ResolveDefaultDirectoryInput & {
    pathExists?: (path: string) => Promise<boolean>;
  },
): Promise<string> {
  const resolvedPath = resolveDefaultDirectoryPath(input);
  const kind = input.kind ?? DEFAULT_DIRECTORY_KIND;

  if (kind !== 'custom' || resolvedPath === input.homeDir || !input.pathExists) {
    return resolvedPath;
  }

  try {
    const customPathExists = await input.pathExists(resolvedPath);
    return customPathExists ? resolvedPath : input.homeDir;
  }
  catch {
    return input.homeDir;
  }
}
