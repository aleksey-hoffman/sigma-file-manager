// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import normalizePath, { joinPath } from '@/utils/normalize-path';

export function isLeadingTildePath(input: string): boolean {
  const normalizedInput = normalizePath(input).trim();
  return normalizedInput === '~' || normalizedInput.startsWith('~/');
}

export function expandLeadingTilde(input: string, homeDir: string): string {
  const normalizedInput = normalizePath(input).trim();
  const normalizedHome = normalizePath(homeDir).trim();

  if (!normalizedHome || !isLeadingTildePath(normalizedInput)) {
    return normalizedInput;
  }

  const relativePath = normalizedInput === '~' ? '' : normalizedInput.slice(2);
  const joinedPath = joinPath(normalizedHome, relativePath);

  if (normalizedInput.endsWith('/') && !joinedPath.endsWith('/')) {
    return `${joinedPath}/`;
  }

  return joinedPath;
}

function stripOnePairOfMatchingQuotes(input: string): string {
  const trimmedInput = input.trim();

  if (trimmedInput.length < 2) {
    return trimmedInput;
  }

  const openingQuote = trimmedInput.charAt(0);
  const closingQuote = trimmedInput.charAt(trimmedInput.length - 1);
  const isSupportedQuote = openingQuote === '"'
    || openingQuote === '\''
    || openingQuote === '`';

  if (!isSupportedQuote || openingQuote !== closingQuote) {
    return trimmedInput;
  }

  return trimmedInput.slice(1, -1);
}

export function expandCopiedPath(input: string, homeDir: string): string {
  return expandLeadingTilde(stripOnePairOfMatchingQuotes(input), homeDir);
}
