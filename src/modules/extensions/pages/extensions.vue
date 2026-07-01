<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  watch,
  markRaw,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import { StoreIcon, CircleCheckIcon, PackageIcon } from '@lucide/vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { PageDefaultLayout } from '@/layouts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRestoredActiveTab } from '@/composables/use-restored-active-tab';
import { useExtensions } from '@/modules/extensions/composables/use-extensions';
import { useExtensionAnimation } from '@/modules/extensions/composables/use-extension-animation';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { isUserCancelledError } from '@/modules/extensions/utils/extension-install-cancellation';
import { isBinarySetupCancelledError } from '@/modules/extensions/utils/binary-setup-cancelled-error';
import { handleError } from '@/utils/error-handler';
import ExtensionBinarySetupModal from '@/modules/extensions/components/extension-binary-setup-modal.vue';
import { useExtensionBinarySetupRoute } from '@/modules/extensions/composables/use-extension-binary-setup';
import { openBinarySetupForExtension, openBinarySetupForAllDependencies, getExtensionIdsUsingBinary } from '@/modules/extensions/utils/extension-binary-setup-state';
import { useBinaryEditAvailability } from '@/modules/extensions/utils/binary-edit-availability';
import { showBinaryEditBlockedToast } from '@/modules/extensions/utils/toast-utils';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import ExtensionsToolbarActions from '@/modules/extensions/components/extensions-toolbar-actions.vue';
import ExtensionSearch from '@/modules/extensions/components/extension-search.vue';
import ExtensionsMarketplace from '@/modules/extensions/components/extensions-marketplace.vue';
import ExtensionsInstalled from '@/modules/extensions/components/extensions-installed.vue';
import ExtensionDetail from '@/modules/extensions/components/extension-detail.vue';
import DependenciesTab from '@/modules/extensions/components/dependencies-tab.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';
import { useGitHubConnectivityStatus } from '@/modules/extensions/utils/github-connectivity-status';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Alert } from '@/components/ui/alert';

const { t } = useI18n();
const route = useRoute();
const extensionsStore = useExtensionsStore();
const { isBinaryEditBlocked } = useBinaryEditAvailability();
const { hasGitHubConnectivityIssue } = useGitHubConnectivityStatus();
useExtensionBinarySetupRoute();

const {
  searchQuery,
  selectedExtension,
  filteredExtensions,
  featuredExtensions,
  installedExtensionsWithManifest,
  isFetchingRegistry,
  isFetchingExtensionRemoteMetadata,
  isLoadingManifest,
  registryError,
  installingExtensions,
  pendingFolderInstalls,
  uninstallingExtensions,
  updatingExtensions,
  togglingExtensions,
  isAnyInstallInProgress,
  selectExtension,
  clearSelection,
  installExtension,
  cancelInstallExtension,
  installLocalExtension,
  refreshLocalExtension,
  uninstallExtension,
  updateExtension,
  toggleExtension,
  toggleAutoUpdate,
  changeVersion,
  refreshRegistry,
} = useExtensions();

const showExtensionsTopLoader = computed(() => {
  return isFetchingRegistry.value
    || isLoadingManifest.value
    || isFetchingExtensionRemoteMetadata.value;
});

const extensionsStorageStore = useExtensionsStorageStore();
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

const activeTab = useRestoredActiveTab('extensions', 'marketplace');
const showDetailModal = ref(false);

onMounted(() => {
  const tabQuery = route.query.tab;

  if (tabQuery === 'installed' || tabQuery === 'dependencies' || tabQuery === 'marketplace') {
    activeTab.value = tabQuery;
  }

  document.addEventListener('keydown', handleKeydown);
});

watch(
  () => route.query.tab,
  (tabQuery) => {
    if (tabQuery === 'installed' || tabQuery === 'dependencies' || tabQuery === 'marketplace') {
      activeTab.value = tabQuery;
    }
  },
);

async function reloadExtensionsAfterBinaryEdit(extensionIds: string[]): Promise<void> {
  for (const extensionId of extensionIds) {
    const installedExtension = installedExtensionsWithManifest.value.find(
      extensionItem => extensionItem.id === extensionId,
    );

    if (!installedExtension?.isEnabled) {
      continue;
    }

    try {
      await extensionsStore.unloadExtension(extensionId);
      await extensionsStore.loadExtension(extensionId, 'onStartup');
    }
    catch (error) {
      handleError(t('extensions.binaries.reloadFailed'), error);
    }
  }
}

function handleEditBinaries(extension: ExtensionWithManifest) {
  if (isBinaryEditBlocked.value) {
    showBinaryEditBlockedToast();
    return;
  }

  if (!extension.manifest) {
    return;
  }

  openBinarySetupForExtension(
    extension.id,
    extension.name || extension.manifest.name || extension.id,
    extension.manifest,
    async () => {
      await reloadExtensionsAfterBinaryEdit([extension.id]);
    },
  );
}

function handleEditDependencies() {
  if (isBinaryEditBlocked.value) {
    showBinaryEditBlockedToast();
    return;
  }

  openBinarySetupForAllDependencies(async () => {
    const extensionIds = new Set<string>();

    for (const sharedBinary of Object.values(extensionsStorageStore.extensionsData.sharedBinaries)) {
      for (const extensionId of getExtensionIdsUsingBinary(sharedBinary.id)) {
        extensionIds.add(extensionId);
      }
    }

    await reloadExtensionsAfterBinaryEdit([...extensionIds]);
  });
}

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
  const controls = detailContainerRef.value.querySelector('[data-animate="controls"]') as HTMLElement | null;
  const tabs = detailContainerRef.value.querySelector('[data-animate="tabs"]') as HTMLElement | null;

  const contentElements: HTMLElement[] = [];
  if (headerRow) contentElements.push(headerRow);
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
  try {
    await installExtension(extensionId, version);
  }
  catch (error) {
    if (isUserCancelledError(error) || isBinarySetupCancelledError(error)) return;
    handleError(t('extensions.installFailed'), error);
  }
}

async function handleCancelInstall(extensionId: string) {
  await cancelInstallExtension(extensionId);
}

async function handleUninstall(extensionId: string) {
  await uninstallExtension(extensionId);
}

async function handleRefresh(extensionId: string) {
  if (installingExtensions.value.has(extensionId)) return;

  try {
    await refreshLocalExtension(extensionId);
    const refreshedExtension = installedExtensionsWithManifest.value.find(
      extensionItem => extensionItem.id === extensionId,
    );
    const extensionName = refreshedExtension?.manifest?.name || extensionId.split('.').pop() || extensionId;
    const reusedBinaryCount = refreshedExtension?.binaries.length ?? 0;
    const toastId = `ext-refresh-${extensionId}`;
    toast.custom(markRaw(ToastStatic), {
      id: toastId,
      duration: 3000,
      componentProps: {
        data: {
          title: `${t('featureExtension')} | ${extensionName}`,
          subtitle: t('extensions.reinstalledSuccessfully'),
          description: reusedBinaryCount > 0
            ? t('extensions.reusedDependencies', { count: reusedBinaryCount })
            : '',
          extensionId,
          extensionIconPath: refreshedExtension?.manifest?.icon,
        },
      },
    });
  }
  catch (error) {
    if (isUserCancelledError(error)) return;
    handleError(t('extensions.installLocalError'), error);
  }
}

async function handleUpdate(extensionId: string, version?: string) {
  try {
    if (version) {
      await changeVersion(extensionId, version);
      return;
    }

    await updateExtension(extensionId);
  }
  catch (error) {
    if (isUserCancelledError(error)) return;
    handleError(t('extensions.installFailed'), error);
  }
}

async function handleToggle(extensionId: string) {
  await toggleExtension(extensionId);
}

async function handleToggleAutoUpdate(extensionId: string) {
  await toggleAutoUpdate(extensionId);
}

async function handleInstallLocal(sourcePath: string) {
  if (isAnyInstallInProgress.value) return;

  activeTab.value = 'installed';

  try {
    await installLocalExtension(sourcePath);
  }
  catch (error) {
    if (isUserCancelledError(error) || isBinarySetupCancelledError(error)) return;
    handleError(t('extensions.installLocalError'), error);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showDetailModal.value) {
    handleBack();
  }
}

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <ExtensionBinarySetupModal />
  <Teleport to="body">
    <div
      v-if="showExtensionsTopLoader"
      class="extensions-page__top-loader animate-fade-in"
      aria-hidden="true"
    >
      <div class="extensions-page__top-loader-bar" />
    </div>
  </Teleport>
  <ExtensionsToolbarActions
    :is-install-from-folder-disabled="isAnyInstallInProgress"
    @install-local="handleInstallLocal"
  />
  <PageDefaultLayout
    class="extensions-page"
    :title="t('pages.extensions')"
    :subtitle="t('extensions.subtitle')"
  >
    <template #prepend>
      <Collapsible
        :open="hasGitHubConnectivityIssue"
        class="extensions-page__network-alert-collapsible"
      >
        <CollapsibleContent class="extensions-page__network-alert-content">
          <div class="extensions-page__network-alert-inner">
            <Alert
              tone="warning"
              class="extensions-page__network-alert"
              :title="t('extensions.githubConnectivityIssue')"
              :description="t('extensions.githubConnectivityIssueDescription')"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </template>
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
          :updating-extensions="updatingExtensions"
          :is-any-install-in-progress="isAnyInstallInProgress"
          :search-query="searchQuery"
          @select="handleSelectExtension"
          @install="handleInstall"
          @update="handleUpdate"
          @cancel="handleCancelInstall"
          @refresh="refreshRegistry"
        />
      </TabsContent>

      <TabsContent
        value="installed"
        class="extensions-page__content"
      >
        <ExtensionsInstalled
          :extensions="installedExtensionsWithManifest"
          :pending-folder-installs="pendingFolderInstalls"
          :installing-extensions="installingExtensions"
          :updating-extensions="updatingExtensions"
          :uninstalling-extensions="uninstallingExtensions"
          :toggling-extensions="togglingExtensions"
          :is-installing-local="isAnyInstallInProgress"
          :is-binary-edit-disabled="isBinaryEditBlocked"
          @select="handleSelectExtension"
          @toggle="handleToggle"
          @update="handleUpdate"
          @refresh="handleRefresh"
          @uninstall="handleUninstall"
          @install-local="handleInstallLocal"
          @cancel="handleCancelInstall"
          @edit-binaries="handleEditBinaries"
        />
      </TabsContent>

      <TabsContent
        value="dependencies"
        class="extensions-page__content"
      >
        <DependenciesTab
          :is-removing="removingDependencies"
          :is-binary-edit-disabled="isBinaryEditBlocked"
          @remove="handleRemoveDependency"
          @edit="handleEditDependencies"
        />
      </TabsContent>
    </Tabs>

    <Teleport to=".app-layout__content">
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
                :is-install-disabled="installingExtensions.has(selectedExtension.id) || isAnyInstallInProgress"
                :is-uninstalling="uninstallingExtensions.has(selectedExtension.id)"
                :is-updating="updatingExtensions.has(selectedExtension.id)"
                :is-toggling-enabled="togglingExtensions.has(selectedExtension.id)"
                @back="handleBack"
                @install="(version) => handleInstall(selectedExtension!.id, version)"
                @uninstall="handleUninstall(selectedExtension!.id)"
                @update="(version) => handleUpdate(selectedExtension!.id, version)"
                @refresh="handleRefresh(selectedExtension!.id)"
                @toggle="handleToggle(selectedExtension!.id)"
                @toggle-auto-update="handleToggleAutoUpdate(selectedExtension!.id)"
                @cancel="handleCancelInstall(selectedExtension!.id)"
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </Teleport>
  </PageDefaultLayout>
</template>

<style>
.extensions-page__top-loader {
  position: fixed;
  z-index: 100;
  top: 0;
  right: 0;
  left: 0;
  overflow: hidden;
  height: 4px;
  background-color: hsl(var(--muted) / 35%);
  pointer-events: none;
}

.extensions-page__top-loader-bar {
  width: 38%;
  height: 100%;
  animation: extensions-page-top-loader 1.15s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    hsl(var(--primary) / 0%),
    hsl(var(--primary) / 92%),
    hsl(var(--primary) / 0%)
  );
}

@keyframes extensions-page-top-loader {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(320%);
  }
}

.extensions-page {
  min-width: 0;
  max-width: 100%;
}

.extensions-page__tabs {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  gap: 20px;
}

.extensions-page__network-alert-collapsible {
  width: 100%;
}

.extensions-page__network-alert-content {
  overflow: hidden;
}

.extensions-page__network-alert-inner {
  padding-bottom: 16px;
}

.extensions-page__network-alert {
  width: 100%;
}

.extensions-page__header {
  display: flex;
  min-width: 0;
  max-width: 100%;
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
  min-width: 0;
  max-width: 100%;
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
  position: absolute;
  z-index: 2;
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
    max-width: 100%;
    height: auto;
    min-height: auto;
  }

  .extensions-page__tabs-list .extensions-page__tab-trigger {
    min-width: 0;
    height: 48px;
    flex: 1 1 0;
    flex-direction: column;
    padding-top: 2px;
    font-size: 0.75rem;
    gap: 0;
    white-space: normal;
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
    max-width: 100%;
    box-sizing: border-box;
    padding: 48px 16px;
  }
}
</style>
