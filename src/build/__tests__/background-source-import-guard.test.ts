// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  assertNoRestrictedBackgroundSourceImport,
  isRestrictedBackgroundSourceModuleId,
  normalizeBuildModuleId,
} from '../background-source-import-guard';

describe('background source import guard', () => {
  it('normalizes Windows module ids before checking them', () => {
    const normalizedModuleId = normalizeBuildModuleId(
      'C:\\repo\\src\\assets\\media\\source-backgrounds\\Exile by Aleksey Hoffman.jpg?url',
    );

    expect(normalizedModuleId).toBe('C:/repo/src/assets/media/source-backgrounds/Exile by Aleksey Hoffman.jpg');
    expect(isRestrictedBackgroundSourceModuleId(normalizedModuleId)).toBe(true);
  });

  it('throws for source background imports and allows preview imports', () => {
    expect(() => assertNoRestrictedBackgroundSourceImport(
      '/repo/src/assets/media/source-backgrounds/Exile by Aleksey Hoffman.jpg?url',
    )).toThrow(/must stay out of the app bundle/i);

    expect(() => assertNoRestrictedBackgroundSourceImport(
      '/repo/src/assets/media/background-previews/Exile by Aleksey Hoffman.jpg',
    )).not.toThrow();
  });
});
