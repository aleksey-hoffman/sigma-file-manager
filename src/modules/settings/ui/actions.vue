<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { openUrl } from '@tauri-apps/plugin-opener';
// FORK-MODIFICATION 2026-10-20：移植上游 8908e214 —— app 目录走后端统一解析。
import { appDataDir, appConfigDir, appLogDir } from '@/utils/app-dirs';
import {
  FolderIcon,
  ExternalLinkIcon,
  LinkIcon,
  FolderOpenIcon,
  SettingsIcon,
  FileTextIcon,
  SearchIcon,
  SparklesIcon,
} from '@lucide/vue';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import externalLinks from '@/data/external-links';
import { openNavigatorPath } from '@/utils/open-navigator-directory';
import { useChangelog } from '@/modules/changelog';
import normalizePath from '@/utils/normalize-path';

const { t } = useI18n();
const router = useRouter();
const { open: openChangelog } = useChangelog();

function navigateToDirectory(path: string) {
  openNavigatorPath(router, path);
}

async function openAppDataDirectory() {
  const path = normalizePath(await appDataDir());
  await navigateToDirectory(path);
}

async function openAppConfigDirectory() {
  const path = normalizePath(await appConfigDir());
  await navigateToDirectory(path);
}

async function openAppLogDirectory() {
  const path = normalizePath(await appLogDir());
  await navigateToDirectory(path);
}

async function openGlobalSearchIndexDirectory() {
  const dataDir = normalizePath(await appDataDir());
  const path = normalizePath(await join(dataDir, 'global-search'));
  await navigateToDirectory(path);
}

function openProjectPage() {
  openUrl(externalLinks.githubRepoLink);
}

function openIssuesPage() {
  openUrl(externalLinks.githubIssuesLink);
}

// FORK-MODIFICATION 2026-10-14：原 openDiscussionsPage 指向 /discussions/，
// 但 kizemo/alpha-file-manager 从未开启 Discussions，该链接必然 404 —— 随菜单项一并删除。
// 原 openChangelogPage 指向 GitHub 的 CHANGELOG.md，现「更新日志」改指 aiec 下载页，
// 与 openReleasesPage 完全同义，留着会变成没人调用的函数并触发 no-unused-vars。
function openReleasesPage() {
  // 更新渠道已迁到自建站；这里的 GitHub 仓仍指向 sigma 上游，会把用户带到别人的版本列表。
  openUrl(externalLinks.updateChannelSiteUrl);
}

function openLearningNotes() {
  openUrl(externalLinks.learningNotesUrl);
}
</script>

<template>
  <Teleport to=".window-toolbar-primary-teleport-target">
    <div class="animate-fade-in settings-actions">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            @click="openChangelog"
          >
            <SparklesIcon
              :size="16"
              class="settings-actions-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('changelog.title') }}
        </TooltipContent>
      </Tooltip>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="openReleasesPage">
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
          <DropdownMenuItem @click="openLearningNotes">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.learningNotes') }}
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
