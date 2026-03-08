<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EllipsisIcon,
  HomeIcon,
  RefreshCwIcon,
} from 'lucide-vue-next';

defineProps<{
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (event: 'goBack'): void;
  (event: 'goForward'): void;
  (event: 'goUp'): void;
  (event: 'goHome'): void;
  (event: 'refresh'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="file-browser-toolbar-nav-buttons file-browser-toolbar-nav-buttons--expanded">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoBack"
          @click="emit('goBack')"
        >
          <ArrowLeftIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('fileBrowser.goBack') }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoForward"
          @click="emit('goForward')"
        >
          <ArrowRightIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('fileBrowser.goForward') }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoUp"
          @click="emit('goUp')"
        >
          <ArrowUpIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('fileBrowser.goUp') }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          @click="emit('goHome')"
        >
          <HomeIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('fileBrowser.goHome') }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <RefreshCwIcon
            class="file-browser-toolbar-nav-buttons__icon"
            :class="{ 'file-browser-toolbar-nav-buttons__icon--spin': isLoading }"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('fileBrowser.refresh') }}</TooltipContent>
    </Tooltip>
  </div>

  <div class="file-browser-toolbar-nav-buttons file-browser-toolbar-nav-buttons--collapsed">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :title="t('settingsCategories.navigation')"
        >
          <EllipsisIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        class="file-browser-toolbar-nav-buttons__dropdown"
      >
        <DropdownMenuItem
          :disabled="!canGoBack"
          @click="emit('goBack')"
        >
          <ArrowLeftIcon :size="14" />
          {{ t('fileBrowser.goBack') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!canGoForward"
          @click="emit('goForward')"
        >
          <ArrowRightIcon :size="14" />
          {{ t('fileBrowser.goForward') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!canGoUp"
          @click="emit('goUp')"
        >
          <ArrowUpIcon :size="14" />
          {{ t('fileBrowser.goUp') }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="emit('goHome')">
          <HomeIcon :size="14" />
          {{ t('fileBrowser.goHome') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <RefreshCwIcon :size="14" />
          {{ t('fileBrowser.refresh') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<style scoped>
.file-browser-toolbar-nav-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.file-browser-toolbar-nav-buttons--expanded {
  display: flex;
}

.file-browser-toolbar-nav-buttons--collapsed {
  display: none;
}

.file-browser-toolbar-nav-buttons__button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar-nav-buttons__icon {
  width: 18px;
  height: 18px;
}

.file-browser-toolbar-nav-buttons__icon--spin {
  animation: toolbar-nav-buttons-spin 1s linear infinite;
}

@keyframes toolbar-nav-buttons-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.file-browser-toolbar-nav-buttons__dropdown {
  min-width: 180px;
}

@container (width < 400px) {
  .file-browser-toolbar-nav-buttons--expanded {
    display: none;
  }

  .file-browser-toolbar-nav-buttons--collapsed {
    display: flex;
  }
}
</style>
