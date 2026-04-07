<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { openUrl } from '@tauri-apps/plugin-opener';
import { EllipsisVerticalIcon, ExternalLinkIcon, FolderOpenIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import externalLinks from '@/data/external-links';
import { useExtensionsFolderActions } from '@/modules/extensions/composables/use-extensions-folder-actions';

const props = defineProps<{
  isInstallFromFolderDisabled?: boolean;
}>();

const emit = defineEmits<{
  installLocal: [sourcePath: string];
}>();

const { t } = useI18n();
const { navigateToExtensionsFolder, pickExtensionFolderPath } = useExtensionsFolderActions();

function openDevelopmentWiki(): void {
  openUrl(externalLinks.extensionsDevelopmentWikiUrl);
}

async function handleInstallLocal(): Promise<void> {
  if (props.isInstallFromFolderDisabled) return;

  const sourcePath = await pickExtensionFolderPath();

  if (sourcePath) {
    emit('installLocal', sourcePath);
  }
}
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <div class="extensions-toolbar-actions animate-fade-in">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
              >
                <EllipsisVerticalIcon
                  :size="16"
                  class="extensions-toolbar-actions__icon"
                />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent
            :side="'bottom'"
            :align="'end'"
          >
            <DropdownMenuItem @click="openDevelopmentWiki">
              <ExternalLinkIcon
                :size="16"
                class="extensions-toolbar-actions__menu-icon"
              />
              {{ t('extensions.createExtension') }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="navigateToExtensionsFolder">
              <FolderOpenIcon
                :size="16"
                class="extensions-toolbar-actions__menu-icon"
              />
              {{ t('extensions.showExtensionsFolder') }}
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="isInstallFromFolderDisabled"
              @click="handleInstallLocal"
            >
              <FolderOpenIcon
                :size="16"
                class="extensions-toolbar-actions__menu-icon"
              />
              {{ t('extensions.installExtensionFromFolder') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
          <TooltipContent>
            {{ t('extensions.toolbarOptions') }}
          </TooltipContent>
        </Tooltip>
      </DropdownMenu>
    </div>
  </Teleport>
</template>

<style scoped>
.extensions-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.extensions-toolbar-actions :deep(.sigma-ui-button) {
  width: 28px;
  height: 28px;
}

.extensions-toolbar-actions__icon {
  stroke: hsl(var(--icon));
}

.extensions-toolbar-actions__menu-icon {
  margin-right: 8px;
  stroke: hsl(var(--icon));
}
</style>
