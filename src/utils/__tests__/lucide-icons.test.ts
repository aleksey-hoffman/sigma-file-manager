// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { getLucideIcon } from '@/utils/lucide-icons';

async function waitForIconHtml(
  getHtml: () => string,
  expectedClass: string,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await flushPromises();
    const html = getHtml();

    if (html.includes(expectedClass)) {
      return html;
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return getHtml();
}

describe('getLucideIcon', () => {
  it('resolves known lucide icons to a stable component', () => {
    const first = getLucideIcon('PencilRuler');
    const second = getLucideIcon('PencilRuler');

    expect(first).toBeDefined();
    expect(second).toBe(first);
  });

  it('loads the real lucide module for known icons instead of Blocks', async () => {
    const Icon = getLucideIcon('PencilRuler');
    expect(Icon).toBeDefined();

    const wrapper = mount(Icon!);
    const html = await waitForIconHtml(() => wrapper.html(), 'lucide-pencil-ruler');

    expect(html).toContain('lucide-pencil-ruler');
    expect(html).not.toContain('lucide-blocks');
  });

  it('returns undefined for empty names', () => {
    expect(getLucideIcon('')).toBeUndefined();
    expect(getLucideIcon('   ')).toBeUndefined();
  });

  it('returns a stable fallback wrapper for unknown icon names', () => {
    const first = getLucideIcon('DefinitelyNotARealLucideIcon');
    const second = getLucideIcon('DefinitelyNotARealLucideIcon');

    expect(first).toBeDefined();
    expect(second).toBe(first);
  });
});
