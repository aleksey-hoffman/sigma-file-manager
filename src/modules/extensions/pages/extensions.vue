<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, nextTick, onMounted, onUnmounted, markRaw,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { StoreIcon, CircleCheckIcon, PackageIcon } from 'lucide-vue-next';
import { toast, CustomProgress } from '@/components/ui/toaster';
import { PageDefaultLayout } from '@/layouts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useExtensions } from '@/modules/extensions/composables/use-extensions';
import { useExtensionAnimation } from '@/modules/extensions/composables/use-extension-animation';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { handleError } from '@/utils/error-handler';
import ExtensionSearch from '@/modules/extensions/components/extension-search.vue';
import ExtensionsMarketplace from '@/modules/extensions/components/extensions-marketplace.vue';
import ExtensionsInstalled from '@/modules/extensions/components/extensions-installed.vue';
import ExtensionDetail from '@/modules/extensions/components/extension-detail.vue';
import DependenciesTab from '@/modules/extensions/components/dependencies-tab.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';

const { t } = useI18n();

const {
  searchQuery,
  selectedExtension,
  filteredExtensions,
  featuredExtensions,
  installedExtensionsWithManifest,
  isFetchingRegistry,
  registryError,
  installingExtensions,
  uninstallingExtensions,
  updatingExtensions,
  selectExtension,
  clearSelection,
  installExtension,
  installLocalExtension,
  refreshLocalExtension,
  uninstallExtension,
  updateExtension,
  toggleExtension,
  toggleAutoUpdate,
  changeVersion,
  refreshRegistry,
} = useExtensions();

const extensionsStorageStore = useExtensionsStorageStore();

const isInstallingLocal = ref(false);
const refreshingExtensions = ref<Set<string>>(new Set());
const removingDependencies = ref<Set<string>>(new Set());

const sharedBinariesCount = computed(() => {
  return Object.keys(extensionsStorageStore.extensionsData.sharedBinaries).length;
});

async function cleanPerExtensionBinaryMetadata(binaryId: string, extensionIds: string[]) {
  for (const extensionId of extensionIds) {
    const extensionData = extensionsStorageStore.extensionsData.installedExtensions[extensionId];
    if (!extensionData?.settings?.customSettings) continue;

    const binaryStorage = extensionData.settings.customSettings.__binaries as Record<string, unknown> | undefined;
    if (!binaryStorage || !binaryStorage[binaryId]) continue;

    const updatedBinaries = { ...binaryStorage };
    delete updatedBinaries[binaryId];
    await extensionsStorageStore.updateExtensionSettings(extensionId, {
      customSettings: {
        ...extensionData.settings.customSettings,
        __binaries: updatedBinaries,
      },
    });
  }
}

async function handleRemoveDependency(binaryId: string, version?: string) {
  const binaryKey = `${binaryId}@${version || 'latest'}`;
  if (removingDependencies.value.has(binaryKey)) return;

  const sharedBinary = extensionsStorageStore.getSharedBinary(binaryId, version);
  const affectedExtensions = sharedBinary?.usedBy ?? [];

  if (affectedExtensions.length > 0) {
    const extensionNames = affectedExtensions.map(
      extensionId => extensionId.split('.').pop() || extensionId,
    ).join(', ');
    const confirmed = window.confirm(
      t('extensions.dependencies.removeConfirm', { extensions: extensionNames }),
    );
    if (!confirmed) return;
  }

  removingDependencies.value.add(binaryKey);

  try {
    await invoke('remove_shared_binary', {
      binaryId,
      version: version ?? null,
    });
    await cleanPerExtensionBinaryMetadata(binaryId, affectedExtensions);
    await extensionsStorageStore.removeSharedBinaryEntry(binaryId, version);
  }
  catch (error) {
    handleError(t('extensions.dependencies.removeError'), error);
  }
  finally {
    removingDependencies.value.delete(binaryKey);
  }
}

const {
  isAnimating,
  isClosing,
  isMorphClose,
  captureSourceRect,
  hideSourceElement,
  showSourceElement,
  animateOpen,
  animateClose,
} = useExtensionAnimation();

const activeTab = ref('marketplace');
const showDetailModal = ref(false);
const detailOverlayRef = ref<HTMLElement | null>(null);
const detailContainerRef = ref<HTMLElement | null>(null);

const showDetail = computed(() => selectedExtension.value !== null && showDetailModal.value);

function getAnimatableElements() {
  if (!detailContainerRef.value) return {
    sharedCard: null,
    contentElements: [],
  };

  const sharedCard = detailContainerRef.value.querySelector('[data-animate="shared-card"]') as HTMLElement | null;
  const headerRow = detailContainerRef.value.querySelector('[data-animate="header-row"]') as HTMLElement | null;
  const statusAlert = detailContainerRef.value.querySelector('[data-animate="status-alert"]') as HTMLElement | null;
  const controls = detailContainerRef.value.querySelector('[data-animate="controls"]') as HTMLElement | null;
  const tabs = detailContainerRef.value.querySelector('[data-animate="tabs"]') as HTMLElement | null;

  const contentElements: HTMLElement[] = [];
  if (headerRow) contentElements.push(headerRow);
  if (statusAlert) contentElements.push(statusAlert);
  if (controls) contentElements.push(controls);
  if (tabs) contentElements.push(tabs);

  return {
    sharedCard,
    contentElements,
  };
}

async function handleSelectExtension(extension: ExtensionWithManifest, event?: MouseEvent) {
  const target = event?.currentTarget as HTMLElement | undefined;

  if (target) {
    captureSourceRect(target);
    hideSourceElement();
  }

  selectExtension(extension);
  showDetailModal.value = true;

  await nextTick();

  const { sharedCard, contentElements } = getAnimatableElements();

  if (sharedCard && detailOverlayRef.value) {
    await animateOpen(sharedCard, contentElements, detailOverlayRef.value);
  }
}

async function handleBack() {
  if (isAnimating.value || isClosing.value) return;

  const { sharedCard, contentElements } = getAnimatableElements();

  if (sharedCard && detailOverlayRef.value) {
    await animateClose(sharedCard, contentElements, detailOverlayRef.value);
  }
  else {
    showSourceElement();
  }

  showDetailModal.value = false;
  clearSelection();
}

async function handleInstall(extensionId: string, version?: string) {
  await installExtension(extensionId, version);
}

async function handleUninstall(extensionId: string) {
  await uninstallExtension(extensionId);
}

async function handleRefresh(extensionId: string) {
  if (refreshingExtensions.value.has(extensionId)) return;

  refreshingExtensions.value = new Set(refreshingExtensions.value).add(extensionId);

  try {
    await refreshLocalExtension(extensionId);
    const refreshedExtension = installedExtensionsWithManifest.value.find(
      extensionItem => extensionItem.id === extensionId,
    );
    const extensionName = refreshedExtension?.manifest?.name || extensionId.split('.').pop() || extensionId;
    const reusedBinaryCount = refreshedExtension?.binaries.length ?? 0;
    const toastId = `ext-refresh-${extensionId}`;
    toast.custom(markRaw(CustomProgress), {
      id: toastId,
      duration: 3000,
      componentProps: {
        data: {
          id: toastId,
          title: `${t('extension')} | ${extensionName}`,
          subtitle: t('extensions.reinstalledSuccessfully'),
          description: reusedBinaryCount > 0
            ? t('extensions.reusedDependencies', { count: reusedBinaryCount })
            : '',
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId,
          extensionIconPath: refreshedExtension?.manifest?.icon,
        },
      },
    });
  }
  catch (error) {
    handleError(t('extensions.installLocalError'), error);
  }
  finally {
    const next = new Set(refreshingExtensions.value);
    next.delete(extensionId);
    refreshingExtensions.value = next;
  }
}

async function handleUpdate(extensionId: string, version?: string) {
  if (version) {
    await changeVersion(extensionId, version);
    return;
  }

  await updateExtension(extensionId);
}

async function handleToggle(extensionId: string) {
  await toggleExtension(extensionId);
}

async function handleToggleAutoUpdate(extensionId: string) {
  await toggleAutoUpdate(extensionId);
}

async function handleInstallLocal(sourcePath: string) {
  if (isInstallingLocal.value) return;

  isInstallingLocal.value = true;

  try {
    await installLocalExtension(sourcePath);
  }
  catch (error) {
    handleError(t('extensions.installLocalError'), error);
  }
  finally {
    isInstallingLocal.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showDetailModal.value) {
    handleBack();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <PageDefaultLayout
    class="extensions-page"
    :title="t('pages.extensions')"
    :subtitle="t('extensions.subtitle')"
  >
    <Tabs
      v-model="activeTab"
      class="extensions-page__tabs"
    >
      <div class="extensions-page__header">
        <TabsList class="extensions-page__tabs-list">
          <TabsTrigger
            value="marketplace"
            class="extensions-page__tab-trigger"
          >
            <span class="extensions-page__tab-icon-wrap">
              <StoreIcon :size="16" />
            </span>
            {{ t('extensions.tabs.marketplace') }}
          </TabsTrigger>
          <TabsTrigger
            value="installed"
            class="extensions-page__tab-trigger"
          >
            <span class="extensions-page__tab-icon-wrap">
              <CircleCheckIcon :size="16" />
              <span
                v-if="installedExtensionsWithManifest.length > 0"
                class="extensions-page__tab-badge extensions-page__tab-badge--icon"
              >
                {{ installedExtensionsWithManifest.length }}
              </span>
            </span>
            {{ t('extensions.tabs.installed') }}
            <span
              v-if="installedExtensionsWithManifest.length > 0"
              class="extensions-page__tab-badge extensions-page__tab-badge--inline"
            >
              {{ installedExtensionsWithManifest.length }}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="dependencies"
            class="extensions-page__tab-trigger"
          >
            <span class="extensions-page__tab-icon-wrap">
              <PackageIcon :size="16" />
              <span
                v-if="sharedBinariesCount > 0"
                class="extensions-page__tab-badge extensions-page__tab-badge--icon"
              >
                {{ sharedBinariesCount }}
              </span>
            </span>
            {{ t('extensions.tabs.dependencies') }}
            <span
              v-if="sharedBinariesCount > 0"
              class="extensions-page__tab-badge extensions-page__tab-badge--inline"
            >
              {{ sharedBinariesCount }}
            </span>
          </TabsTrigger>
        </TabsList>

        <ExtensionSearch
          v-if="activeTab === 'marketplace'"
          v-model="searchQuery"
          :is-refreshing="isFetchingRegistry"
          @refresh="refreshRegistry"
        />
      </div>

      <TabsContent
        value="marketplace"
        class="extensions-page__content"
      >
        <ExtensionsMarketplace
          :extensions="filteredExtensions"
          :featured-extensions="featuredExtensions"
          :is-loading="isFetchingRegistry && filteredExtensions.length === 0"
          :error="registryError"
          :installing-extensions="installingExtensions"
          :search-query="searchQuery"
          @select="handleSelectExtension"
          @install="handleInstall"
          @update="handleUpdate"
        />
      </TabsContent>

      <TabsContent
        value="installed"
        class="extensions-page__content"
      >
        <ExtensionsInstalled
          :extensions="installedExtensionsWithManifest"
          :installing-extensions="installingExtensions"
          :uninstalling-extensions="uninstallingExtensions"
          :refreshing-extensions="refreshingExtensions"
          :is-installing-local="isInstallingLocal"
          @select="handleSelectExtension"
          @toggle="handleToggle"
          @update="handleUpdate"
          @refresh="handleRefresh"
          @uninstall="handleUninstall"
          @install-local="handleInstallLocal"
        />
      </TabsContent>

      <TabsContent
        value="dependencies"
        class="extensions-page__content"
      >
        <DependenciesTab
          :is-removing="removingDependencies"
          @remove="handleRemoveDependency"
        />
      </TabsContent>
    </Tabs>

    <Teleport to="body">
      <div
        v-if="showDetail && selectedExtension"
        class="extension-modal"
        :class="{
          'extension-modal--closing': isClosing && !isMorphClose,
          'extension-modal--morph-close': isMorphClose,
        }"
      >
        <div
          ref="detailOverlayRef"
          class="extension-modal__overlay"
          @click="handleBack"
        />
        <div
          ref="detailContainerRef"
          class="extension-modal__container"
        >
          <ScrollArea class="extension-modal__scroll">
            <div class="extension-modal__content">
              <ExtensionDetail
                :extension="selectedExtension"
                :is-installing="installingExtensions.has(selectedExtension.id)"
                :is-uninstalling="uninstallingExtensions.has(selectedExtension.id)"
                :is-updating="updatingExtensions.has(selectedExtension.id)"
                :is-refreshing="refreshingExtensions.has(selectedExtension.id)"
                @back="handleBack"
                @install="(version) => handleInstall(selectedExtension!.id, version)"
                @uninstall="handleUninstall(selectedExtension!.id)"
                @update="(version) => handleUpdate(selectedExtension!.id, version)"
                @refresh="handleRefresh(selectedExtension!.id)"
                @toggle="handleToggle(selectedExtension!.id)"
                @toggle-auto-update="handleToggleAutoUpdate(selectedExtension!.id)"
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </Teleport>
  </PageDefaultLayout>
</template>

<style>
.extensions-page__tabs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.extensions-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.extensions-page__tabs-list {
  display: flex;
  padding: 4px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 50%);
  gap: 4px;
}

.extensions-page__tab-icon-wrap {
  display: inline-flex;
  align-items: center;
}

.extensions-page__tab-badge {
  display: flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 10px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
}

.extensions-page__tab-badge--inline {
  margin-left: 4px;
}

.extensions-page__tab-badge--icon {
  display: none;
}

.extensions-page__content {
  animation: fade-in 0.2s ease-out;
  outline: none !important;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.extension-modal {
  position: fixed;
  overflow: hidden;
  inset: 0;
  opacity: 1;
  transition: opacity 0.2s ease-out;
}

.extension-modal--closing {
  opacity: 0;
  transition-delay: 0.05s;
}

.extension-modal__overlay {
  position: absolute;
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background) / 20%);
  inset: 0;
}

.extension-modal--morph-close .extension-modal__overlay {
  backdrop-filter: none;
}

.extension-modal__container {
  position: absolute;
  z-index: 1;
  background-color: transparent;
  inset: 0;
}

.extension-modal__container .extension-detail {
  max-width: 1200px;
  margin: 0 auto;
}

.extension-modal__scroll {
  width: 100%;
  height: 100%;
}

.extension-modal__content {
  padding: 64px;
}

.extension-modal__container [data-animate="shared-card"] {
  will-change: transform;
}

.extension-modal__container [data-animate="header-row"],
.extension-modal__container [data-animate="controls"],
.extension-modal__container [data-animate="tabs"] {
  will-change: opacity, transform;
}

@media (width <= 768px) {
  .extensions-page__header {
    flex-direction: column;
    align-items: stretch;
  }

  .extensions-page__tabs-list {
    width: 100%;
    height: auto;
    min-height: auto;
  }

  .extensions-page__tabs-list .extensions-page__tab-trigger {
    height: 48px;
    flex-direction: column;
    padding-top: 2px;
    gap: 0;
  }

  .extensions-page__tabs-list .extensions-page__tab-icon-wrap {
    position: relative;
  }

  .extensions-page__tabs-list .extensions-page__tab-badge--inline {
    display: none;
  }

  .extensions-page__tabs-list .extensions-page__tab-badge--icon {
    position: absolute;
    top: -2px;
    right: -24px;
    display: flex;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    margin-left: 0;
    background-color: hsl(var(--primary) / 40%);
    font-size: 10px;
  }

  .extension-modal__content {
    padding: 64px 24px;
  }
}
</style>
