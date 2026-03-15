// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getAssetNameFromDownloadUrl(downloadUrl: string): string | null {
  try {
    const parsedUrl = new URL(downloadUrl);
    const pathSegments = parsedUrl.pathname.split('/');
    const assetName = pathSegments[pathSegments.length - 1];
    return assetName ? decodeURIComponent(assetName) : null;
  }
  catch {
    return null;
  }
}

export function buildIntegrityCandidateUrls(downloadUrl: string): string[] {
  try {
    const parsedUrl = new URL(downloadUrl);
    const lastSlashIndex = parsedUrl.pathname.lastIndexOf('/');

    if (lastSlashIndex === -1) {
      return [];
    }

    const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname.slice(0, lastSlashIndex)}`;
    const assetDownloadUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;

    return [
      `${assetDownloadUrl}.sha256sum`,
      `${baseUrl}/SHA2-256SUMS`,
      `${baseUrl}/checksums.sha256`,
    ];
  }
  catch {
    return [];
  }
}

export function parseIntegrityFromChecksumText(
  checksumText: string,
  assetName: string,
): string | undefined {
  const normalizedAssetName = assetName.trim();
  const checksumLines = checksumText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (checksumLines.length === 1 && /^[a-f0-9]{64}$/i.test(checksumLines[0])) {
    return `sha256:${checksumLines[0].toLowerCase()}`;
  }

  for (const checksumLine of checksumLines) {
    const posixMatch = checksumLine.match(/^([a-f0-9]{64})\s+[* ]?(.+)$/i);

    if (posixMatch) {
      const [, hashValue, fileName] = posixMatch;
      const normalizedFileName = fileName.trim().replace(/^\.?\//, '');

      if (normalizedFileName === normalizedAssetName) {
        return `sha256:${hashValue.toLowerCase()}`;
      }
    }

    const opensslMatch = checksumLine.match(/^SHA256\s+\((.+)\)\s*=\s*([a-f0-9]{64})$/i);

    if (opensslMatch) {
      const [, fileName, hashValue] = opensslMatch;

      if (fileName.trim() === normalizedAssetName) {
        return `sha256:${hashValue.toLowerCase()}`;
      }
    }
  }

  const powershellAlgorithmMatch = checksumText.match(/Algorithm\s*:\s*SHA256/i);
  const powershellHashMatch = checksumText.match(/Hash\s*:\s*([a-f0-9]{64})/i);
  const powershellPathMatch = checksumText.match(/Path\s*:\s*(.+)/i);

  if (powershellAlgorithmMatch && powershellHashMatch) {
    const powershellPath = powershellPathMatch?.[1]?.trim() ?? '';
    const powershellFileName = powershellPath.split(/[/\\]/).pop()?.trim() ?? '';

    if (!powershellFileName || powershellFileName === normalizedAssetName) {
      return `sha256:${powershellHashMatch[1].toLowerCase()}`;
    }
  }

  return undefined;
}
