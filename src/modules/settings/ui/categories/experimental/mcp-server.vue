<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CircleAlertIcon,
  CopyIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TerminalIcon,
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
} from '@/stores/runtime/mcp';

const { t } = useI18n();
const mcpStore = useMcpStore();

const isCopied = ref(false);
const isRotating = ref(false);

const modeOptions = computed(() =>
  MCP_AGENT_MODES.map(mode => ({
    value: mode,
    label: t(`settings.experimental.mcp.modes.${mode}`),
  })),
);

const modeDescriptionKey = computed(() =>
  `settings.experimental.mcp.modeDescriptions.${mcpStore.agentMode}`,
);

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

onMounted(async () => {
  await mcpStore.refresh();
  await mcpStore.refreshAuditLog();
});
</script>

<template>
  <SettingsItem
    :title="t('settings.experimental.mcp.title')"
    :description="t('settings.experimental.mcp.description')"
    :icon="TerminalIcon"
  >
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
