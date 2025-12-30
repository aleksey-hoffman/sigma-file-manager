<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import type { UserDirectory } from '@/modules/home/composables/use-user-directories';

const props = defineProps<{
  directory: UserDirectory;
}>();

const router = useRouter();
const { t } = useI18n();
const workspacesStore = useWorkspacesStore();

async function handleClick() {
  try {
    await workspacesStore.openNewTabGroup(props.directory.path);
    router.push({ name: 'navigator' });
  }
  catch (error) {
    console.error('Failed to navigate to directory:', error);
  }
}
</script>

<template>
  <button
    type="button"
    class="user-directory-card"
    @click="handleClick"
  >
    <div class="user-directory-card__icon-container">
      <component
        :is="directory.icon"
        :size="20"
        class="user-directory-card__icon"
      />
    </div>

    <div class="user-directory-card__content">
      <div class="user-directory-card__name">
        {{ t(directory.titleKey) }}
      </div>
    </div>
  </button>
</template>

<style>
.user-directory-card {
  display: grid;
  overflow: hidden;
  align-items: center;
  padding: 0 12px 0 0;
  border: none;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  cursor: pointer;
  gap: 0;
  grid-template-columns: 48px 1fr;
  text-align: left;
  transition: background-color 0.15s ease;
}

.user-directory-card:hover {
  background-color: hsl(var(--muted));
}

.user-directory-card:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.user-directory-card__icon-container {
  display: flex;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.user-directory-card__icon {
  color: hsl(var(--muted-foreground));
}

.user-directory-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 8px 0;
}

.user-directory-card__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
