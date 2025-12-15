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
import { SearchIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const settingsStore = useSettingsStore();
const { t } = useI18n();
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInputRef');
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <Popover>
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
      <PopoverContent
        :side="'left'"
        :align="'end'"
        class="settings-search-popover"
      >
        <Input
          ref="searchInputRef"
          v-model="settingsStore.search"
          type="text"
          :placeholder="t('search')"
          class="settings-search-input"
        />
      </PopoverContent>
    </Popover>
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
