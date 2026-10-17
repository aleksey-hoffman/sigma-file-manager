// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/** 权限档位。字符串与 Rust 侧 `AgentMode::as_str` 一一对应，改一处要改两处。 */
export type McpAgentMode = 'off' | 'readOnly' | 'writable' | 'askEachTime';

export const MCP_AGENT_MODES: McpAgentMode[] = ['off', 'readOnly', 'writable', 'askEachTime'];

export interface McpStatus {
  running: boolean;
  mode: string;
  port: number | null;
  endpoint: string | null;
  token: string | null;
  activeClients: number;
  totalRequests: number;
}

export interface McpAuditEntry {
  timestamp: number;
  tool: string;
  summary: string;
  outcome: 'allowed' | 'denied' | 'error';
  detail?: string | null;
}

/**
 * 支持一键部署的客户端标识。与 Rust 侧 `McpClientKind::id()` 一一对应。
 * 显示名走 i18n，不要在这里硬编码 —— 同一个 id 在 17 个语言包里都有名字。
 */
export type McpClientId
  = | 'codex'
    | 'cursor'
    | 'claudeCode'
    | 'claudeDesktop'
    | 'openclaw'
    | 'minimaxCode';

export const MCP_CLIENT_IDS: McpClientId[] = [
  'codex',
  'cursor',
  'claudeCode',
  'claudeDesktop',
  'openclaw',
  'minimaxCode',
];

export interface McpClientState {
  id: McpClientId;
  /** 这台机器上装没装（判据是配置目录或配置文件存在，不是找 exe）。 */
  detected: boolean;
  /** 配置里是不是已经有我们的条目。 */
  installed: boolean;
  configPath: string;
}

export interface McpDeployOutcome {
  configPath: string;
  backupPath?: string;
  /** 内容是否真的变了。重复点同一个按钮会是 false。 */
  changed: boolean;
}

export const useMcpStore = defineStore('mcp', () => {
  const status = ref<McpStatus>({
    running: false,
    mode: 'off',
    port: null,
    endpoint: null,
    token: null,
    activeClients: 0,
    totalRequests: 0,
  });

  const auditLog = ref<McpAuditEntry[]>([]);
  const clients = ref<McpClientState[]>([]);
  const isLoading = ref(false);
  const isApplying = ref(false);
  const errorMessage = ref<string | null>(null);
  /** 正在写配置的客户端 id。用来只让被点的那颗按钮转圈。 */
  const deployingClient = ref<McpClientId | null>(null);

  const agentMode = computed<McpAgentMode>(() => {
    const mode = status.value.mode;
    return MCP_AGENT_MODES.includes(mode as McpAgentMode) ? (mode as McpAgentMode) : 'off';
  });

  const isEnabled = computed(() => status.value.running);

  async function refresh() {
    isLoading.value = true;

    try {
      status.value = await invoke<McpStatus>('mcp_get_status');
      errorMessage.value = null;
    }
    catch (error) {
      // 读不到状态时必须显式报错，而不是把上一次的 running=true 继续显示成
      // 「服务开着」—— 用户会据此以为 AI 还能连。
      errorMessage.value = String(error);
    }
    finally {
      isLoading.value = false;
    }
  }

  async function refreshAuditLog() {
    try {
      auditLog.value = await invoke<McpAuditEntry[]>('mcp_get_audit_log', { limit: 50 });
    }
    catch {
      auditLog.value = [];
    }
  }

  async function setAgentMode(mode: McpAgentMode) {
    isApplying.value = true;

    try {
      status.value = await invoke<McpStatus>('mcp_set_mode', { mode });
      errorMessage.value = null;
      await refreshAuditLog();
    }
    catch (error) {
      errorMessage.value = String(error);
      await refresh();
    }
    finally {
      isApplying.value = false;
    }
  }

  async function rotateToken() {
    isApplying.value = true;

    try {
      status.value = await invoke<McpStatus>('mcp_rotate_token');
      errorMessage.value = null;
    }
    catch (error) {
      errorMessage.value = String(error);
      await refresh();
    }
    finally {
      isApplying.value = false;
    }
  }

  async function fetchClientConfig(): Promise<string | null> {
    if (!status.value.running) {
      return null;
    }

    try {
      const config = await invoke<{
        snippet: string;
        port: number;
      }>('mcp_get_client_config');
      return config.snippet;
    }
    catch (error) {
      errorMessage.value = String(error);
      return null;
    }
  }

  /**
   * 把收藏分类推给 Rust 侧。
   *
   * 收藏数据在 `user-stats.json`，而那个文件的位置用户可以自定义 ——
   * Rust 自己拼路径会读错文件，所以由前端给。
   * 失败不抛：MCP 是可选功能，收藏同步失败不该影响收藏本身的使用。
   */
  async function syncFavorites(categories: unknown[]): Promise<void> {
    try {
      await invoke('mcp_sync_favorites', { categories });
    }
    catch (error) {
      console.warn('[mcp] failed to sync favorites:', error);
    }
  }

  /**
   * 读各客户端的部署现状。
   *
   * 读失败不清空列表：把「探测不到」显示成「没装任何客户端」是误导 ——
   * 前者是我们自己的问题，后者是用户的问题。
   */
  async function refreshClients() {
    try {
      clients.value = await invoke<McpClientState[]>('mcp_list_clients');
    }
    catch (error) {
      errorMessage.value = String(error);
    }
  }

  /**
   * 把本服务写进某个客户端的配置。
   *
   * 写的是**别的软件的配置文件**，所以返回值里带 `backupPath` 与 `configPath`，
   * 由界面原样告诉用户改了哪个文件 —— 用户需要知道我们碰了他的东西。
   */
  async function installClient(client: McpClientId): Promise<McpDeployOutcome | null> {
    deployingClient.value = client;

    try {
      const outcome = await invoke<McpDeployOutcome>('mcp_install_client', { client });
      await refreshClients();
      return outcome;
    }
    catch (error) {
      errorMessage.value = String(error);
      await refreshClients();
      return null;
    }
    finally {
      deployingClient.value = null;
    }
  }

  async function uninstallClient(client: McpClientId): Promise<McpDeployOutcome | null> {
    deployingClient.value = client;

    try {
      const outcome = await invoke<McpDeployOutcome>('mcp_uninstall_client', { client });
      await refreshClients();
      return outcome;
    }
    catch (error) {
      errorMessage.value = String(error);
      await refreshClients();
      return null;
    }
    finally {
      deployingClient.value = null;
    }
  }

  return {
    status,
    auditLog,
    clients,
    isLoading,
    isApplying,
    errorMessage,
    deployingClient,
    agentMode,
    isEnabled,
    refresh,
    refreshAuditLog,
    refreshClients,
    setAgentMode,
    rotateToken,
    fetchClientConfig,
    syncFavorites,
    installClient,
    uninstallClient,
  };
});
