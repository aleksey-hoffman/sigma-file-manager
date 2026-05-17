// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type JsonObject = Record<string, unknown>;

const manifestSchema = JSON.parse(
  readFileSync(
    join(process.cwd(), 'packages/api/manifest.schema.json'),
    'utf8',
  ),
) as JsonObject;

describe('manifest JSON schema icon theme validation', () => {
  it('rejects blank icon theme ids and labels', () => {
    expect(matchesIconThemePropertySchema('id', '   ')).toBe(false);
    expect(matchesIconThemePropertySchema('label', '\t')).toBe(false);
    expect(matchesIconThemePropertySchema('id', 'ocean')).toBe(true);
    expect(matchesIconThemePropertySchema('label', 'Ocean')).toBe(true);
  });

  it('rejects unsafe icon theme paths', () => {
    const unsafePaths = [
      '',
      '   ',
      '.',
      './',
      '../theme.json',
      ' ../theme.json',
      'themes/../theme.json',
      '/theme.json',
      '\\theme.json',
      'C:/theme.json',
    ];

    for (const unsafePath of unsafePaths) {
      expect(matchesIconThemePropertySchema('path', unsafePath)).toBe(false);
    }
  });

  it('accepts safe icon theme paths', () => {
    const safePaths = [
      'themes/ocean-icon-theme.json',
      './themes/ocean-icon-theme.json',
      '.themes/ocean-icon-theme.json',
      'themes\\ocean-icon-theme.json',
    ];

    for (const safePath of safePaths) {
      expect(matchesIconThemePropertySchema('path', safePath)).toBe(true);
    }
  });
});

function matchesIconThemePropertySchema(propertyName: string, value: string): boolean {
  const propertySchema = getIconThemePropertySchema(propertyName);
  const minLength = propertySchema.minLength;

  if (typeof minLength === 'number' && value.length < minLength) {
    return false;
  }

  const pattern = propertySchema.pattern;

  if (typeof pattern === 'string' && !new RegExp(pattern).test(value)) {
    return false;
  }

  return true;
}

function getIconThemePropertySchema(propertyName: string): JsonObject {
  const manifestProperties = asJsonObject(manifestSchema.properties);
  const contributes = asJsonObject(manifestProperties.contributes);
  const contributesProperties = asJsonObject(contributes.properties);
  const iconThemes = asJsonObject(contributesProperties.iconThemes);
  const iconThemeItem = asJsonObject(iconThemes.items);
  const iconThemeProperties = asJsonObject(iconThemeItem.properties);

  return asJsonObject(iconThemeProperties[propertyName]);
}

function asJsonObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a JSON object');
  }

  return value as JsonObject;
}
