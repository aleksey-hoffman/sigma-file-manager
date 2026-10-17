<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ArrowLeftRightIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const emit = defineEmits<{
  (event: 'swap-panes'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="file-browser-toolbar-swap-panes-button"
        :aria-label="t('fileBrowser.swapPanes')"
        data-e2e-root="toolbar-swap-panes"
        @click="emit('swap-panes')"
      >
        <ArrowLeftRightIcon :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {{ t('fileBrowser.swapPanes') }}
    </TooltipContent>
  </Tooltip>
</template>

<style scoped>
.file-browser-toolbar-swap-panes-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
</style>
