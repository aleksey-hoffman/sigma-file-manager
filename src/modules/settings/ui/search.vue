<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type ComponentPublicInstance } from 'vue';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useSettingsStore } from '@/stores/runtime/settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useI18n } from 'vue-i18n';
import { SearchIcon } from 'lucide-vue-next';
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
    <Tooltip>
      <Popover
        :open="isSearchOpen"
        :modal="false"
        @update:open="isSearchOpen = $event"
      >
        <TooltipTrigger as-child>
          <PopoverTrigger
            as-child
            class="animate-fade-in"
          >
            <Button
              variant="ghost"
              size="icon"
            >
              <SearchIcon
                class="settings-search-icon"
                :size="16"
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.searchSettings') }}
          <kbd class="shortcut">{{ shortcutsStore.getShortcutLabel('toggleSettingsSearch') }}</kbd>
        </TooltipContent>
        <PopoverContent
          :side="'left'"
          :align="'end'"
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
  </Teleport>
</template>

<style scoped>
.settings-search-icon {
  stroke: hsl(var(--foreground) / 50%);
  transition: opacity 0.2s ease;
}

.settings-search-icon:hover {
  opacity: 0.7;
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
