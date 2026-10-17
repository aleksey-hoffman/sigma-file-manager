<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CopyIcon,
  DownloadIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TerminalIcon,
  Trash2Icon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { SettingsItem } from '@/modules/settings';
import {
  MCP_AGENT_MODES,
  useMcpStore,
  type McpAgentMode,
  type McpClientId,
} from '@/stores/runtime/mcp';

const { t } = useI18n();
const mcpStore = useMcpStore();

const isCopied = ref(false);
const isRotating = ref(false);
/**
 * 刚部署完、需要重启客户端才生效的目标。
 *
 * 刻意做成常驻状态而不是只弹一次 toast：用户点完按钮多半是**切到那个客户端去看**，
 * 3 秒后消失的 toast 他根本看不到，于是只会得到「配了但没反应」的结论。
 * 上一轮就是这么被当成 bug 报上来的。
 */
const restartPending = ref<{
  client: string;
  path: string;
  backup: string;
} | null>(null);

const modeOptions = computed(() =>
  MCP_AGENT_MODES.map(mode => ({
    value: mode,
    label: t(`settings.experimental.mcp.modes.${mode}`),
  })),
);

const modeDescriptionKey = computed(() =>
  `settings.experimental.mcp.modeDescriptions.${mcpStore.agentMode}`,
);

/** 已装客户端排前面，没装的沉到后面 —— 用户关心的永远是「我用的那个」。 */
const clientRows = computed(() =>
  [...mcpStore.clients].sort((left, right) => {
    if (left.detected !== right.detected) {
      return left.detected ? -1 : 1;
    }

    return 0;
  }),
);

/**
 * 客户端显示名走 `deployClients`，**不是** `clients`。
 *
 * `settings.experimental.mcp.clients` 早就是「已连接客户端」那个标签的字符串，
 * 再往同一个键上挂 6 个客户端名字会让同一处代码既是字符串又是对象。
 * 两个用途分开走。
 */
function clientLabel(id: McpClientId) {
  return t(`settings.experimental.mcp.deployClients.${id}`);
}

const formattedAuditLog = computed(() =>
  mcpStore.auditLog.map(entry => ({
    id: `${entry.timestamp}-${entry.tool}`,
    time: new Date(entry.timestamp).toLocaleTimeString(),
    tool: entry.tool,
    summary: entry.summary,
    outcome: entry.outcome,
  })),
);

async function onModeChange(value: unknown) {
  // Select 的 update 回调给的是 AcceptableValue（可能是 null / number / object），
  // 这里必须收窄成我们的档位类型再往下传 —— 直接当 string 用会把脏值写进 Rust。
  if (typeof value !== 'string' || !MCP_AGENT_MODES.includes(value as McpAgentMode)) {
    return;
  }

  await mcpStore.setAgentMode(value as McpAgentMode);
}

async function copyConfig() {
  const snippet = await mcpStore.fetchClientConfig();

  if (!snippet) {
    toast.error(t('settings.experimental.mcp.notRunning'));
    return;
  }

  try {
    await navigator.clipboard.writeText(snippet);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }
  catch {
    // 剪贴板不可用时把片段显示出来让人手动复制 ——
    // 直接失败等于「功能没有」，但其实内容已经拿到了。
    toast.error(t('settings.experimental.mcp.copyFailed'));
  }
}

async function rotateToken() {
  isRotating.value = true;

  try {
    await mcpStore.rotateToken();
    toast.success(t('settings.experimental.mcp.tokenRotated'));
  }
  finally {
    isRotating.value = false;
  }
}

/**
 * 一键部署。
 *
 * 成功后必须把「改了哪个文件、原件备份在哪」讲清楚 ——
 * 我们动的是别的软件的配置文件，用户有权知道，也有权自己回退。
 */
async function deploy(client: McpClientId) {
  const outcome = await mcpStore.installClient(client);

  if (!outcome) {
    toast.error(t('settings.experimental.mcp.deployFailed'));
    return;
  }

  if (!outcome.changed) {
    toast.success(t('settings.experimental.mcp.deployAlreadyCurrent'));
    // 内容没变也可能只是因为客户端还没重启 —— 同样需要提示。
    restartPending.value = {
      client: clientLabel(client),
      path: outcome.configPath,
      backup: outcome.backupPath ?? '',
    };
    return;
  }

  restartPending.value = {
    client: clientLabel(client),
    path: outcome.configPath,
    backup: outcome.backupPath ?? '',
  };

  toast.success(t('settings.experimental.mcp.deployDone', {
    client: clientLabel(client),
    path: outcome.configPath,
    backup: outcome.backupPath ?? '',
  }));
}

async function removeDeployment(client: McpClientId) {
  const outcome = await mcpStore.uninstallClient(client);

  if (outcome?.changed) {
    restartPending.value = {
      client: clientLabel(client),
      path: outcome.configPath,
      backup: outcome.backupPath ?? '',
    };
  }

  if (!outcome) {
    toast.error(t('settings.experimental.mcp.deployFailed'));
    return;
  }

  toast.success(t('settings.experimental.mcp.deployRemoved', { client: clientLabel(client) }));
}

async function recheck() {
  await mcpStore.refreshClients();
}

onMounted(async () => {
  await mcpStore.refresh();
  await mcpStore.refreshAuditLog();
  await mcpStore.refreshClients();
});
</script>

<template>
  <!--
    刻意不传 :description。SettingsItem 的 header 与内容区是 flex row，
    描述待在 header 里就会被挤成一条窄柱（截图里那串一行一个字的换行）。
    改成放进内容区顶部，能吃满整行宽度。
  -->
  <SettingsItem
    class="mcp-server"
    :title="t('settings.experimental.mcp.title')"
    :icon="TerminalIcon"
  >
    <p class="mcp__intro">
      {{ t('settings.experimental.mcp.description') }}
    </p>

    <div class="mcp__row">
      <Select
        :model-value="mcpStore.agentMode"
        :disabled="mcpStore.isApplying"
        @update:model-value="onModeChange"
      >
        <SelectTrigger class="mcp__mode-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in modeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <span
        class="mcp__status"
        :class="mcpStore.isEnabled ? 'mcp__status--on' : 'mcp__status--off'"
      >
        {{ mcpStore.isEnabled
          ? t('settings.experimental.mcp.running', { port: mcpStore.status.port })
          : t('settings.experimental.mcp.stopped') }}
      </span>
    </div>

    <p class="mcp__mode-description">
      {{ t(modeDescriptionKey) }}
    </p>

    <div
      v-if="mcpStore.isEnabled"
      class="mcp__detail"
    >
      <div class="mcp__detail-row">
        <span class="mcp__detail-label">
          {{ t('settings.experimental.mcp.endpoint') }}
        </span>
        <code class="mcp__detail-value">{{ mcpStore.status.endpoint }}</code>
      </div>

      <div class="mcp__detail-row">
        <span class="mcp__detail-label">
          {{ t('settings.experimental.mcp.clients') }}
        </span>
        <span class="mcp__detail-value">{{ mcpStore.status.activeClients }}</span>
      </div>

      <div class="mcp__detail-row">
        <span class="mcp__detail-label">
          {{ t('settings.experimental.mcp.token') }}
        </span>
        <code class="mcp__detail-value mcp__detail-value--token">
          {{ mcpStore.status.token }}
        </code>
      </div>
    </div>

    <div class="mcp__actions">
      <Button
        variant="outline"
        size="sm"
        :disabled="!mcpStore.isEnabled"
        @click="copyConfig"
      >
        <LoaderCircleIcon
          v-if="mcpStore.isLoading"
          :size="14"
          class="mcp__spinner"
        />
        <CopyIcon
          v-else
          :size="14"
        />
        {{ isCopied ? t('settings.experimental.mcp.copied') : t('settings.experimental.mcp.copyConfig') }}
      </Button>

      <Button
        variant="outline"
        size="sm"
        :disabled="isRotating"
        @click="rotateToken"
      >
        <RefreshCwIcon :size="14" />
        {{ t('settings.experimental.mcp.rotateToken') }}
      </Button>
    </div>

    <p
      v-if="mcpStore.status.token"
      class="mcp__hint"
    >
      <KeyRoundIcon :size="12" />
      {{ t('settings.experimental.mcp.tokenHint') }}
    </p>

    <div class="mcp__deploy">
      <div class="mcp__deploy-header">
        <span>{{ t('settings.experimental.mcp.deployTitle') }}</span>
        <Button
          variant="ghost"
          size="sm"
          :disabled="mcpStore.deployingClient !== null"
          @click="recheck"
        >
          <RefreshCwIcon :size="14" />
          {{ t('settings.experimental.mcp.recheck') }}
        </Button>
      </div>

      <p class="mcp__deploy-hint">
        {{ t('settings.experimental.mcp.deployHint') }}
      </p>

      <div
        v-if="restartPending"
        class="mcp__deploy-banner"
      >
        <CircleAlertIcon
          :size="14"
          class="mcp__deploy-banner-icon"
        />
        <div class="mcp__deploy-banner-body">
          <p class="mcp__deploy-banner-title">
            {{ t('settings.experimental.mcp.restartTitle', { client: restartPending.client }) }}
          </p>
          <p class="mcp__deploy-banner-text">
            {{ t('settings.experimental.mcp.restartBody') }}
          </p>
          <code class="mcp__deploy-banner-path">{{ restartPending.path }}</code>
          <p
            v-if="restartPending.backup"
            class="mcp__deploy-banner-text"
          >
            {{ t('settings.experimental.mcp.restartBackup', { backup: restartPending.backup }) }}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          @click="restartPending = null"
        >
          {{ t('settings.experimental.mcp.restartDismiss') }}
        </Button>
      </div>

      <div
        v-if="clientRows.length"
        class="mcp__deploy-list"
      >
        <div
          v-for="row in clientRows"
          :key="row.id"
          class="mcp__deploy-row"
          :class="{ 'mcp__deploy-row--off': !row.detected }"
        >
          <div class="mcp__deploy-info">
            <span class="mcp__deploy-name">{{ clientLabel(row.id) }}</span>
            <span
              class="mcp__deploy-state"
              :class="{
                'mcp__deploy-state--on': row.installed,
                'mcp__deploy-state--off': !row.installed,
              }"
            >
              {{ row.installed
                ? t('settings.experimental.mcp.deployInstalled')
                : (row.detected
                  ? t('settings.experimental.mcp.deployNotYet')
                  : t('settings.experimental.mcp.deployNotDetected')) }}
            </span>
            <code class="mcp__deploy-path">{{ row.configPath }}</code>
          </div>

          <div class="mcp__deploy-actions">
            <Button
              v-if="!row.installed"
              variant="outline"
              size="sm"
              :disabled="!mcpStore.isEnabled || mcpStore.deployingClient !== null"
              @click="deploy(row.id)"
            >
              <LoaderCircleIcon
                v-if="mcpStore.deployingClient === row.id"
                :size="14"
                class="mcp__spinner"
              />
              <DownloadIcon
                v-else
                :size="14"
              />
              {{ t('settings.experimental.mcp.deployAction') }}
            </Button>

            <template v-else>
              <span class="mcp__deploy-done">
                <CheckCircle2Icon :size="14" />
                {{ t('settings.experimental.mcp.deployDoneShort') }}
              </span>
              <Button
                variant="ghost"
                size="sm"
                :disabled="mcpStore.deployingClient !== null"
                @click="removeDeployment(row.id)"
              >
                <LoaderCircleIcon
                  v-if="mcpStore.deployingClient === row.id"
                  :size="14"
                  class="mcp__spinner"
                />
                <Trash2Icon
                  v-else
                  :size="14"
                />
                {{ t('settings.experimental.mcp.deployRemove') }}
              </Button>
            </template>
          </div>
        </div>
      </div>

      <p
        v-else
        class="mcp__deploy-empty"
      >
        {{ t('settings.experimental.mcp.deployLoading') }}
      </p>
    </div>

    <div
      v-if="formattedAuditLog.length"
      class="mcp__audit"
    >
      <div class="mcp__audit-header">
        {{ t('settings.experimental.mcp.auditTitle') }}
      </div>
      <div
        v-for="entry in formattedAuditLog"
        :key="entry.id"
        class="mcp__audit-row"
      >
        <span class="mcp__audit-time">{{ entry.time }}</span>
        <span class="mcp__audit-tool">{{ entry.tool }}</span>
        <span class="mcp__audit-summary">{{ entry.summary }}</span>
        <span
          class="mcp__audit-outcome"
          :class="`mcp__audit-outcome--${entry.outcome}`"
        >
          {{ t(`settings.experimental.mcp.outcomes.${entry.outcome}`) }}
        </span>
      </div>
    </div>

    <div
      v-if="mcpStore.errorMessage"
      class="mcp__error"
    >
      <CircleAlertIcon
        :size="14"
        class="mcp__error-icon"
      />
      <span>{{ mcpStore.errorMessage }}</span>
    </div>
  </SettingsItem>
</template>

<style scoped>
/*
 * 布局覆盖：让这一项**永远**竖排，不随宽度变化。
 *
 * `item.vue` 里有个容器查询：
 *
 *   @container (max-width: 500px) {
 *     .settings-view-item__main { flex-direction: column; align-items: stretch; }
 *   }
 *
 * 所以窄屏时标题会自动跑到顶部、内容落到下面（那正是我们要的版式），
 * 但窗口一拉宽就变回横排，标题又被困进左边那条只放得下一个标题的窄柱 ——
 * 而这一项的内容是整整一列（档位 + 详情 + 部署列表 + 调用记录），
 * 横排等于把左边三分之一 permanently 让给标题，右侧宽度全被吃掉。
 *
 * 所以这里显式钉死竖排，让两种宽度下版式一致。
 *
 * 用 :deep() 限定影响面：`item.vue` 被另外 45 个设置项共用，
 * 比如「设为默认文件管理器」就依赖横排（标题在左、开关在右），不能一起改。
 */
.mcp-server :deep(.settings-view-item__main) {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.mcp-server :deep(.settings-view-item__content) {
  flex: 1;
  min-width: 0;
}

.mcp__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mcp__mode-trigger {
  width: 11rem;
}

.mcp__status {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

.mcp__status--on {
  color: hsl(var(--success));
  background: hsl(var(--success) / 0.12);
}

.mcp__status--off {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.5);
}

.mcp__mode-description {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.mcp__detail {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mcp__detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.mcp__detail-label {
  color: hsl(var(--muted-foreground));
  min-width: 6rem;
}

.mcp__detail-value {
  font-family: ui-monospace, monospace;
  overflow-wrap: anywhere;
}

.mcp__detail-value--token {
  color: hsl(var(--muted-foreground));
}

.mcp__actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.mcp__hint {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.mcp__audit {
  margin-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 11rem;
  overflow-y: auto;
}

.mcp__intro {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.mcp__deploy {
  border-top: 1px solid hsl(var(--border));
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mcp__deploy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.mcp__deploy-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid hsl(var(--warning) / 0.5);
  background: hsl(var(--warning) / 0.1);
  border-radius: calc(var(--radius) - 2px);
  font-size: 0.6875rem;
}

.mcp__deploy-banner-icon {
  flex-shrink: 0;
  margin-top: 0.0625rem;
  color: hsl(var(--warning));
}

.mcp__deploy-banner-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mcp__deploy-banner-title {
  margin: 0;
  font-weight: 600;
}

.mcp__deploy-banner-text {
  margin: 0;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.mcp__deploy-banner-path {
  font-family: ui-monospace, monospace;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
}

.mcp__deploy-hint {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.mcp__deploy-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.mcp__deploy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  font-size: 0.75rem;
}

.mcp__deploy-row--off {
  opacity: 0.65;
}

.mcp__deploy-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.mcp__deploy-name {
  font-weight: 600;
  white-space: nowrap;
}

.mcp__deploy-state {
  font-size: 0.6875rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  white-space: nowrap;
}

.mcp__deploy-state--on {
  color: hsl(var(--success));
  background: hsl(var(--success) / 0.12);
}

.mcp__deploy-state--off {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.5);
}

.mcp__deploy-path {
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
  min-width: 0;
}

.mcp__deploy-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.mcp__deploy-done {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: hsl(var(--success));
  white-space: nowrap;
}

.mcp__deploy-empty {
  margin: 0;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.mcp__audit-header {
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.mcp__audit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
}

.mcp__audit-time {
  color: hsl(var(--muted-foreground));
  font-family: ui-monospace, monospace;
}

.mcp__audit-tool {
  font-family: ui-monospace, monospace;
  min-width: 8rem;
}

.mcp__audit-summary {
  color: hsl(var(--muted-foreground));
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp__audit-outcome--allowed {
  color: hsl(var(--success));
}

.mcp__audit-outcome--denied,
.mcp__audit-outcome--error {
  color: hsl(var(--destructive));
}

.mcp__error {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--destructive));
}

.mcp__spinner {
  animation: mcp-spin 1s linear infinite;
}

@keyframes mcp-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
