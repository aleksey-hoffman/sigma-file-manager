// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, computed, watch } from 'vue';
import {
  audioDir,
  desktopDir,
  documentDir,
  downloadDir,
  homeDir,
  pictureDir,
  videoDir,
} from '@tauri-apps/api/path';
import type { Component } from 'vue';
import normalizePath from '@/utils/normalize-path';
import * as LucideIcons from 'lucide-vue-next';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { UserDirectoryCustomization } from '@/types/user-settings';
import type { UserDirectoriesCustomizations } from '@/types/user-settings';

export interface UserDirectory {
  name: string;
  titleKey: string;
  customTitle?: string;
  iconName: string;
  customIconName?: string;
  path: string;
  defaultPath: string;
}

interface UserDirectoryDefinition {
  name: string;
  titleKey: string;
  iconName: string;
  pathFn: () => Promise<string>;
}

export const userDirectoryIconNames = [
  'HomeIcon',
  'MonitorIcon',
  'DownloadIcon',
  'FileTextIcon',
  'ImageIcon',
  'VideoIcon',
  'MusicIcon',
  'FolderIcon',
  'FolderOpenIcon',
  'FileIcon',
  'ArchiveIcon',
  'BookIcon',
  'BookmarkIcon',
  'BoxIcon',
  'BriefcaseIcon',
  'CameraIcon',
  'CloudIcon',
  'CodeIcon',
  'CoffeeIcon',
  'CompassIcon',
  'CpuIcon',
  'DatabaseIcon',
  'FilmIcon',
  'GamepadIcon',
  'GiftIcon',
  'GlobeIcon',
  'HeartIcon',
  'InboxIcon',
  'LayersIcon',
  'LibraryIcon',
  'MailIcon',
  'MapIcon',
  'MicIcon',
  'PackageIcon',
  'PaletteIcon',
  'PenToolIcon',
  'PhoneIcon',
  'PieChartIcon',
  'PrinterIcon',
  'RadioIcon',
  'RocketIcon',
  'SaveIcon',
  'ScissorsIcon',
  'ServerIcon',
  'SettingsIcon',
  'ShieldIcon',
  'ShoppingBagIcon',
  'StarIcon',
  'SunIcon',
  'TerminalIcon',
  'TruckIcon',
  'TvIcon',
  'UmbrellaIcon',
  'UserIcon',
  'WalletIcon',
  'WifiIcon',
  'ZapIcon',
] as const;

export type UserDirectoryIconName = typeof userDirectoryIconNames[number];

export function getIconComponent(iconName: string): Component {
  const icons = LucideIcons as unknown as Record<string, Component>;
  return icons[iconName] || LucideIcons.FolderIcon;
}

const directoryDefinitions: UserDirectoryDefinition[] = [
  {
    name: 'home',
    titleKey: 'userDirs.home',
    iconName: 'HomeIcon',
    pathFn: homeDir,
  },
  {
    name: 'desktop',
    titleKey: 'userDirs.desktop',
    iconName: 'MonitorIcon',
    pathFn: desktopDir,
  },
  {
    name: 'downloads',
    titleKey: 'userDirs.downloads',
    iconName: 'DownloadIcon',
    pathFn: downloadDir,
  },
  {
    name: 'documents',
    titleKey: 'userDirs.documents',
    iconName: 'FileTextIcon',
    pathFn: documentDir,
  },
  {
    name: 'pictures',
    titleKey: 'userDirs.pictures',
    iconName: 'ImageIcon',
    pathFn: pictureDir,
  },
  {
    name: 'videos',
    titleKey: 'userDirs.videos',
    iconName: 'VideoIcon',
    pathFn: videoDir,
  },
  {
    name: 'music',
    titleKey: 'userDirs.music',
    iconName: 'MusicIcon',
    pathFn: audioDir,
  },
];

const userDirectories = ref<UserDirectory[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const defaultPaths = ref<Record<string, string>>({});
let defaultPathsInitialized = false;

export function useUserDirectories() {
  const userSettingsStore = useUserSettingsStore();
  const isEmpty = computed(() => userDirectories.value.length === 0 && !isLoading.value);

  async function initDefaultPaths() {
    if (defaultPathsInitialized) {
      return;
    }

    for (const definition of directoryDefinitions) {
      try {
        defaultPaths.value[definition.name] = normalizePath(await definition.pathFn());
      }
      catch {
        continue;
      }
    }

    defaultPathsInitialized = true;
  }

  function buildUserDirectories(customizations: UserDirectoriesCustomizations): UserDirectory[] {
    const directories: UserDirectory[] = [];

    for (const definition of directoryDefinitions) {
      const defaultPath = defaultPaths.value[definition.name];

      if (!defaultPath) {
        continue;
      }

      const customization = customizations[definition.name];
      const customPath = customization?.path ? normalizePath(customization.path) : undefined;

      directories.push({
        name: definition.name,
        titleKey: definition.titleKey,
        customTitle: customization?.title,
        iconName: customization?.icon || definition.iconName,
        customIconName: customization?.icon,
        path: customPath || defaultPath,
        defaultPath,
      });
    }

    return directories;
  }

  async function fetchUserDirectories() {
    isLoading.value = true;
    error.value = null;

    try {
      await initDefaultPaths();
      const customizations = userSettingsStore.userSettings.userDirectories || {};
      userDirectories.value = buildUserDirectories(customizations);
    }
    catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      error.value = errorMessage;
      console.error('Failed to fetch user directories:', fetchError);
    }
    finally {
      isLoading.value = false;
    }
  }

  watch(
    () => userSettingsStore.userSettings.userDirectories,
    (newCustomizations) => {
      if (defaultPathsInitialized && newCustomizations) {
        userDirectories.value = buildUserDirectories(newCustomizations);
      }
    },
    { deep: true },
  );

  async function updateUserDirectory(name: string, customization: UserDirectoryCustomization) {
    const currentCustomizations = { ...userSettingsStore.userSettings.userDirectories };

    const normalizedCustomization: UserDirectoryCustomization = {
      title: customization.title,
      path: customization.path ? normalizePath(customization.path) : undefined,
      icon: customization.icon,
    };

    if (normalizedCustomization.title || normalizedCustomization.path || normalizedCustomization.icon) {
      currentCustomizations[name] = {
        ...currentCustomizations[name],
        ...normalizedCustomization,
      };
    }
    else {
      delete currentCustomizations[name];
    }

    await userSettingsStore.set('userDirectories', currentCustomizations);
  }

  async function resetUserDirectory(name: string) {
    const currentCustomizations = { ...userSettingsStore.userSettings.userDirectories };
    delete currentCustomizations[name];
    await userSettingsStore.set('userDirectories', currentCustomizations);
  }

  onMounted(() => {
    if (!defaultPathsInitialized) {
      fetchUserDirectories();
    }
  });

  return {
    userDirectories,
    isLoading,
    error,
    isEmpty,
    refresh: fetchUserDirectories,
    updateUserDirectory,
    resetUserDirectory,
  };
}
