<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  ArrowLeftIcon,
  PackageIcon,
  DownloadIcon,
  TrashIcon,
  RefreshCwIcon,
  ArrowBigUpDashIcon,
  ExternalLinkIcon,
  ShieldIcon,
  BookOpenIcon,
  UserIcon,
  CalendarIcon,
  GitBranchIcon,
  TriangleAlertIcon,
  TerminalIcon,
  XIcon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import ExtensionBadge from './extension-badge.vue';
import ExtensionIcon from './extension-icon.vue';
import type { ExtensionWithManifest } from '@/modules/extensions/composables/use-extensions';
import type { ExtensionManifest, PlatformInfo } from '@/types/extension';
import { EXTENSION_PERMISSIONS_INFO } from '@/data/extensions';
import { getExtensionReadmeUrl, getExtensionChangelogUrl } from '@/data/extensions';
import { formatBytes, formatDate } from '@/modules/navigator/components/file-browser/utils';
import { getBinaryDisplayVersion } from '@/modules/extensions/utils/binary-metadata';
import { isHttpUrl, openBinaryDownloadUrl } from '@/modules/extensions/utils/binary-download-url';
import { getLucideIcon } from '@/utils/lucide-icons';
import { renderMarkdownToSafeHtml } from '@/utils/safe-html';
import { rewriteMarkdownAssetUrls } from '@/utils/readme-relative-urls';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { getKeybindingForCommand, formatKeybindingKeys } from '@/modules/extensions/api';
import { ensurePlatformInfo } from '@/modules/extensions/api/platform';
import { resolveManifestBinaryAsset } from '@/modules/extensions/utils/manifest-binaries';
import {
  resolveManifestMediaItems,
  getGitHubRefForRemoteMedia,
  manifestHasMediaItems,
  type ResolvedManifestMediaItem,
} from '@/modules/extensions/utils/resolve-manifest-media';
import { useQuickViewStore } from '@/stores/runtime/quick-view';

const props = defineProps<{
  extension: ExtensionWithManifest;
  isInstalling?: boolean;
  isInstallDisabled?: boolean;
  isUninstalling?: boolean;
  isUpdating?: boolean;
  isRefreshing?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  install: [version?: string];
  uninstall: [];
  update: [version?: string];
  refresh: [];
  cancel: [];
  toggle: [];
  toggleAutoUpdate: [];
}>();

const { t } = useI18n();
const extensionsStore = useExtensionsStore();
const quickViewStore = useQuickViewStore();

const activeTab = ref('overview');
const selectedVersion = ref(props.extension.installedVersion || props.extension.latestVersion || '');
const readmeContent = ref<string | null>(null);
const readmeRenderedHtml = ref('');
const changelogContent = ref<string | null>(null);
const changelogRenderedHtml = ref('');
const isLoadingReadme = ref(false);
const isLoadingChangelog = ref(false);
let readmeLoadGeneration = 0;
let changelogLoadGeneration = 0;
const isCancelRequested = ref(false);
const currentManifest = ref<ExtensionManifest | undefined>(props.extension.manifest);
const currentPlatformInfo = ref<PlatformInfo | null>(null);
const resolvedMediaItems = ref<ResolvedManifestMediaItem[]>([]);

const displayName = computed(() => {
  return props.extension.name || currentManifest.value?.name || props.extension.id.split('.').pop() || props.extension.id;
});

const description = computed(() => {
  return props.extension.description || t('extensions.noDescription');
});

const publisherName = computed(() => {
  return props.extension.publisher.name || currentManifest.value?.publisher?.name || t('extensions.unknownPublisher');
});

const publisherUrl = computed(() => {
  return props.extension.publisher.url || currentManifest.value?.publisher?.url;
});

const isOfficial = computed(() => props.extension.isOfficial);

const isLocal = computed(() => props.extension.isLocal);

const isBroken = computed(() => props.extension.isBroken);

const previousName = computed(() => {
  return currentManifest.value?.previousName;
});

const availableVersions = computed(() => {
  return props.extension.versions || [];
});

const RISK_SORT_ORDER: Record<string, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const permissions = computed(() => {
  const permissionsList = currentManifest.value?.permissions || [];
  return [...permissionsList].sort((permissionA, permissionB) => {
    const riskA = RISK_SORT_ORDER[getPermissionInfo(permissionA).risk] ?? 1;
    const riskB = RISK_SORT_ORDER[getPermissionInfo(permissionB).risk] ?? 1;
    return riskA - riskB;
  });
});

const categories = computed(() => {
  return props.extension.categories || [];
});

const extensionCommands = computed(() => {
  const runtimeRegistrations = extensionsStore.commands.filter(
    registration => registration.extensionId === props.extension.id,
  );
  const manifestCommands = currentManifest.value?.contributes?.commands ?? [];
  const registeredIds = new Set(runtimeRegistrations.map(reg => reg.command.id));
  type CommandDisplay = {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    shortcut?: string;
  };
  const result: CommandDisplay[] = [];

  for (const registration of runtimeRegistrations) {
    const keybinding = getKeybindingForCommand(registration.command.id);
    const shortcut = keybinding?.keys?.key ? formatKeybindingKeys(keybinding.keys) : undefined;
    result.push({
      id: registration.command.id,
      title: registration.command.title,
      description: registration.command.description,
      icon: registration.command.icon,
      shortcut,
    });
  }

  for (const manifestCmd of manifestCommands) {
    const fullCommandId = `${props.extension.id}.${manifestCmd.id}`;
    if (registeredIds.has(fullCommandId)) continue;
    registeredIds.add(fullCommandId);
    const keybinding = getKeybindingForCommand(fullCommandId);
    const shortcut = keybinding?.keys?.key ? formatKeybindingKeys(keybinding.keys) : manifestCmd.shortcut;
    result.push({
      id: fullCommandId,
      title: manifestCmd.title,
      description: manifestCmd.description,
      icon: manifestCmd.icon,
      shortcut,
    });
  }

  return result;
});

const repositoryUrl = computed(() => {
  return props.extension.repository;
});

const hasSelectedVersionChange = computed(() => {
  return props.extension.isInstalled
    && selectedVersion.value.length > 0
    && selectedVersion.value !== props.extension.installedVersion;
});

const showUpdateButton = computed(() => {
  return props.extension.isInstalled
    && !isLocal.value
    && !isBroken.value
    && (props.extension.hasUpdate || hasSelectedVersionChange.value);
});

const extensionBinaries = computed(() => {
  return props.extension.binaries || [];
});

const dependencyRows = computed(() => {
  if (props.extension.isInstalled) {
    return extensionBinaries.value.map(binary => ({
      id: binary.id,
      label: binary.id,
      versionLabel: getBinaryDisplayVersion(binary) || t('extensions.unknownVersion'),
      hasUpdate: binary.hasUpdate,
      latestVersion: binary.latestVersion,
      dateLabel: formatDate(binary.installedAt),
      downloadUrl: binary.downloadUrl,
    }));
  }

  return (currentManifest.value?.binaries || []).map((binary) => {
    const matchingAsset = currentPlatformInfo.value
      ? resolveManifestBinaryAsset(binary, currentPlatformInfo.value.os, currentPlatformInfo.value.arch)
      : null;

    return {
      id: binary.id,
      label: binary.name,
      versionLabel: binary.version,
      hasUpdate: false,
      latestVersion: undefined,
      dateLabel: [...(binary.platforms || Array.from(new Set(binary.assets.map(asset => asset.platform))))].join(' / '),
      downloadUrl: matchingAsset?.downloadUrl,
    };
  });
});

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

const extensionPlatforms = computed(() => {
  return currentManifest.value?.platforms || props.extension.platforms || [];
});

const isCrossPlatform = computed(() => {
  return extensionPlatforms.value.length === 3;
});

const isPlatformCompatible = computed(() => {
  return props.extension.isPlatformCompatible;
});

const isShowingCancelButton = computed(() => {
  return Boolean(props.isInstalling || props.isUpdating || props.isRefreshing);
});

function getPlatformDisplayName(platform: string): string {
  return PLATFORM_DISPLAY_NAMES[platform] || platform;
}

async function loadSelectedManifest(): Promise<void> {
  if (props.extension.isInstalled) {
    currentManifest.value = props.extension.manifest;
    return;
  }

  const targetVersion = selectedVersion.value || props.extension.latestVersion || '';

  if (!targetVersion) {
    currentManifest.value = props.extension.manifest;
    return;
  }

  try {
    currentManifest.value = await extensionsStore.fetchExtensionManifest(props.extension, targetVersion);
  }
  catch {
    currentManifest.value = props.extension.manifest;
  }
}

async function loadPlatformInfo(): Promise<void> {
  try {
    currentPlatformInfo.value = await ensurePlatformInfo();
  }
  catch {
    currentPlatformInfo.value = null;
  }
}

function handleStatusEnter(element: Element) {
  const htmlElement = element as HTMLElement;
  htmlElement.style.height = '0px';
  htmlElement.style.opacity = '0';
  htmlElement.style.marginBottom = '0px';
  const contentHeight = htmlElement.scrollHeight;
  requestAnimationFrame(() => {
    htmlElement.style.height = `${contentHeight}px`;
    htmlElement.style.opacity = '1';
    htmlElement.style.marginBottom = '12px';
  });
}

function handleStatusAfterEnter(element: Element) {
  const htmlElement = element as HTMLElement;
  htmlElement.style.height = 'auto';
}

function handleStatusLeave(element: Element) {
  const htmlElement = element as HTMLElement;
  const contentHeight = htmlElement.scrollHeight;
  htmlElement.style.height = `${contentHeight}px`;
  htmlElement.style.opacity = '1';
  htmlElement.style.marginBottom = '12px';
  requestAnimationFrame(() => {
    htmlElement.style.height = '0px';
    htmlElement.style.opacity = '0';
    htmlElement.style.marginBottom = '0px';
  });
}

function getPermissionInfo(permission: string) {
  return EXTENSION_PERMISSIONS_INFO[permission] || {
    title: permission,
    description: t('extensions.unknownPermission'),
    risk: 'medium',
  };
}

async function readInstalledExtensionFile(fileName: string): Promise<string | null> {
  try {
    const fileBytes = await invoke<number[]>('read_extension_file', {
      extensionId: props.extension.id,
      filePath: fileName,
    });
    return new TextDecoder().decode(new Uint8Array(fileBytes));
  }
  catch {
    return null;
  }
}

async function buildRenderedMarkdownHtml(
  markdown: string,
  useLocalImages: boolean,
  remoteDocumentBaseUrl: string,
): Promise<string> {
  const markdownHtml = renderMarkdownToSafeHtml(markdown);

  if (useLocalImages && props.extension.isInstalled) {
    try {
      const extensionPath = await invoke<string>('get_extension_path', { extensionId: props.extension.id });
      return rewriteMarkdownAssetUrls(markdownHtml, {
        kind: 'localExtension',
        extensionRootPath: extensionPath,
      });
    }
    catch {
      return rewriteMarkdownAssetUrls(markdownHtml, {
        kind: 'remoteGitHub',
        documentBaseUrl: remoteDocumentBaseUrl,
      });
    }
  }

  return rewriteMarkdownAssetUrls(markdownHtml, {
    kind: 'remoteGitHub',
    documentBaseUrl: remoteDocumentBaseUrl,
  });
}

async function loadReadme(forceReload = false) {
  if (!forceReload && readmeContent.value !== null) return;

  const generation = ++readmeLoadGeneration;
  isLoadingReadme.value = true;
  readmeContent.value = null;
  readmeRenderedHtml.value = '';

  try {
    let markdown: string;
    let useLocalImages = false;

    if (props.extension.isInstalled) {
      const localContent = await readInstalledExtensionFile('README.md');

      if (localContent) {
        markdown = localContent;
        useLocalImages = true;
      }
      else {
        const url = getExtensionReadmeUrl(props.extension.repository);
        const response = await fetch(url);
        markdown = response.ok ? await response.text() : t('extensions.readmeNotFound');
      }
    }
    else {
      const url = getExtensionReadmeUrl(props.extension.repository);
      const response = await fetch(url);
      markdown = response.ok ? await response.text() : t('extensions.readmeNotFound');
    }

    if (generation !== readmeLoadGeneration) return;

    const renderedReadmeHtml = await buildRenderedMarkdownHtml(
      markdown,
      useLocalImages,
      getExtensionReadmeUrl(props.extension.repository),
    );

    if (generation !== readmeLoadGeneration) return;

    readmeContent.value = markdown;
    readmeRenderedHtml.value = renderedReadmeHtml;
  }
  catch {
    if (generation !== readmeLoadGeneration) return;
    const errorMessage = t('extensions.readmeLoadError');
    readmeContent.value = errorMessage;
    readmeRenderedHtml.value = renderMarkdownToSafeHtml(errorMessage);
  }
  finally {
    if (generation === readmeLoadGeneration) {
      isLoadingReadme.value = false;
    }
  }
}

async function loadChangelog(forceReload = false) {
  if (!forceReload && changelogContent.value !== null) return;

  const generation = ++changelogLoadGeneration;
  isLoadingChangelog.value = true;
  changelogContent.value = null;
  changelogRenderedHtml.value = '';

  try {
    let markdown: string;
    let useLocalImages = false;

    if (props.extension.isInstalled) {
      const localContent = await readInstalledExtensionFile('CHANGELOG.md');

      if (localContent) {
        markdown = localContent;
        useLocalImages = true;
      }
      else {
        const url = getExtensionChangelogUrl(props.extension.repository);
        const response = await fetch(url);
        markdown = response.ok ? await response.text() : t('extensions.changelogNotFound');
      }
    }
    else {
      const url = getExtensionChangelogUrl(props.extension.repository);
      const response = await fetch(url);
      markdown = response.ok ? await response.text() : t('extensions.changelogNotFound');
    }

    if (generation !== changelogLoadGeneration) return;

    const renderedChangelogHtml = await buildRenderedMarkdownHtml(
      markdown,
      useLocalImages,
      getExtensionChangelogUrl(props.extension.repository),
    );

    if (generation !== changelogLoadGeneration) return;

    changelogContent.value = markdown;
    changelogRenderedHtml.value = renderedChangelogHtml;
  }
  catch {
    if (generation !== changelogLoadGeneration) return;
    const errorMessage = t('extensions.changelogLoadError');
    changelogContent.value = errorMessage;
    changelogRenderedHtml.value = renderMarkdownToSafeHtml(errorMessage);
  }
  finally {
    if (generation === changelogLoadGeneration) {
      isLoadingChangelog.value = false;
    }
  }
}

function handleTabChange(value: string | number) {
  const stringValue = String(value);
  activeTab.value = stringValue;

  if (stringValue === 'overview' && readmeContent.value === null) {
    loadReadme();
  }
  else if (stringValue === 'changelog' && changelogContent.value === null) {
    loadChangelog();
  }
}

function handleInstall() {
  emit('install', selectedVersion.value);
}

function handleUpdate() {
  emit('update', hasSelectedVersionChange.value ? selectedVersion.value : undefined);
}

function handleCancel() {
  if (isCancelRequested.value) return;
  isCancelRequested.value = true;
  emit('cancel');
}

async function openRepository() {
  if (repositoryUrl.value) {
    await openUrl(repositoryUrl.value);
  }
}

async function openPublisherProfile() {
  if (publisherUrl.value) {
    await openUrl(publisherUrl.value);
  }
}

async function handleManifestMediaClick(item: ResolvedManifestMediaItem) {
  if (item.quickViewPath) {
    await quickViewStore.openFileFromMainWindow(
      item.quickViewPath,
      item.quickViewSiblingPaths ?? null,
    );

    return;
  }

  if (item.remoteOpenUrl) {
    await openUrl(item.remoteOpenUrl);
  }
}

watch(
  () => props.extension.installedVersion,
  (newInstalledVersion) => {
    if (newInstalledVersion) {
      selectedVersion.value = newInstalledVersion;
    }
    else if (props.extension.latestVersion) {
      selectedVersion.value = props.extension.latestVersion;
    }
  },
);

watch(
  [
    () => props.extension.id,
    () => props.extension.manifest,
    () => props.extension.isInstalled,
    selectedVersion,
  ],
  () => {
    void loadSelectedManifest();
  },
  { immediate: true },
);

watch(
  () => [
    currentManifest.value,
    props.extension.id,
    props.extension.isInstalled,
    props.extension.repository,
    selectedVersion.value,
    props.extension.latestVersion,
    props.extension.installedVersion,
    props.extension.manifest,
  ],
  async () => {
    try {
      let manifestForMedia = currentManifest.value;

      if (props.extension.isInstalled && !manifestHasMediaItems(manifestForMedia)) {
        const versionForRemoteMedia
          = props.extension.installedVersion || selectedVersion.value || props.extension.latestVersion || '';

        if (versionForRemoteMedia) {
          try {
            const remoteManifest = await extensionsStore.fetchExtensionManifest(
              props.extension,
              versionForRemoteMedia,
            );

            if (manifestHasMediaItems(remoteManifest)) {
              const baseManifest = manifestForMedia ?? props.extension.manifest;
              manifestForMedia = {
                ...baseManifest,
                media: remoteManifest.media,
              } as ExtensionManifest;
            }
          }
          catch {
          }
        }
      }

      resolvedMediaItems.value = await resolveManifestMediaItems({
        manifest: manifestForMedia,
        extensionId: props.extension.id,
        isInstalled: props.extension.isInstalled,
        repository: props.extension.repository,
        remoteRef: getGitHubRefForRemoteMedia({
          isInstalled: props.extension.isInstalled,
          selectedVersion: selectedVersion.value,
          installedVersion: props.extension.installedVersion ?? null,
          latestVersion: props.extension.latestVersion,
        }),
      });
    }
    catch {
      resolvedMediaItems.value = [];
    }
  },
  { immediate: true },
);

watch(isShowingCancelButton, (isShowing) => {
  if (!isShowing) {
    isCancelRequested.value = false;
  }
});

function handleMarkdownLinkClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor?.href) return;
  const url = anchor.getAttribute('href') ?? '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    event.preventDefault();
    openUrl(url);
  }
}

function reloadContentAfterOperation() {
  loadReadme(true);

  if (changelogContent.value !== null) {
    loadChangelog(true);
  }
}

function watchOperationCompletion(getter: () => boolean | undefined) {
  watch(getter, (currentValue, previousValue) => {
    if (previousValue && !currentValue) {
      reloadContentAfterOperation();
    }
  });
}

watchOperationCompletion(() => props.isRefreshing);
watchOperationCompletion(() => props.isUpdating);
watchOperationCompletion(() => props.isInstalling);
watchOperationCompletion(() => props.isUninstalling);

watch(
  () => props.extension.id,
  () => {
    readmeContent.value = null;
    readmeRenderedHtml.value = '';
    changelogContent.value = null;
    changelogRenderedHtml.value = '';
    void loadReadme();

    if (activeTab.value === 'changelog') {
      void loadChangelog();
    }
  },
  { immediate: true },
);

onMounted(() => {
  void loadPlatformInfo();
});
</script>

<template>
  <div class="extension-detail">
    <div class="extension-detail__header">
      <div
        class="extension-detail__header-row"
        data-animate="header-row"
      >
        <Button
          variant="ghost"
          size="icon"
          @click="emit('back')"
        >
          <ArrowLeftIcon :size="20" />
        </Button>

        <div
          v-if="extension.isInstalled && !isInstalling"
          class="extension-detail__enabled-toggle"
        >
          <span class="extension-detail__enabled-label">
            {{ extension.isEnabled ? t('extensions.enabled') : t('extensions.disabled') }}
          </span>
          <Switch
            :id="`enabled-${extension.id}`"
            :model-value="extension.isEnabled"
            :disabled="isBroken"
            @update:model-value="emit('toggle')"
          />
        </div>
      </div>

      <Transition
        name="extension-status-alert"
        @enter="handleStatusEnter"
        @after-enter="handleStatusAfterEnter"
        @leave="handleStatusLeave"
      >
        <div
          v-if="extension.isInstalled && !isInstalling && !extension.isEnabled"
          class="extension-detail__status-alert-wrapper"
          data-animate="status-alert"
        >
          <div class="extension-detail__status-alert">
            <span class="extension-detail__status-alert-text">
              {{ t('extensions.disabled') }}
            </span>
          </div>
        </div>
      </Transition>

      <div class="extension-detail__cards">
        <div
          class="extension-detail__banner"
          data-animate="shared-card"
        >
          <div
            class="extension-detail__banner-content"
            data-animate="shared-card-content"
          >
            <div class="extension-detail__icon">
              <ExtensionIcon
                :extension-id="extension.id"
                :icon-path="extension.manifest?.icon"
                :repository="extension.repository"
                :version="extension.installedVersion || extension.latestVersion || extension.manifest?.version"
                :is-installed="extension.isInstalled"
                :size="42"
                :cache-key="extension.installedAt"
              />
            </div>

            <div class="extension-detail__info">
              <div class="extension-detail__title-row">
                <h1 class="extension-detail__name">
                  {{ displayName }}
                </h1>
                <ExtensionBadge
                  v-if="isBroken"
                  type="broken"
                  show-label
                />
                <ExtensionBadge
                  v-else-if="isLocal"
                  type="local"
                  show-label
                />
                <ExtensionBadge
                  v-else-if="isOfficial"
                  type="official"
                  show-label
                />
                <ExtensionBadge
                  v-else
                  type="community"
                  show-label
                />
                <span
                  v-for="category in categories"
                  :key="category"
                  class="extension-detail__category"
                >
                  {{ category }}
                </span>
              </div>

              <p
                v-if="previousName"
                class="extension-detail__previous-name"
              >
                {{ t('extensions.previouslyKnownAs', { name: previousName }) }}
              </p>

              <p class="extension-detail__description">
                {{ description }}
              </p>

              <div class="extension-detail__meta">
                <component
                  :is="publisherUrl ? 'button' : 'span'"
                  class="extension-detail__meta-item"
                  :class="{ 'extension-detail__meta-item--clickable': publisherUrl }"
                  @click="publisherUrl ? openPublisherProfile() : undefined"
                >
                  <UserIcon :size="14" />
                  {{ publisherName }}
                  <ExternalLinkIcon
                    v-if="publisherUrl"
                    :size="12"
                  />
                </component>
                <button
                  v-if="repositoryUrl"
                  class="extension-detail__meta-item extension-detail__meta-item--clickable"
                  @click="openRepository"
                >
                  <GitBranchIcon :size="14" />
                  {{ t('extensions.viewSource') }}
                  <ExternalLinkIcon :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          class="extension-detail__controls"
          data-animate="controls"
        >
          <Select
            v-if="!isLocal && availableVersions.length > 0"
            v-model="selectedVersion"
          >
            <SelectTrigger class="extension-detail__version-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="version in availableVersions"
                :key="version"
                :value="version"
              >
                {{ t('extensions.versionPrefix') }}{{ version }}
                <span
                  v-if="version === extension.latestVersion"
                  class="extension-detail__latest-tag"
                >
                  {{ t('extensions.latest') }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <span
            v-else-if="extension.installedVersion"
            class="extension-detail__version-display"
          >
            {{ t('extensions.versionPrefix') }}{{ extension.installedVersion }}
          </span>

          <div
            v-if="!isPlatformCompatible"
            class="extension-detail__platform-warning"
          >
            <TriangleAlertIcon :size="14" />
            <span>{{ t('extensions.platformWarning', { platforms: extensionPlatforms.map(getPlatformDisplayName).join(', ') }) }}</span>
          </div>

          <template v-if="!extension.isInstalled || isInstalling">
            <Button
              class="extension-detail__controls-button"
              size="sm"
              :disabled="(isInstallDisabled ?? isInstalling) || !isPlatformCompatible"
              @click="handleInstall"
            >
              <DownloadIcon
                v-if="!isInstalling"
                :size="16"
              />
              <RefreshCwIcon
                v-else
                :size="16"
                class="extension-detail__spinner"
              />
              {{ isInstalling ? (isCancelRequested ? t('extensions.cancellingInstall') : t('extensions.installing')) : t('extensions.install') }}
            </Button>

            <Button
              v-if="isInstalling && !isCancelRequested"
              variant="outline"
              size="sm"
              class="extension-detail__controls-button"
              @click="handleCancel"
            >
              <XIcon :size="16" />
              {{ t('extensions.cancelInstall') }}
            </Button>
          </template>

          <template v-else>
            <Button
              v-if="showUpdateButton"
              class="extension-detail__controls-button"
              size="sm"
              :disabled="isUpdating"
              @click="handleUpdate"
            >
              <RefreshCwIcon
                v-if="isUpdating"
                :size="16"
                class="extension-detail__spinner"
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
              class="extension-detail__controls-button"
              @click="handleCancel"
            >
              <XIcon :size="16" />
              {{ t('extensions.cancelInstall') }}
            </Button>

            <Button
              v-if="isLocal"
              variant="outline"
              size="sm"
              class="extension-detail__controls-button"
              :disabled="isRefreshing"
              @click="emit('refresh')"
            >
              <RefreshCwIcon
                :size="16"
                :class="{ 'extension-detail__spinner': isRefreshing }"
              />
              {{ t('extensions.reinstall') }}
            </Button>

            <Button
              v-if="isLocal && isRefreshing && !isCancelRequested"
              variant="outline"
              size="sm"
              class="extension-detail__controls-button"
              @click="handleCancel"
            >
              <XIcon :size="16" />
              {{ t('extensions.cancelInstall') }}
            </Button>

            <Button
              variant="outline"
              size="sm"
              class="extension-detail__controls-button"
              :disabled="isUninstalling"
              @click="emit('uninstall')"
            >
              <RefreshCwIcon
                v-if="isUninstalling"
                :size="16"
                class="extension-detail__spinner"
              />
              <TrashIcon
                v-else
                :size="16"
              />
              {{ t('extensions.uninstall') }}
            </Button>
            <div
              v-if="!isLocal"
              class="extension-detail__auto-update"
            >
              <span class="extension-detail__auto-update-label">{{ t('extensions.autoUpdate') }}</span>
              <Switch
                :id="`auto-update-${extension.id}`"
                :model-value="extension.autoUpdate"
                @update:model-value="emit('toggleAutoUpdate')"
              />
            </div>
          </template>

          <div
            v-if="extensionPlatforms.length > 0"
            class="extension-detail__metadata-block"
          >
            <span class="extension-detail__metadata-label">
              {{ t('extensions.platforms') }}
            </span>
            <div class="extension-detail__platforms">
              <span
                v-if="isCrossPlatform"
                class="extension-detail__platform-badge"
              >
                {{ t('extensions.allPlatforms') }}
              </span>
              <template v-else>
                <span
                  v-for="platform in extensionPlatforms"
                  :key="platform"
                  class="extension-detail__platform-badge"
                  :class="{ 'extension-detail__platform-badge--inactive': !isPlatformCompatible && !extension.platforms?.includes(platform) }"
                >
                  {{ getPlatformDisplayName(platform) }}
                </span>
              </template>
            </div>
          </div>
          <div
            v-if="typeof extension.sizeBytes === 'number'"
            class="extension-detail__metadata-block"
          >
            <span class="extension-detail__metadata-label">{{ t('size') }}</span>
            <span class="extension-detail__metadata-value">{{ formatBytes(extension.sizeBytes) }}</span>
          </div>
          <div
            v-if="dependencyRows.length > 0"
            class="extension-detail__metadata-block"
          >
            <span class="extension-detail__metadata-label">{{ t('extensions.tabs.dependencies') }}</span>
            <span class="extension-detail__metadata-value">{{ dependencyRows.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <Tabs
      v-model="activeTab"
      class="extension-detail__tabs"
      data-animate="tabs"
      @update:model-value="handleTabChange"
    >
      <TabsList class="extension-detail__tabs-list">
        <TabsTrigger
          value="overview"
          class="extension-detail__tab-trigger"
        >
          <BookOpenIcon :size="16" />
          <span>{{ t('extensions.tabs.overview') }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="permissions"
          class="extension-detail__tab-trigger"
        >
          <ShieldIcon :size="16" />
          <span>{{ t('extensions.tabs.permissions') }}</span>
        </TabsTrigger>
        <TabsTrigger
          v-if="extensionCommands.length > 0"
          value="commands"
          class="extension-detail__tab-trigger"
        >
          <TerminalIcon :size="16" />
          <span>{{ t('extensions.tabs.commands') }}</span>
        </TabsTrigger>
        <TabsTrigger
          value="changelog"
          class="extension-detail__tab-trigger"
        >
          <CalendarIcon :size="16" />
          <span>{{ t('extensions.tabs.changelog') }}</span>
        </TabsTrigger>
        <TabsTrigger
          v-if="dependencyRows.length > 0"
          value="binaries"
          class="extension-detail__tab-trigger"
        >
          <PackageIcon :size="16" />
          <span>{{ t('extensions.tabs.dependencies') }}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="overview"
        class="extension-detail__tab-content"
      >
        <div class="extension-detail__overview">
          <div
            v-if="resolvedMediaItems.length > 0"
            class="extension-detail__media"
          >
            <div class="extension-detail__media-row">
              <button
                v-for="(mediaItem, mediaIndex) in resolvedMediaItems"
                :key="`${mediaItem.title}-${mediaIndex}`"
                type="button"
                class="extension-detail__media-card"
                :class="{
                  'extension-detail__media-card--clickable':
                    Boolean(mediaItem.quickViewPath || mediaItem.remoteOpenUrl),
                }"
                :aria-label="mediaItem.title"
                :disabled="!mediaItem.quickViewPath && !mediaItem.remoteOpenUrl"
                @click="handleManifestMediaClick(mediaItem)"
              >
                <div class="extension-detail__media-preview">
                  <img
                    v-if="mediaItem.type === 'image'"
                    class="extension-detail__media-preview-content"
                    :src="mediaItem.previewUrl"
                    :alt="mediaItem.title"
                    loading="lazy"
                    decoding="async"
                  >
                  <video
                    v-else
                    class="extension-detail__media-preview-content"
                    :src="mediaItem.previewUrl"
                    muted
                    playsinline
                    preload="metadata"
                  />
                </div>
                <span class="extension-detail__media-title">{{ mediaItem.title }}</span>
              </button>
            </div>
          </div>
          <div class="extension-detail__readme">
            <Skeleton
              v-if="isLoadingReadme"
              class="extension-detail__readme-skeleton"
            />
            <div
              v-else
              class="extension-detail__readme-content markdown-content"
              v-html="readmeRenderedHtml"
              @click="handleMarkdownLinkClick"
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="permissions"
        class="extension-detail__tab-content"
      >
        <div
          v-if="permissions.length === 0"
          class="extension-detail__empty"
        >
          {{ t('extensions.noPermissions') }}
        </div>

        <div
          v-else
          class="extension-detail__permissions"
        >
          <div
            v-for="permission in permissions"
            :key="permission"
            class="extension-detail__permission"
          >
            <div class="extension-detail__permission-header">
              <span class="extension-detail__permission-title">
                {{ getPermissionInfo(permission).title }}
              </span>
              <span
                class="extension-detail__permission-risk"
                :class="`extension-detail__permission-risk--${getPermissionInfo(permission).risk}`"
              >
                {{ getPermissionInfo(permission).risk }}
              </span>
            </div>
            <p class="extension-detail__permission-description">
              {{ getPermissionInfo(permission).description }}
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="commands"
        class="extension-detail__tab-content"
      >
        <div
          v-if="extensionCommands.length === 0"
          class="extension-detail__empty"
        >
          {{ t('extensions.noExtensionCommands') }}
        </div>

        <div
          v-else
          class="extension-detail__commands"
        >
          <div
            v-for="command in extensionCommands"
            :key="command.id"
            class="extension-detail__command"
          >
            <div class="extension-detail__command-header">
              <component
                :is="command.icon ? getLucideIcon(command.icon) : undefined"
                v-if="command.icon && getLucideIcon(command.icon)"
                :size="16"
                class="extension-detail__command-icon"
              />
              <TerminalIcon
                v-else
                :size="16"
                class="extension-detail__command-icon"
              />
              <span class="extension-detail__command-title">
                {{ command.title }}
              </span>
              <span
                v-if="command.shortcut"
                class="extension-detail__command-shortcut"
              >
                {{ command.shortcut }}
              </span>
            </div>
            <p
              v-if="command.description"
              class="extension-detail__command-description"
            >
              {{ command.description }}
            </p>
            <span class="extension-detail__command-id">
              {{ command.id }}
            </span>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="changelog"
        class="extension-detail__tab-content"
      >
        <Skeleton
          v-if="isLoadingChangelog"
          class="extension-detail__changelog-skeleton"
        />
        <div
          v-else
          class="extension-detail__changelog-content markdown-content"
          v-html="changelogRenderedHtml"
          @click="handleMarkdownLinkClick"
        />
      </TabsContent>

      <TabsContent
        value="binaries"
        class="extension-detail__tab-content"
      >
        <div
          v-if="dependencyRows.length === 0"
          class="extension-detail__empty"
        >
          {{ t('extensions.dependencies.noDependencies') }}
        </div>
        <div
          v-else
          class="extension-detail__binary-list"
        >
          <div
            v-for="binary in dependencyRows"
            :key="binary.id"
            class="extension-detail__binary-item"
          >
            <div class="extension-detail__binary-item-main">
              <span class="extension-detail__binary-id">{{ binary.label || binary.id }}</span>
              <span class="extension-detail__binary-version">{{ binary.versionLabel }}</span>
              <span
                v-if="binary.hasUpdate && binary.latestVersion"
                class="extension-detail__binary-update"
              >{{ `${t('extensions.update')}: ${binary.latestVersion}` }}</span>
              <span
                v-else-if="binary.latestVersion"
                class="extension-detail__binary-latest"
              >{{ `${t('extensions.latest')}: ${binary.latestVersion}` }}</span>
              <span class="extension-detail__binary-date">{{ binary.dateLabel }}</span>
            </div>
            <Button
              v-if="binary.downloadUrl && isHttpUrl(binary.downloadUrl)"
              variant="ghost"
              size="sm"
              class="extension-detail__binary-download"
              :title="binary.downloadUrl"
              @click="openBinaryDownloadUrl(binary.downloadUrl)"
            >
              <ExternalLinkIcon :size="14" />
              {{ t('extensions.dependencies.downloadSource') }}
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style>
@import '@/styles/markdown-content.css';

.extension-detail {
  position: relative;
  display: flex;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  flex-direction: column;
  padding: 4px;
  gap: 16px;
}

.extension-detail *,
.extension-detail *::before,
.extension-detail *::after {
  box-sizing: border-box;
}

.extension-detail__status-alert-wrapper {
  overflow: hidden;
  height: auto;
  margin-bottom: 12px;
  transition:
    height 0.25s ease,
    opacity 0.2s ease,
    margin-bottom 0.2s ease;
}

.extension-detail__status-alert {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid hsl(0deg 84% 60% / 30%);
  border-radius: var(--radius);
  background-color: hsl(0deg 84% 60% / 12%);
  color: hsl(0deg 84% 60%);
  font-size: 0.875rem;
  font-weight: 600;
}

.extension-detail__status-alert-text {
  padding: 10px 0;
}

.extension-status-alert-enter-active,
.extension-status-alert-leave-active {
  transition:
    height 0.25s ease,
    opacity 0.2s ease,
    margin-bottom 0.2s ease;
}

.extension-detail__header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.extension-detail__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.extension-detail__enabled-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extension-detail__enabled-label {
  font-size: 0.875rem;
}

.extension-detail__cards {
  display: flex;
  gap: 16px;
}

.extension-detail__banner {
  position: relative;
  z-index: 1;
  overflow: hidden;
  min-height: 160px;
  flex: 1;
  padding: 24px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  background-color: hsl(var(--card));
}

.extension-detail__controls {
  position: relative;
  z-index: 1;
  display: flex;
  width: 200px;
  min-width: 200px;
  flex-direction: column;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  background-color: hsl(var(--card));
  gap: 8px;
}

.extension-detail__controls-button {
  width: 100%;
}

.extension-detail__auto-update {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 8px;
}

.extension-detail__auto-update-label {
  font-size: 0.875rem;
}

.extension-detail__banner-content {
  position: relative;
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 20px;
}

.extension-detail__icon {
  display: flex;
  width: 42px;
  min-width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background-color: hsl(var(--background));
  color: hsl(var(--primary));
}

.extension-detail__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.extension-detail__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.extension-detail__name {
  color: hsl(var(--foreground));
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

.extension-detail__previous-name {
  margin: 0;
  color: hsl(var(--muted-foreground) / 70%);
  font-size: 0.8rem;
  font-style: italic;
}

.extension-detail__description {
  color: hsl(var(--muted-foreground));
  font-size: 1rem;
  line-height: 1.5;
}

.extension-detail__meta {
  display: flex;
  flex-wrap: wrap;
  margin-top: 4px;
  gap: 16px;
}

.extension-detail__metadata-block {
  display: flex;
  align-items: center;
  margin-top: 2px;
  gap: 8px;
}

.extension-detail__metadata-label {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  gap: 4px;
  text-transform: uppercase;
}

.extension-detail__metadata-value {
  color: hsl(var(--foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
}

.extension-detail__platforms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.extension-detail__platform-badge {
  padding: 1px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.extension-detail__platform-badge--inactive {
  opacity: 0.4;
}

.extension-detail__platform-warning {
  display: flex;
  align-items: flex-start;
  padding: 8px 10px;
  border: 1px solid hsl(38deg 92% 50% / 30%);
  border-radius: var(--radius);
  background-color: hsl(38deg 92% 50% / 8%);
  color: hsl(38deg 92% 50%);
  font-size: 0.8rem;
  gap: 6px;
  line-height: 1.4;
}

.extension-detail__binary-list {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  gap: 6px;
}

.extension-detail__binary-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 8px;
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 8px;
  background-color: hsl(var(--background) / 60%);
  gap: 8px;
}

.extension-detail__binary-item-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.extension-detail__binary-download {
  max-width: 100%;
  padding: 0 8px;
  color: hsl(var(--primary));
  font-size: 0.8125rem;
  gap: 6px;
}

.extension-detail__binary-id {
  color: hsl(var(--foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  font-weight: 600;
}

.extension-detail__binary-version,
.extension-detail__binary-date {
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

.extension-detail__binary-update {
  color: hsl(45deg 93% 47%);
  font-size: 0.75rem;
}

.extension-detail__binary-latest {
  color: hsl(142deg 76% 36%);
  font-size: 0.75rem;
}

.extension-detail__meta-item {
  display: flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  gap: 6px;
}

.extension-detail__meta-item--clickable {
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.extension-detail__meta-item--clickable:hover {
  color: hsl(var(--primary));
}

.extension-detail__meta-item--enabled {
  color: hsl(142deg 76% 36%);
}

.extension-detail__meta-item--delete:hover {
  color: hsl(var(--destructive));
}

.extension-detail__meta-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.extension-detail__version-trigger {
  width: 100%;
  height: 32px;
}

.extension-detail__version-display {
  display: flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.875rem;
}

.extension-detail__latest-tag {
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
}

.extension-detail__category {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
}

.extension-detail__action-buttons {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
  gap: 8px;
}

.extension-detail__spinner {
  animation: spin 1s linear infinite;
}

.extension-detail__tabs {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.extension-detail__tabs-list {
  display: flex;
  overflow: auto hidden;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: nowrap;
  justify-content: flex-start;
  padding: 4px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  background-color: hsl(var(--card));
  gap: 4px;
}

.extension-detail__tab-trigger {
  display: flex;
  min-width: min-content;
  flex: 0 0 auto;
  align-items: center;
  padding: 10px 16px;
  gap: 8px;
}

.extension-detail__tab-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  margin-top: 0;
  gap: 16px;
}

.extension-detail__overview {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.extension-detail__media {
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}

.extension-detail__media-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.extension-detail__media-card {
  display: flex;
  min-width: 0;
  max-width: 180px;
  flex: 1 1 100px;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 20%);
  cursor: default;
  text-align: left;
}

.extension-detail__media-card--clickable:not(:disabled) {
  cursor: pointer;
}

.extension-detail__media-preview {
  overflow: hidden;
  width: 100%;
  border-radius: var(--radius) var(--radius) 0 0;
  aspect-ratio: 16 / 10;
  background-color: hsl(var(--muted) / 40%);
}

.extension-detail__media-preview-content {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.extension-detail__media-title {
  display: block;
  padding: 4px 8px;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
}

.extension-detail__readme,
.extension-detail__changelog {
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  padding: 32px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}

.extension-detail__readme-content,
.extension-detail__changelog-content {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.extension-detail__readme-skeleton,
.extension-detail__changelog-skeleton {
  height: 200px;
}

.extension-detail__empty {
  padding: 24px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.extension-detail__permissions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extension-detail__permission {
  padding: 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
}

.extension-detail__permission-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.extension-detail__permission-title {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.extension-detail__permission-risk {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.extension-detail__permission-risk--low {
  background-color: hsl(142deg 76% 36% / 15%);
  color: hsl(142deg 76% 36%);
}

.extension-detail__permission-risk--medium {
  background-color: hsl(45deg 93% 47% / 15%);
  color: hsl(45deg 93% 47%);
}

.extension-detail__permission-risk--high {
  background-color: hsl(0deg 84% 60% / 15%);
  color: hsl(0deg 84% 60%);
}

.extension-detail__permission-risk--highest {
  background-color: hsl(282.46deg 46.84% 46.22% / 20%);
  color: hsl(274.67deg 52.78% 55.29%);
  font-weight: 700;
}

.extension-detail__permission-description {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.5;
}

.extension-detail__commands {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extension-detail__command {
  padding: 16px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
}

.extension-detail__command-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extension-detail__command-icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.extension-detail__command-title {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.extension-detail__command-shortcut {
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

.extension-detail__command-description {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.5;
}

.extension-detail__command-id {
  display: inline-block;
  margin-top: 6px;
  color: hsl(var(--muted-foreground) / 60%);
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (width <= 900px) {
  .extension-detail__cards {
    flex-direction: column;
  }

  .extension-detail__controls {
    width: 100%;
    min-width: 100%;
    flex-flow: row wrap;
    gap: 8px;
  }

  .extension-detail__controls-button {
    min-width: 120px;
    flex: 1;
  }

  .extension-detail__version-trigger {
    min-width: 140px;
  }

  .extension-detail__auto-update {
    min-width: 120px;
    flex: 1;
  }
}

@media (width <= 640px) {
  .extension-detail {
    gap: 16px;
  }

  .extension-detail__controls {
    flex-direction: column;
  }

  .extension-detail__controls-button {
    width: 100%;
  }

  .extension-detail__banner {
    min-height: auto;
    padding: 16px;
  }

  .extension-detail__banner-content {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .extension-detail__icon {
    width: 64px;
    min-width: 64px;
    height: 64px;
  }

  .extension-detail__icon svg {
    width: 32px;
    height: 32px;
  }

  .extension-detail__info {
    align-items: center;
  }

  .extension-detail__title-row {
    flex-wrap: wrap;
    justify-content: center;
  }

  .extension-detail__name {
    font-size: 1.25rem;
  }

  .extension-detail__description {
    font-size: 0.875rem;
  }

  .extension-detail__meta {
    justify-content: center;
    gap: 8px 16px;
  }

  .extension-detail__action-buttons {
    justify-content: center;
  }

  .extension-detail__auto-update {
    justify-content: center;
  }

  .extension-detail__readme,
  .extension-detail__changelog,
  .extension-detail__media {
    padding: 12px;
  }

  .extension-detail__permission {
    padding: 12px;
  }
}

@media (width <= 480px) {
  .extension-detail__action-buttons {
    width: 100%;
    flex-direction: column;
  }

  .extension-detail__action-buttons .sigma-ui-button {
    width: 100%;
    justify-content: center;
  }

  .extension-detail__meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
