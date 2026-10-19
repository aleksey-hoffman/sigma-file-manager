// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount } from '@vue/test-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import Infusion from '../infusion.vue';

describe('infusion rendering', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create a live CSS filter for static images', () => {
    const wrapper = mount(Infusion, {
      props: {
        src: 'background.jpg',
        blur: 64,
        noiseIntensity: 0,
      },
    });

    expect(wrapper.find('.infusion-media--filtered').exists()).toBe(false);
    wrapper.unmount();
  });

  it('enables the live media filter for video when blur is visible', () => {
    const wrapper = mount(Infusion, {
      props: {
        src: 'background.mp4',
        type: 'video',
        blur: 64,
        noiseIntensity: 0,
      },
    });

    expect(wrapper.get('.infusion-video').classes()).toContain('infusion-media--filtered');
    wrapper.unmount();
  });
});
