<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useSettingsStore } from '../stores/store';
import { useI18n } from 'vue-i18n';
import { FolderIcon, ExternalLinkIcon, SearchIcon, LinkIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const settingsStore = useSettingsStore();
const { t } = useI18n();
</script>

<template>
  <Teleport to=".window-toolbar-primary-teleport-target">
    <div class="animate-fade-in">
      <DropdownMenu>
        <DropdownMenuTrigger>
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
        <DropdownMenuContent>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.projectPage') }}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.requestsIssues') }}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.discussions') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger>
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
        <DropdownMenuContent>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.projectPage') }}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.requestsIssues') }}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLinkIcon />
            {{ t('projectGithubButtons.discussions') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-actions-icon {
  stroke: hsl(var(--foreground) / 50%);
  transition: opacity 0.2s ease;
}

.settings-actions-icon:hover {
  opacity: 0.7;
}

.settings-actions-input {
  width: 100%;
  height: 36px;
}

:global(.settings-actions-popover.sigma-ui-popover-content) {
  width: 300px;
  padding: 0;
}

@media (width <= 768px) {
  :global(.settings-actions-popover.sigma-ui-popover-content) {
    width: 250px;
  }
}
</style>
