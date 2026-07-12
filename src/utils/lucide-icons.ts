// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  defineAsyncComponent,
  defineComponent,
  h,
  type Component,
} from 'vue';
import { Blocks } from '@lucide/vue';

interface IconModule {
  default: Component;
}

type IconModuleLoader = () => Promise<IconModule>;

function toPascalCase(kebabName: string): string {
  return kebabName
    .split('-')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

const iconModules = import.meta.glob<IconModule>([
  '../../node_modules/@lucide/vue/dist/esm/icons/*.mjs',
  '../../node_modules/@lucide/vue/dist/esm/icons/*.js',
]);

const iconModuleLoaders = new Map<string, IconModuleLoader>();

for (const [modulePath, loader] of Object.entries(iconModules)) {
  const normalizedPath = modulePath.replace(/\\/g, '/');
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
  const kebabName = fileName.replace(/\.(?:mjs|js)$/, '');
  const pascalName = toPascalCase(kebabName);
  const aliases = [
    kebabName,
    pascalName,
    pascalName.toLowerCase(),
  ];

  for (const alias of aliases) {
    if (!iconModuleLoaders.has(alias)) {
      iconModuleLoaders.set(alias, loader);
    }
  }
}

const LucideIconLoading = defineComponent({
  name: 'LucideIconLoading',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => {
      const {
        size = 24,
        style,
        ...svgAttrs
      } = attrs;

      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        ...svgAttrs,
        width: size,
        height: size,
        style: [style, { visibility: 'hidden' }],
      });
    };
  },
});

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function createLucideIconResolver(
  moduleLoaders: ReadonlyMap<string, IconModuleLoader>,
): (name: string) => Component | undefined {
  const iconWrappers = new Map<IconModuleLoader, Component>();

  return (name: string): Component | undefined => {
    if (!name || typeof name !== 'string') {
      return undefined;
    }

    const baseName = name.trim().replace(/Icon$/i, '');

    if (!baseName) {
      return undefined;
    }

    const loader = moduleLoaders.get(baseName)
      ?? moduleLoaders.get(baseName.toLowerCase())
      ?? moduleLoaders.get(toKebabCase(baseName));

    if (!loader) {
      return Blocks;
    }

    const cachedWrapper = iconWrappers.get(loader);

    if (cachedWrapper) {
      return cachedWrapper;
    }

    const wrapper = defineAsyncComponent({
      loader: async () => {
        try {
          const iconModule = await loader();
          return iconModule.default;
        }
        catch (loadError) {
          console.error(`Failed to load Lucide icon "${baseName}":`, loadError);
          return Blocks;
        }
      },
      loadingComponent: LucideIconLoading,
      delay: 0,
      suspensible: false,
    });

    iconWrappers.set(loader, wrapper);
    return wrapper;
  };
}

export const getLucideIcon = createLucideIconResolver(iconModuleLoaders);
