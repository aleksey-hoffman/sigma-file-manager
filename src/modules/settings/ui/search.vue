<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type ComponentPublicInstance } from 'vue';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { useSettingsStore } from '@/stores/runtime/settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useI18n } from 'vue-i18n';
import { SearchIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';

const settingsStore = useSettingsStore();
const shortcutsStore = useShortcutsStore();
const { t } = useI18n();

const isSearchOpen = ref(false);
const searchInputRef = ref<ComponentPublicInstance | null>(null);

function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value;
}

function handleSearchAutoFocus(event: Event) {
  event.preventDefault();
  searchInputRef.value?.$el?.focus();
}

onMounted(() => {
  shortcutsStore.registerHandler('toggleSettingsSearch', toggleSearch);
});

onBeforeUnmount(() => {
  shortcutsStore.unregisterHandler('toggleSettingsSearch');
});
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <div class="settings-search-toolbar-button animate-fade-in">
      <Tooltip>
        <Popover
          :open="isSearchOpen"
          :modal="false"
          @update:open="isSearchOpen = $event"
        >
          <TooltipTrigger as-child>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :class="{ 'settings-search-toolbar-button__button--active': isSearchOpen }"
              >
                <SearchIcon
                  class="settings-search-toolbar-button__icon"
                  :size="16"
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <div class="settings-search__tooltip-row">
              {{ t('settings.searchSettings') }}
              <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleSettingsSearch') }}</ContextMenuShortcut>
            </div>
          </TooltipContent>
          <PopoverContent
            :side="'left'"
            :align="'center'"
            class="settings-search-popover"
            @open-auto-focus="handleSearchAutoFocus"
          >
            <Input
              ref="searchInputRef"
              v-model="settingsStore.search"
              type="text"
              :placeholder="t('settings.searchSettings')"
              class="settings-search-input"
            />
          </PopoverContent>
        </Popover>
      </Tooltip>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-search-toolbar-button {
  display: flex;
  align-items: center;
  align-self: stretch;
}

.settings-search-toolbar-button :deep(.sigma-ui-button) {
  width: 28px;
  height: 28px;
}

.settings-search-toolbar-button__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.settings-search-toolbar-button__button--active {
  background-color: hsl(var(--secondary));
}

.settings-search-toolbar-button__button--active .settings-search-toolbar-button__icon {
  stroke: hsl(var(--primary));
}

.settings-search__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-search-input {
  width: 100%;
  height: 36px;
}

:global(.settings-search-popover.sigma-ui-popover-content) {
  width: 300px;
  padding: 0;
}

@media (width <= 768px) {
  :global(.settings-search-popover.sigma-ui-popover-content) {
    width: 250px;
  }
}
</style>
