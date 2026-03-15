// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type {
  CommandRegistration,
  InstalledExtension,
} from '@/types/extension';
import { getPaletteCommandEntries } from '@/modules/extensions/utils/command-display';

function createInstalledExtension(commandTitle: string): InstalledExtension {
  return {
    id: 'sigma.test-extension',
    version: '1.0.0',
    enabled: true,
    autoUpdate: true,
    installedAt: 0,
    manifest: {
      id: 'sigma.test-extension',
      name: 'Test Extension',
      version: '1.0.0',
      publisher: {
        name: 'sigma-hub',
      },
      repository: 'https://example.com/test-extension',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: [],
      contributes: {
        commands: [
          {
            id: 'test-command',
            title: commandTitle,
          },
        ],
      },
      engines: {
        sigmaFileManager: '>=2.0.0',
      },
    },
    settings: {
      scopedDirectories: [],
    },
  };
}

describe('getPaletteCommandEntries', () => {
  it('prefers runtime-registered commands over manifest commands', () => {
    const enabledExtensions = [createInstalledExtension('Manifest Title')];
    const runtimeCommands: CommandRegistration[] = [
      {
        extensionId: 'sigma.test-extension',
        command: {
          id: 'sigma.test-extension.test-command',
          title: 'Translated Runtime Title',
        },
        handler: () => undefined,
      },
    ];

    const entries = getPaletteCommandEntries(enabledExtensions, runtimeCommands);

    expect(entries).toEqual([
      {
        extensionId: 'sigma.test-extension',
        command: {
          id: 'sigma.test-extension.test-command',
          title: 'Translated Runtime Title',
        },
      },
    ]);
  });

  it('falls back to manifest commands when no runtime registration exists', () => {
    const enabledExtensions = [createInstalledExtension('Manifest Title')];

    const entries = getPaletteCommandEntries(enabledExtensions, []);

    expect(entries).toEqual([
      {
        extensionId: 'sigma.test-extension',
        command: {
          id: 'sigma.test-extension.test-command',
          title: 'Manifest Title',
        },
      },
    ]);
  });
});
