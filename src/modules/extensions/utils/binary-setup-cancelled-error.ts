// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export class BinarySetupCancelledError extends Error {
  constructor() {
    super('Binary setup cancelled');
    this.name = 'BinarySetupCancelledError';
  }
}

export function isBinarySetupCancelledError(error: unknown): boolean {
  return error instanceof BinarySetupCancelledError
    || (error instanceof Error && error.name === 'BinarySetupCancelledError');
}
