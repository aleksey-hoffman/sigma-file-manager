// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { ExtensionManifest } from '@/types/extension';
import {
  checkEngineCompatibility,
  isExtensionVisibleInMarketplace,
} from '@/modules/extensions/utils/engine-compatibility';

function createManifest(engines: ExtensionManifest['engines']): ExtensionManifest {
  return {
    id: 'sigma.test',
    name: 'Test',
    version: '1.0.0',
    extensionType: 'api',
    main: 'dist/index.js',
    repository: 'https://github.com/example/test',
    license: 'MIT',
    permissions: ['commands'],
    engines,
  };
}

describe('checkEngineCompatibility', () => {
  it('accepts extensions when app and api requirements are satisfied', () => {
    const result = checkEngineCompatibility(
      createManifest({
        sigmaFileManager: '>=2.0.0',
        extensionApi: '>=1.9.0',
      }),
      {
        appVersion: '2.0.0',
        extensionApiVersion: '1.9.0',
      },
    );

    expect(result.isCompatible).toBe(true);
  });

  it('rejects extensions that require a newer extension API', () => {
    const result = checkEngineCompatibility(
      createManifest({
        sigmaFileManager: '>=2.0.0',
        extensionApi: '>=1.9.0',
      }),
      {
        appVersion: '2.0.0',
        extensionApiVersion: '1.8.1',
      },
    );

    expect(result.isCompatible).toBe(false);
    expect(result.isAppCompatible).toBe(true);
    expect(result.isExtensionApiCompatible).toBe(false);
  });

  it('accepts extensions without an extension API requirement', () => {
    const result = checkEngineCompatibility(
      createManifest({
        sigmaFileManager: '>=2.0.0',
      }),
      {
        appVersion: '2.0.0',
        extensionApiVersion: '1.8.1',
      },
    );

    expect(result.isCompatible).toBe(true);
  });
});

describe('isExtensionVisibleInMarketplace', () => {
  const context = {
    appVersion: '2.0.0',
    extensionApiVersion: '1.8.1',
  };

  it('hides incompatible marketplace extensions', () => {
    expect(isExtensionVisibleInMarketplace(
      createManifest({
        sigmaFileManager: '>=2.0.0',
        extensionApi: '>=1.9.0',
      }),
      false,
      context,
    )).toBe(false);
  });

  it('keeps installed incompatible extensions visible', () => {
    expect(isExtensionVisibleInMarketplace(
      createManifest({
        sigmaFileManager: '>=2.0.0',
        extensionApi: '>=1.9.0',
      }),
      true,
      context,
    )).toBe(true);
  });
});
