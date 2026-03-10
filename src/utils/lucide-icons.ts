// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  defineComponent,
  h,
  onMounted,
  shallowRef,
  useAttrs,
  type Component,
  type VNode,
} from 'vue';
import { Blocks } from 'lucide-vue-next';

// Include all icon mappings into bundle so we can load any icon  dynamically at runtime
const iconModules = import.meta.glob<{ default: Component }>(
  '../../node_modules/lucide-vue-next/dist/esm/icons/*.js',
);

const iconCache = new Map<string, Component>();

function toKebabCase(name: string): string {
  const withoutIcon = name.trim().replace(/Icon$/i, '');
  return withoutIcon
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function getIconModulePath(kebabName: string): string {
  const paths = Object.keys(iconModules);
  return paths.find(path => path.endsWith(`/${kebabName}.js`)) ?? '';
}

function loadIcon(kebabName: string): Promise<Component> {
  const cached = iconCache.get(kebabName);

  if (cached) {
    return Promise.resolve(cached);
  }

  const modulePath = getIconModulePath(kebabName);
  const loader = modulePath ? iconModules[modulePath] : undefined;

  if (!loader) {
    return Promise.resolve(Blocks);
  }

  return loader().then((module) => {
    const iconComponent = module.default as Component;
    iconCache.set(kebabName, iconComponent);
    return iconComponent;
  });
}

export function getLucideIcon(name: string): Component | undefined {
  if (!name || typeof name !== 'string') {
    return undefined;
  }

  const kebabName = toKebabCase(name);

  if (!kebabName || kebabName.length === 0) {
    return undefined;
  }

  const cached = iconCache.get(kebabName);

  if (cached) {
    return cached;
  }

  return defineComponent({
    setup() {
      const attrs = useAttrs();
      const LoadedIcon = shallowRef<Component | null>(null);

      onMounted(() => {
        loadIcon(kebabName).then((component) => {
          LoadedIcon.value = component;
        });
      });

      return () => {
        const component = LoadedIcon.value ?? Blocks;
        return h(component as Component, attrs) as VNode;
      };
    },
  });
}
