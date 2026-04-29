// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const BUILTIN_NAVIGATOR_ICON_THEME_IDS = {
  default: 'builtin:default',
  system: 'builtin:system',
} as const;

export type BuiltinNavigatorIconThemeId = typeof BUILTIN_NAVIGATOR_ICON_THEME_IDS[keyof typeof BUILTIN_NAVIGATOR_ICON_THEME_IDS];

export type NavigatorIconThemeId = string;

export type ParsedNavigatorIconThemeId
  = | {
    kind: 'builtin';
    themeId: BuiltinNavigatorIconThemeId;
  }
  | {
    kind: 'extension';
    extensionId: string;
    themeId: string;
  };

export type NavigatorIconThemeOption = {
  id: NavigatorIconThemeId;
  label: string;
  source: 'builtin' | 'extension';
  extensionId?: string;
  themeId?: string;
};

export type IconThemeIconDefinition = {
  src: string;
};

export type LoadedIconThemeDefinition = {
  iconDefinitions: Record<string, IconThemeIconDefinition>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
};

export type IconThemeMatchTarget = {
  name: string;
  parentName: string | null;
  extension: string | null;
  isDirectory: boolean;
};

export function createExtensionNavigatorIconThemeId(extensionId: string, themeId: string): NavigatorIconThemeId {
  return `extension:${encodeURIComponent(extensionId)}:${encodeURIComponent(themeId)}`;
}

export function parseNavigatorIconThemeId(value: string | null | undefined): ParsedNavigatorIconThemeId | null {
  if (!value) {
    return null;
  }

  if (value === BUILTIN_NAVIGATOR_ICON_THEME_IDS.default || value === BUILTIN_NAVIGATOR_ICON_THEME_IDS.system) {
    return {
      kind: 'builtin',
      themeId: value,
    };
  }

  if (!value.startsWith('extension:')) {
    return null;
  }

  const payload = value.slice('extension:'.length);
  const separatorIndex = payload.indexOf(':');

  if (separatorIndex === -1) {
    return null;
  }

  const encodedExtensionId = payload.slice(0, separatorIndex);
  const encodedThemeId = payload.slice(separatorIndex + 1);

  if (!encodedExtensionId || !encodedThemeId) {
    return null;
  }

  try {
    return {
      kind: 'extension',
      extensionId: decodeURIComponent(encodedExtensionId),
      themeId: decodeURIComponent(encodedThemeId),
    };
  }
  catch {
    return null;
  }
}

export function normalizeNavigatorIconThemeId(value: string | null | undefined): NavigatorIconThemeId {
  return parseNavigatorIconThemeId(value)?.kind
    ? value as NavigatorIconThemeId
    : BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
}
