<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon, PencilIcon } from 'lucide-vue-next';
import { useUserDirectories, type UserDirectory } from '@/modules/home/composables';
import { Button } from '@/components/ui/button';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import UserDirectoryCard from './user-directory-card.vue';
import UserDirectoryEditorDialog from './user-directory-editor-dialog.vue';

const { t } = useI18n();
const {
  userDirectories,
  isLoading,
  error,
  isEmpty,
  refresh,
  createUserDirectory,
  deleteUserDirectory,
  updateUserDirectory,
} = useUserDirectories();

const isEditorOpen = ref(false);
const editingDirectory = ref<UserDirectory | null>(null);

function handleAddDirectory() {
  editingDirectory.value = {
    id: '',
    titleKey: undefined,
    customTitle: '',
    iconName: 'FolderIcon',
    customIconName: undefined,
    path: '',
  };
  isEditorOpen.value = true;
}

function handleEditDirectory(directory: UserDirectory) {
  editingDirectory.value = directory;
  isEditorOpen.value = true;
}

async function handleSaveDirectory(directoryId: string, title: string, path: string, icon: string | undefined) {
  const customization = {
    title: title || undefined,
    path,
    icon,
  };

  if (directoryId) {
    await updateUserDirectory(directoryId, customization);
    return;
  }

  await createUserDirectory(customization);
}

async function handleDeleteDirectory(directoryId: string) {
  await deleteUserDirectory(directoryId);
}
</script>

<template>
  <section class="user-directories-section">
    <div class="user-directories-section__header">
      <h2 class="user-directories-section__title">
        {{ t('userDirectories') }}
      </h2>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            class="user-directories-section__add-button"
            variant="outline"
            size="xs"
            @click="handleAddDirectory"
          >
            <PlusIcon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('add') }}</TooltipContent>
      </Tooltip>
    </div>

    <div
      v-if="isLoading"
      class="user-directories-section__loading"
    >
      <div class="user-directories-section__spinner" />
      <span>{{ t('loadingDots') }}</span>
    </div>

    <div
      v-else-if="error"
      class="user-directories-section__error"
    >
      <span>{{ error }}</span>
      <Button
        variant="outline"
        size="sm"
        @click="refresh"
      >
        {{ t('navigator.reloadCurrentDirectory') }}
      </Button>
    </div>

    <div
      v-else-if="isEmpty"
      class="user-directories-section__empty"
    >
      {{ t('placeholders.noUserDirectoriesFound') }}
    </div>

    <div
      v-else
      class="user-directories-section__grid"
    >
      <DirEntryInteractive
        v-for="directory in userDirectories"
        :key="directory.id"
        :path="directory.path"
      >
        <template #extra-items>
          <ContextMenuSeparator />
          <ContextMenuItem @select="handleEditDirectory(directory)">
            <PencilIcon :size="16" />
            {{ t('contextMenus.dirItem.editCard') }}
          </ContextMenuItem>
        </template>
        <UserDirectoryCard :directory="directory" />
      </DirEntryInteractive>
    </div>

    <UserDirectoryEditorDialog
      v-if="isEditorOpen"
      v-model:open="isEditorOpen"
      :directory="editingDirectory"
      @save="handleSaveDirectory"
      @delete="handleDeleteDirectory"
    />
  </section>
</template>

<style>
.user-directories-section {
  margin-bottom: 16px;
}

.user-directories-section__header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.user-directories-section__title {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.user-directories-section__add-button {
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.user-directories-section:hover .user-directories-section__add-button,
.user-directories-section:focus-within .user-directories-section__add-button {
  opacity: 1;
}

.user-directories-section__grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 48px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.user-directories-section__loading {
  display: flex;
  align-items: center;
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  gap: 12px;
}

.user-directories-section__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  border-top-color: hsl(var(--foreground));
  animation: sigma-ui-spin 0.8s linear infinite;
}

.user-directories-section__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: var(--radius);
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
  font-size: 13px;
  gap: 12px;
}

.user-directories-section__empty {
  padding: 32px 16px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}

.user-directories-section__grid .dir-entry-interactive {
  border-radius: var(--radius);
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}

.user-directories-section__grid .dir-entry-interactive[data-drag-over] {
  background-color: hsl(var(--primary) / 8%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 60%);
}
</style>
