<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangleIcon,
  CheckIcon,
  FileIcon,
  FolderIcon,
  LoaderCircleIcon,
  SkipForwardIcon,
} from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import toReadableBytes from '@/utils/to-readable-bytes';
import {
  closeRemoteTransferProgress,
  useRemoteTransferDialogStates,
} from '@/modules/remote/utils/remote-transfer-state';

const { t } = useI18n();
const { progressDialogState } = useRemoteTransferDialogStates();

const isOpen = defineModel<boolean>('open', { required: true });

const state = computed(() => progressDialogState.value);
const isRunning = computed(() => state.value.phase === 'running');
const direction = computed(() => state.value.direction);

/**
 * 百分比。
 *
 * **有字节分母就用字节**，没有才退回文件数 ——
 * 传 1 个 2 GB 的文件时，按文件数算的进度条全程都是 0%。
 */
const percent = computed(() => {
  const { bytesDone, bytesTotal, filesDone, filesTotal } = state.value.progress;

  if (bytesTotal > 0) {
    return Math.min(100, Math.round((bytesDone / bytesTotal) * 100));
  }

  if (filesTotal > 0) {
    return Math.min(100, Math.round((filesDone / filesTotal) * 100));
  }

  return 0;
});

/** 传输还在跑，但一个字节都还没传（分母还没算出来）—— 进度条走不确定态。 */
const isIndeterminate = computed(() =>
  isRunning.value
  && state.value.progress.bytesTotal === 0
  && state.value.progress.filesTotal === 0,
);

const failures = computed(() => state.value.report?.failures ?? []);
const skipped = computed(() => [
  ...(state.value.report?.skipped ?? []),
  ...state.value.skippedByUser,
]);

const summary = computed(() => {
  const report = state.value.report;

  return t('remote.transfer.resultSummary', {
    files: report?.transferred_files ?? 0,
    skipped: skipped.value.length,
    failed: failures.value.length,
  });
});

function skipReasonText(reason: string): string {
  if (reason === 'already_exists') {
    return t('remote.transfer.skipReasonAlreadyExists');
  }

  if (reason === 'user_skipped') {
    return t('remote.transfer.skipReasonUserSkipped');
  }

  return reason;
}

function displayName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function handleClose() {
  closeRemoteTransferProgress();
  isOpen.value = false;
}
</script>

<template>
  <Dialog
    v-model:open="isOpen"
    @update:open="(open: boolean) => { if (!open) { handleClose(); } }"
  >
    <DialogContent class="remote-transfer-dialog">
      <DialogHeader>
        <DialogTitle class="remote-transfer-dialog__title">
          <LoaderCircleIcon
            v-if="isRunning"
            class="remote-transfer-dialog__spinner"
            :size="18"
          />
          <CheckIcon
            v-else-if="failures.length === 0"
            class="remote-transfer-dialog__check"
            :size="18"
          />
          <AlertTriangleIcon
            v-else
            class="remote-transfer-dialog__warning"
            :size="18"
          />
          {{
            isRunning
              ? t(direction === 'upload' ? 'remote.transfer.uploading' : 'remote.transfer.downloading')
              : t('remote.transfer.resultTitle')
          }}
        </DialogTitle>
        <DialogDescription
          v-if="isRunning"
          class="remote-transfer-dialog__description"
        >
          {{ t('remote.transfer.progressFiles', {
            done: state.progress.filesDone,
            total: state.progress.filesTotal,
          }) }}
        </DialogDescription>
        <DialogDescription
          v-else
          class="remote-transfer-dialog__description"
        >
          {{ summary }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="isRunning"
        class="remote-transfer-dialog__progress"
      >
        <div class="remote-transfer-dialog__progress-bar">
          <div
            class="remote-transfer-dialog__progress-bar-fill"
            :class="{ 'remote-transfer-dialog__progress-bar-fill--indeterminate': isIndeterminate }"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <div class="remote-transfer-dialog__progress-meta">
          <span v-if="!isIndeterminate">{{ percent }}%</span>
          <span v-if="state.progress.bytesTotal > 0">
            {{ t('remote.transfer.progressBytes', {
              done: toReadableBytes(state.progress.bytesDone),
              total: toReadableBytes(state.progress.bytesTotal),
            }) }}
          </span>
        </div>
        <div
          v-if="state.progress.currentPath"
          class="remote-transfer-dialog__current"
        >
          {{ t('remote.transfer.progressCurrent', {
            name: displayName(state.progress.currentPath),
          }) }}
        </div>
      </div>

      <ScrollArea
        v-if="!isRunning && (failures.length > 0 || skipped.length > 0)"
        class="remote-transfer-dialog__items"
      >
        <div class="remote-transfer-dialog__items-inner">
          <div
            v-if="failures.length > 0"
            class="remote-transfer-dialog__section"
          >
            <div class="remote-transfer-dialog__section-title">
              <AlertTriangleIcon
                class="remote-transfer-dialog__section-icon remote-transfer-dialog__section-icon--danger"
                :size="14"
              />
              {{ t('remote.transfer.failureSection') }}
            </div>
            <div
              v-for="failure in failures"
              :key="failure.path"
              class="remote-transfer-dialog__row remote-transfer-dialog__row--danger"
            >
              <FileIcon class="remote-transfer-dialog__row-icon" />
              <div class="remote-transfer-dialog__row-main">
                <span class="remote-transfer-dialog__row-path">{{ displayName(failure.path) }}</span>
                <span class="remote-transfer-dialog__row-reason">{{ failure.message }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="skipped.length > 0"
            class="remote-transfer-dialog__section"
          >
            <div class="remote-transfer-dialog__section-title">
              <SkipForwardIcon
                class="remote-transfer-dialog__section-icon"
                :size="14"
              />
              {{ t('remote.transfer.skippedSection') }}
            </div>
            <div
              v-for="item in skipped"
              :key="item.path"
              class="remote-transfer-dialog__row"
            >
              <FolderIcon class="remote-transfer-dialog__row-icon" />
              <div class="remote-transfer-dialog__row-main">
                <span class="remote-transfer-dialog__row-path">{{ displayName(item.path) }}</span>
                <span class="remote-transfer-dialog__row-reason">{{ skipReasonText(item.reason) }}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter
        v-if="!isRunning"
        class="remote-transfer-dialog__footer"
      >
        <div class="remote-transfer-dialog__actions">
          <Button
            class="remote-transfer-dialog__action-btn--primary"
            @click="handleClose"
          >
            {{ t('close') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.remote-transfer-dialog {
  width: 560px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.remote-transfer-dialog > * {
  min-width: 0;
}

.remote-transfer-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remote-transfer-dialog__spinner {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  animation: remote-transfer-spin 1s linear infinite;
  color: hsl(var(--primary));
}

.remote-transfer-dialog__check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: hsl(var(--success, 142 76% 36%));
}

.remote-transfer-dialog__warning {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: hsl(var(--destructive));
}

.remote-transfer-dialog__description {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 1.5;
}

.remote-transfer-dialog__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.remote-transfer-dialog__progress-bar {
  overflow: hidden;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: hsl(var(--muted));
}

.remote-transfer-dialog__progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: hsl(var(--primary));
  transition: width 0.2s ease;
}

.remote-transfer-dialog__progress-bar-fill--indeterminate {
  width: 35% !important;
  animation: remote-transfer-indeterminate 1.1s ease-in-out infinite;
}

.remote-transfer-dialog__progress-meta {
  display: flex;
  flex-wrap: wrap;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  gap: 12px;
}

.remote-transfer-dialog__current {
  overflow: hidden;
  color: hsl(var(--foreground) / 72%);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-transfer-dialog__items {
  max-height: 40vh;
}

.remote-transfer-dialog__items-inner {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  gap: 12px;
}

.remote-transfer-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.remote-transfer-dialog__section-title {
  display: flex;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  gap: 6px;
}

.remote-transfer-dialog__section-icon {
  color: hsl(var(--muted-foreground));
}

.remote-transfer-dialog__section-icon--danger {
  color: hsl(var(--destructive));
}

.remote-transfer-dialog__row {
  display: grid;
  align-items: start;
  padding: 8px 12px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 40%);
  gap: 10px;
  grid-template-columns: 16px 1fr;
}

.remote-transfer-dialog__row--danger {
  background-color: hsl(var(--destructive) / 8%);
}

.remote-transfer-dialog__row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
}

.remote-transfer-dialog__row-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.remote-transfer-dialog__row-path {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remote-transfer-dialog__row-reason {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.remote-transfer-dialog__footer {
  padding-top: 4px;
}

.remote-transfer-dialog__actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@keyframes remote-transfer-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes remote-transfer-indeterminate {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(285%);
  }
}
</style>
