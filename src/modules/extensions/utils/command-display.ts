// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  CommandRegistration,
  ExtensionCommand,
  InstalledExtension,
} from '@/types/extension';

export type PaletteCommandEntry = {
  extensionId: string;
  command: ExtensionCommand;
};

function getFullCommandId(extensionId: string, commandId: string): string {
  return commandId.includes('.') ? commandId : `${extensionId}.${commandId}`;
}

export function getPaletteCommandEntries(
  enabledExtensions: InstalledExtension[],
  runtimeCommands: CommandRegistration[],
): PaletteCommandEntry[] {
  const entries: PaletteCommandEntry[] = [];
  const existingIds = new Set<string>();

  for (const registration of runtimeCommands) {
    const fullCommandId = getFullCommandId(registration.extensionId, registration.command.id);

    if (existingIds.has(fullCommandId)) {
      continue;
    }

    existingIds.add(fullCommandId);
    entries.push({
      extensionId: registration.extensionId,
      command: {
        ...registration.command,
        id: fullCommandId,
      },
    });
  }

  for (const extension of enabledExtensions) {
    const manifestCommands = extension.manifest.contributes?.commands ?? [];

    for (const command of manifestCommands) {
      const fullCommandId = getFullCommandId(extension.id, command.id);

      if (existingIds.has(fullCommandId)) {
        continue;
      }

      existingIds.add(fullCommandId);
      entries.push({
        extensionId: extension.id,
        command: {
          ...command,
          id: fullCommandId,
        },
      });
    }
  }

  return entries;
}
