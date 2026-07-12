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

const iconModules = import.meta.glob<IconModule>([
  '../../node_modules/@lucide/vue/dist/esm/icons/*.mjs',
  '../../node_modules/@lucide/vue/dist/esm/icons/*.js',
]);

const iconModuleLoaders = new Map<string, IconModuleLoader>();

for (const [modulePath, loader] of Object.entries(iconModules)) {
  const normalizedPath = modulePath.replace(/\\/g, '/');
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
  const kebabName = fileName.replace(/\.(?:mjs|js)$/, '');

  if (!iconModuleLoaders.has(kebabName)) {
    iconModuleLoaders.set(kebabName, loader);
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
  const withoutIcon = name.trim().replace(/Icon$/i, '');
  return withoutIcon
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function createLucideIconResolver(
  moduleLoaders: ReadonlyMap<string, IconModuleLoader>,
): (name: string) => Component | undefined {
  const iconWrappers = new Map<string, Component>();

  return (name: string): Component | undefined => {
    if (!name || typeof name !== 'string') {
      return undefined;
    }

    const kebabName = toKebabCase(name);

    if (!kebabName) {
      return undefined;
    }

    const cachedWrapper = iconWrappers.get(kebabName);

    if (cachedWrapper) {
      return cachedWrapper;
    }

    const loader = moduleLoaders.get(kebabName);

    if (!loader) {
      iconWrappers.set(kebabName, Blocks);
      return Blocks;
    }

    const wrapper = defineAsyncComponent({
      loader: async () => {
        try {
          const iconModule = await loader();
          return iconModule.default;
        }
        catch {
          return Blocks;
        }
      },
      loadingComponent: LucideIconLoading,
      delay: 0,
      suspensible: false,
    });

    iconWrappers.set(kebabName, wrapper);
    return wrapper;
  };
}

export const getLucideIcon = createLucideIconResolver(iconModuleLoaders);
