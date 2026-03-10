// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toRaw } from 'vue';
import type { UIElement } from '@/types/extension';

const NON_VALUE_ELEMENT_TYPES = new Set<UIElement['type']>([
  'separator', 'text', 'button', 'image', 'skeleton', 'alert',
  'previewCard', 'previewCardSkeleton',
]);

export function hasValue(element: UIElement): boolean {
  return Boolean(element.id && !NON_VALUE_ELEMENT_TYPES.has(element.type));
}

export function getDefaultValue(element: UIElement): unknown {
  switch (element.type) {
    case 'checkbox':
      return element.value ?? false;
    case 'select':
      return element.value ?? element.options?.[0]?.value ?? '';
    default:
      return element.value ?? '';
  }
}

export function toPlainValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = toRaw(values);
  const plain: Record<string, unknown> = {};

  for (const key of Object.keys(raw)) {
    plain[key] = toRaw(raw[key]);
  }

  return plain;
}

export function initializeFormValues(content: UIElement[]): Record<string, unknown> {
  const formValues: Record<string, unknown> = {};

  for (const element of content) {
    if (hasValue(element)) {
      formValues[element.id!] = getDefaultValue(element);
    }
  }

  return formValues;
}
