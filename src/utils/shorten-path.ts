// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { getPathDisplayValue, getPathSegments, isUncPath } from '@/utils/normalize-path';

const ELLIPSIS = '…';
const DEFAULT_MAX_LENGTH = 44;
const MAX_ROOT_LENGTH = 16;

function truncateMiddle(text: string, maxLength: number): string {
  const characters = Array.from(text);

  if (characters.length <= maxLength) {
    return text;
  }

  const keptLength = Math.max(maxLength - ELLIPSIS.length, 2);
  const startLength = Math.ceil(keptLength / 2);
  const endLength = keptLength - startLength;
  return `${characters.slice(0, startLength).join('')}${ELLIPSIS}${characters.slice(-endLength).join('')}`;
}

function getRootSegmentCount(path: string): number {
  return isUncPath(path) ? 2 : 1;
}

function getRootPrefix(path: string): string {
  if (isUncPath(path)) {
    return '//';
  }

  return path.startsWith('/') ? '/' : '';
}

/** Keeps the first directory, the parent directory and the name, and drops the directories between them. */
export function shortenPath(path: string, maxLength = DEFAULT_MAX_LENGTH): string {
  const displayPath = getPathDisplayValue(path);

  if (displayPath.length <= maxLength) {
    return displayPath;
  }

  const segments = getPathSegments(displayPath);
  const rootSegmentCount = getRootSegmentCount(displayPath);
  const rootPath = `${getRootPrefix(displayPath)}${segments.slice(0, rootSegmentCount).join('/')}`;
  const innerSegments = segments.slice(rootSegmentCount);
  const name = innerSegments.pop();

  if (!name) {
    return truncateMiddle(rootPath, maxLength);
  }

  const parentName = innerSegments.pop();
  const root = truncateMiddle(rootPath, MAX_ROOT_LENGTH);
  const start = innerSegments.length > 0 ? `${root}/${ELLIPSIS}/` : `${root}/`;

  if (!parentName) {
    return `${start}${truncateMiddle(name, maxLength - start.length)}`;
  }

  const availableLength = maxLength - start.length - 1;
  const parentLength = Math.max(Math.floor(availableLength / 3), availableLength - name.length);
  const shortParentName = truncateMiddle(parentName, parentLength);
  const shortName = truncateMiddle(name, availableLength - shortParentName.length);
  return `${start}${shortParentName}/${shortName}`;
}
