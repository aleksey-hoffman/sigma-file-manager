// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const localeDirectoryPath = path.resolve('src/localization/messages');

describe('locale json format', () => {
  const localeFileNames = fs.readdirSync(localeDirectoryPath).filter(
    fileName => fileName.endsWith('.json'),
  );

  it('uses lf line endings and exactly one trailing newline', () => {
    expect(localeFileNames.length).toBeGreaterThan(0);

    for (const fileName of localeFileNames) {
      const fileContent = fs.readFileSync(path.join(localeDirectoryPath, fileName), 'utf8');

      expect(fileContent.includes('\r'), fileName).toBe(false);
      expect(fileContent.endsWith('\n'), fileName).toBe(true);
      expect(fileContent.endsWith('\n\n'), fileName).toBe(false);
    }
  });
});
