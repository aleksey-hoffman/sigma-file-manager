<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DownloadIcon,
  TrashIcon,
  RefreshCwIcon,
  ArrowBigUpDashIcon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ExtensionEngineRequirements from './extension-engine-requirements.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';
import type { PlatformOS } from '@/types/extension';
import type { EngineCompatibilityResult } from '@/modules/extensions/utils/engine-compatibility';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

const props = defineProps<{
  extension: ExtensionWithManifest;
  selectedVersion: string;
  availableVersions: string[];
  isInstalling?: boolean;
  isInstallDisabled?: boolean;
  isUninstalling?: boolean;
  isUpdating?: boolean;
  isInstallAllowed: boolean;
  showUpdateButton: boolean;
  engineCompatibility: EngineCompatibilityResult | null;
  currentAppVersion: string | null;
  engineRequirements: ExtensionWithManifest['engineRequirements'];
  extensionPlatforms: PlatformOS[];
  isCrossPlatform: boolean;
  isPlatformCompatible: boolean;
  dependencyCount: number;
  sizeBytes?: number;
  isCancelRequested: boolean;
  getPlatformDisplayName: (platform: PlatformOS) => string;
}>();

const emit = defineEmits<{
  'update:selectedVersion': [version: string];
  'install': [];
  'update': [];
  'refresh': [];
  'uninstall': [];
  'cancel': [];
  'toggleAutoUpdate': [];
}>();

const { t } = useI18n();

const isLocal = computed(() => props.extension.isLocal);

const isLocalReinstallInProgress = computed(() => {
  return Boolean(
    props.extension.isLocal
    && props.extension.isInstalled
    && props.isInstalling,
  );
});

const showInstallActions = computed(() => {
  return !props.extension.isInstalled || (props.isInstalling && !isLocalReinstallInProgress.value);
});

const selectedVersionModel = computed({
  get() {
    return props.selectedVersion;
  },
  set(value: string) {
    emit('update:selectedVersion', value);
  },
});

function handleInstall() {
  emit('install');
}

function handleUpdate() {
  emit('update');
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <div
    class="extension-detail-controls"
    data-animate="controls"
  >
    <ExtensionEngineRequirements
      :engine-compatibility="engineCompatibility"
      :current-app-version="currentAppVersion"
      :show-requirements-list="false"
    />

    <div
      v-if="!isPlatformCompatible"
      class="extension-detail-controls__platform-warning"
    >
      <TriangleAlertIcon :size="14" />
      <span>{{ t('extensions.platformWarning', { platforms: extensionPlatforms.map(getPlatformDisplayName).join(', ') }) }}</span>
    </div>

    <ExtensionEngineRequirements
      :engine-requirements="engineRequirements"
      :show-compatibility-warning="false"
    />

    <div class="extension-detail-controls__summary">
      <div class="extension-detail-controls__actions">
        <div
          v-if="showInstallActions && !isInstalling && !isLocal && availableVersions.length > 0"
          class="extension-detail-controls__version"
        >
          <Select v-model="selectedVersionModel">
            <SelectTrigger class="extension-detail-controls__version-trigger">
              <SelectValue>
                <span class="extension-detail-controls__version-value">
                  <span>{{ t('extensions.versionPrefix') }}{{ selectedVersionModel }}</span>
                  <span
                    v-if="selectedVersionModel === extension.latestVersion"
                    class="extension-detail-controls__latest-tag"
                  >
                    {{ t('extensions.latest') }}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="version in availableVersions"
                :key="version"
                :value="version"
              >
                <span class="extension-detail-controls__version-value">
                  <span>{{ t('extensions.versionPrefix') }}{{ version }}</span>
                  <span
                    v-if="version === extension.latestVersion"
                    class="extension-detail-controls__latest-tag"
                  >
                    {{ t('extensions.latest') }}
                  </span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span
          v-else-if="isInstalling && selectedVersionModel"
          class="extension-detail-controls__version-display"
        >
          {{ t('extensions.versionPrefix') }}{{ selectedVersionModel }}
        </span>
        <span
          v-else-if="extension.installedVersion"
          class="extension-detail-controls__version-display"
        >
          {{ t('extensions.versionPrefix') }}{{ extension.installedVersion }}
        </span>

        <template v-if="showInstallActions">
          <Button
            class="extension-detail-controls__button"
            size="sm"
            :disabled="(isInstallDisabled ?? isInstalling) || !isInstallAllowed"
            @click="handleInstall"
          >
            <DownloadIcon
              v-if="!isInstalling"
              :size="16"
            />
            <RefreshCwIcon
              v-else
              :size="16"
              class="extension-detail-controls__spinner"
            />
            {{ isInstalling ? (isCancelRequested ? t('extensions.cancellingInstall') : t('extensions.installing')) : t('extensions.install') }}
          </Button>
          <Button
            v-if="isInstalling && !isCancelRequested"
            variant="outline"
            size="sm"
            class="extension-detail-controls__button"
            @click="handleCancel"
          >
            <XIcon :size="16" />
            {{ t('extensions.cancelInstall') }}
          </Button>
        </template>

        <template v-else>
          <Button
            v-if="showUpdateButton"
            class="extension-detail-controls__button"
            size="sm"
            :disabled="isUpdating"
            @click="handleUpdate"
          >
            <RefreshCwIcon
              v-if="isUpdating"
              :size="16"
              class="extension-detail-controls__spinner"
            />
            <ArrowBigUpDashIcon
              v-else
              :size="16"
            />
            {{ t('extensions.update') }}
          </Button>
          <Button
            v-if="showUpdateButton && isUpdating && !isCancelRequested"
            variant="outline"
            size="sm"
            class="extension-detail-controls__button"
            @click="handleCancel"
          >
            <XIcon :size="16" />
            {{ t('extensions.cancelInstall') }}
          </Button>

          <Button
            v-if="isLocal"
            variant="outline"
            size="sm"
            class="extension-detail-controls__button"
            :disabled="isLocalReinstallInProgress"
            @click="emit('refresh')"
          >
            <RefreshCwIcon
              :size="16"
              :class="{ 'extension-detail-controls__spinner': isLocalReinstallInProgress }"
            />
            {{ isLocalReinstallInProgress ? t('extensions.installing') : t('extensions.reinstall') }}
          </Button>
          <Button
            v-if="isLocalReinstallInProgress && !isCancelRequested"
            variant="outline"
            size="sm"
            class="extension-detail-controls__button"
            @click="handleCancel"
          >
            <XIcon :size="16" />
            {{ t('extensions.cancelInstall') }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="extension-detail-controls__button"
            :disabled="isUninstalling"
            @click="emit('uninstall')"
          >
            <RefreshCwIcon
              v-if="isUninstalling"
              :size="16"
              class="extension-detail-controls__spinner"
            />
            <TrashIcon
              v-else
              :size="16"
            />
            {{ t('extensions.uninstall') }}
          </Button>

          <div
            v-if="!isLocal"
            class="extension-detail-controls__auto-update"
          >
            <span class="extension-detail-controls__auto-update-label">{{ t('extensions.autoUpdate') }}</span>
            <Switch
              :id="`auto-update-${extension.id}`"
              :model-value="extension.autoUpdate"
              @update:model-value="emit('toggleAutoUpdate')"
            />
          </div>
        </template>
      </div>

      <div class="extension-detail-controls__info">
        <div
          v-if="extensionPlatforms.length > 0"
          class="extension-detail-controls__metadata-block"
        >
          <span class="extension-detail-controls__metadata-label">
            {{ t('extensions.platforms') }}
          </span>
          <div class="extension-detail-controls__platforms">
            <span
              v-if="isCrossPlatform"
              class="extension-detail-controls__platform-badge"
            >
              {{ t('extensions.allPlatforms') }}
            </span>
            <template v-else>
              <span
                v-for="platform in extensionPlatforms"
                :key="platform"
                class="extension-detail-controls__platform-badge"
                :class="{ 'extension-detail-controls__platform-badge--inactive': !isPlatformCompatible && !extension.platforms?.includes(platform) }"
              >
                {{ getPlatformDisplayName(platform) }}
              </span>
            </template>
          </div>
        </div>
        <div
          v-if="typeof sizeBytes === 'number'"
          class="extension-detail-controls__metadata-block"
        >
          <span class="extension-detail-controls__metadata-label">{{ t('size') }}</span>
          <span class="extension-detail-controls__metadata-value">{{ formatBytes(sizeBytes) }}</span>
        </div>
        <div
          v-if="dependencyCount > 0"
          class="extension-detail-controls__metadata-block"
        >
          <span class="extension-detail-controls__metadata-label">{{ t('extensions.tabs.dependencies') }}</span>
          <span class="extension-detail-controls__metadata-value">{{ dependencyCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.extension-detail-controls {
  position: relative;
  z-index: 1;
  display: flex;
  width: 220px;
  min-width: 220px;
  flex-direction: column;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  background-color: hsl(var(--card));
  gap: 8px;
}

.extension-detail-controls__button {
  width: 100%;
}

.extension-detail-controls__summary {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.extension-detail-controls__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extension-detail-controls__version {
  display: flex;
  width: 100%;
}

.extension-detail-controls__version-trigger {
  width: 100%;
}

.extension-detail-controls__actions .extension-detail-controls__button {
  width: 100%;
}

.extension-detail-controls__auto-update {
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 8px;
}

.extension-detail-controls__auto-update-label {
  font-size: 0.875rem;
}

.extension-detail-controls__info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extension-detail-controls__metadata-block {
  display: flex;
  align-items: center;
  margin-top: 2px;
  gap: 8px;
}

.extension-detail-controls__metadata-label {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  gap: 4px;
  text-transform: uppercase;
}

.extension-detail-controls__metadata-value {
  color: hsl(var(--foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
}

.extension-detail-controls__platforms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.extension-detail-controls__platform-badge {
  padding: 1px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.extension-detail-controls__platform-badge--inactive {
  opacity: 0.4;
}

.extension-detail-controls__platform-warning {
  display: flex;
  align-items: flex-start;
  padding: 8px 10px;
  border: 1px solid hsl(var(--warning) / 30%);
  border-radius: var(--radius);
  background-color: hsl(var(--warning) / 8%);
  color: hsl(var(--warning));
  font-size: 0.8rem;
  gap: 6px;
  line-height: 1.4;
}

.extension-detail-controls__version-display {
  display: flex;
  height: 32px;
  align-items: center;
  padding: 0 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.extension-detail-controls__version-value {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.extension-detail-controls__latest-tag {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.extension-detail-controls__spinner {
  animation: extension-detail-controls-spin 1s linear infinite;
}

@keyframes extension-detail-controls-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (width <= 900px) {
  .extension-detail-controls {
    width: 100%;
    min-width: 0;
  }

  .extension-detail-controls__summary {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .extension-detail-controls__actions {
    flex-flow: row wrap;
    align-items: center;
    gap: 8px;
  }

  .extension-detail-controls__version {
    width: auto;
    min-width: 0;
    flex: 0 1 140px;
  }

  .extension-detail-controls__actions .extension-detail-controls__version-display {
    min-width: 0;
    flex: 0 1 auto;
  }

  .extension-detail-controls__actions .extension-detail-controls__button {
    width: auto;
    height: 32px;
    flex-shrink: 0;
    padding-inline: 10px;
  }

  .extension-detail-controls__actions .extension-detail-controls__auto-update {
    width: auto;
    height: 32px;
    flex-shrink: 0;
    padding: 0 10px;
  }

  .extension-detail-controls__info {
    flex-shrink: 0;
    align-items: flex-end;
  }
}
</style>
