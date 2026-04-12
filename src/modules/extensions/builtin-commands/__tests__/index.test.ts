// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';

const { routerPushMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/stores/runtime/quick-view', () => ({
  useQuickViewStore: () => ({
    openFileFromMainWindow: vi.fn(),
    closeWindow: vi.fn(),
  }),
}));

vi.mock('@/router', () => ({
  default: {
    push: routerPushMock,
  },
}));

import { getBuiltinCommandHandler } from '@/modules/extensions/builtin-commands';

describe('extension builtin commands', () => {
  it('opens extension pages through the router', async () => {
    const handler = getBuiltinCommandHandler('sigma.app.openExtensionPage');

    await expect(handler?.('sigma.excalidraw.excalidraw')).resolves.toBeUndefined();
    expect(routerPushMock).toHaveBeenCalledWith({
      name: 'extension-page',
      params: {
        fullPageId: 'sigma.excalidraw.excalidraw',
      },
    });
  });
});
