<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ActivityIcon,
  BanIcon,
  CheckIcon,
  LoaderCircleIcon,
  XIcon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useStatusCenterStore, type Operation, type OperationStatus, type OperationType } from '@/stores/runtime/status-center';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';
import { useCancelOperation } from './use-cancel-operation';

interface Props {
  operation: Operation;
}

const props = defineProps<Props>();

const { t } = useI18n();
const statusCenterStore = useStatusCenterStore();
const dirSizesStore = useDirSizesStore();
const { cancelOperation } = useCancelOperation();

const isActive = computed(() =>
  props.operation.status === 'in-progress'
  || props.operation.status === 'pending'
  || props.operation.status === 'cancelling',
);

const isCancellable = computed(() =>
  props.operation.status === 'in-progress'
  || props.operation.status === 'pending',
);

const isCancelling = computed(() => props.operation.status === 'cancelling');

function operationTypeShortKey(type: OperationType): string {
  if (type === 'deleteTrash') {
    return 'trash';
  }

  if (type === 'dir-size') {
    return 'dirSize';
  }

  return type;
}

function operationStatusShortKey(status: OperationStatus): string {
  if (status === 'in-progress') {
    return 'inProgress';
  }

  return status;
}

const operationSummaryLine = computed(() =>
  t('statusCenter.operationSummary', {
    operationType: t(`statusCenter.operationTypeShort.${operationTypeShortKey(props.operation.type)}`),
    operationStatus: t(`statusCenter.operationStatusShort.${operationStatusShortKey(props.operation.status)}`),
  }),
);

const showProgressBar = computed(() =>
  props.operation.progress != null && isActive.value,
);

const statusIcon = computed(() => {
  switch (props.operation.status) {
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
});

const operationLabel = computed(() => {
  if (
    props.operation.type === 'copy'
    || props.operation.type === 'move'
    || props.operation.type === 'deleteTrash'
    || props.operation.type === 'deletePermanent'
  ) {
    return primaryLabelForTransferOperation(props.operation);
  }

  if (props.operation.type === 'archive') {
    return props.operation.label;
  }

  return formatPath(props.operation.path);
});

const operationDetails = computed(() => buildOperationDetails(props.operation));

function formatPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function primaryLabelForTransferOperation(operation: Operation): string {
  const source = operation.sourceDisplayName?.trim();

  if (source) {
    return source;
  }

  const pathHint = operation.path?.trim();

  if (pathHint) {
    return pathHint;
  }

  return operation.label;
}

function transferOperationLocationSubtitle(operation: Operation): string {
  const primary = primaryLabelForTransferOperation(operation);
  const pathHint = operation.path?.trim() ?? '';

  if (pathHint && pathHint !== primary) {
    return pathHint;
  }

  return '';
}

function formatItemCountLine(processed: number | undefined, total: number | undefined): string | null {
  if (processed === undefined && total === undefined) {
    return null;
  }

  if (processed !== undefined && total !== undefined) {
    return `${processed.toLocaleString()} / ${total.toLocaleString()}`;
  }

  if (processed !== undefined) {
    return `${processed.toLocaleString()} / …`;
  }

  return null;
}

function parseCopyMoveInnerMessage(message: string | undefined): string {
  if (!message) {
    return '';
  }

  const separator = ' · ';
  const separatorIndex = message.indexOf(separator);

  if (separatorIndex === -1) {
    return message;
  }

  return message.slice(separatorIndex + separator.length).trim();
}

function isRedundantDeleteProgressMessage(
  sourceDisplayName: string,
  currentItemMessage: string,
): boolean {
  if (!currentItemMessage) {
    return true;
  }

  if (currentItemMessage === sourceDisplayName) {
    return true;
  }

  if (sourceDisplayName.startsWith(`${currentItemMessage} (`)) {
    return true;
  }

  return false;
}

function buildOperationDetails(operation: Operation): string {
  if (operation.type === 'dir-size') {
    if (operation.status === 'error') {
      return formatPath(operation.path);
    }

    const sizeInfo = dirSizesStore.getSize(operation.path);

    if (sizeInfo && sizeInfo.size > 0) {
      return formatBytes(sizeInfo.size);
    }

    return '';
  }

  if (operation.type === 'copy' || operation.type === 'move') {
    if (operation.status === 'error') {
      const primary = primaryLabelForTransferOperation(operation);
      const pathHint = operation.path?.trim() ?? '';

      if (pathHint && pathHint !== primary) {
        return pathHint;
      }

      return '';
    }

    if (
      operation.status === 'in-progress'
      || operation.status === 'pending'
      || operation.status === 'cancelling'
    ) {
      const segments: string[] = [];

      if (operation.progress != null) {
        segments.push(`${operation.progress}%`);
      }

      const itemCountLine = formatItemCountLine(operation.processedCount, operation.totalCount);

      if (itemCountLine) {
        segments.push(itemCountLine);
      }

      let inner = parseCopyMoveInnerMessage(operation.message);

      if (inner === 'Preparing') {
        inner = t('statusCenter.preparing');
      }

      if (inner) {
        segments.push(inner);
      }

      if (segments.length > 0) {
        return segments.join(' · ');
      }
    }

    return transferOperationLocationSubtitle(operation);
  }

  if (operation.type === 'deleteTrash' || operation.type === 'deletePermanent') {
    if (operation.status === 'error') {
      const primary = primaryLabelForTransferOperation(operation);
      const pathHint = operation.path?.trim() ?? '';

      if (pathHint && pathHint !== primary) {
        return pathHint;
      }

      return '';
    }

    if (
      operation.status === 'in-progress'
      || operation.status === 'pending'
      || operation.status === 'cancelling'
    ) {
      const sourceName = operation.sourceDisplayName ?? '';
      const segments: string[] = [];

      if (operation.progress != null) {
        segments.push(`${operation.progress}%`);
      }

      const itemCountLine = formatItemCountLine(operation.processedCount, operation.totalCount);

      if (itemCountLine) {
        segments.push(itemCountLine);
      }

      if (
        operation.message
        && !isRedundantDeleteProgressMessage(sourceName, operation.message)
      ) {
        segments.push(operation.message);
      }

      if (segments.length > 0) {
        return segments.join(' · ');
      }
    }

    return transferOperationLocationSubtitle(operation);
  }

  if (operation.type === 'archive') {
    const pathLeaf = formatPath(operation.path);
    const label = operation.label?.trim() ?? '';

    if (operation.status === 'error') {
      return pathLeaf;
    }

    if (
      operation.status === 'in-progress'
      || operation.status === 'pending'
      || operation.status === 'cancelling'
    ) {
      const segments: string[] = [];

      if (operation.progress != null) {
        segments.push(`${operation.progress}%`);
      }

      const itemCountLine = formatItemCountLine(operation.processedCount, operation.totalCount);

      if (itemCountLine) {
        segments.push(itemCountLine);
      }

      if (operation.message) {
        segments.push(operation.message);
      }

      if (segments.length > 0) {
        return `${pathLeaf} · ${segments.join(' · ')}`;
      }

      return pathLeaf;
    }

    if (pathLeaf && pathLeaf !== label) {
      return pathLeaf;
    }

    return '';
  }

  return operation.message || '';
}

async function handleCancel() {
  await cancelOperation(props.operation);
}

function handleDismiss() {
  statusCenterStore.removeOperation(props.operation.id);
}
</script>

<template>
  <div
    class="status-center-operation-row"
    :class="`status-center-operation-row--${operation.status}`"
  >
    <div class="status-center-operation-row__status-icon">
      <component
        :is="statusIcon"
        :size="14"
        :class="{
          'status-center-operation-row__spinner': isActive,
          'status-center-operation-row__check': operation.status === 'completed',
          'status-center-operation-row__error':
            operation.status === 'cancelled' || operation.status === 'error',
        }"
      />
    </div>

    <div class="status-center-operation-row__info">
      <div class="status-center-operation-row__meta-line">
        {{ operationSummaryLine }}
      </div>
      <div class="status-center-operation-row__label-line">
        <span class="status-center-operation-row__label">{{ operationLabel }}</span>
      </div>

      <div
        v-if="showProgressBar"
        class="status-center-operation-row__progress"
      >
        <div
          class="status-center-operation-row__progress-bar"
          :style="{ width: `${Math.min(100, Math.max(0, operation.progress ?? 0))}%` }"
        />
      </div>

      <span
        v-if="operationDetails"
        class="status-center-operation-row__details"
      >
        {{ operationDetails }}
      </span>

      <span
        v-if="operation.status === 'error' && operation.message"
        class="status-center-operation-row__error-message"
      >
        {{ operation.message }}
      </span>
    </div>

    <Button
      v-if="isCancellable"
      variant="ghost"
      size="sm"
      class="status-center-operation-row__action"
      :aria-label="t('cancel')"
      @click="handleCancel"
    >
      <BanIcon :size="12" />
    </Button>
    <div
      v-else-if="isCancelling"
      class="status-center-operation-row__action-slot"
      aria-hidden="true"
    />
    <Button
      v-else
      variant="ghost"
      size="sm"
      class="status-center-operation-row__action"
      :aria-label="t('close')"
      @click="handleDismiss"
    >
      <XIcon :size="12" />
    </Button>
  </div>
</template>

<style scoped>
.status-center-operation-row {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 5px;
  background: hsl(var(--muted) / 30%);
  gap: 8px;
  transition: background 0.15s ease;
}

.status-center-operation-row:hover {
  background: hsl(var(--muted) / 50%);
}

.status-center-operation-row--completed {
  opacity: 0.7;
}

.status-center-operation-row--cancelled,
.status-center-operation-row--error {
  opacity: 0.6;
}

.status-center-operation-row__status-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.status-center-operation-row__spinner {
  animation: spin 1s linear infinite;
  color: hsl(var(--primary));
}

.status-center-operation-row__check {
  color: hsl(var(--success, 142 76% 36%));
}

.status-center-operation-row__error {
  color: hsl(var(--muted-foreground));
}

.status-center-operation-row__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.status-center-operation-row__meta-line {
  overflow: hidden;
  min-width: 0;
  color: hsl(var(--foreground) / 94%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-center-operation-row__label-line {
  display: flex;
  min-width: 0;
  align-items: center;
}

.status-center-operation-row__label {
  overflow: hidden;
  min-width: 0;
  color: hsl(var(--foreground) / 72%);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-center-operation-row__progress {
  overflow: hidden;
  width: 100%;
  height: 3px;
  flex-shrink: 0;
  border-radius: 2px;
  margin-top: 2px;
  background: hsl(var(--muted) / 60%);
}

.status-center-operation-row__progress-bar {
  height: 100%;
  border-radius: 2px;
  background: hsl(var(--primary));
  transition: width 0.2s ease;
}

.status-center-operation-row__details {
  display: block;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  color: hsl(var(--muted-foreground));
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-center-operation-row__error-message {
  display: block;
  min-width: 0;
  max-width: 100%;
  margin-top: 2px;
  color: hsl(var(--destructive));
  font-size: 10px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.status-center-operation-row__action {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  color: hsl(var(--muted-foreground));
}

.status-center-operation-row__action:hover {
  color: hsl(var(--destructive));
}

.status-center-operation-row__action-slot {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
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
