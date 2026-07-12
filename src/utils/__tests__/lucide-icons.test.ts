// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { CircleIcon } from '@lucide/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  defineComponent,
  h,
  type Component,
} from 'vue';
import {
  createLucideIconResolver,
  getLucideIcon,
} from '@/utils/lucide-icons';

afterEach(() => {
  vi.restoreAllMocks();
});

function createDeferred<Value>() {
  let resolvePromise!: (value: Value) => void;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

function mountIcon(
  icon: Component,
  attrs: Record<string, unknown> = {},
) {
  return mount(defineComponent({
    setup() {
      return () => h(icon, attrs);
    },
  }));
}

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

describe('createLucideIconResolver', () => {
  it('deduplicates concurrent mounts and renders resolved remounts immediately', async () => {
    const deferredModule = createDeferred<{ default: Component }>();
    const loader = vi.fn(() => deferredModule.promise);
    const resolveIcon = createLucideIconResolver(new Map([
      ['circle', loader],
    ]));
    const Icon = resolveIcon('Circle');

    expect(Icon).toBeDefined();
    expect(resolveIcon('CircleIcon')).toBe(Icon);

    const firstWrapper = mountIcon(Icon!);
    const secondWrapper = mountIcon(Icon!);

    expect(firstWrapper.html()).not.toContain('lucide-blocks');
    expect(secondWrapper.html()).not.toContain('lucide-blocks');
    expect(loader).toHaveBeenCalledTimes(1);

    deferredModule.resolve({ default: CircleIcon });
    await flushPromises();

    expect(firstWrapper.html()).toContain('lucide-circle');
    expect(secondWrapper.html()).toContain('lucide-circle');

    firstWrapper.unmount();
    secondWrapper.unmount();

    const remountedWrapper = mountIcon(Icon!);

    expect(remountedWrapper.html()).toContain('lucide-circle');
    expect(remountedWrapper.html()).not.toContain('visibility: hidden');
  });

  it('forwards attributes and listeners through loading and resolved states', async () => {
    const deferredModule = createDeferred<{ default: Component }>();
    const loader = vi.fn(() => deferredModule.promise);
    const handleClick = vi.fn();
    const resolveIcon = createLucideIconResolver(new Map([
      ['circle', loader],
    ]));
    const Icon = resolveIcon('Circle');
    const wrapper = mountIcon(Icon!, {
      'aria-label': 'Circle icon',
      'class': 'navigation-icon',
      'onClick': handleClick,
      'size': 18,
    });

    const loadingSvg = wrapper.get('svg');
    const loadingClasses = loadingSvg.classes()
      .filter(className => className === 'navigation-icon');

    expect(loadingClasses).toHaveLength(1);
    expect(loadingSvg.attributes('aria-label')).toBe('Circle icon');
    expect(loadingSvg.attributes('width')).toBe('18');
    expect(loadingSvg.attributes('height')).toBe('18');
    expect(loadingSvg.attributes('style')).toContain('visibility: hidden');

    await loadingSvg.trigger('click');
    expect(handleClick).toHaveBeenCalledTimes(1);

    deferredModule.resolve({ default: CircleIcon });
    await flushPromises();

    const resolvedSvg = wrapper.get('svg');
    const resolvedClasses = resolvedSvg.classes()
      .filter(className => className === 'navigation-icon');

    expect(resolvedClasses).toHaveLength(1);
    expect(resolvedSvg.attributes('aria-label')).toBe('Circle icon');
    expect(resolvedSvg.attributes('width')).toBe('18');
    expect(resolvedSvg.attributes('height')).toBe('18');

    await resolvedSvg.trigger('click');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('settles rejected loaders on Blocks without retrying after remount', async () => {
    const loadError = new Error('Forced icon load failure');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loader = vi.fn(() => Promise.reject(loadError));
    const handleClick = vi.fn();
    const resolveIcon = createLucideIconResolver(new Map([
      ['failed', loader],
    ]));
    const Icon = resolveIcon('FailedIcon');
    const firstWrapper = mountIcon(Icon!, {
      'aria-label': 'Unavailable icon',
      'class': 'failed-icon',
      'onClick': handleClick,
      'size': 16,
    });

    await flushPromises();

    const fallbackSvg = firstWrapper.get('svg');
    const fallbackClasses = fallbackSvg.classes()
      .filter(className => className === 'failed-icon');

    expect(firstWrapper.html()).toContain('lucide-blocks');
    expect(fallbackClasses).toHaveLength(1);
    expect(fallbackSvg.attributes('aria-label')).toBe('Unavailable icon');
    expect(fallbackSvg.attributes('width')).toBe('16');

    await fallbackSvg.trigger('click');
    expect(handleClick).toHaveBeenCalledTimes(1);

    firstWrapper.unmount();

    const remountedWrapper = mountIcon(Icon!);

    expect(remountedWrapper.html()).toContain('lucide-blocks');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load Lucide icon "Failed":',
      loadError,
    );
  });

  it('retains a resolved icon after its first wrapper unmounts during loading', async () => {
    const deferredModule = createDeferred<{ default: Component }>();
    const loader = vi.fn(() => deferredModule.promise);
    const resolveIcon = createLucideIconResolver(new Map([
      ['circle', loader],
    ]));
    const Icon = resolveIcon('Circle');
    const wrapper = mountIcon(Icon!);

    wrapper.unmount();
    deferredModule.resolve({ default: CircleIcon });
    await flushPromises();

    const remountedWrapper = mountIcon(Icon!);

    expect(remountedWrapper.html()).toContain('lucide-circle');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

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

    const wrapper = mountIcon(Icon!);
    const html = await waitForIconHtml(() => wrapper.html(), 'lucide-pencil-ruler');

    expect(html).toContain('lucide-pencil-ruler');
    expect(html).not.toContain('lucide-blocks');
    expect(getLucideIcon('PencilRuler')).toBe(Icon);
  });

  it.each([
    ['Building2', 'building2', 'building-2', 'lucide-building-2'],
    ['ArrowUpAZ', 'arrowupaz', 'arrow-up-a-z', 'lucide-arrow-up-a-z'],
  ])(
    'loads %s and reuses its filename aliases',
    async (pascalName, lowercaseName, kebabName, expectedClass) => {
      const Icon = getLucideIcon(pascalName);

      expect(Icon).toBeDefined();
      expect(getLucideIcon(lowercaseName)).toBe(Icon);
      expect(getLucideIcon(kebabName)).toBe(Icon);
      expect(getLucideIcon(`${pascalName}Icon`)).toBe(Icon);

      const wrapper = mountIcon(Icon!);
      const html = await waitForIconHtml(() => wrapper.html(), expectedClass);

      expect(html).toContain(expectedClass);
      expect(html).not.toContain('lucide-blocks');
    },
  );

  it('returns undefined for empty names', () => {
    expect(getLucideIcon('')).toBeUndefined();
    expect(getLucideIcon('   ')).toBeUndefined();
  });

  it('renders Blocks immediately for unknown icon names', () => {
    const first = getLucideIcon('DefinitelyNotARealLucideIcon');
    const second = getLucideIcon('DefinitelyNotARealLucideIcon');

    expect(first).toBeDefined();
    expect(second).toBe(first);

    const wrapper = mountIcon(first!);

    expect(wrapper.html()).toContain('lucide-blocks');
    expect(getLucideIcon('DefinitelyNotARealLucideIcon')).toBe(first);
  });
});
