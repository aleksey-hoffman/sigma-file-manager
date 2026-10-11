<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import type { BatchRenameHistoryEntry } from '@/types/batch-rename';
import {
  getDirectoryName,
  loadBatchRenameHistory,
  undoBatchRename,
} from '@/composables/use-batch-rename';

const props = defineProps<{
  /** 当前目录。用于把本目录的历史排在前面，不是过滤条件。 */
  directory: string;
}>();

const emit = defineEmits<{
  /** 撤销成功后抛出，父组件据此刷新目录列表。 */
  undone: [];
}>();

const { t } = useI18n();

const entries = ref<BatchRenameHistoryEntry[]>([]);
const isLoading = ref(false);
const undoingId = ref<string | null>(null);

/**
 * 本目录的记录排前面。
 *
 * 历史是全局的（10 条共享），用户刚做完的那一批通常就在当前目录，
 * 把它埋在别的目录的记录后面会让「撤销刚才那批」变得难找。
 */
const sortedEntries = computed(() => {
  const currentDirectoryName = getDirectoryName(props.directory);

  return [...entries.value].sort((a, b) => {
    const aMatches = getDirectoryName(a.directory) === currentDirectoryName ? 0 : 1;
    const bMatches = getDirectoryName(b.directory) === currentDirectoryName ? 0 : 1;

    return aMatches - bMatches;
  });
});

function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString();
}

async function refresh(): Promise<void> {
  isLoading.value = true;

  try {
    entries.value = await loadBatchRenameHistory();
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void refresh();
});

/**
 * 撤销。
 *
 * 失败原因一律如实显示，不静默：
 * 撤销是破坏性操作的反向操作，用户必须知道到底还原了没有。
 * 三种失败各有各的说法 —— 被占用、执行报错、回滚失败，
 * 混成一句「撤销失败」会让用户去错误的地方排查。
 */
async function handleUndo(entry: BatchRenameHistoryEntry): Promise<void> {
  undoingId.value = entry.id;

  try {
    const report = await undoBatchRename(entry.id);

    if (report.successful) {
      toast.success(t('batchRename.history.undoSuccess', { count: report.restoredCount }));
      await refresh();
      emit('undone');
      return;
    }

    toast.error(t('batchRename.history.undoFailed'));

    if (report.failed) {
      toast.error(report.failed);
    }

    if (report.blockedBy.length > 0) {
      toast.error(t('batchRename.history.blockedBy', { names: report.blockedBy.join('、') }));
    }

    if (report.rollback.attempted && !report.rollback.succeeded) {
      toast.error(report.rollback.error ?? t('batchRename.history.undoFailed'));
    }

    // 即使撤销失败也要刷新：文件系统的状态已经变了（哪怕变得不完整），
    // 界面上还显示旧名单会误导用户。
    await refresh();
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    undoingId.value = null;
  }
}
</script>

<template>
  <div class="file-browser-batch-rename-history">
    <div class="file-browser-batch-rename-history__header">
      <span class="file-browser-batch-rename-history__title">
        {{ t('batchRename.history.title') }}
      </span>
      <Button
        variant="ghost"
        size="xs"
        :disabled="isLoading"
        @click="refresh"
      >
        {{ t('batchRename.dialog.tabHistory') }}
      </Button>
    </div>

    <p
      v-if="entries.length === 0 && !isLoading"
      class="file-browser-batch-rename-history__empty"
    >
      {{ t('batchRename.history.empty') }}
    </p>

    <ul class="file-browser-batch-rename-history__list">
      <li
        v-for="entry in sortedEntries"
        :key="entry.id"
        class="file-browser-batch-rename-history__item"
      >
        <div class="file-browser-batch-rename-history__item-info">
          <span class="file-browser-batch-rename-history__item-count">
            {{ t('batchRename.history.itemCount', { count: entry.itemCount }) }}
          </span>
          <span class="file-browser-batch-rename-history__item-meta">
            {{ getDirectoryName(entry.directory) }} · {{ formatTimestamp(entry.timestampMs) }}
          </span>
        </div>
        <Button
          variant="outline"
          size="xs"
          :disabled="undoingId === entry.id"
          @click="handleUndo(entry)"
        >
          {{ undoingId === entry.id
            ? t('batchRename.history.undoing')
            : t('batchRename.history.undo') }}
        </Button>
      </li>
    </ul>
  </div>
</template>

<style>
.file-browser-batch-rename-history {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.file-browser-batch-rename-history__header {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-browser-batch-rename-history__title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
}

.file-browser-batch-rename-history__empty {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.file-browser-batch-rename-history__list {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  padding: 0;
  margin: 0;
  gap: 8px;
  list-style: none;
}

.file-browser-batch-rename-history__item {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 12px;
}

.file-browser-batch-rename-history__item-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.file-browser-batch-rename-history__item-count {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
}

.file-browser-batch-rename-history__item-meta {
  min-width: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  overflow-wrap: break-word;
}
</style>
