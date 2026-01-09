<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcwIcon, FolderOpenIcon } from 'lucide-vue-next';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type UserDirectory,
  userDirectoryIconNames,
  getIconComponent,
} from '@/modules/home/composables/use-user-directories';

const props = defineProps<{
  directory: UserDirectory | null;
}>();

const emit = defineEmits<{
  'save': [name: string, title: string, path: string, icon: string | undefined];
  'reset': [name: string];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const editedTitle = ref('');
const editedPathRaw = ref('');
const selectedIcon = ref<string | undefined>(undefined);
const pathError = ref<string | null>(null);

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

const editedPath = computed({
  get: () => normalizePath(editedPathRaw.value),
  set: (value: string) => {
    editedPathRaw.value = normalizePath(value);
  },
});

const hasChanges = computed(() => {
  if (!props.directory) {
    return false;
  }

  const originalTitle = props.directory.customTitle || '';
  const originalPath = props.directory.path;
  const originalIcon = props.directory.customIconName;

  return editedTitle.value !== originalTitle
    || editedPath.value !== originalPath
    || selectedIcon.value !== originalIcon;
});

const isValid = computed(() => {
  return !pathError.value && editedPath.value.length > 0;
});

watch(() => props.directory, (directory) => {
  if (directory) {
    editedTitle.value = directory.customTitle || '';
    editedPathRaw.value = directory.path;
    selectedIcon.value = directory.customIconName;
    pathError.value = null;
  }
}, { immediate: true });

function selectIcon(iconName: string) {
  if (selectedIcon.value === iconName) {
    selectedIcon.value = undefined;
  }
  else {
    selectedIcon.value = iconName;
  }
}

watch(editedPath, async (newPath) => {
  if (!newPath || newPath.length === 0) {
    pathError.value = t('dialogs.userDirectoryEditorDialog.pathCannotBeEmpty');
    return;
  }

  try {
    const pathExists = await invoke<boolean>('path_exists', { path: newPath });

    if (!pathExists) {
      pathError.value = t('dialogs.userDirectoryEditorDialog.pathDoesNotExist');
    }
    else {
      pathError.value = null;
    }
  }
  catch {
    pathError.value = t('dialogs.userDirectoryEditorDialog.pathDoesNotExist');
  }
});

function handleSave() {
  if (!props.directory || !isValid.value) {
    return;
  }

  emit('save', props.directory.name, editedTitle.value, editedPath.value, selectedIcon.value);
  isOpen.value = false;
}

function handleReset() {
  if (!props.directory) {
    return;
  }

  emit('reset', props.directory.name);
  isOpen.value = false;
}

function handleCancel() {
  isOpen.value = false;
}

async function handleBrowse() {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: editedPath.value || undefined,
  });

  if (selected) {
    editedPathRaw.value = normalizePath(selected);
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="user-directory-editor-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('dialogs.userDirectoryEditorDialog.userDirectoryEditor') }}</DialogTitle>
      </DialogHeader>

      <div class="user-directory-editor-dialog__form">
        <div class="user-directory-editor-dialog__field">
          <label
            for="directory-title"
            class="user-directory-editor-dialog__label"
          >
            {{ t('dialogs.userDirectoryEditorDialog.directoryTitle') }}
          </label>
          <Input
            id="directory-title"
            v-model="editedTitle"
            :placeholder="directory ? t(directory.titleKey) : ''"
          />
        </div>

        <div class="user-directory-editor-dialog__field">
          <label
            for="directory-path"
            class="user-directory-editor-dialog__label"
          >
            {{ t('dialogs.userDirectoryEditorDialog.directoryPath') }}
          </label>
          <div class="user-directory-editor-dialog__path-row">
            <Input
              id="directory-path"
              v-model="editedPath"
              :class="{ 'user-directory-editor-dialog__input--error': pathError }"
            />
            <Tooltip :delay-duration="0">
              <TooltipTrigger as-child>
                <Button
                  variant="secondary"
                  size="icon"
                  @click="handleBrowse"
                >
                  <FolderOpenIcon :size="16" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('browse') }}
              </TooltipContent>
            </Tooltip>
          </div>
          <div
            v-if="pathError"
            class="user-directory-editor-dialog__error"
          >
            {{ pathError }}
          </div>
        </div>

        <div class="user-directory-editor-dialog__field">
          <label class="user-directory-editor-dialog__label">
            {{ t('dialogs.userDirectoryEditorDialog.directoryIcon') }}
          </label>
          <ScrollArea class="user-directory-editor-dialog__icon-scroll">
            <div class="user-directory-editor-dialog__icon-grid">
              <button
                v-for="iconName in userDirectoryIconNames"
                :key="iconName"
                type="button"
                class="user-directory-editor-dialog__icon-button"
                :class="{ 'user-directory-editor-dialog__icon-button--selected': selectedIcon === iconName }"
                @click="selectIcon(iconName)"
              >
                <component
                  :is="getIconComponent(iconName)"
                  :size="18"
                />
              </button>
            </div>
          </ScrollArea>
        </div>
      </div>

      <DialogFooter>
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="user-directory-editor-dialog__reset-button"
              @click="handleReset"
            >
              <RotateCcwIcon :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('home.resetBackgroundPosition') }}
          </TooltipContent>
        </Tooltip>

        <div class="user-directory-editor-dialog__actions">
          <Button
            variant="ghost"
            @click="handleCancel"
          >
            {{ t('cancel') }}
          </Button>
          <Button
            :disabled="!isValid || !hasChanges"
            @click="handleSave"
          >
            {{ t('save') }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.user-directory-editor-dialog {
  max-width: 520px;
}

.user-directory-editor-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-directory-editor-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-directory-editor-dialog__label {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
}

.user-directory-editor-dialog__path-row {
  display: flex;
  gap: 8px;
}

.user-directory-editor-dialog__path-row .sigma-ui-input {
  flex: 1;
}

.user-directory-editor-dialog__input--error {
  border-color: hsl(var(--destructive));
}

.user-directory-editor-dialog__error {
  color: hsl(var(--destructive));
  font-size: 12px;
}

.user-directory-editor-dialog__icon-scroll {
  height: 160px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.user-directory-editor-dialog__icon-grid {
  display: grid;
  padding: 8px;
  gap: 4px;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
}

.user-directory-editor-dialog__icon-button {
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.user-directory-editor-dialog__icon-button:hover {
  border-color: hsl(var(--border));
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.user-directory-editor-dialog__icon-button--selected {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.user-directory-editor-dialog__icon-button--selected:hover {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
}

.sigma-ui-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-directory-editor-dialog__reset-button {
  width: 32px;
  height: 32px;
}

.user-directory-editor-dialog__actions {
  display: flex;
  gap: 8px;
}
</style>
