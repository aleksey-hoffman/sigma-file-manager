<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { SettingsItem } from '@/modules/settings';
import { Button } from '@/components/ui/button';
import { ServerIcon, PlusIcon, TrashIcon } from '@lucide/vue';
import ConnectionForm from './connection-form.vue';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';
import type { RemoteConnection } from '@/types/remote';

const { t } = useI18n();
const store = useRemoteConnectionsStore();

const editing = ref<RemoteConnection | null>(null);
const isCreating = ref(false);

onMounted(async () => {
  await store.init();
});

/**
 * 导航栏悬停面板上每条连接右侧的设置按钮，会先往 store 里放一个待编辑的
 * 连接 id，再跳到本分类（用户 2026-10-18 要求）。
 *
 * **挂载后和变化时都要看**：从别的页面跳过来时分类是**新挂载**的；
 * 而用户在设置页里又点一次那颗按钮时分类不会重新挂载，只有 watch 能接住。
 *
 * ⚠️ **查不到连接时不能立刻把请求丢掉**：`onMounted` 里 `store.init()` 是异步的，
 * 组件挂载那一刻 `connections` 可能还是空的。此时消费掉请求就等于把用户的
 * 那次点击吞掉，表单永远不打开 —— 表现是「点设置只是跳到了远程分类」。
 * 所以只有「已加载完还查不到」才认定连接真被删了，这时才清除请求。
 */
function applyPendingEdit(): void {
  const id = store.pendingEditId;

  if (!id) {
    return;
  }

  const target = store.getConnection(id);

  if (!target) {
    // 连接可能在这条请求排队期间被删了。找不到就不开表单 ——
    // 凭空弹一个空表单会让用户以为多了一条连接。
    if (store.isInitialized) {
      store.consumeRemoteEdit();
    }

    return;
  }

  store.consumeRemoteEdit();
  isCreating.value = false;
  editing.value = target;
}

onMounted(async () => {
  await store.init();
  applyPendingEdit();
});

watch(() => store.pendingEditId, applyPendingEdit);

function startCreate() {
  editing.value = null;
  isCreating.value = true;
}

function startEdit(connection: RemoteConnection) {
  isCreating.value = false;
  editing.value = connection;
}

function closeForm() {
  isCreating.value = false;
  editing.value = null;
}

async function handleDelete(connection: RemoteConnection) {
  await store.deleteConnection(connection.id);

  if (editing.value?.id === connection.id) {
    closeForm();
  }
}

/**
 * 有存档密码时显示的掩码。
 *
 * **放在 script 而不是模板里**，是因为项目启用了 `@intlify/vue-i18n/no-raw-text`，
 * 模板里的裸文本一律报错。星号本身不该翻译（译成别的语言它还是一串星号），
 * 所以也不进语言包 —— 可读名称由 `settings.remote.password.saved` 承担。
 */
const PASSWORD_MASK = '***';

function describeProtocol(connection: RemoteConnection): string {
  return t(`settings.remote.protocol.${connection.protocol}`);
}

function describeProxy(connection: RemoteConnection): string {
  if (connection.proxy.kind === 'direct') {
    return t('settings.remote.proxy.direct');
  }

  return `${t(`settings.remote.proxy.${connection.proxy.kind}`)} · ${connection.proxy.host}:${connection.proxy.port}`;
}
</script>

<template>
  <SettingsItem
    class="remote-connections"
    :title="t('settings.remote.connections.title')"
    :description="t('settings.remote.connections.description')"
    :icon="ServerIcon"
  >
    <p
      v-if="store.connections.length === 0 && !isCreating"
      class="remote-connections__empty"
      data-test="empty"
    >
      {{ t('settings.remote.connections.empty') }}
    </p>

    <ul
      v-else
      class="remote-connections__list"
      data-test="list"
    >
      <li
        v-for="connection in store.connections"
        :key="connection.id"
        class="remote-connections__entry"
        :data-test="`entry-${connection.id}`"
      >
        <div class="remote-connections__entry-main">
          <div class="remote-connections__entry-title">
            <span>{{ connection.name }}</span>
            <!--
              有存档密码就显示 `***`，没有就整块不渲染（用户 2026-10-18 要求）。
              用星号而不是「已保存密码」这种文案，是为了让「有没有密码」在一眼
              扫过去时就分得出来 —— 文案徽标要读，没星号不要读。

              `***` 是密码掩码，不该翻译（译成别的语言它就还是一串星号）；
              可读名称挂在 title/aria-label 上，屏幕阅读器照样念得出来。
            -->
            <span
              v-if="connection.credentialKey"
              class="remote-connections__badge"
              data-test="has-password"
              :title="t('settings.remote.password.saved')"
              :aria-label="t('settings.remote.password.saved')"
            >{{ PASSWORD_MASK }}</span>
          </div>
          <div class="remote-connections__entry-meta">
            <span>{{ describeProtocol(connection) }}</span>
            <span>{{ connection.host }}:{{ connection.port }}</span>
            <span v-if="connection.username">{{ connection.username }}</span>
            <span>{{ connection.initialPath }}</span>
            <span>{{ describeProxy(connection) }}</span>
            <span
              v-if="connection.localPath"
              class="remote-connections__entry-local"
              data-test="local-path"
            >
              {{ t('settings.remote.field.localPath') }} {{ connection.localPath }}
            </span>
          </div>
        </div>
        <div class="remote-connections__entry-actions">
          <Button
            variant="outline"
            size="sm"
            :data-test="`edit-${connection.id}`"
            @click="startEdit(connection)"
          >
            {{ t('settings.remote.action.edit') }}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            :data-test="`delete-${connection.id}`"
            @click="handleDelete(connection)"
          >
            <TrashIcon :size="16" />
            {{ t('settings.remote.action.delete') }}
          </Button>
        </div>
      </li>
    </ul>

    <Button
      v-if="!isCreating && editing === null"
      variant="outline"
      data-test="add"
      @click="startCreate"
    >
      <PlusIcon :size="16" />
      {{ t('settings.remote.action.add') }}
    </Button>

    <ConnectionForm
      v-if="isCreating"
      :connection="null"
      @cancel="closeForm"
      @saved="closeForm"
    />

    <ConnectionForm
      v-else-if="editing"
      :connection="editing"
      @cancel="closeForm"
      @saved="closeForm"
    />
  </SettingsItem>
</template>

<style scoped>
/*
  用户要求（2026-10-18）：标题文本单行显示，设置内容放在标题**下方**，
  而不是左右排版。

  SettingsItem 的 header 与内容区默认是 `flex-direction: row` 加
  `justify-content: space-between`，内容区被压成右侧一窄栏。放单个开关没问题，
  但连接表单有十几个字段，全挤在右栏会窄到没法用 —— 这正是实机验收抓到的。

  这里显式弹成竖排。**必须用 :deep() 限定影响**：`item.vue` 被另外 45 个设置项
  共用，「设为默认文件管理器」就依赖横排（标题在左、开关在右），直接改它会
  一次改掉全店。既有先例：`experimental/mcp-server.vue`。
*/
.remote-connections :deep(.settings-view-item__main) {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.remote-connections :deep(.settings-view-item__content) {
  flex: 1;
  min-width: 0;
}

/* 标题单行：长标题换行会把下面的表单推得更远，且和别的分类不一致。 */
.remote-connections :deep(.settings-view-item__title) {
  white-space: nowrap;
}

.remote-connections__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.remote-connections__entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 0.75rem;
}

.remote-connections__entry-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.remote-connections__entry-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: hsl(var(--foreground));
  font-weight: 600;
}

.remote-connections__badge {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  font-weight: 400;
}

.remote-connections__entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

/*
  本地目录带字段名渲染：裸路径混在协议/主机/初始目录里会被当成又一段远端信息，
  而它其实是本机路径，也是「会摆双屏」的唯一可见标志。
*/
.remote-connections__entry-local {
  color: hsl(var(--foreground));
}

.remote-connections__entry-actions {
  display: flex;
  gap: 0.5rem;
}

.remote-connections__empty {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}
</style>
