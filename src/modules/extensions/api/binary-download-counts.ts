// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const binaryDownloadCounts = new Map<string, number>();

export function getBinaryDownloadCount(extensionId: string): number {
  return binaryDownloadCounts.get(extensionId) ?? 0;
}

export function clearBinaryDownloadCount(extensionId: string): void {
  binaryDownloadCounts.delete(extensionId);
}

export function incrementBinaryDownloadCount(extensionId: string): void {
  binaryDownloadCounts.set(extensionId, (binaryDownloadCounts.get(extensionId) ?? 0) + 1);
}
