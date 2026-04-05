<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ActivityIcon, LoaderCircleIcon, XIcon, CheckIcon, FolderIcon, FileArchiveIcon,
  BanIcon, Trash2Icon,
} from '@lucide/vue';
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStatusCenterStore } from '@/stores/runtime/status-center';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useArchiveJobsStore } from '@/stores/runtime/archive-jobs';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

const { t } = useI18n();
const statusCenterStore = useStatusCenterStore();
const { isOpen: statusCenterPopoverOpen } = storeToRefs(statusCenterStore);
const dirSizesStore = useDirSizesStore();
const archiveJobsStore = useArchiveJobsStore();
const deleteJobsStore = useDeleteJobsStore();

const hasOperations = computed(() => statusCenterStore.operationsList.length > 0);
const hasCompletedOperations = computed(() => statusCenterStore.completedOperations.length > 0);

function getOperationIcon(type: string) {
  switch (type) {
    case 'dir-size':
      return FolderIcon;
    case 'archive':
      return FileArchiveIcon;
    case 'delete':
      return Trash2Icon;
    default:
      return ActivityIcon;
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'in-progress':
    case 'pending':
    case 'cancelling':
      return LoaderCircleIcon;
    case 'completed':
      return CheckIcon;
    case 'cancelled':
    case 'error':
      return BanIcon;
    default:
      return ActivityIcon;
  }
}

function getGroupActiveCount(operations: typeof statusCenterStore.operationsList) {
  return operations.filter(
    op =>
      op.status === 'in-progress'
      || op.status === 'pending'
      || op.status === 'cancelling',
  ).length;
}

async function handleCancelOperation(operation: typeof statusCenterStore.operationsList[0]) {
  if (operation.type === 'dir-size') {
    await dirSizesStore.cancelSize(operation.path);
    statusCenterStore.completeOperation(operation.id, 'cancelled');
  }
  else if (operation.type === 'archive') {
    if (operation.status === 'cancelling') {
      return;
    }

    statusCenterStore.updateOperation(operation.id, {
      status: 'cancelling',
      message: t('statusCenter.cancelling'),
    });
    await archiveJobsStore.cancelJob(operation.id);
  }
  else if (operation.type === 'delete') {
    if (operation.status === 'cancelling') {
      return;
    }

    statusCenterStore.updateOperation(operation.id, {
      status: 'cancelling',
      message: t('statusCenter.cancelling'),
    });
    await deleteJobsStore.cancelJob(operation.id);
  }
}

async function handleCancelGroup(operations: typeof statusCenterStore.operationsList) {
  for (const op of operations) {
    if (op.status === 'in-progress' || op.status === 'pending') {
      await handleCancelOperation(op);
    }
  }
}

function handleClearCompleted() {
  statusCenterStore.clearCompleted();
}

function handleDismiss(id: string) {
  statusCenterStore.removeOperation(id);
}

function formatPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function operationPrimaryLabel(operation: typeof statusCenterStore.operationsList[0]): string {
  if (operation.type === 'archive' || operation.type === 'delete') {
    return operation.label;
  }

  return formatPath(operation.path);
}

function handleStatusCenterPointerDownOutside(event: PointerDownOutsideEvent) {
  if (statusCenterStore.isOutsideDismissSuppressed()) {
    event.preventDefault();
  }
}

function handleStatusCenterFocusOutside(event: FocusOutsideEvent) {
  if (statusCenterStore.isOutsideDismissSuppressed()) {
    event.preventDefault();
  }
}

function getOperationDetails(operation: typeof statusCenterStore.operationsList[0]): string {
  if (operation.type === 'dir-size') {
    const sizeInfo = dirSizesStore.getSize(operation.path);

    if (sizeInfo && sizeInfo.size > 0) {
      return formatBytes(sizeInfo.size);
    }
  }

  if (operation.type === 'archive' || operation.type === 'delete') {
    const name = formatPath(operation.path);
    const segments: string[] = [];

    if (
      operation.progress != null
      && (
        operation.status === 'in-progress'
        || operation.status === 'pending'
        || operation.status === 'cancelling'
      )
    ) {
      segments.push(`${operation.progress}%`);
    }

    if (operation.message) {
      segments.push(operation.message);
    }

    if (segments.length > 0) {
      return `${name} · ${segments.join(' · ')}`;
    }

    return name;
  }

  return operation.message || '';
}
</script>

<template>
  <div class="status-center-toolbar-button animate-fade-in">
    <Popover v-model:open="statusCenterPopoverOpen">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="status-center-toolbar-button__button"
          :class="{ 'status-center-toolbar-button__button--active': statusCenterStore.hasActiveOperations }"
        >
          <LoaderCircleIcon
            v-if="statusCenterStore.hasActiveOperations"
            :size="16"
            class="status-center-toolbar-button__icon status-center-toolbar-button__icon--spinning"
          />
          <ActivityIcon
            v-else
            :size="16"
            class="status-center-toolbar-button__icon"
          />
          <span
            v-if="statusCenterStore.activeCount > 0"
            class="status-center-toolbar-button__badge"
          >
            {{ statusCenterStore.activeCount }}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        :side-offset="8"
        class="status-center-popover"
        @pointer-down-outside="handleStatusCenterPointerDownOutside"
        @focus-outside="handleStatusCenterFocusOutside"
      >
        <div class="status-center">
          <div class="status-center__header">
            <h3 class="status-center__title">
              {{ t('statusCenter.title') }}
            </h3>
            <Button
              variant="secondary"
              size="xs"
              class="status-center__clear-btn"
              :class="{ 'status-center__clear-btn--hidden': !hasCompletedOperations }"
              :disabled="!hasCompletedOperations"
              @click="handleClearCompleted"
            >
              {{ t('statusCenter.clearCompleted') }}
            </Button>
          </div>

          <ScrollArea
            v-if="hasOperations"
            class="status-center__content"
          >
            <div
              v-for="group in statusCenterStore.groupedOperations"
              :key="group.type"
              class="status-center__group"
            >
              <div class="status-center__group-header">
                <div class="status-center__group-title-wrapper">
                  <component
                    :is="getOperationIcon(group.type)"
                    :size="14"
                    class="status-center__group-icon"
                  />
                  <span class="status-center__group-title">{{ t(`statusCenter.groups.${group.type}`) }}</span>
                </div>
                <div
                  v-if="getGroupActiveCount(group.operations) > 0"
                  class="status-center__group-actions"
                >
                  <span class="status-center__group-count">
                    {{ getGroupActiveCount(group.operations) }} {{ t('statusCenter.active') }}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    class="status-center__group-cancel"
                    @click="handleCancelGroup(group.operations)"
                  >
                    {{ t('statusCenter.cancelAll') }}
                  </Button>
                </div>
              </div>

              <div class="status-center__operations">
                <div
                  v-for="operation in group.operations"
                  :key="operation.id"
                  class="status-center__operation"
                  :class="`status-center__operation--${operation.status}`"
                >
                  <div class="status-center__operation-icon">
                    <component
                      :is="getStatusIcon(operation.status)"
                      :size="14"
                      :class="{
                        'status-center__spinner':
                          operation.status === 'in-progress'
                          || operation.status === 'pending'
                          || operation.status === 'cancelling',
                        'status-center__check': operation.status === 'completed',
                        'status-center__error': operation.status === 'cancelled' || operation.status === 'error',
                      }"
                    />
                  </div>
                  <div class="status-center__operation-info">
                    <span class="status-center__operation-label">{{ operationPrimaryLabel(operation) }}</span>
                    <div
                      v-if="
                        operation.progress != null
                          && (
                            operation.status === 'in-progress'
                            || operation.status === 'pending'
                            || operation.status === 'cancelling'
                          )
                      "
                      class="status-center__operation-progress"
                    >
                      <div
                        class="status-center__operation-progress-bar"
                        :style="{ width: `${Math.min(100, Math.max(0, operation.progress))}%` }"
                      />
                    </div>
                    <span
                      v-if="getOperationDetails(operation)"
                      class="status-center__operation-details"
                    >
                      {{ getOperationDetails(operation) }}
                    </span>
                  </div>
                  <Button
                    v-if="operation.status === 'in-progress' || operation.status === 'pending'"
                    variant="ghost"
                    size="sm"
                    class="status-center__operation-cancel"
                    @click="handleCancelOperation(operation)"
                  >
                    <BanIcon :size="12" />
                  </Button>
                  <div
                    v-else-if="operation.status === 'cancelling'"
                    class="status-center__operation-action-slot"
                    aria-hidden="true"
                  />
                  <Button
                    v-else
                    variant="ghost"
                    size="sm"
                    class="status-center__operation-dismiss"
                    @click="handleDismiss(operation.id)"
                  >
                    <XIcon :size="12" />
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div
            v-else
            class="status-center__empty"
          >
            <ActivityIcon
              :size="24"
              class="status-center__empty-icon"
            />
            <span>{{ t('statusCenter.noOperations') }}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.status-center-toolbar-button :deep(.sigma-ui-button) {
  position: relative;
  width: 28px;
  height: 28px;
}

.status-center-toolbar-button__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.status-center-toolbar-button__icon--spinning {
  animation: spin 1.5s linear infinite;
  stroke: hsl(var(--primary));
}

.status-center-toolbar-button__button--active :deep(.sigma-ui-button) {
  background: hsl(var(--primary) / 10%);
}

.status-center-toolbar-button__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  display: flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 10px;
  font-weight: 600;
}

:global(.status-center-popover) {
  width: 340px;
  padding: 0;
}

.status-center {
  display: flex;
  flex-direction: column;
}

.status-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border));
}

.status-center__title {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-center__clear-btn {
  min-width: 0;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  transition: opacity 0.15s ease;
}

.status-center__clear-btn--hidden {
  opacity: 0;
  pointer-events: none;
}

.status-center__content {
  max-height: 400px;
}

.status-center__group {
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border) / 50%);
}

.status-center__group:last-child {
  border-bottom: none;
}

.status-center__group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 4px 8px;
}

.status-center__group-icon {
  color: hsl(var(--muted-foreground));
}

.status-center__group-title-wrapper {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-center__group-title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-center__group-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-center__group-count {
  padding: 2px 6px;
  border-radius: 3px;
  background: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-size: 10px;
  font-weight: 500;
}

.status-center__group-cancel {
  height: 22px;
  padding: 0 8px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.status-center__group-cancel:hover {
  color: hsl(var(--destructive));
}

.status-center__operations {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.status-center__operation {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 5px;
  background: hsl(var(--muted) / 30%);
  gap: 8px;
  transition: background 0.15s ease;
}

.status-center__operation:hover {
  background: hsl(var(--muted) / 50%);
}

.status-center__operation-action-slot {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.status-center__operation--completed {
  opacity: 0.7;
}

.status-center__operation--cancelled,
.status-center__operation--error {
  opacity: 0.6;
}

.status-center__operation-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.status-center__spinner {
  animation: spin 1s linear infinite;
  color: hsl(var(--primary));
}

.status-center__check {
  color: hsl(var(--success, 142 76% 36%));
}

.status-center__error {
  color: hsl(var(--muted-foreground));
}

.status-center__operation-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.status-center__operation-label {
  overflow: hidden;
  color: hsl(var(--foreground) / 80%);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-center__operation-details {
  color: hsl(var(--muted-foreground));
  font-size: 10px;
}

.status-center__operation-progress {
  overflow: hidden;
  width: 100%;
  height: 3px;
  flex-shrink: 0;
  border-radius: 2px;
  background: hsl(var(--muted) / 60%);
}

.status-center__operation-progress-bar {
  height: 100%;
  border-radius: 2px;
  background: hsl(var(--primary));
  transition: width 0.2s ease;
}

.status-center__operation-cancel,
.status-center__operation-dismiss {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  color: hsl(var(--muted-foreground));
}

.status-center__operation-cancel:hover {
  color: hsl(var(--destructive));
}

.status-center__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  gap: 6px;
}

.status-center__empty-icon {
  opacity: 0.5;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
