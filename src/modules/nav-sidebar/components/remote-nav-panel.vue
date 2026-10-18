<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  左侧导航栏「远程」按钮的悬停面板。

  两段结构，照用户 2026-10-18 的要求：
  1. **设置** —— 跳到设置页的「远程」分类；
  2. **连接** —— 已配置好的连接逐条列出，点一条开一组标签页。

  连接列表**直接读 store**，不在这里缓存一份：
  面板可能在设置页改完连接后还开着（悬停面板本来就常驻），
  缓存的副本会列出已经删掉或改名的连接。

  每条连接右侧还有一颗**设置按钮**（用户 2026-10-18 要求）：点它直接进那条
  连接的编辑界面，而不是落到「远程」分类让用户自己再找一次。
  行主体与按钮是**两个并列的 button**，不是按钮套按钮 —— 嵌套 button 是无效
  HTML，而且外层的 click 会一起触发，等于点设置也把连接打开了。
-->

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ServerIcon, SettingsIcon } from '@lucide/vue';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';
import { hasRemoteLocalPath } from '@/types/remote';
import type { RemoteConnection } from '@/types/remote';

const emit = defineEmits<{
  openSettings: [];
  open: [connection: RemoteConnection];
  edit: [connection: RemoteConnection];
}>();

const { t } = useI18n();
const store = useRemoteConnectionsStore();

const connections = computed(() => store.connections);

function describeSplitTag(connection: RemoteConnection): string | null {
  // 双屏是这个连接的属性，不是全局开关，必须跟着连接一起显示，
  // 否则用户不知道点下去会开一格还是两格。
  return hasRemoteLocalPath(connection) ? t('settings.remote.nav.split') : null;
}

onMounted(async () => {
  // 导航栏可能先于设置页被打开，这里自己确保 store 已从盘上读过一遍。
  await store.init();
});
</script>

<template>
  <div class="remote-nav-panel">
    <button
      type="button"
      class="remote-nav-panel__row"
      data-test="remote-nav-settings"
      @click="emit('openSettings')"
    >
      <SettingsIcon :size="14" />
      <span>{{ t('settings.remote.nav.openSettings') }}</span>
    </button>

    <div class="remote-nav-panel__label">
      {{ t('settings.remote.nav.connect') }}
    </div>

    <p
      v-if="connections.length === 0"
      class="remote-nav-panel__empty"
      data-test="remote-nav-empty"
    >
      {{ t('settings.remote.nav.empty') }}
    </p>

    <div
      v-for="connection in connections"
      :key="connection.id"
      class="remote-nav-panel__entry"
      data-test="remote-nav-connection-row"
    >
      <button
        type="button"
        class="remote-nav-panel__row remote-nav-panel__row--open"
        data-test="remote-nav-connection"
        @click="emit('open', connection)"
      >
        <ServerIcon :size="14" />
        <span class="remote-nav-panel__name">{{ connection.name }}</span>
        <span
          v-if="describeSplitTag(connection)"
          class="remote-nav-panel__tag"
          data-test="remote-nav-split-tag"
        >
          {{ describeSplitTag(connection) }}
        </span>
      </button>

      <button
        type="button"
        class="remote-nav-panel__edit"
        :title="t('settings.remote.nav.editConnection')"
        :aria-label="`${t('settings.remote.nav.editConnection')}: ${connection.name}`"
        data-test="remote-nav-edit"
        @click="emit('edit', connection)"
      >
        <SettingsIcon :size="13" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.remote-nav-panel {
  display: flex;
  width: 240px;
  flex-direction: column;
  gap: 2px;
}

.remote-nav-panel__row {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  padding: 6px 8px;
  color: hsl(var(--foreground));
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.remote-nav-panel__row:hover {
  background-color: hsl(var(--foreground) / 5%);
}

/*
  行 = 「打开这一格」的主按钮 + 右侧一颗设置按钮。
  两者并列而不是嵌套：button 里再放 button 是无效 HTML，
  而且外层的 click 会一起触发 —— 点设置等于把连接也打开了。
*/
.remote-nav-panel__entry {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  gap: 2px;
}

.remote-nav-panel__row--open {
  flex: 1;
  min-width: 0;
}

.remote-nav-panel__entry:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.remote-nav-panel__entry:hover .remote-nav-panel__row--open {
  background-color: transparent;
}

.remote-nav-panel__edit {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background-color: transparent;
  padding: 6px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.remote-nav-panel__edit:hover {
  background-color: hsl(var(--foreground) / 10%);
  color: hsl(var(--foreground));
}

.remote-nav-panel__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-nav-panel__tag {
  border-radius: 999px;
  margin-left: auto;
  padding: 0 6px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
}

.remote-nav-panel__label {
  padding: 8px 8px 4px;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
}

.remote-nav-panel__empty {
  margin: 0;
  padding: 4px 8px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}
</style>
