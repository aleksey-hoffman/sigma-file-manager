// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionRegistryEntry } from '@/types/extension';
import {
  getExtensionManifestUrl,
  fetchUrlText,
} from '@/data/extensions';
import { assertValidManifestData } from '@/modules/extensions/runtime/validation';

export function isMissingRegistryEntryError(error: unknown): boolean {
  return error instanceof Error && /\b404\b/.test(error.message);
}

export async function getRegistryEntryReachability(
  registryEntry: ExtensionRegistryEntry,
): Promise<'reachable' | 'unreachable' | 'unknown'> {
  try {
    const response = await fetchUrlText(getExtensionManifestUrl(registryEntry.repository, 'main'));

    if (!response.ok) {
      return response.status === 404 ? 'unreachable' : 'unknown';
    }

    const parsedManifest = JSON.parse(response.body) as unknown;
    assertValidManifestData(parsedManifest);
    return 'reachable';
  }
  catch (error) {
    if (isMissingRegistryEntryError(error)) {
      return 'unreachable';
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to validate registry entry ${registryEntry.id}: ${message}`);
    return 'unknown';
  }
}

export async function filterReachableRegistryEntries(
  registryEntries: ExtensionRegistryEntry[],
): Promise<ExtensionRegistryEntry[]> {
  const validationResults = await Promise.all(registryEntries.map(async (registryEntry) => {
    return {
      registryEntry,
      reachability: await getRegistryEntryReachability(registryEntry),
    };
  }));

  const unreachableIds = validationResults
    .filter(result => result.reachability === 'unreachable')
    .map(result => result.registryEntry.id);

  if (unreachableIds.length > 0) {
    console.warn(`Filtered unreachable registry extensions: ${unreachableIds.join(', ')}`);
  }

  return validationResults
    .filter(result => result.reachability !== 'unreachable')
    .map(result => result.registryEntry);
}
