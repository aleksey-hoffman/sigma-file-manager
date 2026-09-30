// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: mockInvoke,
}));

import {
  getCoverDrawRect,
  getInfusionRasterSize,
  prepareInfusionImage,
} from '../use-prepared-infusion-image';

describe('prepared infusion images', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockInvoke.mockReset();
  });

  it('bounds raster dimensions without upscaling small windows', () => {
    expect(getInfusionRasterSize(2560, 1440)).toEqual({
      width: 1200,
      height: 675,
    });
    expect(getInfusionRasterSize(800, 600)).toEqual({
      width: 800,
      height: 600,
    });
    expect(getInfusionRasterSize(0, 600)).toBeNull();
  });

  it('calculates an object-cover draw rectangle', () => {
    expect(getCoverDrawRect(4000, 4000, 1200, 675)).toEqual({
      x: 0,
      y: -262.5,
      width: 1200,
      height: 1200,
    });
  });

  it('prepares a bounded raster and scales the native blur radius', async () => {
    const drawImage = vi.fn();
    const closeImage = vi.fn();
    const canvasContext = {
      drawImage,
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(['image'])),
    }));
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 4000,
      height: 4000,
      close: closeImage,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,cHJlcGFyZWQ=');
    mockInvoke.mockResolvedValue('/tmp/generated-infusion.jpg');

    const result = await prepareInfusionImage({
      src: 'asset://background.jpg',
      containerWidth: 2560,
      containerHeight: 1440,
      blur: 64,
      contrast: 110,
      brightness: 90,
      noiseIntensity: 0.5,
      noiseOpacity: 0.05,
      noiseScale: 0.5,
    });

    expect(result).toBe('asset:///tmp/generated-infusion.jpg');
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      -262.5,
      1200,
      1200,
    );
    expect(mockInvoke).toHaveBeenCalledWith('generate_infusion_image', {
      imageDataUrl: 'data:image/jpeg;base64,cHJlcGFyZWQ=',
      blur: 30,
      contrast: 110,
      brightness: 90,
      noiseStrength: 0.025,
      noiseScale: 0.5,
    });
    expect(closeImage).toHaveBeenCalledOnce();
  });
});
