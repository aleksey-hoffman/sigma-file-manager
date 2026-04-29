// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { InstalledExtensionData } from '@/types/extension';
import type { BuiltinThemeId, Theme } from '@/types/user-settings';

export const BUILTIN_THEME_IDS = ['dark', 'light', 'system'] as const;
export const DEFAULT_THEME_ID: BuiltinThemeId = 'dark';

type ResolvedBuiltinThemeId = Exclude<BuiltinThemeId, 'system'>;

type BuiltinThemeOption = {
  id: BuiltinThemeId;
  source: 'builtin';
  builtinThemeId: BuiltinThemeId;
};

type ExtensionThemeOption = {
  id: Theme;
  source: 'extension';
  extensionId: string;
  themeId: string;
  title: string;
  description?: string;
  baseTheme: ResolvedBuiltinThemeId;
  variables: Record<`--${string}`, string>;
};

export type ThemeOption = BuiltinThemeOption | ExtensionThemeOption;

type ParsedBuiltinThemeId = {
  source: 'builtin';
  builtinThemeId: BuiltinThemeId;
};

type ParsedExtensionThemeId = {
  source: 'extension';
  extensionId: string;
  themeId: string;
};

type ParsedThemeId = ParsedBuiltinThemeId | ParsedExtensionThemeId;

const EXTENSION_THEME_PREFIX = 'extension:';
const EXTENSION_THEME_ID_PATTERN = /^[a-z0-9-]+$/;

export function createExtensionThemeId(extensionId: string, themeId: string): Theme {
  return `${EXTENSION_THEME_PREFIX}${extensionId}:${themeId}` as Theme;
}

export function parseThemeId(theme: string): ParsedThemeId | null {
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    return {
      source: 'builtin',
      builtinThemeId: theme,
    };
  }

  if (!theme.startsWith(EXTENSION_THEME_PREFIX)) {
    return null;
  }

  const identifier = theme.slice(EXTENSION_THEME_PREFIX.length);
  const separatorIndex = identifier.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex === identifier.length - 1) {
    return null;
  }

  const extensionId = identifier.slice(0, separatorIndex);
  const themeId = identifier.slice(separatorIndex + 1);

  if (!EXTENSION_THEME_ID_PATTERN.test(themeId)) {
    return null;
  }

  return {
    source: 'extension',
    extensionId,
    themeId,
  };
}

export function getBuiltinThemeOptions(): ThemeOption[] {
  return BUILTIN_THEME_IDS.map(themeId => ({
    id: themeId,
    source: 'builtin' as const,
    builtinThemeId: themeId,
  }));
}

export function getExtensionThemeOptions(
  installedExtensions: Record<string, InstalledExtensionData>,
): ThemeOption[] {
  const themeOptions: ThemeOption[] = [];

  for (const [extensionId, extension] of Object.entries(installedExtensions)) {
    if (!extension.enabled || extension.installPendingDependencies) {
      continue;
    }

    const contributedThemes = extension.manifest.contributes?.themes ?? [];

    for (const theme of contributedThemes) {
      themeOptions.push({
        id: createExtensionThemeId(extensionId, theme.id),
        source: 'extension',
        extensionId,
        themeId: theme.id,
        title: theme.title,
        description: theme.description,
        baseTheme: theme.baseTheme,
        variables: theme.variables,
      });
    }
  }

  return themeOptions.sort((left, right) => {
    const extensionCompare = left.source === 'extension' && right.source === 'extension'
      ? left.extensionId.localeCompare(right.extensionId)
      : 0;

    if (extensionCompare !== 0) {
      return extensionCompare;
    }

    if (left.source === 'extension' && right.source === 'extension') {
      return left.title.localeCompare(right.title);
    }

    return 0;
  });
}

export function getAvailableThemeOptions(
  installedExtensions: Record<string, InstalledExtensionData>,
): ThemeOption[] {
  return [
    ...getBuiltinThemeOptions(),
    ...getExtensionThemeOptions(installedExtensions),
  ];
}

export function findThemeOption(
  theme: string,
  installedExtensions: Record<string, InstalledExtensionData>,
): ThemeOption | undefined {
  const parsedTheme = parseThemeId(theme);

  if (!parsedTheme) {
    return undefined;
  }

  if (parsedTheme.source === 'builtin') {
    return getBuiltinThemeOptions().find(option => option.id === parsedTheme.builtinThemeId);
  }

  return getExtensionThemeOptions(installedExtensions).find((option) => {
    return option.source === 'extension'
      && option.extensionId === parsedTheme.extensionId
      && option.themeId === parsedTheme.themeId;
  });
}

export function normalizeThemeSelection(
  theme: string,
  installedExtensions: Record<string, InstalledExtensionData>,
): Theme {
  const selectedTheme = findThemeOption(theme, installedExtensions);
  return (selectedTheme?.id ?? DEFAULT_THEME_ID) as Theme;
}
