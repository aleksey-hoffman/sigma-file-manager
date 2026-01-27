<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, ConfirmButton } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  KeyboardIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
  SearchIcon,
  TextSearchIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  CheckCheckIcon,
  Trash2Icon,
  PencilIcon,
  XIcon,
  UserIcon,
  SettingsIcon,
  LockIcon,
  EyeIcon,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import {
  useShortcutsStore,
  formatShortcutKeys,
  formatConditionsLabel,
  type ShortcutId,
  type ShortcutKeys,
} from '@/stores/runtime/shortcuts';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

const shortcutIcons: Record<ShortcutId, Component> = {
  toggleGlobalSearch: SearchIcon,
  toggleFilter: TextSearchIcon,
  toggleSettingsSearch: TextSearchIcon,
  copy: CopyIcon,
  cut: FolderInputIcon,
  paste: ClipboardPasteIcon,
  selectAll: CheckCheckIcon,
  delete: Trash2Icon,
  deletePermanently: Trash2Icon,
  rename: PencilIcon,
  escape: XIcon,
  quickView: EyeIcon,
};

const isDialogOpen = ref(false);
const editingShortcutId = ref<ShortcutId | null>(null);
const recordedKeys = ref<ShortcutKeys | null>(null);
const isRecording = ref(false);
const recordButtonRef = ref<HTMLButtonElement | null>(null);

const editingDefinition = computed(() => {
  if (!editingShortcutId.value) return null;
  return shortcutsStore.getShortcutDefinition(editingShortcutId.value);
});

const currentEditingShortcutLabel = computed(() => {
  if (!editingShortcutId.value) return '';
  return shortcutsStore.getShortcutLabel(editingShortcutId.value);
});

const recordedKeysLabel = computed(() => {
  if (!recordedKeys.value) return '';
  return formatShortcutKeys(recordedKeys.value);
});

const conflictingShortcut = computed(() => {
  if (!recordedKeys.value || !editingShortcutId.value) return null;
  return shortcutsStore.findConflictingShortcut(recordedKeys.value, editingShortcutId.value);
});

const hasConflict = computed(() => conflictingShortcut.value !== null);

function openShortcutEditor(shortcutId: ShortcutId) {
  const definition = shortcutsStore.getShortcutDefinition(shortcutId);
  if (definition?.isReadOnly) return;

  editingShortcutId.value = shortcutId;
  recordedKeys.value = null;
  isRecording.value = true;
  isDialogOpen.value = true;

  nextTick(() => {
    focusRecordButton();
  });
}

function focusRecordButton() {
  recordButtonRef.value?.focus();
}

function startRecording() {
  isRecording.value = true;
  recordedKeys.value = null;
  focusRecordButton();
}

function handleRecordKeyDown(event: KeyboardEvent) {
  const key = event.key;

  if (key === 'Escape') {
    if (isRecording.value && recordedKeys.value === null) {
      isDialogOpen.value = false;
    }
    else {
      isRecording.value = false;
    }

    return;
  }

  if (key === 'Tab') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    return;
  }

  const keys: ShortcutKeys = {
    key: key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };

  recordedKeys.value = keys;
  isRecording.value = false;
}

async function saveShortcut() {
  if (!editingShortcutId.value || !recordedKeys.value || hasConflict.value) return;

  await shortcutsStore.setShortcut(editingShortcutId.value, recordedKeys.value);
  isDialogOpen.value = false;
  editingShortcutId.value = null;
  recordedKeys.value = null;
}

async function resetShortcut() {
  if (!editingShortcutId.value) return;

  await shortcutsStore.resetShortcut(editingShortcutId.value);
  isDialogOpen.value = false;
  editingShortcutId.value = null;
  recordedKeys.value = null;
}

async function resetAllShortcuts() {
  await shortcutsStore.resetAllShortcuts();
}

function getConditionsLabel(shortcutId: ShortcutId): string {
  const definition = shortcutsStore.getShortcutDefinition(shortcutId);
  if (!definition) return '';
  return formatConditionsLabel(definition.conditions);
}

function getSourceLabel(shortcutId: ShortcutId): string {
  return shortcutsStore.getSource(shortcutId) === 'user' ? 'User' : 'System';
}

function getSourceIcon(shortcutId: ShortcutId): Component {
  return shortcutsStore.getSource(shortcutId) === 'user' ? UserIcon : SettingsIcon;
}

watch(isDialogOpen, (open) => {
  if (!open) {
    isRecording.value = false;
    recordedKeys.value = null;
    editingShortcutId.value = null;
  }
});

watch(isDialogOpen, (open) => {
  if (open) {
    nextTick(() => {
      focusRecordButton();
    });
  }
});
</script>

<template>
  <div class="shortcuts-card">
    <div class="shortcuts-card__header">
      <div class="shortcuts-card__header-left">
        <KeyboardIcon
          :size="24"
          class="shortcuts-card__icon"
        />
        <h3 class="shortcuts-card__title">
          {{ t('settingsTabs.shortcuts') }}
        </h3>
      </div>
      <ConfirmButton
        variant="outline"
        size="sm"
        class="shortcuts-card__reset-all-button"
        @click="resetAllShortcuts"
      >
        <RotateCcwIcon :size="14" />
        {{ t('resetAll') }}
      </ConfirmButton>
    </div>

    <div class="shortcuts-section">
      <div class="shortcuts-table">
        <div class="shortcuts-table__header">
          <div class="shortcuts-table__header-cell shortcuts-table__cell--command">
            {{ t('command') }}
          </div>
          <div class="shortcuts-table__header-cell shortcuts-table__cell--keybinding">
            {{ t('keybinding') }}
          </div>
          <div class="shortcuts-table__header-cell shortcuts-table__cell--when">
            {{ t('when') }}
          </div>
          <div class="shortcuts-table__header-cell shortcuts-table__cell--source">
            {{ t('source') }}
          </div>
        </div>

        <div class="shortcuts-table__body">
          <div
            v-for="definition in shortcutsStore.definitions"
            :key="definition.id"
            class="shortcuts-table__row"
            :class="{ 'shortcuts-table__row--readonly': definition.isReadOnly }"
            @click="openShortcutEditor(definition.id)"
          >
            <div class="shortcuts-table__cell shortcuts-table__cell--command">
              <component
                :is="shortcutIcons[definition.id]"
                :size="14"
                class="shortcuts-table__cell-icon"
              />
              <span class="shortcuts-table__cell-text">
                {{ t(definition.labelKey) }}
              </span>
            </div>

            <div class="shortcuts-table__cell shortcuts-table__cell--keybinding">
              <kbd class="shortcuts-table__kbd">
                {{ shortcutsStore.getShortcutLabel(definition.id) }}
              </kbd>
            </div>

            <div class="shortcuts-table__cell shortcuts-table__cell--when">
              <TooltipProvider v-if="getConditionsLabel(definition.id)">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <code class="shortcuts-table__when-code">
                      {{ getConditionsLabel(definition.id) }}
                    </code>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <code class="shortcuts-table__when-tooltip-code">
                      {{ getConditionsLabel(definition.id) }}
                    </code>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div class="shortcuts-table__cell shortcuts-table__cell--source">
              <span
                class="shortcuts-table__source"
                :class="{
                  'shortcuts-table__source--user': shortcutsStore.getSource(definition.id) === 'user',
                  'shortcuts-table__source--system': shortcutsStore.getSource(definition.id) === 'system',
                }"
              >
                <component
                  :is="getSourceIcon(definition.id)"
                  :size="12"
                />
                {{ getSourceLabel(definition.id) }}
              </span>
              <LockIcon
                v-if="definition.isReadOnly"
                :size="10"
                class="shortcuts-table__lock-icon"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog v-model:open="isDialogOpen">
        <DialogContent class="shortcut-editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {{ t('shortcutsUI.changeShortcut') }}
            </DialogTitle>
            <DialogDescription v-if="editingDefinition">
              {{ t(editingDefinition.labelKey) }}
            </DialogDescription>
          </DialogHeader>

          <div class="shortcut-editor">
            <div class="shortcut-editor__info-row">
              <span class="shortcut-editor__label">
                {{ t('dialogs.shortcutEditorDialog.shortcut') }}:
              </span>
              <kbd class="shortcut-editor__kbd">
                {{ currentEditingShortcutLabel }}
              </kbd>
            </div>

            <div
              v-if="editingDefinition && getConditionsLabel(editingDefinition.id)"
              class="shortcut-editor__info-row"
            >
              <span class="shortcut-editor__label">
                {{ t('when') }}:
              </span>
              <code class="shortcut-editor__when-code">
                {{ getConditionsLabel(editingDefinition.id) }}
              </code>
            </div>

            <div class="shortcut-editor__recording">
              <button
                ref="recordButtonRef"
                type="button"
                class="shortcut-editor__record-button"
                :class="{
                  'shortcut-editor__record-button--recording': isRecording,
                  'shortcut-editor__record-button--has-value': recordedKeys && !isRecording,
                  'shortcut-editor__record-button--conflict': hasConflict,
                }"
                @click="startRecording"
                @keydown="handleRecordKeyDown"
              >
                <span
                  v-if="isRecording"
                  class="shortcut-editor__record-pulse"
                />
                <kbd
                  v-if="recordedKeys && !isRecording"
                  class="shortcut-editor__recorded-kbd"
                >
                  {{ recordedKeysLabel }}
                </kbd>
                <span
                  v-else-if="isRecording"
                  class="shortcut-editor__record-text"
                >
                  {{ t('dialogs.shortcutEditorDialog.pressDesiredKeyCombination') }}
                </span>
                <span
                  v-else
                  class="shortcut-editor__record-placeholder"
                >
                  {{ t('click') }}
                </span>
              </button>

              <div
                v-if="hasConflict && conflictingShortcut"
                class="shortcut-editor__conflict"
              >
                <AlertTriangleIcon :size="14" />
                <span>{{ t('conflict') }}: {{ t(conflictingShortcut.labelKey) }}</span>
              </div>
            </div>
          </div>

          <div class="shortcut-editor-dialog__footer">
            <ConfirmButton
              variant="outline"
              class="shortcut-editor-dialog__footer-button"
              @click="resetShortcut"
            >
              <RotateCcwIcon :size="14" />
              {{ t('shortcutsUI.resetShortcut') }}
            </ConfirmButton>
            <div class="shortcut-editor-dialog__footer-right">
              <DialogClose as-child>
                <Button variant="outline">
                  {{ t('cancel') }}
                </Button>
              </DialogClose>
              <Button
                :disabled="!recordedKeys || hasConflict"
                @click="saveShortcut"
              >
                {{ t('save') }}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-card {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}

.shortcuts-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  gap: 1rem;
}

.shortcuts-card__header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.shortcuts-card__icon {
  flex-shrink: 0;
  color: hsl(var(--icon));
}

.shortcuts-card__title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 1rem;
  font-weight: 600;
}

.shortcuts-card__reset-all-button {
  gap: 8px;
}

.shortcuts-section {
  display: flex;
  flex-direction: column;
}

.shortcuts-table {
  display: flex;
  width: 100%;
  flex-direction: column;
}

.shortcuts-table__header {
  display: grid;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 30%);
  font-size: 0.75rem;
  font-weight: 600;
  grid-template-columns: 1fr 140px 160px 100px;
  text-transform: uppercase;
}

.shortcuts-table__header-cell {
  padding: 0.5rem 1rem;
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__body {
  display: flex;
  flex-direction: column;
}

.shortcuts-table__row {
  display: grid;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  cursor: pointer;
  grid-template-columns: 1fr 140px 160px 100px;
  transition: background-color 0.1s ease;
}

.shortcuts-table__row:hover {
  background-color: hsl(var(--muted) / 30%);
}

.shortcuts-table__row--readonly {
  cursor: not-allowed;
  opacity: 0.7;
}

.shortcuts-table__row--readonly:hover {
  background-color: transparent;
}

.shortcuts-table__cell {
  display: flex;
  align-items: center;
  padding: 0.625rem 1rem;
  gap: 0.5rem;
}

.shortcuts-table__cell--command {
  overflow: hidden;
}

.shortcuts-table__cell-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__cell-text {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcuts-table__kbd {
  padding: 0.125rem 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.75rem;
}

.shortcuts-table__when-code {
  overflow: hidden;
  max-width: 140px;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  cursor: help;
  font-family: monospace;
  font-size: 0.625rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcuts-table__when-tooltip-code {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.75rem;
  white-space: nowrap;
}

.shortcuts-table__source {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  gap: 0.25rem;
}

.shortcuts-table__source--system {
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__source--user {
  color: hsl(var(--primary));
}

.shortcuts-table__lock-icon {
  flex-shrink: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
}

.shortcut-editor {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  gap: 1rem;
}

.shortcut-editor__info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shortcut-editor__label {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.shortcut-editor__kbd {
  padding: 0.25rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.875rem;
}

.shortcut-editor__when-code {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  font-family: monospace;
  font-size: 0.75rem;
}

.shortcut-editor__recording {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-editor__record-button {
  position: relative;
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 2px dashed hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-family: monospace;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.15s ease;
}

.shortcut-editor__record-button:hover {
  border-color: hsl(var(--primary) / 50%);
  background-color: hsl(var(--muted) / 50%);
}

.shortcut-editor__record-button:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 20%);
}

.shortcut-editor__record-button--recording {
  border-style: solid;
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.shortcut-editor__record-button--has-value {
  border-style: solid;
  border-color: hsl(var(--success) / 50%);
  background-color: hsl(var(--success) / 10%);
}

.shortcut-editor__record-button--conflict {
  border-color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 10%);
}

.shortcut-editor__record-pulse {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
  background-color: hsl(var(--primary));
  inset: 8px 8px auto auto;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.shortcut-editor__recorded-kbd {
  padding: 0.5rem 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 1rem;
  font-weight: 500;
}

.shortcut-editor__record-text {
  font-size: 0.75rem;
}

.shortcut-editor__record-placeholder {
  font-size: 0.875rem;
}

.shortcut-editor__conflict {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: var(--radius);
  background-color: hsl(var(--warning) / 15%);
  color: hsl(var(--warning));
  font-size: 0.75rem;
  gap: 0.5rem;
}

.shortcut-editor-dialog {
  max-width: 400px;
}

.shortcut-editor-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  border-top: 1px solid hsl(var(--border));
  margin-top: 0.5rem;
  gap: 0.5rem;
}

.shortcut-editor-dialog__footer-button {
  gap: 8px;
}

.shortcut-editor-dialog__footer-right {
  display: flex;
  gap: 0.5rem;
}
</style>
