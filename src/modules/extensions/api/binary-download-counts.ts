// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const binaryDownloadCounts = new Map<string, number>();
const binaryReuseCounts = new Map<string, number>();

export function getBinaryDownloadCount(extensionId: string): number {
  return binaryDownloadCounts.get(extensionId) ?? 0;
}

export function clearBinaryDownloadCount(extensionId: string): void {
  binaryDownloadCounts.delete(extensionId);
}

export function incrementBinaryDownloadCount(extensionId: string): void {
  binaryDownloadCounts.set(extensionId, (binaryDownloadCounts.get(extensionId) ?? 0) + 1);
}

export function getBinaryReuseCount(extensionId: string): number {
  return binaryReuseCounts.get(extensionId) ?? 0;
}

export function clearBinaryReuseCount(extensionId: string): void {
  binaryReuseCounts.delete(extensionId);
}

export function incrementBinaryReuseCount(extensionId: string): void {
  binaryReuseCounts.set(extensionId, (binaryReuseCounts.get(extensionId) ?? 0) + 1);
}
