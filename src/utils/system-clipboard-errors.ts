// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function isExpectedClipboardReadError(error: unknown): boolean {
  const message = String(error);

  if (message.includes('OpenClipboard failed') && message.includes('Access is denied')) {
    return true;
  }

  if (message.includes('not available in the requested format')) {
    return true;
  }

  if (message.includes('clipboard is empty')) {
    return true;
  }

  return false;
}

export function isTransientClipboardAccessError(error: unknown): boolean {
  return isExpectedClipboardReadError(error);
}
