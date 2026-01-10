<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { openUrl } from '@tauri-apps/plugin-opener';
import { appDataDir, appConfigDir, appLogDir } from '@tauri-apps/api/path';
import {
  FolderIcon,
  ExternalLinkIcon,
  LinkIcon,
  FolderOpenIcon,
  SettingsIcon,
  FileTextIcon,
  SearchIcon,
} from 'lucide-vue-next';
import { join } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import externalLinks from '@/data/external-links';
import { useWorkspacesStore } from '@/stores/storage/workspaces';

const { t } = useI18n();
const router = useRouter();
const workspacesStore = useWorkspacesStore();

async function navigateToDirectory(path: string) {
  await workspacesStore.openNewTabGroup(path);
  router.push({ name: 'navigator' });
}

async function openAppDataDirectory() {
  const path = await appDataDir();
  await navigateToDirectory(path);
}

async function openAppConfigDirectory() {
  const path = await appConfigDir();
  await navigateToDirectory(path);
}

async function openAppLogDirectory() {
  const path = await appLogDir();
  await navigateToDirectory(path);
}

async function openGlobalSearchIndexDirectory() {
  const dataDir = await appDataDir();
  const path = await join(dataDir, 'global-search');
  await navigateToDirectory(path);
}

function openProjectPage() {
  openUrl(externalLinks.githubRepoLink);
}

function openIssuesPage() {
  openUrl(externalLinks.githubIssuesLink);
}

function openDiscussionsPage() {
  openUrl(externalLinks.githubDiscussionsLink);
}

function openChangelogPage() {
  openUrl(externalLinks.githubChangelogLink);
}

function openReleasesPage() {
  openUrl(externalLinks.githubAllReleases);
}
</script>

<template>
  <Teleport to=".window-toolbar-primary-teleport-target">
    <div class="animate-fade-in settings-actions">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
          >
            <FolderIcon
              :size="16"
              class="settings-actions-icon"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{{ t('settings.actions.appDirectories') }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openAppDataDirectory">
            <FolderOpenIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.openAppDataDirectory') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openAppConfigDirectory">
            <SettingsIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.openAppConfigDirectory') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openAppLogDirectory">
            <FileTextIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.openAppLogDirectory') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openGlobalSearchIndexDirectory">
            <SearchIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.openGlobalSearchIndexDirectory') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
          >
            <LinkIcon
              :size="16"
              class="settings-actions-icon"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{{ t('settings.actions.externalLinks') }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openProjectPage">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('projectGithubButtons.projectPage') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openIssuesPage">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('projectGithubButtons.requestsIssues') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openDiscussionsPage">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('projectGithubButtons.discussions') }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openChangelogPage">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.changelog') }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="openReleasesPage">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.allReleases') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-actions {
  display: flex;
  gap: 4px;
}

.settings-actions-icon {
  stroke: hsl(var(--foreground) / 50%);
  transition: opacity 0.2s ease;
}

.settings-actions-icon:hover {
  opacity: 0.7;
}

.settings-actions__links-menu-icon {
  margin-right: 8px;
  stroke: hsl(var(--icon));
}

.settings-actions__links-menu-icon:hover {
  opacity: 0.7;
}
</style>
