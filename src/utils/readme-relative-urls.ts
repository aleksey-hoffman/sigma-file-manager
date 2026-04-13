// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { getParentDirectory } from '@/utils/normalize-path';

export type ReadmeAssetRewriteOptions
  = | {
    kind: 'remoteGitHub';
    documentBaseUrl: string;
  }
  | {
    kind: 'localExtension';
    extensionRootPath: string;
  }
  | {
    kind: 'localMarkdownFile';
    markdownFilePath: string;
  };

function urlNeedsRelativeRewrite(url: string): boolean {
  const trimmed = url.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return false;
  }

  if (/^(data:|blob:|https?:)/i.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith('//')) {
    return false;
  }

  if (/^(asset|tauri):/i.test(trimmed)) {
    return false;
  }

  return true;
}

function parseRelativeHref(href: string): string {
  const [withoutFragment] = href.split('#');
  const [withoutQuery] = (withoutFragment ?? '').split('?');
  let trimmed = (withoutQuery ?? '').trim();

  if (!trimmed) {
    return '';
  }

  try {
    trimmed = decodeURIComponent(trimmed);
  }
  catch {
  }

  return trimmed;
}

function isSafeRelativePath(relativePath: string): boolean {
  const segments = relativePath.split(/[/\\]/);
  return !segments.some(segment => segment === '..');
}

function resolveAgainstDocumentBase(relativeHref: string, documentBaseUrl: string): string {
  try {
    return new URL(relativeHref, documentBaseUrl).href;
  }
  catch {
    return relativeHref;
  }
}

export async function rewriteMarkdownAssetUrls(
  html: string,
  options: ReadmeAssetRewriteOptions,
): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const element of doc.querySelectorAll('img[src]')) {
    const src = element.getAttribute('src');

    if (!src || !urlNeedsRelativeRewrite(src)) {
      continue;
    }

    const relativePath = parseRelativeHref(src);

    if (!relativePath) {
      continue;
    }

    if (options.kind === 'remoteGitHub') {
      element.setAttribute('src', resolveAgainstDocumentBase(relativePath, options.documentBaseUrl));
    }
    else if (options.kind === 'localMarkdownFile') {
      const baseDir = getParentDirectory(options.markdownFilePath);
      const fullPath = await join(baseDir, relativePath);
      element.setAttribute('src', convertFileSrc(fullPath));
    }
    else if (isSafeRelativePath(relativePath)) {
      const fullPath = await join(options.extensionRootPath, relativePath);
      element.setAttribute('src', convertFileSrc(fullPath));
    }
  }

  return doc.body.innerHTML;
}
