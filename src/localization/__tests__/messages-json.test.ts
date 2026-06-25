// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const messagesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../messages',
);

describe('localization messages json', () => {
  it('parses every locale file as valid json', () => {
    const localeFiles = fs.readdirSync(messagesDirectory).filter(fileName => fileName.endsWith('.json'));

    expect(localeFiles.length).toBeGreaterThan(0);

    for (const localeFile of localeFiles) {
      const fileContents = fs.readFileSync(path.join(messagesDirectory, localeFile), 'utf8');

      expect(() => JSON.parse(fileContents)).not.toThrow();
    }
  });
});
