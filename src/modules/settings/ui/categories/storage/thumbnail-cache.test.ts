// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 这组测试盯的是缩略图缓存设置项的三个最容易回归的点：
//
// 1. **command 名字**：`get_thumbnail_cache_stats` / `clear_thumbnail_cache`
//    在 Rust 侧注册，改名不会让 `npm run ts` 报错，只会在用户点下去时 404。
//    command 层的测试构造不出 AppHandle（tauri feature 不含 test），
//    所以这里直接断言前端 invoke 的字符串与 Rust 侧一致。
// 2. **确认弹窗**：清理是不可撤销的破坏性操作，必须先确认才真正执行。
// 3. **错误不得静默吞掉**：读不到统计时不能把上一次的数字继续显示成「当前占用」，
//    否则用户清理完会以为没生效。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type * as VueI18nModule from 'vue-i18n';
import { flushPromises, mount } from '@vue/test-utils';
import ThumbnailCache from '@/modules/settings/ui/categories/storage/thumbnail-cache.vue';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/modules/settings', () => ({
  SettingsItem: {
    props: ['title', 'description', 'icon'],
    template: `
      <section class="settings-view-item">
        <slot name="title-suffix" />
        <slot />
      </section>
    `,
  },
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// 不 mock Dialog：真实的 Dialog（reka-ui）会把内容 portal 到 body，
// 只在打开时渲染。用 attachTo 挂到 document.body 后直接查询 portal 里的节点，
// 这样断言的是真实交互（关闭时确实没有确认按钮），而不是替身的行为。

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof VueI18nModule>();

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

/** 让 invoke 按 command 名分派返回值。 */
function mockCommands(overrides: {
  stats?: unknown;
  clear?: unknown;
} = {}) {
  invokeMock.mockImplementation((command: string) => {
    if (command === 'get_thumbnail_cache_stats') {
      return overrides.stats instanceof Error
        ? Promise.reject(overrides.stats)
        : Promise.resolve(overrides.stats ?? {
            itemCount: 12,
            sizeBytes: 6722193,
          });
    }

    if (command === 'clear_thumbnail_cache') {
      return overrides.clear instanceof Error
        ? Promise.reject(overrides.clear)
        : Promise.resolve(undefined);
    }

    return Promise.reject(new Error(`unexpected command: ${command}`));
  });
}

function statValue(wrapper: ReturnType<typeof mount>, index: number): string {
  return wrapper.findAll('.thumbnail-cache__stat-value')[index].text();
}

describe('thumbnail cache setting', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('reads the cache stats through get_thumbnail_cache_stats on mount', async () => {
    mockCommands();

    const wrapper = mount(ThumbnailCache);
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('get_thumbnail_cache_stats');
    expect(statValue(wrapper, 0)).toBe(formatBytes(6722193));
    expect(statValue(wrapper, 1)).toBe('12');
  });

  it('renders the shared byte formatter rather than its own', async () => {
    mockCommands({
      stats: {
        itemCount: 1,
        sizeBytes: 0,
      },
    });

    const wrapper = mount(ThumbnailCache);
    await flushPromises();

    // 复用项目既有工具，格式化结果必须与 formatBytes 完全一致。
    expect(statValue(wrapper, 0)).toBe(formatBytes(0));
    expect(statValue(wrapper, 0)).toBe('0 B');
  });

  it('does not clear the cache until the confirmation is accepted', async () => {
    mockCommands();

    const wrapper = mount(ThumbnailCache, { attachTo: document.body });
    await flushPromises();
    invokeMock.mockClear();

    // 确认弹窗默认是关的：portal 里不应该有它的内容。
    expect(document.body.querySelector('.thumbnail-cache__confirm-dialog')).toBeNull();

    await wrapper.get('.thumbnail-cache__actions button').trigger('click');
    await flushPromises();

    // 点开确认弹窗这一步不允许触发任何清理调用。
    expect(invokeMock).not.toHaveBeenCalledWith('clear_thumbnail_cache');

    const dialog = document.body.querySelector('.thumbnail-cache__confirm-dialog');
    expect(dialog, '确认弹窗应当被打开').not.toBeNull();

    // 文案要写明图片与视频缩略图都会一起被清掉。
    expect(dialog?.textContent).toContain('settings.storage.thumbnailCache.confirmDescription');
    expect(dialog?.textContent).toContain('cancel');

    // 走确认流程。注意：DialogContent 会在 slot 之后追加一个「关闭」按钮，
    // 所以不能按位置取最后一个 button，要按文案找破坏性确认按钮。
    const confirmButton = [...dialog!.querySelectorAll('button')].find(button =>
      button.textContent?.includes('settings.storage.thumbnailCache.clear'),
    );
    expect(confirmButton, '确认弹窗里应当有清理按钮').toBeDefined();
    confirmButton!.click();
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('clear_thumbnail_cache');
    // 清理后要重新读一次占用，让界面归零。
    expect(invokeMock).toHaveBeenCalledWith('get_thumbnail_cache_stats');

    wrapper.unmount();
  });

  it('surfaces a failing stats read instead of keeping stale numbers', async () => {
    mockCommands({ stats: new Error('boom') });

    const wrapper = mount(ThumbnailCache);
    await flushPromises();

    expect(wrapper.get('.thumbnail-cache__error').text()).toContain('boom');
    // 读失败时必须显示「未知」，不能继续显示上一次的占用。
    expect(statValue(wrapper, 0)).toBe('settings.storage.thumbnailCache.sizeUnknown');
    expect(statValue(wrapper, 1)).toBe('settings.storage.thumbnailCache.countUnknown');
  });

  it('surfaces a failing clear instead of reporting success', async () => {
    mockCommands({ clear: new Error('clear failed') });

    const wrapper = mount(ThumbnailCache, { attachTo: document.body });
    await flushPromises();

    await wrapper.get('.thumbnail-cache__actions button').trigger('click');
    await flushPromises();

    const dialog = document.body.querySelector('.thumbnail-cache__confirm-dialog');
    const confirmButton = [...dialog!.querySelectorAll('button')].find(button =>
      button.textContent?.includes('settings.storage.thumbnailCache.clear'),
    );
    confirmButton!.click();
    await flushPromises();

    expect(wrapper.get('.thumbnail-cache__error').text()).toContain('clear failed');

    wrapper.unmount();
  });

  it('mentions both image and video thumbnails in the confirmation copy', async () => {
    const messages = await import('@/localization/messages/en.json');

    const confirmDescription = messages.default.settings.storage.thumbnailCache.confirmDescription;
    const description = messages.default.settings.storage.thumbnailCache.description;

    // 清理会连带删掉视频缩略图（两者共用 cache_dir），
    // 文案不写清楚用户会当成 bug。
    expect(confirmDescription.toLowerCase()).toContain('image');
    expect(confirmDescription.toLowerCase()).toContain('video');
    expect(description.toLowerCase()).toContain('image');
    expect(description.toLowerCase()).toContain('video');
  });
});
