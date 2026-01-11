<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserDirectories, type UserDirectory } from '@/modules/home/composables';
import { Button } from '@/components/ui/button';
import UserDirectoryCard from './user-directory-card.vue';
import UserDirectoryEditorDialog from './user-directory-editor-dialog.vue';

const { t } = useI18n();
const {
  userDirectories,
  isLoading,
  error,
  isEmpty,
  refresh,
  updateUserDirectory,
  resetUserDirectory,
} = useUserDirectories();

const isEditorOpen = ref(false);
const editingDirectory = ref<UserDirectory | null>(null);

function handleEditDirectory(directory: UserDirectory) {
  editingDirectory.value = directory;
  isEditorOpen.value = true;
}

async function handleSaveDirectory(name: string, title: string, path: string, icon: string | undefined) {
  await updateUserDirectory(name, {
    title: title || undefined,
    path,
    icon,
  });
}

async function handleResetDirectory(name: string) {
  await resetUserDirectory(name);
}
</script>

<template>
  <section class="user-directories-section">
    <h2 class="user-directories-section__title">
      {{ t('userDirectories') }}
    </h2>

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
      <UserDirectoryCard
        v-for="directory in userDirectories"
        :key="directory.name"
        :directory="directory"
        @edit="handleEditDirectory"
      />
    </div>

    <UserDirectoryEditorDialog
      v-if="isEditorOpen"
      v-model:open="isEditorOpen"
      :directory="editingDirectory"
      @save="handleSaveDirectory"
      @reset="handleResetDirectory"
    />
  </section>
</template>

<style>
.user-directories-section {
  margin-bottom: 16px;
}

.user-directories-section__title {
  margin-bottom: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
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
</style>
