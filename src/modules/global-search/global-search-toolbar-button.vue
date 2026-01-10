<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { SearchIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';

const { t } = useI18n();
const globalSearchStore = useGlobalSearchStore();
const router = useRouter();
const globalSearchShortcut = 'Ctrl+Shift+F';

function handleClick() {
  if (!globalSearchStore.isOpen) {
    router.push({ name: 'navigator' });
    globalSearchStore.open();
  }
  else {
    globalSearchStore.close();
  }
}
</script>

<template>
  <div class="global-search-toolbar-button animate-fade-in">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="global-search-toolbar-button__button"
          @click="handleClick"
        >
          <SearchIcon
            :size="16"
            class="global-search-toolbar-button__icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('globalSearch.globalSearch') }}
        <kbd class="shortcut">{{ globalSearchShortcut }}</kbd>
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<style scoped>
.global-search-toolbar-button :deep(.sigma-ui-button) {
  width: 28px;
  height: 28px;
}

.global-search-toolbar-button__icon {
  stroke: hsl(var(--foreground) / 50%);
}
</style>
