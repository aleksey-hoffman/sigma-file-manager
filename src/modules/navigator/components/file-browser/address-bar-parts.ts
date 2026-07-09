// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  getAddressBarSegments,
  isUncPath,
  isUnixFilesystemRoot,
  canonicalizePath,
} from '@/utils/normalize-path';
import {
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  LOCATIONS_VIRTUAL_PATH,
  shouldPrependLocationsCrumb,
} from '@/utils/virtual-locations';

export type AddressBarPart = {
  path: string;
  name: string;
  isLast: boolean;
  disableDropTarget?: boolean;
  displayRootIcon?: boolean;
  useLocationsDropdown?: boolean;
};

export function buildAddressBarParts(
  currentPath: string,
  platform: string | null,
  locationsLabel: string,
): AddressBarPart[] {
  if (!currentPath) {
    return [];
  }

  if (isVirtualLocationPath(currentPath)) {
    return [{
      path: LOCATIONS_VIRTUAL_PATH,
      name: locationsLabel,
      isLast: true,
      disableDropTarget: true,
      displayRootIcon: true,
      useLocationsDropdown: true,
    }];
  }

  const normalizedPath = canonicalizePath(currentPath);
  const parts = getAddressBarSegments(normalizedPath);
  const uncPath = isUncPath(normalizedPath);
  const formattedParts: AddressBarPart[] = [];

  parts.forEach((part, index) => {
    const pathSegments = parts.slice(0, index + 1);
    let fullPath = '';

    if (uncPath) {
      fullPath = `//${pathSegments.join('/')}`;
    }
    else if (isUnixFilesystemRoot(normalizedPath)) {
      fullPath = '/';
    }
    else if (normalizedPath.startsWith('/')) {
      fullPath = `/${pathSegments.join('/')}`;
    }
    else if (pathSegments[0]?.includes(':')) {
      fullPath = `${pathSegments[0]}/`;

      if (pathSegments.length > 1) {
        fullPath += pathSegments.slice(1).join('/');
      }
    }
    else {
      fullPath = pathSegments.join('/');
    }

    formattedParts.push({
      path: fullPath,
      name: part,
      isLast: index === parts.length - 1,
      disableDropTarget: isVirtualDirectoryPath(fullPath),
    });
  });

  if (!shouldPrependLocationsCrumb(currentPath, platform)) {
    return formattedParts;
  }

  return [
    {
      path: LOCATIONS_VIRTUAL_PATH,
      name: locationsLabel,
      isLast: false,
      disableDropTarget: true,
      displayRootIcon: true,
      useLocationsDropdown: true,
    },
    ...formattedParts,
  ];
}
