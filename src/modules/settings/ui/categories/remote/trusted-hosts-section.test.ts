// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-18：已信任主机分区（阶段 2 决策 3）。
//
// 这个测试盯的是**接线与状态切换**，纯函数部分在
// `src/utils/__tests__/remote-directory.test.ts`。
//
// 刻意包含一条「读失败不许显示成空列表」的用例：这一区只有一行「你还没信任过
// 任何主机」的时候，「读不到」与「真的没有」长得一模一样，而两者的处置完全相反
// —— 前者要重试，后者什么都不用做。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TrustedHostsSection from '@/modules/settings/ui/categories/remote/trusted-hosts-section.vue';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...(args as [string, unknown?])),
}));

// 整个 barrel 换成替身：`@/modules/settings` 的 index 会把 pages/settings.vue 与
// nav.vue 都导出进来，一路拖到 router，在测试环境里直接 `routes is not iterable` 崩。
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

/**
 * i18n 打回键名，断言直接对键、不受翻译影响。
 *
 * 这正是「键拼错」这一类缺陷的最佳阳性对照：真键名渲染成键名本身，
 * 拼错的键会渲染成另一个键名，肉眼在界面上也看不出来。
 */
function createI18nStubPlugin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createI18n } = require('vue-i18n');

  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackWarn: false,
    missingWarn: false,
    messages: {} as Record<string, unknown>,
  });
}

const HOSTS = [
  {
    host: '192.168.1.9',
    port: 22,
    fingerprint: 'SHA256:one',
    keyType: 'Ed25519',
    addedAt: 1_700_000_000_000,
    kind: 'ssh' as const,
  },
  {
    host: 'files.example.com',
    port: 2222,
    fingerprint: 'SHA256:two',
    keyType: 'RsaSha2_256',
    addedAt: 1_700_000_100_000,
    kind: 'x509' as const,
  },
];

function mountSection() {
  return mount(TrustedHostsSection, {
    global: { plugins: [createI18nStubPlugin()] },
  });
}

describe('已信任主机分区', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        return HOSTS;
      }

      if (command === 'remote_forget_host') {
        return true;
      }

      return undefined;
    });
  });

  it('挂载时读一次列表', async () => {
    mountSection();
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('remote_list_known_hosts');
  });

  it('每条记录都列出主机、端口与指纹', async () => {
    const wrapper = mountSection();
    await flushPromises();

    const entries = wrapper.findAll('[data-test^="trusted-host-"]');

    expect(entries).toHaveLength(2);
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').text())
      .toContain('192.168.1.9:22');
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').text())
      .toContain('SHA256:one');
    expect(wrapper.find('[data-test="trusted-host-files.example.com-2222-x509"]').text())
      .toContain('SHA256:two');
  });

  it('算法名与各自的指纹显示在同一行', async () => {
    // 只给指纹不够：同一台主机换算法时指纹必然不同，
    // 没有算法名用户分不清「服务器重装」与「被换掉了公钥」。
    //
    // 断言要**逐条**对，不能把两条记录的文本合起来查 —— 那样
    // 「第一条显示了第二条的算法名」也会通过。
    const wrapper = mountSection();
    await flushPromises();

    const first = wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').text();
    const second = wrapper.find('[data-test="trusted-host-files.example.com-2222-x509"]').text();

    expect(first).toContain('Ed25519');
    expect(first).not.toContain('RsaSha2_256');
    expect(second).toContain('RsaSha2_256');
  });

  it('空列表显示空状态', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        return [];
      }

      return undefined;
    });

    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.find('[data-test="trusted-hosts-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="trusted-hosts-list"]').exists()).toBe(false);
  });

  it('读失败显示错误，不伪装成空列表', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        throw {
          kind: 'permission',
          message: '读不到',
        };
      }

      return undefined;
    });

    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.find('[data-test="trusted-hosts-error"]').exists()).toBe(true);
    // 阳性对照：空状态**不能**同时出现，否则「读不到」会被读成「你没信任过」。
    expect(wrapper.find('[data-test="trusted-hosts-empty"]').exists()).toBe(false);
  });

  it('后端返回的不是数组时也走错误分支，不让渲染期崩掉', async () => {
    // 契约破掉时，整个设置分类因为一个无关子区块白屏，比什么都不显示更糟 ——
    // 尤其这一区是用户事后收紧信任的唯一入口。
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        return undefined;
      }

      return undefined;
    });

    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.find('[data-test="trusted-hosts-error"]').exists()).toBe(true);
  });

  it('点删除走 remote_forget_host，并只带走那一条的 host/port', async () => {
    // 两条记录的端口不同，参数传错在界面上看不出来，所以必须对参数本身断言。
    const wrapper = mountSection();
    await flushPromises();

    await wrapper.find('[data-test="forget-trusted-host-192.168.1.9-22-ssh"]').trigger('click');
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('remote_forget_host', {
      host: '192.168.1.9',
      port: 22,
      kind: 'ssh',
    });
  });

  it('删除后那一条从列表里消失，另一条留着', async () => {
    const wrapper = mountSection();
    await flushPromises();

    await wrapper.find('[data-test="forget-trusted-host-192.168.1.9-22-ssh"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="trusted-host-files.example.com-2222-x509"]').exists()).toBe(true);
  });

  it('同一台主机的 SSH 与证书是两行，删一行不动另一行', async () => {
    // 键是 `(host, port, kind)` 三元。漏掉 kind 的话，点掉证书那行
    // 会把 SSH 那行也删掉 —— 而用户想收紧的是**一条**信任。
    const sameEndpoint = [
      { ...HOSTS[0] },
      {
        ...HOSTS[0],
        fingerprint: 'SHA256:cert',
        kind: 'x509' as const,
      },
    ];

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        return sameEndpoint;
      }

      if (command === 'remote_forget_host') {
        return true;
      }

      return undefined;
    });

    const wrapper = mountSection();
    await flushPromises();

    // 两行都在，而且各自可点。
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-x509"]').exists()).toBe(true);

    await wrapper.find('[data-test="forget-trusted-host-192.168.1.9-22-x509"]').trigger('click');
    await flushPromises();

    // **关键断言**：传出去的那条命令必须带 kind='x509'。
    expect(invokeMock).toHaveBeenCalledWith('remote_forget_host', {
      host: '192.168.1.9',
      port: 22,
      kind: 'x509',
    });
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-x509"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').exists()).toBe(true);
  });

  it('删除后**不**重新拉全量', async () => {
    // 删除是确定性的本地变换，再发一次请求只会让整张列表闪一下。
    const wrapper = mountSection();
    await flushPromises();

    const readsBefore = invokeMock.mock.calls
      .filter(call => call[0] === 'remote_list_known_hosts').length;

    await wrapper.find('[data-test="forget-trusted-host-192.168.1.9-22-ssh"]').trigger('click');
    await flushPromises();

    const readsAfter = invokeMock.mock.calls
      .filter(call => call[0] === 'remote_list_known_hosts').length;

    expect(readsBefore).toBe(1);
    expect(readsAfter).toBe(1);
  });

  it('删除失败时那一行留在原处，列表不被错误提示顶掉', async () => {
    // 列表是用户「我还信任了谁」的唯一事实来源。
    // 曾经把读错误与删除错误合成一个字段，结果 `v-if` 在删除失败时
    // 把整张列表换成了错误提示 —— 用户刚点删除，屏幕上却连还剩哪些都看不见。
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_list_known_hosts') {
        return HOSTS;
      }

      if (command === 'remote_forget_host') {
        throw {
          kind: 'permission',
          message: '文件被占用',
        };
      }

      return undefined;
    });

    const wrapper = mountSection();
    await flushPromises();

    await wrapper.find('[data-test="forget-trusted-host-192.168.1.9-22-ssh"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="trusted-host-192.168.1.9-22-ssh"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="trusted-host-files.example.com-2222-x509"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="trusted-hosts-mutation-error"]').exists()).toBe(true);
  });
});
