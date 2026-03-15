<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import {
  TrashIcon,
  RefreshCwIcon,
  ArrowBigUpDashIcon,
  PackageOpenIcon,
  FolderOpenIcon,
} from 'lucide-vue-next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import ExtensionBadge from './extension-badge.vue';
import ExtensionIcon from './extension-icon.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';

const props = defineProps<{
  extensions: ExtensionWithManifest[];
  installingExtensions: Set<string>;
  uninstallingExtensions: Set<string>;
  refreshingExtensions?: Set<string>;
  isInstallingLocal?: boolean;
}>();

const emit = defineEmits<{
  select: [extension: ExtensionWithManifest, event: MouseEvent];
  toggle: [extensionId: string];
  update: [extensionId: string];
  uninstall: [extensionId: string];
  refresh: [extensionId: string];
  installLocal: [sourcePath: string];
}>();

const { t } = useI18n();
const router = useRouter();
const workspacesStore = useWorkspacesStore();

async function navigateToExtensionsFolder() {
  const extensionsDir = await invoke<string>('get_extensions_dir');

  if (extensionsDir) {
    await workspacesStore.openNewTabGroup(extensionsDir);
    router.push({ name: 'navigator' });
  }
}

async function handleInstallLocal() {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: t('extensions.selectExtensionFolder'),
  });

  if (selected && typeof selected === 'string') {
    emit('installLocal', selected);
  }
}

const enabledCount = computed(() => {
  return props.extensions.filter(ext => ext.isEnabled).length;
});

const disabledCount = computed(() => {
  return props.extensions.filter(ext => !ext.isEnabled).length;
});

const updatesAvailable = computed(() => {
  return props.extensions.filter(ext => ext.hasUpdate).length;
});

const localCount = computed(() => {
  return props.extensions.filter(ext => ext.isLocal).length;
});

const totalExtensionsSize = computed(() => {
  return props.extensions.reduce((accumulatedSize, extension) => {
    if (typeof extension.sizeBytes !== 'number') {
      return accumulatedSize;
    }

    return accumulatedSize + extension.sizeBytes;
  }, 0);
});

const hasSizeData = computed(() => {
  return props.extensions.some(extension => typeof extension.sizeBytes === 'number');
});

function getDisplayName(extension: ExtensionWithManifest): string {
  return extension.name || extension.manifest?.name || extension.id.split('.').pop() || extension.id;
}

function getPublisherName(extension: ExtensionWithManifest): string {
  return extension.publisher || extension.manifest?.publisher?.name || t('extensions.unknownPublisher');
}

function getBinariesPreview(extension: ExtensionWithManifest): string {
  if (extension.binaries.length === 0) {
    return 'none';
  }

  return extension.binaries.map(binaryItem => binaryItem.id).join(', ');
}

</script>

<template>
  <div class="extensions-installed">
    <div
      v-if="extensions.length === 0"
      class="extensions-installed__empty"
    >
      <PackageOpenIcon
        :size="48"
        class="extensions-installed__empty-icon"
      />
      <h3 class="extensions-installed__empty-title">
        {{ t('extensions.noInstalledExtensions') }}
      </h3>
      <p class="extensions-installed__empty-description">
        {{ t('extensions.noInstalledExtensionsDescription') }}
      </p>
      <Button
        variant="outline"
        :disabled="isInstallingLocal"
        @click="handleInstallLocal"
      >
        <FolderOpenIcon :size="16" />
        {{ t('extensions.installFromFolder') }}
      </Button>
    </div>

    <template v-else>
      <div class="extensions-installed__stats">
        <div class="extensions-installed__stats-left">
          <div class="extensions-installed__stat">
            <span class="extensions-installed__stat-value">{{ extensions.length }}</span>
            <span class="extensions-installed__stat-label">{{ t('extensions.stats.total') }}</span>
          </div>
          <div class="extensions-installed__stat extensions-installed__stat--enabled">
            <span class="extensions-installed__stat-value">{{ enabledCount }}</span>
            <span class="extensions-installed__stat-label">{{ t('extensions.stats.enabled') }}</span>
          </div>
          <div class="extensions-installed__stat extensions-installed__stat--disabled">
            <span class="extensions-installed__stat-value">{{ disabledCount }}</span>
            <span class="extensions-installed__stat-label">{{ t('extensions.stats.disabled') }}</span>
          </div>
          <div
            v-if="localCount > 0"
            class="extensions-installed__stat extensions-installed__stat--local"
          >
            <span class="extensions-installed__stat-value">{{ localCount }}</span>
            <span class="extensions-installed__stat-label">{{ t('extensions.stats.local') }}</span>
          </div>
          <div
            v-if="updatesAvailable > 0"
            class="extensions-installed__stat extensions-installed__stat--updates"
          >
            <span class="extensions-installed__stat-value">{{ updatesAvailable }}</span>
            <span class="extensions-installed__stat-label">{{ t('extensions.stats.updates') }}</span>
          </div>
          <div
            v-if="hasSizeData"
            class="extensions-installed__stat extensions-installed__stat--size"
          >
            <span class="extensions-installed__stat-value">{{ formatBytes(totalExtensionsSize) }}</span>
            <span class="extensions-installed__stat-label">{{ t('size') }}</span>
          </div>
        </div>
        <div class="extensions-installed__stats-actions">
          <Button
            variant="outline"
            @click="navigateToExtensionsFolder"
          >
            <FolderOpenIcon :size="16" />
            {{ t('extensions.showFolder') }}
          </Button>
          <Button
            variant="outline"
            :disabled="isInstallingLocal"
            @click="handleInstallLocal"
          >
            <RefreshCwIcon
              v-if="isInstallingLocal"
              :size="16"
              class="extensions-installed__spinner"
            />
            <FolderOpenIcon
              v-else
              :size="16"
            />
            {{ t('extensions.installFromFolder') }}
          </Button>
        </div>
      </div>

      <div class="extensions-installed__list">
        <div
          v-for="extension in extensions"
          :key="extension.id"
          class="extensions-installed__item"
          :class="{ 'extensions-installed__item--disabled': !extension.isEnabled }"
          @click="emit('select', extension, $event)"
        >
          <div class="extensions-installed__item-icon">
            <ExtensionIcon
              :extension-id="extension.id"
              :icon-path="extension.manifest?.icon"
              :size="36"
              :cache-key="extension.installedAt"
            />
          </div>

          <div class="extensions-installed__item-info">
            <div class="extensions-installed__item-header">
              <span class="extensions-installed__item-name">{{ getDisplayName(extension) }}</span>
              <ExtensionBadge
                v-if="extension.isBroken"
                type="broken"
              />
              <ExtensionBadge
                v-else-if="extension.isLocal"
                type="local"
              />
              <ExtensionBadge
                v-else-if="extension.isOfficial"
                type="official"
              />
              <ExtensionBadge
                v-else
                type="community"
              />
              <span
                v-if="extension.hasUpdate && !extension.isLocal"
                class="extensions-installed__update-badge"
              >
                {{ t('extensions.updateAvailable') }}
              </span>
            </div>
            <div class="extensions-installed__item-meta">
              <span>{{ getPublisherName(extension) }}</span>
              <span class="extensions-installed__item-separator">{{ t('extensions.metaSeparator') }}</span>
              <span>{{ t('extensions.versionPrefix') }}{{ extension.installedVersion }}</span>
              <template v-if="typeof extension.sizeBytes === 'number'">
                <span class="extensions-installed__item-separator">{{ t('extensions.metaSeparator') }}</span>
                <span>{{ formatBytes(extension.sizeBytes) }}</span>
              </template>
            </div>
            <div
              v-if="extension.binaries.length > 0"
              class="extensions-installed__item-meta"
            >
              <span>{{ `${t('extensions.tabs.dependencies')}:` }}</span>
              <span class="extensions-installed__item-binaries">{{ getBinariesPreview(extension) }}</span>
            </div>
          </div>

          <div class="extensions-installed__item-actions">
            <div class="extensions-installed__item-actions-dynamic-container">
              <Button
                v-if="extension.hasUpdate && !extension.isLocal && !extension.isBroken"
                variant="outline"
                size="icon"
                :disabled="installingExtensions.has(extension.id)"
                @click.stop="emit('update', extension.id)"
              >
                <RefreshCwIcon
                  v-if="installingExtensions.has(extension.id)"
                  :size="16"
                  class="extensions-installed__spinner"
                />
                <ArrowBigUpDashIcon
                  v-else
                  :size="16"
                />
              </Button>
              <Button
                v-if="extension.isLocal"
                variant="ghost"
                size="icon"
                :title="t('extensions.reinstall')"
                :disabled="refreshingExtensions?.has(extension.id) || installingExtensions.has(extension.id)"
                @click.stop="emit('refresh', extension.id)"
              >
                <RefreshCwIcon
                  v-if="refreshingExtensions?.has(extension.id)"
                  :size="16"
                  class="extensions-installed__spinner"
                />
                <RefreshCwIcon
                  v-else
                  :size="16"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                :disabled="uninstallingExtensions.has(extension.id) || installingExtensions.has(extension.id)"
                @click.stop="emit('uninstall', extension.id)"
              >
                <TrashIcon :size="16" />
              </Button>
            </div>

            <Switch
              @click.stop
              :model-value="extension.isEnabled"
              :disabled="extension.isBroken || installingExtensions.has(extension.id)"
              @update:model-value="emit('toggle', extension.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
.extensions-installed {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
}

.extensions-installed__empty {
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

.extensions-installed__empty-icon {
  color: hsl(var(--muted-foreground) / 50%);
}

.extensions-installed__empty-title {
  color: hsl(var(--foreground));
  font-size: 1.25rem;
  font-weight: 600;
}

.extensions-installed__empty-description {
  max-width: 400px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.extensions-installed__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  gap: 16px;
}

.extensions-installed__stats-left {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.extensions-installed__stats-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extensions-installed__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.extensions-installed__stat-value {
  color: hsl(var(--foreground));
  font-size: 1.5rem;
  font-weight: 700;
}

.extensions-installed__stat-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.extensions-installed__stat--enabled .extensions-installed__stat-value {
  color: hsl(142deg 76% 36%);
}

.extensions-installed__stat--disabled .extensions-installed__stat-value {
  color: hsl(var(--muted-foreground));
}

.extensions-installed__stat--updates .extensions-installed__stat-value {
  color: hsl(217deg 91% 60%);
}

.extensions-installed__stat--local .extensions-installed__stat-value {
  color: hsl(271deg 91% 65%);
}

.extensions-installed__list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  container-name: extension-list;
  container-type: inline-size;
  gap: 8px;
}

.extensions-installed__item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  cursor: pointer;
  gap: 16px;
  transition: border-color 0.2s, opacity 0.2s;
}

.extensions-installed__item:hover {
  border-color: hsl(var(--border) / 80%);
}

.extensions-installed__item--disabled {
  opacity: 0.6;
}

.extensions-installed__item-icon {
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

.extensions-installed__item-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.extensions-installed__item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extensions-installed__item-name {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.extensions-installed__update-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(217deg 91% 60% / 15%);
  color: hsl(217deg 91% 60%);
  font-size: 0.75rem;
  font-weight: 500;
}

.extensions-installed__item-meta {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  gap: 6px;
}

.extensions-installed__item-binaries {
  color: hsl(var(--primary));
  font-weight: 500;
}

.extensions-installed__item-separator {
  opacity: 0.5;
}

.extensions-installed__item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extensions-installed__item-actions-dynamic-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extensions-installed__spinner {
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

@container extension-list (max-width: 500px) {
  .extensions-installed__item {
    display: grid;
    align-items: start;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .extensions-installed__item-icon {
    grid-column: 1;
    grid-row: 1;
  }

  .extensions-installed__item-info {
    grid-column: 2;
    grid-row: 1;
  }

  .extensions-installed__item-actions {
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid hsl(var(--border) / 60%);
    margin-top: 2px;
    gap: 8px;
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .extensions-installed__item-actions .sigma-ui-button {
    width: 28px;
    height: 28px;
    padding: 0;
  }
}

@media (width <= 768px) {
  .extensions-installed__stats-left {
    gap: 12px;
  }

  .extensions-installed__stats-left .extensions-installed__stat-value {
    font-size: 1.125rem;
  }

  .extensions-installed__stats-left .extensions-installed__stat-label {
    font-size: 0.625rem;
  }
}
</style>
