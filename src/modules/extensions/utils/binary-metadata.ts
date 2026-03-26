// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getBinaryLookupVersion(binary: {
  version?: string;
  storageVersion?: string | null;
}): string | undefined {
  if (binary.storageVersion === null) {
    return undefined;
  }

  return binary.storageVersion ?? binary.version;
}

export function getBinaryDisplayVersion(binary: {
  version?: string;
  latestVersion?: string;
}): string | undefined {
  return binary.version ?? binary.latestVersion;
}
