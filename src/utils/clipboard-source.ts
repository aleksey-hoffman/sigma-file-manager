// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export interface ClipboardSourceContext {
  windowTitle?: string;
  processName?: string;
  processPath?: string;
  processIconUrl?: string;
}

const KNOWN_PROCESS_DISPLAY_NAMES: Record<string, string> = {
  explorer: 'Explorer',
  msedge: 'Edge',
  chrome: 'Chrome',
  firefox: 'Firefox',
  brave: 'Brave',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  arc: 'Arc',
  code: 'VS Code',
  cursor: 'Cursor',
  mspaint: 'Paint',
  snippingtool: 'Snipping Tool',
  screenclippinghost: 'Snipping Tool',
  photos: 'Photos',
  photoshop: 'Photoshop',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
};

export async function readClipboardSourceContext(): Promise<ClipboardSourceContext> {
  try {
    return await invoke<ClipboardSourceContext>('get_clipboard_source_context');
  }
  catch {
    return {};
  }
}

export function normalizeClipboardSourceContext(
  source: ClipboardSourceContext | null | undefined,
): ClipboardSourceContext | null {
  if (!source) {
    return null;
  }

  const windowTitle = source.windowTitle?.trim();
  const processName = source.processName?.trim();
  const processPath = source.processPath?.trim();
  const processIconUrl = source.processIconUrl?.trim();

  if (!windowTitle && !processName && !processPath && !processIconUrl) {
    return null;
  }

  return {
    ...(windowTitle ? { windowTitle } : {}),
    ...(processName ? { processName } : {}),
    ...(processPath ? { processPath } : {}),
    ...(processIconUrl ? { processIconUrl } : {}),
  };
}

export function formatClipboardSourceAppName(processName?: string | null): string | undefined {
  if (!processName) {
    return undefined;
  }

  const strippedName = processName
    .replace(/^.*[\\/]/, '')
    .replace(/\.(exe|app)$/i, '')
    .trim();

  if (!strippedName) {
    return undefined;
  }

  const knownName = KNOWN_PROCESS_DISPLAY_NAMES[strippedName.toLowerCase()];

  if (knownName) {
    return knownName;
  }

  return strippedName.charAt(0).toUpperCase() + strippedName.slice(1);
}
