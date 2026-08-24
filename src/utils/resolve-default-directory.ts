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

export function createDefaultDirectoryResolveInput(
  defaultDirectory: DefaultDirectorySettings | undefined,
  homeDir: string,
): ResolveDefaultDirectoryInput {
  return {
    kind: defaultDirectory?.kind ?? 'userHome',
    customPath: defaultDirectory?.customPath ?? '',
    homeDir,
  };
}

export function resolveDefaultDirectoryPath(input: ResolveDefaultDirectoryInput): string {
  const kind = input.kind ?? 'userHome';

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
  const kind = input.kind ?? 'userHome';

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
