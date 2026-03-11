// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const SOURCE_BACKGROUNDS_SEGMENT = '/src/assets/media/source-backgrounds/';

export function normalizeBuildModuleId(moduleId: string): string {
  return moduleId.replace(/\\/g, '/').split('?')[0];
}

export function isRestrictedBackgroundSourceModuleId(moduleId: string): boolean {
  return normalizeBuildModuleId(moduleId).includes(SOURCE_BACKGROUNDS_SEGMENT);
}

export function assertNoRestrictedBackgroundSourceImport(moduleId: string) {
  if (isRestrictedBackgroundSourceModuleId(moduleId)) {
    throw new Error(
      'Do not import files from src/assets/media/source-backgrounds. Built-in source backgrounds must stay out of the app bundle.',
    );
  }
}
