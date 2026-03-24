// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function getPathOrUrlExtension(pathOrUrl: string): string {
  let cleanPath = pathOrUrl;

  if (isHttpUrl(cleanPath)) {
    try {
      cleanPath = new URL(cleanPath).pathname;
    }
    catch {
      cleanPath = cleanPath.split('?')[0].split('#')[0];
    }
  }

  const lastDot = cleanPath.lastIndexOf('.');

  return lastDot >= 0 ? cleanPath.slice(lastDot + 1).toLowerCase() : '';
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function safeFileNameFromUrl(url: string): string {
  let baseName = '';

  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();

    if (segment) {
      let decoded = segment;

      try {
        decoded = decodeURIComponent(segment);
      }
      catch {
        // ignore malformed components
      }

      const cleanName = decoded.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();

      if (cleanName) {
        baseName = cleanName;
      }
    }
  }
  catch {
  }

  const extension = getPathOrUrlExtension(url) || 'jpg';

  if (!baseName) {
    return `image-${Date.now().toString(36)}.${extension}`;
  }

  if (/\.\w+$/.test(baseName)) {
    return baseName;
  }

  return `${baseName}.${extension}`;
}

export function createIndexedFileName(fileName: string, index: number): string {
  if (index <= 0) {
    return fileName;
  }

  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return `${fileName} (${index})`;
  }

  const stem = fileName.slice(0, extensionIndex);
  const extension = fileName.slice(extensionIndex);
  return `${stem} (${index})${extension}`;
}
