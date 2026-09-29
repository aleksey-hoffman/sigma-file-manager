<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDashboardItemOpener } from '@/modules/dashboard/composables/use-dashboard-item-opener';
import { getParentPath } from '@/utils/normalize-path';
import { isVirtualLocationPath } from '@/utils/virtual-locations';

const props = defineProps<{
  path: string;
}>();

const { t } = useI18n();
const { openContainingFolder } = useDashboardItemOpener();

const hasContainingFolder = computed(() => {
  return !isVirtualLocationPath(props.path) && !!getParentPath(props.path);
});
</script>

<template>
  <Tooltip v-if="hasContainingFolder">
    <TooltipTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="dashboard-open-folder-button"
        :aria-label="t('dashboard.actions.openContainingFolder')"
        @mousedown.stop
        @click.stop="openContainingFolder(path)"
      >
        <FolderIcon :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {{ t('dashboard.actions.openContainingFolder') }}
    </TooltipContent>
  </Tooltip>
</template>

<style>
.dashboard-open-folder-button.sigma-ui-button {
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
}
</style>
