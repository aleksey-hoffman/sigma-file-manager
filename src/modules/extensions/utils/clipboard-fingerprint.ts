// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

export function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export function hashBytes(bytes: Uint8Array): string {
  let hash = 2166136261;

  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export function hashTextSample(text: string, maxBytes = 4096): string {
  const bytes = new TextEncoder().encode(text);

  if (bytes.length <= maxBytes) {
    return hashBytes(bytes);
  }

  const half = Math.floor(maxBytes / 2);
  const sample = new Uint8Array(maxBytes);
  sample.set(bytes.subarray(0, half), 0);
  sample.set(bytes.subarray(bytes.length - half), half);
  return hashBytes(sample);
}

export function buildFingerprint(parts: string[]): string {
  return hashString(parts.join('\0'));
}

export function isValidPngBytes(pngBytes: Uint8Array): boolean {
  if (pngBytes.length < PNG_SIGNATURE.length) {
    return false;
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (pngBytes[index] !== PNG_SIGNATURE[index]) {
      return false;
    }
  }

  return true;
}

export function buildImageContentFingerprint(
  pngBytes: Uint8Array,
  width: number,
  height: number,
): string {
  return buildFingerprint(['image', String(width), String(height), hashBytes(pngBytes)]);
}
