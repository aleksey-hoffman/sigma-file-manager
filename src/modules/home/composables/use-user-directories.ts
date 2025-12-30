// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, computed } from 'vue';
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
import {
  HomeIcon,
  MonitorIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
} from 'lucide-vue-next';

export interface UserDirectory {
  name: string;
  titleKey: string;
  icon: Component;
  path: string;
}

interface UserDirectoryDefinition {
  name: string;
  titleKey: string;
  icon: Component;
  pathFn: () => Promise<string>;
}

const directoryDefinitions: UserDirectoryDefinition[] = [
  {
    name: 'home',
    titleKey: 'userDirs.home',
    icon: HomeIcon,
    pathFn: homeDir,
  },
  {
    name: 'desktop',
    titleKey: 'userDirs.desktop',
    icon: MonitorIcon,
    pathFn: desktopDir,
  },
  {
    name: 'downloads',
    titleKey: 'userDirs.downloads',
    icon: DownloadIcon,
    pathFn: downloadDir,
  },
  {
    name: 'documents',
    titleKey: 'userDirs.documents',
    icon: FileTextIcon,
    pathFn: documentDir,
  },
  {
    name: 'pictures',
    titleKey: 'userDirs.pictures',
    icon: ImageIcon,
    pathFn: pictureDir,
  },
  {
    name: 'videos',
    titleKey: 'userDirs.videos',
    icon: VideoIcon,
    pathFn: videoDir,
  },
  {
    name: 'music',
    titleKey: 'userDirs.music',
    icon: MusicIcon,
    pathFn: audioDir,
  },
];

const userDirectories = ref<UserDirectory[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function fetchUserDirectories() {
  isLoading.value = true;
  error.value = null;

  try {
    const directories: UserDirectory[] = [];

    for (const definition of directoryDefinitions) {
      try {
        const path = await definition.pathFn();
        directories.push({
          name: definition.name,
          titleKey: definition.titleKey,
          icon: definition.icon,
          path,
        });
      }
      catch {
        continue;
      }
    }

    userDirectories.value = directories;
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

let initialized = false;

export function useUserDirectories() {
  const isEmpty = computed(() => userDirectories.value.length === 0 && !isLoading.value);

  onMounted(() => {
    if (!initialized) {
      initialized = true;
      fetchUserDirectories();
    }
  });

  return {
    userDirectories,
    isLoading,
    error,
    isEmpty,
    refresh: fetchUserDirectories,
  };
}
