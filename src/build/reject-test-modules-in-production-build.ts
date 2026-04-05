// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';

export function rejectTestModulesInProductionBuild(): Plugin {
  const projectRoot = path.normalize(fileURLToPath(new URL('../..', import.meta.url)));
  let resolvedConfig: ResolvedConfig | undefined;
  return {
    name: 'reject-test-modules-in-production-build',
    configResolved(config) {
      resolvedConfig = config;
    },
    load(moduleId) {
      if (resolvedConfig?.command !== 'build') {
        return null;
      }

      const filePath = path.normalize(moduleId.split('\0').pop()?.split('?')[0] ?? moduleId);
      const relativePath = path.relative(projectRoot, filePath);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
      }

      const segments = relativePath.split(path.sep);

      if (segments.includes('e2e-webdriver') || segments.includes('__tests__')) {
        throw new Error(
          `Production build cannot include test-only module: ${relativePath}`,
        );
      }

      return null;
    },
  };
}
