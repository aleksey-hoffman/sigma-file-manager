<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PanelLeftOpenIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigationPanelLayoutContext } from './composables/use-navigation-panel-layout';

const { showNavigationPanel, toggleNavigationPanel } = useNavigationPanelLayoutContext();
const { t } = useI18n();
</script>

<template>
  <Teleport to=".window-toolbar-leading-teleport-target">
    <div class="navigation-panel-toggle animate-fade-in">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'navigation-panel-toggle__button--active': showNavigationPanel }"
            :aria-pressed="showNavigationPanel"
            @click="toggleNavigationPanel"
          >
            <PanelLeftOpenIcon
              :size="16"
              class="navigation-panel-toggle__icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('navigator.navigationPanel') }}
        </TooltipContent>
      </Tooltip>
    </div>
  </Teleport>
</template>

<style scoped>
.navigation-panel-toggle {
  display: flex;
  align-items: center;
  align-self: stretch;
}

.navigation-panel-toggle :deep(.sigma-ui-button) {
  width: 28px;
  height: 28px;
}

.navigation-panel-toggle__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.navigation-panel-toggle__button--active {
  background-color: hsl(var(--secondary));
}

.navigation-panel-toggle__button--active .navigation-panel-toggle__icon {
  stroke: hsl(var(--primary));
}
</style>
