<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  HomeIcon,
  RefreshCwIcon,
  TextSearchIcon,
  XIcon,
} from 'lucide-vue-next';
import AddressBar from './address-bar.vue';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const props = defineProps<{
  pathInput: string;
  filterQuery: string;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  isLoading: boolean;
  isFilterOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:pathInput', value: string): void;
  (event: 'update:filterQuery', value: string): void;
  (event: 'update:isFilterOpen', value: boolean): void;
  (event: 'goBack'): void;
  (event: 'goForward'): void;
  (event: 'goUp'): void;
  (event: 'goHome'): void;
  (event: 'refresh'): void;
  (event: 'submitPath'): void;
  (event: 'navigateTo', path: string): void;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

const filterInputRef = ref<InstanceType<typeof Input> | null>(null);

function handleFilterAutoFocus(event: Event) {
  event.preventDefault();
  filterInputRef.value?.$el?.focus();
}

function clearFilter() {
  emit('update:filterQuery', '');
}

function handleFilterQueryUpdate(value: string | number | undefined) {
  emit('update:filterQuery', String(value ?? ''));
}

function handleAddressBarNavigate(path: string) {
  emit('update:pathInput', path);
  emit('navigateTo', path);
}

function handleFilterInteractOutside(event: Event) {
  if (!props.filterQuery) {
    emit('update:isFilterOpen', false);
  }
  else {
    event.preventDefault();
  }
}
</script>

<template>
  <div class="file-browser-toolbar">
    <div class="file-browser-toolbar__nav-buttons">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar__nav-button"
            :disabled="!canGoBack"
            @click="emit('goBack')"
          >
            <ArrowLeftIcon class="file-browser-toolbar__icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('fileBrowser.goBack') }}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar__nav-button"
            :disabled="!canGoForward"
            @click="emit('goForward')"
          >
            <ArrowRightIcon class="file-browser-toolbar__icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('fileBrowser.goForward') }}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar__nav-button"
            :disabled="!canGoUp"
            @click="emit('goUp')"
          >
            <ArrowUpIcon class="file-browser-toolbar__icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('fileBrowser.goUp') }}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar__nav-button"
            @click="emit('goHome')"
          >
            <HomeIcon class="file-browser-toolbar__icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('fileBrowser.goHome') }}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-toolbar__nav-button"
            :disabled="isLoading"
            @click="emit('refresh')"
          >
            <RefreshCwIcon
              class="file-browser-toolbar__icon"
              :class="{ 'animate-spin': isLoading }"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('fileBrowser.refresh') }}</TooltipContent>
      </Tooltip>
    </div>
    <Separator
      orientation="vertical"
      class="file-browser-toolbar__separator"
    />
    <div class="file-browser-toolbar__right">
      <AddressBar
        :current-path="pathInput"
        class="file-browser-toolbar__address-bar"
        @navigate="handleAddressBarNavigate"
      />
      <Tooltip>
        <Popover
          :open="isFilterOpen"
          :modal="false"
          @update:open="emit('update:isFilterOpen', $event)"
        >
          <TooltipTrigger as-child>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="file-browser-toolbar__filter-button"
                :class="{ 'file-browser-toolbar__filter-button--active': filterQuery }"
              >
                <TextSearchIcon class="file-browser-toolbar__icon" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('fileBrowser.quickSearch') }}
            <kbd class="shortcut">{{ shortcutsStore.getShortcutLabel('toggleFilter') }}</kbd>
          </TooltipContent>
          <PopoverContent
            :side="'bottom'"
            :align="'end'"
            class="file-browser-toolbar__filter-popover"
            @open-auto-focus="handleFilterAutoFocus"
            @close-auto-focus.prevent
            @interact-outside="handleFilterInteractOutside"
          >
            <div class="file-browser-toolbar__filter-input-wrapper">
              <Input
                ref="filterInputRef"
                :model-value="filterQuery"
                :placeholder="t('fileBrowser.searchThisDirectory')"
                class="file-browser-toolbar__filter-input"
                @update:model-value="handleFilterQueryUpdate"
              />
              <Button
                v-if="filterQuery"
                variant="ghost"
                size="icon"
                class="file-browser-toolbar__filter-clear"
                @click="clearFilter"
              >
                <XIcon :size="14" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.file-browser-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid hsl(var(--border));
  container-type: inline-size;
  gap: 12px;
}

.file-browser-toolbar__nav-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.file-browser-toolbar__nav-button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar__icon {
  width: 18px;
  height: 18px;
}

.file-browser-toolbar__icon.animate-spin {
  animation: toolbar-spin 1s linear infinite;
}

@keyframes toolbar-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.file-browser-toolbar__separator {
  display: none;
  height: 20px;
}

.file-browser-toolbar__right {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
}

.file-browser-toolbar__address-bar {
  min-width: 0;
  flex: 1;
}

.file-browser-toolbar__filter-button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar__filter-button--active {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.file-browser-toolbar__filter-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.file-browser-toolbar__filter-input {
  width: 100%;
  height: 36px;
  padding-right: 36px;
}

.file-browser-toolbar__filter-clear {
  position: absolute;
  right: 4px;
  width: 28px;
  height: 28px;
}

@container (width < 400px) {
  .file-browser-toolbar__separator {
    display: block;
  }
}

@container (width < 300px) {
  .file-browser-toolbar__nav-button,
  .file-browser-toolbar__filter-button {
    width: 28px;
    height: 28px;
  }

  .file-browser-toolbar__icon {
    width: 14px;
    height: 14px;
  }

  .file-browser-toolbar {
    gap: 8px;
  }

  .file-browser-toolbar__nav-buttons {
    gap: 2px;
  }

  .file-browser-toolbar__right {
    gap: 4px;
  }
}
</style>

<style>
.file-browser-toolbar__filter-popover.sigma-ui-popover-content {
  width: 280px;
  padding: 8px;
}
</style>
