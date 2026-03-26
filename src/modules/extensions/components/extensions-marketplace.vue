<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SparklesIcon, SearchXIcon, AlertCircleIcon, Loader2Icon } from '@lucide/vue';
import ExtensionCard from './extension-card.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';

const props = defineProps<{
  extensions: ExtensionWithManifest[];
  featuredExtensions: ExtensionWithManifest[];
  isLoading?: boolean;
  error?: string | null;
  installingExtensions: Set<string>;
  isAnyInstallInProgress?: boolean;
  searchQuery: string;
}>();

const emit = defineEmits<{
  select: [extension: ExtensionWithManifest, event: MouseEvent];
  install: [extensionId: string];
  update: [extensionId: string];
}>();

const { t } = useI18n();

const hasSearchQuery = computed(() => props.searchQuery.trim().length > 0);

const showFeatured = computed(() => {
  return !hasSearchQuery.value && props.featuredExtensions.length > 0;
});

const displayExtensions = computed(() => {
  if (hasSearchQuery.value) {
    return props.extensions;
  }

  return props.extensions.filter(ext => !ext.featured);
});

const noResults = computed(() => {
  return hasSearchQuery.value && props.extensions.length === 0;
});
</script>

<template>
  <div class="extensions-marketplace">
    <div
      v-if="isLoading"
      class="extensions-marketplace__loading"
    >
      <Loader2Icon
        :size="32"
        class="extensions-marketplace__loading-icon"
      />
      <p>{{ t('extensions.loadingRegistry') }}</p>
    </div>

    <div
      v-else-if="error"
      class="extensions-marketplace__error"
    >
      <AlertCircleIcon :size="32" />
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <div
        v-if="noResults"
        class="extensions-marketplace__no-results"
      >
        <SearchXIcon
          :size="48"
          class="extensions-marketplace__no-results-icon"
        />
        <h3>{{ t('extensions.noResults') }}</h3>
        <p>{{ t('extensions.noResultsDescription', { query: searchQuery }) }}</p>
      </div>

      <template v-else>
        <div
          v-if="showFeatured"
          class="extensions-marketplace__section"
        >
          <div class="extensions-marketplace__section-header">
            <SparklesIcon :size="20" />
            <h2>{{ t('extensions.featured') }}</h2>
          </div>
          <div class="extensions-marketplace__grid extensions-marketplace__grid--featured">
            <ExtensionCard
              v-for="extension in featuredExtensions"
              :key="extension.id"
              :extension="extension"
              :is-installing="installingExtensions.has(extension.id)"
              :is-install-disabled="installingExtensions.has(extension.id) || isAnyInstallInProgress"
              @click="(event) => emit('select', extension, event)"
              @install="emit('install', extension.id)"
              @update="emit('update', extension.id)"
            />
          </div>
        </div>

        <div
          v-if="displayExtensions.length > 0"
          class="extensions-marketplace__section"
        >
          <div class="extensions-marketplace__section-header">
            <h2>{{ hasSearchQuery ? t('extensions.searchResults') : t('extensions.allExtensions') }}</h2>
            <span class="extensions-marketplace__count">{{ displayExtensions.length }}</span>
          </div>
          <div class="extensions-marketplace__grid">
            <ExtensionCard
              v-for="extension in displayExtensions"
              :key="extension.id"
              :extension="extension"
              :is-installing="installingExtensions.has(extension.id)"
              :is-install-disabled="installingExtensions.has(extension.id) || isAnyInstallInProgress"
              @click="(event) => emit('select', extension, event)"
              @install="emit('install', extension.id)"
              @update="emit('update', extension.id)"
            />
          </div>
        </div>

        <div
          v-if="extensions.length === 0 && !hasSearchQuery"
          class="extensions-marketplace__empty"
        >
          <p>{{ t('extensions.noExtensionsAvailable') }}</p>
        </div>
      </template>
    </template>
  </div>
</template>

<style>
.extensions-marketplace {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.extensions-marketplace__loading,
.extensions-marketplace__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: hsl(var(--muted-foreground));
  gap: 12px;
  text-align: center;
}

.extensions-marketplace__loading-icon {
  animation: spin 1s linear infinite;
}

.extensions-marketplace__error {
  color: hsl(0deg 84% 60%);
}

.extensions-marketplace__no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  gap: 12px;
  text-align: center;
}

.extensions-marketplace__no-results-icon {
  color: hsl(var(--muted-foreground) / 50%);
}

.extensions-marketplace__no-results h3 {
  color: hsl(var(--foreground));
  font-size: 1.25rem;
  font-weight: 600;
}

.extensions-marketplace__no-results p {
  max-width: 400px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.extensions-marketplace__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.extensions-marketplace__section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extensions-marketplace__section-header h2 {
  color: hsl(var(--foreground));
  font-size: 1.25rem;
  font-weight: 600;
}

.extensions-marketplace__count {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
}

.extensions-marketplace__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.extensions-marketplace__grid--featured {
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
}

.extensions-marketplace__empty {
  padding: 24px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (width <= 768px) {
  .extensions-marketplace__grid,
  .extensions-marketplace__grid--featured {
    grid-template-columns: 1fr;
  }
}
</style>
