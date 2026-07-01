<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOpenIcon, PackageIcon } from '@lucide/vue';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import ExtensionIcon from '@/modules/extensions/components/extension-icon.vue';
import BinaryDownloadLinkButton from '@/modules/extensions/components/binary-download-link-button.vue';
import {
  applyBinarySetupRows,
  closeBinarySetup,
  extensionBinarySetupState,
  type BinarySetupRowState,
} from '@/modules/extensions/utils/extension-binary-setup-state';
import { validateBinaryPath } from '@/modules/extensions/utils/binary-path-validation';
import { useBinaryEditAvailability } from '@/modules/extensions/utils/binary-edit-availability';
import { showBinarySetupSavedToast, showBinaryEditBlockedToast } from '@/modules/extensions/utils/toast-utils';

const { t } = useI18n();
const { isBinaryEditBlocked, isBinaryRowEditBlocked } = useBinaryEditAvailability();

const isOpen = computed({
  get: () => extensionBinarySetupState.value.isOpen,
  set: (value: boolean) => {
    if (!value) {
      handleCancel();
    }
  },
});

const modalState = computed(() => extensionBinarySetupState.value);
const isEditMode = computed(() => modalState.value.mode === 'edit');
const isDependenciesEdit = computed(() => modalState.value.scope === 'dependencies');
const autoSetupEnabled = ref(true);
const showDependencyList = computed(() => isEditMode.value || !autoSetupEnabled.value);
const hasSharedBinaryWarning = computed(() => {
  return showDependencyList.value && modalState.value.rows.some(row => row.sharedExtensionCount > 0);
});

const canContinue = computed(() => {
  if (isEditMode.value && isBinaryEditBlocked.value) {
    return false;
  }

  return modalState.value.rows.every((row) => {
    if (row.useManagedDownload) {
      return true;
    }

    if (!row.customPath.trim()) {
      return false;
    }

    return row.validationStatus === 'valid';
  });
});

let validationSequence = 0;

async function validateRowPath(row: BinarySetupRowState): Promise<void> {
  const currentSequence = ++validationSequence;
  row.validationStatus = 'pending';

  const isValid = await validateBinaryPath(row.customPath);

  if (currentSequence !== validationSequence) {
    return;
  }

  row.validationStatus = isValid ? 'valid' : 'invalid';
}

function applyAutoSetupToRows(): void {
  for (const row of modalState.value.rows) {
    row.useManagedDownload = true;
    row.validationStatus = 'idle';
  }
}

function handleAutoSetupToggle(enabled: boolean): void {
  autoSetupEnabled.value = enabled;

  if (enabled) {
    applyAutoSetupToRows();
  }
}

function handleManagedToggle(row: BinarySetupRowState, enabled: boolean): void {
  row.useManagedDownload = enabled;

  if (!enabled && row.customPath.trim()) {
    void validateRowPath(row);
  }
  else if (enabled) {
    row.validationStatus = 'idle';
  }
}

function handleCustomPathInput(row: BinarySetupRowState, value: string | number | undefined): void {
  row.customPath = String(value ?? '');

  if (!row.useManagedDownload && row.customPath.trim()) {
    void validateRowPath(row);
  }
  else if (!row.customPath.trim()) {
    row.validationStatus = 'idle';
  }
}

async function browseForBinary(row: BinarySetupRowState): Promise<void> {
  const selected = await openDialog({
    directory: false,
    multiple: false,
    title: t('extensions.binaries.browseTitle', { name: row.name }),
  });

  if (selected && typeof selected === 'string') {
    row.customPath = selected;
    await validateRowPath(row);
  }
}

function getValidationHint(row: BinarySetupRowState): string | null {
  if (row.useManagedDownload || !row.customPath.trim()) {
    return null;
  }

  switch (row.validationStatus) {
    case 'valid':
      return t('extensions.binaries.pathValid');
    case 'invalid':
      return t('extensions.binaries.pathInvalid');
    case 'pending':
      return t('extensions.binaries.pathValidating');
    default:
      return null;
  }
}

function getValidationHintClass(row: BinarySetupRowState): string {
  if (row.validationStatus === 'valid') {
    return 'extension-binary-setup-modal__hint--valid';
  }

  if (row.validationStatus === 'invalid') {
    return 'extension-binary-setup-modal__hint--invalid';
  }

  return '';
}

function isRowEditLocked(row: BinarySetupRowState): boolean {
  return isEditMode.value && isBinaryRowEditBlocked(row.binaryId);
}

async function handleContinue(): Promise<void> {
  if (!canContinue.value) {
    return;
  }

  if (isEditMode.value && isBinaryEditBlocked.value) {
    showBinaryEditBlockedToast();
    return;
  }

  const rows = modalState.value.rows;
  const extensionId = modalState.value.extensionId;
  const hasResolver = modalState.value.resolve !== null;

  await applyBinarySetupRows(extensionId, rows);

  if (isEditMode.value) {
    showBinarySetupSavedToast(
      rows,
      isDependenciesEdit.value ? undefined : extensionId,
    );
  }

  if (hasResolver) {
    closeBinarySetup(true);
    return;
  }

  closeBinarySetup(true);
}

function handleCancel(): void {
  if (modalState.value.resolve) {
    closeBinarySetup(false);
    return;
  }

  closeBinarySetup(false);
}

watch(isOpen, (open) => {
  if (!open) {
    validationSequence += 1;
    return;
  }

  if (!isEditMode.value) {
    autoSetupEnabled.value = true;
    applyAutoSetupToRows();
  }

  for (const row of modalState.value.rows) {
    if (!row.useManagedDownload && row.customPath.trim()) {
      void validateRowPath(row);
    }
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent
      class="extension-binary-setup-modal"
      :class="{ 'extension-binary-setup-modal--auto-setup': !isEditMode && autoSetupEnabled }"
    >
      <DialogHeader class="extension-binary-setup-modal__header">
        <DialogTitle class="extension-binary-setup-modal__title">
          <span class="extension-binary-setup-modal__title-text">
            {{
              isDependenciesEdit
                ? t('extensions.binaries.editDependenciesTitle')
                : isEditMode
                  ? t('extensions.binaries.editTitle')
                  : t('extensions.binaries.installTitle')
            }}
          </span>
          <span
            v-if="!isDependenciesEdit"
            class="extension-binary-setup-modal__badge extension-binary-setup-modal__title-badge"
          >
            <ExtensionIcon
              :extension-id="modalState.extensionId"
              :icon-path="modalState.extensionIconPath"
              :repository="modalState.extensionRepository"
              :version="modalState.extensionVersion"
              :is-installed="modalState.extensionIsInstalled"
              :size="12"
            />
            {{ modalState.extensionName }}
          </span>
        </DialogTitle>
        <DialogDescription class="extension-binary-setup-modal__description">
          <template v-if="isEditMode">
            {{
              isDependenciesEdit
                ? t('extensions.binaries.editDependenciesDescription')
                : t('extensions.binaries.editDescription')
            }}
          </template>
          <template v-else>
            <p class="extension-binary-setup-modal__intro">
              {{ t('extensions.binaries.installIntro') }}
            </p>
            <p
              v-if="!autoSetupEnabled"
              class="extension-binary-setup-modal__instructions"
            >
              {{ t('extensions.binaries.installDescription') }}
            </p>
          </template>
        </DialogDescription>
      </DialogHeader>

      <div class="extension-binary-setup-modal__body">
        <div
          v-if="!isEditMode"
          class="extension-binary-setup-modal__auto-setup"
        >
          <div class="extension-binary-setup-modal__switch-row">
            <Switch
              id="binary-auto-setup"
              :model-value="autoSetupEnabled"
              @update:model-value="handleAutoSetupToggle"
            />
            <div class="extension-binary-setup-modal__auto-setup-label">
              <Label for="binary-auto-setup">
                {{ t('extensions.binaries.autoSetup') }}
              </Label>
              <p class="extension-binary-setup-modal__auto-setup-description">
                {{ t('extensions.binaries.autoSetupDescription') }}
              </p>
            </div>
          </div>
        </div>

        <p
          v-if="hasSharedBinaryWarning"
          class="extension-binary-setup-modal__shared-warning"
        >
          {{ t('extensions.binaries.sharedWarning') }}
        </p>

        <ScrollArea
          v-if="showDependencyList"
          class="extension-binary-setup-modal__list"
        >
          <div class="extension-binary-setup-modal__list-content">
            <article
              v-for="row in modalState.rows"
              :key="row.binaryId"
              class="extension-binary-setup-modal__card"
            >
              <div class="extension-binary-setup-modal__card-top">
                <div class="extension-binary-setup-modal__card-icon">
                  <PackageIcon :size="22" />
                </div>

                <div class="extension-binary-setup-modal__card-main">
                  <div class="extension-binary-setup-modal__card-header">
                    <span class="extension-binary-setup-modal__card-name">{{ row.name }}</span>
                    <BinaryDownloadLinkButton :download-url="row.downloadUrl" />
                  </div>

                  <div class="extension-binary-setup-modal__card-meta">
                    <span>{{ t('extensions.versionPrefix') }}{{ row.version }}</span>
                    <span class="extension-binary-setup-modal__meta-separator">{{ t('extensions.metaSeparator') }}</span>
                    <span>{{ row.platformLabel }}</span>
                  </div>

                  <span
                    v-if="row.sharedExtensionCount > 0"
                    class="extension-binary-setup-modal__badge extension-binary-setup-modal__shared-badge"
                  >
                    {{ t('extensions.binaries.sharedWith', { count: row.sharedExtensionCount }) }}
                  </span>

                  <p
                    v-if="row.versionMismatch"
                    class="extension-binary-setup-modal__version-note"
                  >
                    {{ t('extensions.binaries.versionMismatch') }}
                  </p>
                </div>
              </div>

              <div class="extension-binary-setup-modal__card-controls">
                <div class="extension-binary-setup-modal__switch-row">
                  <Switch
                    :id="`binary-managed-${row.binaryId}`"
                    :model-value="row.useManagedDownload"
                    :disabled="isRowEditLocked(row)"
                    @update:model-value="handleManagedToggle(row, $event)"
                  />
                  <Label :for="`binary-managed-${row.binaryId}`">
                    {{ t('extensions.binaries.useManagedDownload') }}
                  </Label>
                </div>

                <p
                  v-if="isRowEditLocked(row)"
                  class="extension-binary-setup-modal__install-lock-note"
                >
                  {{ t('extensions.binaries.installInProgressNote') }}
                </p>

                <div
                  v-if="!row.useManagedDownload"
                  class="extension-binary-setup-modal__custom-path"
                >
                  <div class="extension-binary-setup-modal__path-input-row">
                    <Input
                      :model-value="row.customPath"
                      :placeholder="t('extensions.binaries.customPathPlaceholder')"
                      :disabled="isRowEditLocked(row)"
                      @update:model-value="handleCustomPathInput(row, $event)"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      :title="t('extensions.binaries.browse')"
                      :disabled="isRowEditLocked(row)"
                      @click="browseForBinary(row)"
                    >
                      <FolderOpenIcon :size="16" />
                    </Button>
                  </div>
                  <p class="extension-binary-setup-modal__custom-path-hint">
                    {{ t('extensions.binaries.customPathHint') }}
                  </p>
                  <p
                    v-if="getValidationHint(row)"
                    class="extension-binary-setup-modal__hint"
                    :class="getValidationHintClass(row)"
                  >
                    {{ getValidationHint(row) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </ScrollArea>
      </div>

      <DialogFooter class="extension-binary-setup-modal__footer">
        <Button
          variant="ghost"
          @click="handleCancel"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          :disabled="!canContinue"
          @click="handleContinue"
        >
          {{ isEditMode ? t('save') : t('extensions.binaries.continue') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.extension-binary-setup-modal.sigma-ui-dialog-content {
  display: flex;
  overflow: hidden;
  width: min(560px, calc(100vw - 2rem));
  max-width: min(560px, calc(100vw - 2rem));
  height: min(calc(100vh - 2rem), 600px);
  max-height: min(calc(100vh - 2rem), 600px);
  flex-direction: column;
  padding: 1.25rem;
  gap: 0;
}

.extension-binary-setup-modal--auto-setup.sigma-ui-dialog-content {
  height: auto;
  max-height: min(calc(100vh - 2rem), 600px);
}

.extension-binary-setup-modal--auto-setup .extension-binary-setup-modal__body {
  flex: 0 0 auto;
}

.extension-binary-setup-modal__header {
  flex-shrink: 0;
}

.extension-binary-setup-modal__description {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  line-height: 1.5;
}

.extension-binary-setup-modal__intro {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.extension-binary-setup-modal__instructions {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.extension-binary-setup-modal__title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  line-height: 1.3;
}

.extension-binary-setup-modal__title-text {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.extension-binary-setup-modal__badge {
  display: inline-flex;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 50%);
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 500;
  gap: 6px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-binary-setup-modal__title-badge .extension-icon {
  flex-shrink: 0;
}

.extension-binary-setup-modal__shared-badge {
  align-self: flex-start;
  margin-top: 2px;
}

.extension-binary-setup-modal__body {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin-top: 0.75rem;
  gap: 0.75rem;
}

.extension-binary-setup-modal__auto-setup {
  flex-shrink: 0;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}

.extension-binary-setup-modal__auto-setup-label {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.extension-binary-setup-modal__auto-setup-description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  line-height: 1.4;
}

.extension-binary-setup-modal__shared-warning {
  flex-shrink: 0;
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.extension-binary-setup-modal__list.sigma-ui-scroll-area {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.extension-binary-setup-modal__list-content {
  display: flex;
  flex-direction: column;
  padding: 2px 4px 2px 2px;
  gap: 8px;
}

.extension-binary-setup-modal__card {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  gap: 14px;
  transition: border-color 0.2s;
}

.extension-binary-setup-modal__card-top {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.extension-binary-setup-modal__card-icon {
  display: flex;
  width: 48px;
  min-width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.extension-binary-setup-modal__card-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.extension-binary-setup-modal__card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.extension-binary-setup-modal__card-name {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.extension-binary-setup-modal__card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  gap: 6px;
}

.extension-binary-setup-modal__meta-separator {
  opacity: 0.5;
}

.extension-binary-setup-modal__version-note {
  margin: 0;
  color: hsl(38deg 92% 40%);
  font-size: 0.8125rem;
}

.extension-binary-setup-modal__card-controls {
  display: flex;
  flex-direction: column;
  padding-top: 12px;
  border-top: 1px solid hsl(var(--border) / 60%);
  gap: 10px;
}

.extension-binary-setup-modal__switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.extension-binary-setup-modal__install-lock-note {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.extension-binary-setup-modal__custom-path {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extension-binary-setup-modal__custom-path-hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.extension-binary-setup-modal__path-input-row {
  display: flex;
  gap: 8px;
}

.extension-binary-setup-modal__path-input-row .sigma-ui-input {
  min-width: 0;
  flex: 1;
}

.extension-binary-setup-modal__hint {
  margin: 0;
  font-size: 0.75rem;
}

.extension-binary-setup-modal__hint--valid {
  color: hsl(142deg 76% 36%);
}

.extension-binary-setup-modal__hint--invalid {
  color: hsl(var(--destructive));
}

.extension-binary-setup-modal__footer {
  flex-shrink: 0;
  padding-top: 1rem;
  border-top: 1px solid hsl(var(--border) / 60%);
  margin-top: 0.75rem;
}
</style>
