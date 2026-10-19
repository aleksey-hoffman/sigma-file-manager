// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount } from '@vue/test-utils';
import {
  beforeAll, describe, expect, it, vi,
} from 'vitest';
import Infusion from '../infusion.vue';

function mountInfusion(props: Record<string, unknown> = {}) {
  return mount(Infusion, {
    props: {
      src: 'background.jpg',
      noiseIntensity: 0,
      opacity: 0.2,
      ...props,
    },
  });
}

describe('Infusion blend modes', () => {
  beforeAll(() => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('renders normal without any blend mode or fill', () => {
    const wrapper = mountInfusion();
    const container = wrapper.get('.infusion-container').element as HTMLElement;

    expect(container.style.mixBlendMode).toBe('');
    expect(wrapper.find('.infusion-tint').exists()).toBe(false);
    expect((wrapper.get('.infusion-media').element as HTMLElement).style.mixBlendMode).toBe('');
    expect(container.style.getPropertyValue('--infusion-opacity')).toBe('0.2');
  });

  it('ignores the fill color while the mode is normal', () => {
    const wrapper = mountInfusion({
      blendMode: 'normal',
      blendTarget: 'fill',
    });

    expect(wrapper.find('.infusion-tint').exists()).toBe(false);
    expect((wrapper.get('.infusion-container').element as HTMLElement).style.mixBlendMode).toBe('');
  });

  it('blends the whole layer with the interface for the ui target', () => {
    const wrapper = mountInfusion({
      blendMode: 'multiply',
      blendTarget: 'ui',
    });

    expect((wrapper.get('.infusion-container').element as HTMLElement).style.mixBlendMode).toBe('multiply');
    expect(wrapper.find('.infusion-tint').exists()).toBe(false);
    expect((wrapper.get('.infusion-media').element as HTMLElement).style.mixBlendMode).toBe('');
  });

  it('blends the media with the fill color inside the group for the fill target', () => {
    const wrapper = mountInfusion({
      blendMode: 'overlay',
      blendTarget: 'fill',
      blendTint: '#ec4899',
    });
    const group = wrapper.get('.infusion-blend-group');
    const [tint, media] = group.element.children as unknown as HTMLElement[];

    expect((wrapper.get('.infusion-container').element as HTMLElement).style.mixBlendMode).toBe('');
    expect(tint.classList.contains('infusion-tint')).toBe(true);
    expect(tint.style.backgroundColor).toBe('rgb(236, 72, 153)');
    expect(media.classList.contains('infusion-media')).toBe(true);
    expect(media.style.mixBlendMode).toBe('overlay');
  });

  it('keeps the same video element when the mode or target changes', async () => {
    const wrapper = mountInfusion({
      src: 'background.mp4',
      type: 'video',
    });
    const video = wrapper.get('video').element;

    await wrapper.setProps({
      blendMode: 'screen',
      blendTarget: 'ui',
    });
    expect(wrapper.get('video').element).toBe(video);

    await wrapper.setProps({ blendTarget: 'fill' });
    expect(wrapper.get('video').element).toBe(video);
    expect(wrapper.find('.infusion-tint').exists()).toBe(true);

    await wrapper.setProps({ blendMode: 'normal' });
    expect(wrapper.get('video').element).toBe(video);
    expect(wrapper.find('.infusion-tint').exists()).toBe(false);
  });
});
