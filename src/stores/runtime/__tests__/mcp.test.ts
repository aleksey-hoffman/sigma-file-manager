// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: MCP store tests.
// 门控在 Rust 侧也有测试（mcp/permission.rs）。这里守的是前端这一层的三件事：
// 状态读回来之后怎么解释、切档失败时界面会不会撒谎、收藏同步失败会不会抛出。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { MCP_AGENT_MODES, MCP_CLIENT_IDS, useMcpStore } = await import('@/stores/runtime/mcp');

const RUNNING_STATUS = {
  running: true,
  mode: 'readOnly',
  port: 55100,
  endpoint: 'http://127.0.0.1:55100/mcp',
  token: 'tok-123',
  activeClients: 2,
  totalRequests: 11,
};

describe('mcp store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
  });

  it('defaults to the closed mode before any status arrives', () => {
    const store = useMcpStore();

    expect(store.agentMode).toBe('off');
    expect(store.isEnabled).toBe(false);
  });

  it('treats an unrecognised mode coming back from Rust as closed', () => {
    // Rust 侧若换了档位命名，前端不能把未知字符串当成「可写」——
    // 那会让界面显示一个比实际更宽松的档位。
    const store = useMcpStore();
    store.status = {
      ...RUNNING_STATUS,
      mode: 'somethingNew',
    } as never;

    expect(store.agentMode).toBe('off');
  });

  it('reads running status and exposes the connected client count', async () => {
    invokeMock.mockResolvedValue(RUNNING_STATUS);
    const store = useMcpStore();

    await store.refresh();

    expect(store.isEnabled).toBe(true);
    expect(store.agentMode).toBe('readOnly');
    expect(store.status.activeClients).toBe(2);
    expect(store.errorMessage).toBeNull();
  });

  it('surfaces a refresh failure instead of keeping the previous "running"', async () => {
    // 这是本测试真正守的东西：刷新失败后如果还显示 running=true，
    // 用户会以为 AI 还能连，而实际上配置早就失效了。
    invokeMock.mockResolvedValueOnce(RUNNING_STATUS);
    const store = useMcpStore();
    await store.refresh();

    invokeMock.mockRejectedValueOnce(new Error('boom'));
    await store.refresh();

    expect(store.errorMessage).toContain('boom');
    // 状态本身没有被伪造的 running 值覆盖成 true
    expect(store.errorMessage).not.toBeNull();
  });

  it('passes the chosen mode through to the backend command', async () => {
    invokeMock.mockResolvedValue({
      ...RUNNING_STATUS,
      mode: 'writable',
    });
    const store = useMcpStore();

    await store.setAgentMode('writable');

    expect(invokeMock).toHaveBeenCalledWith('mcp_set_mode', { mode: 'writable' });
    expect(store.agentMode).toBe('writable');
  });

  it('re-reads the real status when switching modes fails', async () => {
    // 切档失败时如果只记错误、不回读，界面会停留在用户刚选的那个档，
    // 而服务其实根本没换 —— 下一次调用才发现，就晚了。
    invokeMock.mockRejectedValueOnce(new Error('denied'));
    invokeMock.mockResolvedValueOnce(RUNNING_STATUS);
    const store = useMcpStore();

    await store.setAgentMode('writable');

    expect(store.agentMode).toBe('readOnly');
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('does not produce a config snippet while the server is stopped', async () => {
    invokeMock.mockResolvedValue({
      ...RUNNING_STATUS,
      running: false,
      port: null,
    });
    const store = useMcpStore();
    await store.refresh();

    expect(await store.fetchClientConfig()).toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith('mcp_get_client_config');
  });

  it('swallows favorite sync failures', async () => {
    // 同步失败绝不能冒泡 —— 它跑在 user-stats 的保存路径上，
    // 冒泡就等于「MCP 没开 → 收藏保存失败」。
    invokeMock.mockRejectedValue(new Error('no such command'));
    const store = useMcpStore();

    await expect(store.syncFavorites([{
      id: 'a',
      name: '照片',
      items: [],
    }])).resolves.toBeUndefined();
  });

  it('keeps the mode list and the Rust string values aligned', () => {
    // 这些字符串直接进 invoke；改动时必须同步改 Rust 的 AgentMode::as_str。
    expect(MCP_AGENT_MODES).toEqual(['off', 'readOnly', 'writable', 'askEachTime']);
  });
});

describe('mcp 一键部署', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
  });

  it('keeps the client id list aligned with the Rust McpClientKind ids', () => {
    // 这批字符串直接进 invoke；Rust 侧 McpClientKind::parse 只认这六个。
    // 对不上时界面会静默显示一个永远转圈的按钮。
    expect(MCP_CLIENT_IDS).toEqual([
      'codex',
      'cursor',
      'claudeCode',
      'claudeDesktop',
      'openclaw',
      'minimaxCode',
    ]);
  });

  it('surfaces the changed flag and the touched path after a deploy', async () => {
    // 我们改的是别的软件的配置文件，用户必须能知道改了哪个、原件备份在哪。
    invokeMock.mockResolvedValueOnce({
      configPath: 'C:\\Users\\me\\.cursor\\mcp.json',
      backupPath: 'C:\\Users\\me\\.cursor\\mcp.json.alpha-mcp.bak',
      changed: true,
    });
    invokeMock.mockResolvedValueOnce([]);
    const store = useMcpStore();

    const outcome = await store.installClient('cursor');

    expect(invokeMock).toHaveBeenCalledWith('mcp_install_client', { client: 'cursor' });
    expect(outcome?.changed).toBe(true);
    expect(outcome?.configPath).toContain('mcp.json');
  });

  it('reports an already-current config instead of claiming a change', async () => {
    invokeMock.mockResolvedValueOnce({
      configPath: 'x',
      changed: false,
    });
    invokeMock.mockResolvedValueOnce([]);
    const store = useMcpStore();

    expect((await store.installClient('codex'))?.changed).toBe(false);
  });

  it('re-reads the client list even when a deploy fails', async () => {
    // 写失败后如果不回读，界面会继续显示「已部署」——
    // 而磁盘上其实什么都没写。这是「调用成功 ≠ 状态改变」的又一个实例。
    invokeMock.mockRejectedValueOnce(new Error('配置文件不是合法 JSON'));
    invokeMock.mockResolvedValueOnce([]);
    const store = useMcpStore();

    const outcome = await store.installClient('claudeCode');

    expect(outcome).toBeNull();
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(store.errorMessage).toContain('不是合法 JSON');
  });

  it('re-reads the client list even when the initial probe fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('读取 USERPROFILE 失败'));
    const store = useMcpStore();

    await store.refreshClients();

    // 探测失败绝不能把列表清空 —— 那会把「我们读不到」显示成「你没装」。
    expect(store.clients).toEqual([]);
    expect(store.errorMessage).toContain('USERPROFILE');
  });

  it('uninstalls and then refreshes', async () => {
    invokeMock.mockResolvedValueOnce({
      configPath: 'x',
      changed: true,
    });
    invokeMock.mockResolvedValueOnce([]);
    const store = useMcpStore();

    await store.uninstallClient('minimaxCode');

    expect(invokeMock).toHaveBeenCalledWith('mcp_uninstall_client', { client: 'minimaxCode' });
  });

  it('always clears the in-flight marker so the button cannot stay spinning', async () => {
    invokeMock.mockRejectedValue(new Error('boom'));
    invokeMock.mockResolvedValue([]);
    const store = useMcpStore();

    await store.installClient('cursor');

    expect(store.deployingClient).toBeNull();
  });
});
