// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import * as icons from 'lucide-vue-next';
import type { Component } from 'vue';

type LucideIcons = typeof icons;
type IconName = keyof LucideIcons;

export function getLucideIcon(name: string): Component | undefined {
  const iconName = name as IconName;

  if (iconName in icons) {
    return icons[iconName] as Component;
  }

  const iconNameWithIcon = `${name}Icon` as IconName;

  if (iconNameWithIcon in icons) {
    return icons[iconNameWithIcon] as Component;
  }

  return undefined;
}
