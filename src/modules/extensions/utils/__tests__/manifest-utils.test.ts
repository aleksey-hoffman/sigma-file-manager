// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getCommandIdParts,
  getFullCommandId,
  isCommandIdQualifiedForExtension,
  isCommandOwnedByAnotherExtension,
} from '@/modules/extensions/utils/manifest-utils';

describe('getFullCommandId', () => {
  it('prefixes short command ids', () => {
    expect(getFullCommandId('your-name.http-api-extension', 'demo-http-form')).toBe(
      'your-name.http-api-extension.demo-http-form',
    );
  });

  it('prefixes namespaced command ids that contain dots', () => {
    expect(getFullCommandId('your-name.http-api-extension', 'my-extension.demo-http-form')).toBe(
      'your-name.http-api-extension.my-extension.demo-http-form',
    );
  });

  it('returns already qualified command ids unchanged', () => {
    expect(getFullCommandId(
      'your-name.http-api-extension',
      'your-name.http-api-extension.demo-http-form',
    )).toBe('your-name.http-api-extension.demo-http-form');
  });
});

describe('getCommandIdParts', () => {
  it('derives short ids from namespaced command ids', () => {
    expect(getCommandIdParts('your-name.http-api-extension', 'demo-http-form')).toEqual({
      fullCommandId: 'your-name.http-api-extension.demo-http-form',
      shortCommandId: 'demo-http-form',
    });
  });
});

describe('isCommandIdQualifiedForExtension', () => {
  it('returns true only for ids owned by the extension', () => {
    expect(isCommandIdQualifiedForExtension(
      'your-name.http-api-extension',
      'your-name.http-api-extension.demo-http-form',
    )).toBe(true);

    expect(isCommandIdQualifiedForExtension(
      'your-name.http-api-extension',
      'demo-http-form',
    )).toBe(false);
  });
});

describe('isCommandOwnedByAnotherExtension', () => {
  it('detects qualified commands owned by another extension', () => {
    expect(isCommandOwnedByAnotherExtension(
      'other.extension.test-command',
      'your-name.http-api-extension',
      ['your-name.http-api-extension', 'other.extension'],
    )).toBe(true);
  });

  it('treats local command ids as not owned by another extension', () => {
    expect(isCommandOwnedByAnotherExtension(
      'demo-http-form',
      'your-name.http-api-extension',
      ['your-name.http-api-extension', 'other.extension'],
    )).toBe(false);
  });
});
