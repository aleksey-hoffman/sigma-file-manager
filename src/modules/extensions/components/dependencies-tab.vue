<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import {
  PackageIcon,
  TrashIcon,
  RefreshCwIcon,
  HardDriveIcon,
  FolderOpenIcon,
  TriangleAlertIcon,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { formatBytes, formatDate } from '@/modules/navigator/components/file-browser/utils';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import type { SharedBinaryInfo } from '@/types/extension';
import { getBinaryDisplayVersion, getBinaryLookupVersion } from '@/modules/extensions/utils/binary-metadata';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type DirSizeResult = {
  path: string;
  size: number;
  status: 'Complete' | 'Partial' | 'Timeout' | 'Error' | 'Cancelled';
};

defineProps<{
  isRemoving: Set<string>;
}>();

const emit = defineEmits<{
  remove: [binaryId: string, version?: string];
  update: [binaryId: string, version?: string];
}>();

const { t } = useI18n();
const router = useRouter();
const workspacesStore = useWorkspacesStore();
const extensionsStorageStore = useExtensionsStorageStore();
const binarySizes = ref<Map<string, number>>(new Map());

async function navigateToDependenciesFolder() {
  const binariesDir = await invoke<string>('get_shared_binaries_base_dir');

  if (binariesDir) {
    await workspacesStore.openNewTabGroup(binariesDir);
    router.push({ name: 'navigator' });
  }
}

const sharedBinaries = computed((): SharedBinaryInfo[] => {
  const binaries = extensionsStorageStore.extensionsData.sharedBinaries;
  return Object.values(binaries).sort((binaryFirst, binarySecond) => {
    return binaryFirst.id.localeCompare(binarySecond.id);
  });
});

const totalBinaries = computed(() => sharedBinaries.value.length);

const updatesAvailable = computed(() => {
  return sharedBinaries.value.filter(binary => binary.hasUpdate).length;
});

const totalSize = computed(() => {
  let accumulated = 0;

  for (const size of binarySizes.value.values()) {
    accumulated += size;
  }

  return accumulated;
});

const hasSizeData = computed(() => binarySizes.value.size > 0);

function normalizeFsPath(pathValue: string): string {
  return pathValue
    .replace(/^\\\\\?\\/, '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

async function refreshBinarySizes(): Promise<void> {
  const binaries = sharedBinaries.value;

  if (binaries.length === 0) {
    binarySizes.value.clear();
    return;
  }

  try {
    const baseDir = await invoke<string>('get_shared_binaries_base_dir');
    const normalizedBaseDir = normalizeFsPath(baseDir);

    const binaryIdByPath = new Map<string, string>();

    for (const binary of binaries) {
      const versionDir = getBinaryLookupVersion(binary) || 'latest';
      const binaryDir = `${normalizedBaseDir}/${binary.id}/${versionDir}`;
      const key = `${binary.id}@${versionDir}`;
      binaryIdByPath.set(binaryDir, key);
    }

    const paths = Array.from(binaryIdByPath.keys());
    const sizeResults = await invoke<DirSizeResult[]>('get_dir_sizes_batch', {
      paths,
      timeoutMs: 30000,
      useCache: false,
    });

    const nextSizes = new Map<string, number>();

    for (const result of sizeResults) {
      if (result.status === 'Error' || result.status === 'Cancelled') {
        continue;
      }

      const binaryId = binaryIdByPath.get(normalizeFsPath(result.path));

      if (!binaryId) {
        continue;
      }

      nextSizes.set(binaryId, result.size);
    }

    binarySizes.value = nextSizes;
  }
  catch {
  }
}

function getExtensionDisplayId(extensionId: string): string {
  const lastDot = extensionId.lastIndexOf('.');
  return lastDot !== -1 ? extensionId.substring(lastDot + 1) : extensionId;
}

watch(
  () => sharedBinaries.value.map((binary) => {
    return `${binary.id}:${getBinaryLookupVersion(binary)}:${binary.path}:${binary.hasUpdate}:${binary.latestVersion}`;
  }).join('|'),
  () => {
    refreshBinarySizes();
  },
  { immediate: true },
);
</script>

<template>
  <div class="dependencies-tab">
    <div
      v-if="sharedBinaries.length === 0"
      class="dependencies-tab__empty"
    >
      <HardDriveIcon
        :size="48"
        class="dependencies-tab__empty-icon"
      />
      <h3 class="dependencies-tab__empty-title">
        {{ t('extensions.dependencies.noDependencies') }}
      </h3>
      <p class="dependencies-tab__empty-description">
        {{ t('extensions.dependencies.noDependenciesDescription') }}
      </p>
    </div>

    <template v-else>
      <div class="dependencies-tab__stats">
        <div class="dependencies-tab__stats-left">
          <div class="dependencies-tab__stat">
            <span class="dependencies-tab__stat-value">{{ totalBinaries }}</span>
            <span class="dependencies-tab__stat-label">{{ t('extensions.stats.total') }}</span>
          </div>
          <div
            v-if="updatesAvailable > 0"
            class="dependencies-tab__stat dependencies-tab__stat--updates"
          >
            <span class="dependencies-tab__stat-value">{{ updatesAvailable }}</span>
            <span class="dependencies-tab__stat-label">{{ t('extensions.stats.updates') }}</span>
          </div>
          <div
            v-if="hasSizeData"
            class="dependencies-tab__stat dependencies-tab__stat--size"
          >
            <span class="dependencies-tab__stat-value">{{ formatBytes(totalSize) }}</span>
            <span class="dependencies-tab__stat-label">{{ t('size') }}</span>
          </div>
        </div>
        <div class="dependencies-tab__stats-actions">
          <Button
            variant="outline"
            @click="navigateToDependenciesFolder"
          >
            <FolderOpenIcon :size="16" />
            {{ t('extensions.showFolder') }}
          </Button>
        </div>
      </div>

      <div class="dependencies-tab__list">
        <div
          v-for="binary in sharedBinaries"
          :key="`${binary.id}@${getBinaryLookupVersion(binary) || 'latest'}`"
          class="dependencies-tab__item"
        >
          <div class="dependencies-tab__item-icon">
            <PackageIcon :size="24" />
          </div>

          <div class="dependencies-tab__item-info">
            <div class="dependencies-tab__item-header">
              <span class="dependencies-tab__item-name">{{ binary.id }}</span>
              <span
                v-if="binary.hasUpdate"
                class="dependencies-tab__update-badge"
              >
                {{ t('extensions.updateAvailable') }}
              </span>
            </div>
            <div class="dependencies-tab__item-meta">
              <span v-if="getBinaryDisplayVersion(binary)">{{ t('extensions.versionPrefix') }}{{ getBinaryDisplayVersion(binary) }}</span>
              <span
                v-if="getBinaryDisplayVersion(binary)"
                class="dependencies-tab__item-separator"
              >{{ t('extensions.metaSeparator') }}</span>
              <span>{{ t('extensions.dependencies.installedOn') }} {{ formatDate(binary.installedAt) }}</span>
              <template v-if="binarySizes.has(`${binary.id}@${getBinaryLookupVersion(binary) || 'latest'}`)">
                <span class="dependencies-tab__item-separator">{{ t('extensions.metaSeparator') }}</span>
                <span>{{ formatBytes(binarySizes.get(`${binary.id}@${getBinaryLookupVersion(binary) || 'latest'}`)!) }}</span>
              </template>
            </div>
            <div
              v-if="binary.usedBy.length > 0"
              class="dependencies-tab__item-used-by"
            >
              <span class="dependencies-tab__used-by-label">{{ t('extensions.dependencies.usedBy') }}:</span>
              <span
                v-for="(extensionId, extensionIndex) in binary.usedBy"
                :key="extensionId"
                class="dependencies-tab__used-by-extension"
              >{{ getExtensionDisplayId(extensionId) }}<span v-if="extensionIndex < binary.usedBy.length - 1">,&nbsp;</span></span>
            </div>
          </div>

          <div class="dependencies-tab__item-actions">
            <Tooltip :disabled="binary.usedBy.length === 0">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="isRemoving.has(`${binary.id}@${getBinaryLookupVersion(binary) || 'latest'}`)"
                  @click.stop="emit('remove', binary.id, getBinaryLookupVersion(binary))"
                >
                  <RefreshCwIcon
                    v-if="isRemoving.has(`${binary.id}@${getBinaryLookupVersion(binary) || 'latest'}`)"
                    :size="16"
                    class="dependencies-tab__spinner"
                  />
                  <TrashIcon
                    v-else
                    :size="16"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span class="dependencies-tab__warning-content">
                  <TriangleAlertIcon :size="14" />
                  {{ t('extensions.dependencies.removeWarning') }}
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
.dependencies-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dependencies-tab__empty {
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

.dependencies-tab__empty-icon {
  color: hsl(var(--muted-foreground) / 50%);
}

.dependencies-tab__empty-title {
  color: hsl(var(--foreground));
  font-size: 1.25rem;
  font-weight: 600;
}

.dependencies-tab__empty-description {
  max-width: 400px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.dependencies-tab__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  gap: 16px;
}

.dependencies-tab__stats-left {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.dependencies-tab__stats-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dependencies-tab__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dependencies-tab__stat-value {
  color: hsl(var(--foreground));
  font-size: 1.5rem;
  font-weight: 700;
}

.dependencies-tab__stat-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dependencies-tab__stat--updates .dependencies-tab__stat-value {
  color: hsl(217deg 91% 60%);
}

.dependencies-tab__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dependencies-tab__item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  gap: 16px;
  transition: border-color 0.2s;
}

.dependencies-tab__item:hover {
  border-color: hsl(var(--border) / 80%);
}

.dependencies-tab__item-icon {
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

.dependencies-tab__item-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.dependencies-tab__item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dependencies-tab__item-name {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.dependencies-tab__update-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(217deg 91% 60% / 15%);
  color: hsl(217deg 91% 60%);
  font-size: 0.75rem;
  font-weight: 500;
}

.dependencies-tab__item-meta {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  gap: 6px;
}

.dependencies-tab__item-separator {
  opacity: 0.5;
}

.dependencies-tab__item-used-by {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  gap: 4px;
}

.dependencies-tab__used-by-label {
  opacity: 0.7;
}

.dependencies-tab__used-by-extension {
  color: hsl(var(--primary));
  font-weight: 500;
}

.dependencies-tab__item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dependencies-tab__spinner {
  animation: spin 1s linear infinite;
}

.dependencies-tab__warning-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
