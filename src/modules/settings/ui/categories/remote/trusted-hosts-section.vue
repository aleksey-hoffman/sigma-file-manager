<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
// FORK-MODIFICATION 2026-10-18：已信任主机列表（阶段 2 决策 3）。
//
// 这一区的存在理由是**可撤销**：信任一条主机公钥是安全决定，用户有权事后反悔。
// 没有这一区，known_hosts 就是一只只进不出的黑盒 —— 用户想收紧策略时无处下手。
//
// 数据直连 `remote_list_known_hosts`，**不经过 Pinia**。这份记录当前只有一个读者
// （本组件）与一个写者（握手时的 `known_hosts::trust`），中间再插一层 store
// 只会多一个可能忘记刷新的缓存。
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { SettingsItem } from '@/modules/settings';
import { Button } from '@/components/ui/button';
import { ShieldCheckIcon, TrashIcon } from '@lucide/vue';
import {
  forgetKnownHost,
  listKnownHosts,
  type KnownHostSummary,
} from '@/utils/remote-directory';
const { t, locale } = useI18n();

const hosts = ref<KnownHostSummary[]>([]);
const isLoading = ref(true);
const isMutating = ref(false);
// 读失败与删除失败**分开记**。
// 合在一起的话，删除一失败整个列表会被 `v-if` 顶掉：用户刚删掉一条、
// 屏幕上却连还剩哪些都看不见了 —— 而这一区恰恰是用户事后收紧信任的唯一入口。
const loadError = ref<string | null>(null);
const mutationError = ref<string | null>(null);

async function reload(): Promise<void> {
  isLoading.value = true;
  loadError.value = null;

  try {
    const listed = await listKnownHosts();

    // 后端契约是数组。契约破掉时走错误分支，**不**让 `hosts.value.length`
    // 在渲染期炸掉整个设置分类 —— 那会让「已信任主机」这个可撤销入口
    // 因为一个无关的 bug 而整块消失，用户连「我信任过谁」都查不了。
    if (!Array.isArray(listed)) {
      throw new TypeError('remote_list_known_hosts did not return an array');
    }

    hosts.value = listed;
  }
  catch (caught) {
    // 读不到就**不假装是空的**：一个空列表会被读成「你没信任过任何主机」，
    // 而真相是「我不知道」。这两种状态的处置完全不同。
    loadError.value = String(caught);
  }
  finally {
    isLoading.value = false;
  }
}

onMounted(reload);

/**
 * 删掉一条记录。
 *
 * 列表直接从返回值里过滤掉那条，**不重新拉全量**：删除是确定性的本地变换，
 * 再发一次请求只会让这一行闪一下。而失败时把它放回去 —— 列表是唯一的事实来源。
 */
async function handleForget(host: KnownHostSummary): Promise<void> {
  isMutating.value = true;
  mutationError.value = null;

  try {
    // **带 `kind`** —— 同一台主机的 SSH 与证书是两行，
    // 删一行不该动另一行。
    await forgetKnownHost(host.host, host.port, host.kind);
    hosts.value = hosts.value.filter(
      entry => !(
        entry.host === host.host
        && entry.port === host.port
        && entry.kind === host.kind
      ),
    );
  }
  catch (caught) {
    // 不动 hosts：后端没删掉，界面上就不能消失。
    mutationError.value = String(caught);
  }
  finally {
    isMutating.value = false;
  }
}

/**
 * 信任日期。`addedAt` 是 Unix 毫秒；后端恒有值，但坏数据不该让整个分区白屏。
 */
function formatAddedAt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return new Date(value).toLocaleString(locale.value);
}

const isEmpty = computed(() => !isLoading.value && !loadError.value && hosts.value.length === 0);
</script>

<template>
  <SettingsItem
    class="remote-trusted-hosts"
    :title="t('settings.remote.trustedHosts.title')"
    :description="t('settings.remote.trustedHosts.description')"
    :icon="ShieldCheckIcon"
  >
    <p
      v-if="loadError"
      class="remote-trusted-hosts__error"
      data-test="trusted-hosts-error"
    >
      {{ t('settings.remote.trustedHosts.loadFailed') }}
    </p>

    <p
      v-else-if="isEmpty"
      class="remote-trusted-hosts__empty"
      data-test="trusted-hosts-empty"
    >
      {{ t('settings.remote.trustedHosts.empty') }}
    </p>

    <ul
      v-else
      class="remote-trusted-hosts__list"
      data-test="trusted-hosts-list"
    >
      <li
        v-for="entry in hosts"
        :key="`${entry.host}:${entry.port}:${entry.kind}`"
        class="remote-trusted-hosts__entry"
        :data-test="`trusted-host-${entry.host}-${entry.port}-${entry.kind}`"
      >
        <div class="remote-trusted-hosts__entry-main">
          <div class="remote-trusted-hosts__entry-title">
            <span>{{ entry.host }}:{{ entry.port }}</span>
            <!--
              信任类型**必须显示**，而且它是一行与一条的分界：
              同一台主机的 SSH 公钥与 X.509 证书是两条独立记录，
              列表里看不出区别的话，用户不知道自己删掉的是哪一条。
            -->
            <span class="remote-trusted-hosts__kind">
              {{ entry.kind === 'x509'
                ? t('settings.remote.trustedHosts.kindX509')
                : t('settings.remote.trustedHosts.kindSsh') }}
            </span>
          </div>
          <div class="remote-trusted-hosts__entry-meta">
            <!--
              指纹是这一区的正文：用户要核对的正是它，显示成等宽小字便于逐字比对。
              算法名一起带上 —— 同一台主机换算法时，指纹本来就必然不同，
              光看指纹用户分不清「重装了」和「被换了」。
            -->
            <span
              class="remote-trusted-hosts__fingerprint"
              data-test="fingerprint"
            >{{ entry.fingerprint }}</span>
            <span v-if="entry.keyType">{{ entry.keyType }}</span>
            <span v-if="formatAddedAt(entry.addedAt)">{{ formatAddedAt(entry.addedAt) }}</span>
          </div>
        </div>
        <div class="remote-trusted-hosts__entry-actions">
          <Button
            variant="destructive"
            size="sm"
            :disabled="isMutating"
            :data-test="`forget-trusted-host-${entry.host}-${entry.port}-${entry.kind}`"
            @click="handleForget(entry)"
          >
            <TrashIcon :size="16" />
            {{ t('settings.remote.trustedHosts.forget') }}
          </Button>
        </div>
      </li>
    </ul>

    <!--
      删除失败**不替换**上面的列表，只在列表下方加一条。
      列表是用户「我还信任了谁」的唯一事实来源，失败时把它藏起来
      只会让人以为记录已经没了。
    -->
    <p
      v-if="mutationError"
      class="remote-trusted-hosts__error"
      data-test="trusted-hosts-mutation-error"
    >
      {{ t('settings.remote.trustedHosts.forgetFailed') }}
    </p>
  </SettingsItem>
</template>

<style scoped>
/*
  与 connections-section 保持同一套版式：标题单行、内容在下方。
  这里多一列宽指纹，所以行高留得比连接列表松一点。
*/

.remote-trusted-hosts__empty,
.remote-trusted-hosts__error {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.remote-trusted-hosts__error {
  color: hsl(var(--destructive));
}

.remote-trusted-hosts__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
}

.remote-trusted-hosts__entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.remote-trusted-hosts__entry-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.remote-trusted-hosts__entry-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-weight: 500;
}

.remote-trusted-hosts__kind {
  padding: 0.0625rem 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 400;
  text-transform: none;
}

.remote-trusted-hosts__entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.remote-trusted-hosts__fingerprint {
  font-family: var(--font-mono, ui-monospace, monospace);
  word-break: break-all;
}
</style>
