// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const {
  translateMock,
  invokeAsExtensionMock,
} = vi.hoisted(() => ({
  translateMock: vi.fn(),
  invokeAsExtensionMock: vi.fn(),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: translateMock,
      mergeLocaleMessage: vi.fn(),
      locale: {
        value: 'en',
      },
    },
  },
}));

vi.mock('@/localization/data', () => ({
  messages: {
    en: {},
    fr: {},
  },
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

import { createI18nAPI } from '@/modules/extensions/api/create-i18n-api';

describe('createI18nAPI', () => {
  beforeEach(() => {
    translateMock.mockReset();
    invokeAsExtensionMock.mockReset();
  });

  it('returns the original key when an extension translation is missing and no fallback is provided', () => {
    translateMock.mockImplementation((key: string) => key);

    const api = createI18nAPI({
      extensionId: 'sigma.video-downloader',
      t: translateMock,
    } as never);

    expect(api.extensionT('missingKey')).toBe('missingKey');
    expect(translateMock).toHaveBeenCalledWith('extensions.sigma.video-downloader.missingKey', undefined);
  });

  it('uses the provided fallback when extensionT cannot resolve a key', () => {
    translateMock.mockImplementation((key: string) => key);

    const api = createI18nAPI({
      extensionId: 'sigma.video-downloader',
      t: translateMock,
    } as never);

    expect(
      api.extensionT(
        'downloadingWithCookies',
        { cookieSource: 'cookies' },
        api.formatMessage('Downloading with {cookieSource}...', { cookieSource: 'cookies' }),
      ),
    ).toBe('Downloading with cookies...');
  });

  it('returns translated extension messages when they exist', () => {
    translateMock.mockImplementation((key: string) => {
      if (key === 'extensions.sigma.video-downloader.downloadComplete') {
        return 'Download complete';
      }

      return key;
    });

    const api = createI18nAPI({
      extensionId: 'sigma.video-downloader',
      t: translateMock,
    } as never);

    expect(api.extensionT('downloadComplete')).toBe('Download complete');
  });
});
