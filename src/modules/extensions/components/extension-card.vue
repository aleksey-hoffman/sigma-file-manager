<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DownloadIcon,
  RefreshCwIcon,
  CheckIcon,
  ArrowBigUpDashIcon,
  TriangleAlertIcon,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import ExtensionBadge from './extension-badge.vue';
import ExtensionIcon from './extension-icon.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

const props = defineProps<{
  extension: ExtensionWithManifest;
  isInstalling?: boolean;
}>();

const emit = defineEmits<{
  click: [event: MouseEvent];
  install: [];
  update: [];
}>();

const { t } = useI18n();

const displayName = computed(() => {
  return props.extension.name || props.extension.manifest?.name || props.extension.id.split('.').pop() || props.extension.id;
});

const description = computed(() => {
  return props.extension.description || t('extensions.noDescription');
});

const publisherName = computed(() => {
  return props.extension.publisher || props.extension.manifest?.publisher?.name || t('extensions.unknownPublisher');
});

const isOfficial = computed(() => props.extension.isOfficial);

const isLocal = computed(() => props.extension.isLocal);

const isPlatformCompatible = computed(() => props.extension.isPlatformCompatible);

const displayVersion = computed(() => {
  if (props.extension.isInstalled) {
    return props.extension.installedVersion;
  }

  return props.extension.latestVersion || props.extension.manifest?.version;
});

const categories = computed(() => {
  return (props.extension.categories || []).slice(0, 3);
});

function handleInstallClick(event: MouseEvent) {
  event.stopPropagation();
  emit('install');
}

function handleUpdateClick(event: MouseEvent) {
  event.stopPropagation();
  emit('update');
}
</script>

<template>
  <div
    class="extension-card"
    @click="emit('click', $event)"
  >
    <div class="extension-card__header">
      <div class="extension-card__icon">
        <ExtensionIcon
          :extension-id="extension.id"
          :icon-path="extension.manifest?.icon"
          :repository="extension.repository"
          :version="extension.latestVersion || extension.manifest?.version"
          :is-installed="extension.isInstalled"
          :size="32"
        />
      </div>
      <div class="extension-card__info">
        <div class="extension-card__title-row">
          <h3 class="extension-card__name">
            {{ displayName }}
          </h3>
          <ExtensionBadge
            v-if="isLocal"
            type="local"
          />
          <ExtensionBadge
            v-else-if="isOfficial"
            type="official"
          />
          <ExtensionBadge
            v-else
            type="community"
          />
        </div>
        <p class="extension-card__publisher">
          {{ publisherName }}
        </p>
      </div>
    </div>

    <p class="extension-card__description">
      {{ description }}
    </p>

    <div
      v-if="categories.length > 0"
      class="extension-card__categories"
    >
      <span
        v-for="category in categories"
        :key="category"
        class="extension-card__category"
      >
        {{ category }}
      </span>
    </div>

    <div class="extension-card__footer">
      <div class="extension-card__meta">
        <span
          v-if="displayVersion"
          class="extension-card__version"
        >
          {{ t('extensions.versionPrefix') }}{{ displayVersion }}
        </span>
        <span
          v-if="!isPlatformCompatible"
          class="extension-card__incompatible"
          :title="t('extensions.platformIncompatibleShort')"
        >
          <TriangleAlertIcon :size="12" />
          {{ t('extensions.platformIncompatibleShort') }}
        </span>
      </div>

      <div class="extension-card__actions">
        <Button
          v-if="!extension.isInstalled"
          variant="default"
          size="xs"
          :disabled="isInstalling || !isPlatformCompatible"
          @click="handleInstallClick"
        >
          <DownloadIcon
            v-if="!isInstalling"
            :size="16"
          />
          <RefreshCwIcon
            v-else
            :size="16"
            class="extension-card__spinner"
          />
          {{ isInstalling ? t('extensions.installing') : t('extensions.install') }}
        </Button>

        <template v-else>
          <Button
            v-if="extension.hasUpdate && !isLocal"
            variant="outline"
            size="sm"
            :disabled="isInstalling"
            @click="handleUpdateClick"
          >
            <RefreshCwIcon
              v-if="isInstalling"
              :size="16"
              class="extension-card__spinner"
            />
            <ArrowBigUpDashIcon
              v-else
              :size="16"
            />
            {{ t('extensions.update') }}
          </Button>
          <span
            v-else
            class="extension-card__installed-badge"
          >
            <CheckIcon :size="14" />
            {{ t('extensions.installed') }}
            <span
              v-if="typeof extension.sizeBytes === 'number'"
              class="extension-card__installed-size"
            >
              {{ t('extensions.metaSeparator') }} {{ formatBytes(extension.sizeBytes) }}
            </span>
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.extension-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  cursor: pointer;
  gap: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.extension-card:hover {
  border-color: hsl(var(--border) / 80%);
  box-shadow: 0 2px 8px hsl(var(--foreground) / 5%);
}

.extension-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.extension-card__icon {
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

.extension-card__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.extension-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extension-card__name {
  color: hsl(var(--foreground));
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.extension-card__publisher {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.extension-card__description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  -webkit-line-clamp: 2;
  line-height: 1.5;
}

.extension-card__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extension-card__category {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.extension-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border) / 50%);
  margin-top: auto;
}

.extension-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.extension-card__version {
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

.extension-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extension-card__installed-badge {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  font-weight: 500;
  gap: 4px;
}

.extension-card__installed-size {
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.extension-card__incompatible {
  display: flex;
  align-items: center;
  color: hsl(38deg 92% 50%);
  font-size: 0.75rem;
  gap: 3px;
}

.extension-card__spinner {
  animation: spin 1s linear infinite;
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
