<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FlipHorizontalIcon,
  PanelLeftRightDashedIcon,
  PanelRightIcon,
  PanelRightOpenIcon,
  CircleHelpIcon,
  EllipsisVerticalIcon,
} from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import type { SplitViewMode } from '@/types/user-settings';

const props = defineProps<{
  isSplitView: boolean;
  showInfoPanel: boolean;
  isGlobalSearchOpen: boolean;
}>();

const emit = defineEmits<{
  'toggle-split-view': [];
  'toggle-info-panel': [];
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();

const infoPanelDynamicSize = computed(() => (
  userSettingsStore.userSettings.navigator.infoPanel.dynamicSize
));
const splitViewMode = computed(() => (
  userSettingsStore.userSettings.navigator.splitViewMode
));

async function setSplitViewMode(mode: SplitViewMode) {
  if (props.isGlobalSearchOpen) {
    return;
  }

  await userSettingsStore.set('navigator.splitViewMode', mode);
}

async function handleSplitViewModeChange(value: string | number) {
  if (value !== 'split' && value !== 'linked') {
    return;
  }

  await setSplitViewMode(value);
}

async function handleToggleInfoPanelDynamicSize(enabled: boolean) {
  await userSettingsStore.set('navigator.infoPanel.dynamicSize', enabled);
}
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <div class="navigator-toolbar-actions animate-fade-in">
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
                  class="navigator-toolbar-actions__icon"
                />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent
            :side="'bottom'"
            :align="'end'"
            class="navigator-settings-menu"
          >
            <ScrollArea
              type="auto"
              class="navigator-settings-menu__scroll"
            >
              <div class="navigator-settings-menu__scroll-content">
                <div class="navigator-settings-menu__title">
                  {{ t('settings.navigator.navigatorOptions') }}
                </div>
                <DropdownMenuItem
                  @select.prevent
                  class="navigator-settings-menu__item navigator-settings-menu__row"
                >
                  <span class="navigator-settings-menu__row-label">
                    <FlipHorizontalIcon
                      :size="16"
                      class="navigator-settings-menu__row-icon"
                    />
                    {{ t('splitView') }}
                  </span>
                  <Tabs
                    :model-value="splitViewMode"
                    class="navigator-settings-menu__choice-tabs"
                    @update:model-value="handleSplitViewModeChange"
                  >
                    <TabsList class="sigma-ui-tabs-list--page">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <TabsTrigger
                            value="split"
                            :disabled="isGlobalSearchOpen"
                          >
                            {{ t('splitViewModeSplit') }}
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {{ t('splitViewModeSplitTooltip') }}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <TabsTrigger
                            value="linked"
                            :disabled="isGlobalSearchOpen"
                          >
                            {{ t('splitViewModeLinked') }}
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {{ t('splitViewModeLinkedTooltip') }}
                        </TooltipContent>
                      </Tooltip>
                    </TabsList>
                  </Tabs>
                </DropdownMenuItem>
                <DropdownMenuItem
                  @select.prevent
                  class="navigator-settings-menu__item navigator-settings-menu__row"
                >
                  <span class="navigator-settings-menu__row-label">
                    <PanelRightIcon
                      :size="16"
                      class="navigator-settings-menu__row-icon"
                    />
                    {{ t('settings.infoPanel.dynamicSize') }}
                  </span>
                  <div class="navigator-settings-menu__item-controls">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="navigator-settings-menu__info-trigger"
                          :aria-label="t('settings.infoPanel.dynamicSizeTooltip')"
                          @click.stop
                        >
                          <CircleHelpIcon :size="14" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        class="navigator-settings-menu__info-tooltip"
                      >
                        {{ t('settings.infoPanel.dynamicSizeTooltip') }}
                      </TooltipContent>
                    </Tooltip>
                    <Switch
                      class="navigator-settings-menu__switch"
                      :model-value="infoPanelDynamicSize"
                      @update:model-value="handleToggleInfoPanelDynamicSize"
                    />
                  </div>
                </DropdownMenuItem>
              </div>
            </ScrollArea>
          </DropdownMenuContent>
          <TooltipContent>
            {{ t('settings.navigator.navigatorOptions') }}
          </TooltipContent>
        </Tooltip>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'navigator-toolbar-actions__button--active': props.isSplitView }"
            :disabled="props.isGlobalSearchOpen"
            @click="emit('toggle-split-view')"
          >
            <PanelLeftRightDashedIcon
              v-if="splitViewMode === 'linked'"
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
            <FlipHorizontalIcon
              v-else
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div class="navigator-toolbar-actions__tooltip-row">
            {{ t('splitView') }}
            <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleSplitView') }}</ContextMenuShortcut>
          </div>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'navigator-toolbar-actions__button--active': props.showInfoPanel }"
            @click="emit('toggle-info-panel')"
          >
            <PanelRightOpenIcon
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.infoPanel.title') }}
        </TooltipContent>
      </Tooltip>
    </div>
  </Teleport>
</template>

<style>
.navigator-toolbar-actions {
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: 4px;
}

.navigator-toolbar-actions .sigma-ui-button {
  width: 28px;
  height: 28px;
}

.navigator-toolbar-actions__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.navigator-toolbar-actions__button--active {
  background-color: hsl(var(--secondary));
}

.navigator-toolbar-actions__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.navigator-toolbar-actions__button--active .navigator-toolbar-actions__icon {
  stroke: hsl(var(--primary));
}

.navigator-settings-menu__title {
  padding: 6px 8px 2px;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.navigator-settings-menu__row-label {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 13px;
  gap: 8px;
  line-height: 1.25rem;
}

.navigator-settings-menu__row-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.navigator-settings-menu__grouping-select.sigma-ui-select-trigger {
  width: 7.5rem;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 60%);
  font-size: 12px;
}

.navigator-settings-menu__grouping-select.sigma-ui-select-trigger:hover {
  background-color: hsl(var(--secondary));
}

.navigator-settings-menu__choice-tabs {
  flex-shrink: 0;
}

.navigator-settings-menu.sigma-ui-dropdown-menu-content {
  --navigator-settings-menu-scroll-max: min(
    80vh,
    var(--reka-dropdown-menu-content-available-height, calc(100vh - var(--window-toolbar-height) - 12px))
  );

  width: 320px;
  max-height: var(--navigator-settings-menu-scroll-max);
  padding: 0;
}

.navigator-settings-menu__scroll {
  max-height: var(--navigator-settings-menu-scroll-max);
}

.navigator-settings-menu__scroll [data-reka-scroll-area-viewport] {
  height: auto;
  max-height: var(--navigator-settings-menu-scroll-max);
}

.navigator-settings-menu__scroll-content {
  padding: 0.25rem;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: default;
  gap: 12px;
}

.navigator-settings-menu__row.sigma-ui-dropdown-menu-item {
  min-height: 36px;
  padding-block: 4px;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:focus,
.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:hover {
  background-color: transparent;
  color: inherit;
}

.navigator-settings-menu__item-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.navigator-settings-menu__info-trigger {
  display: flex;
  padding: 0;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: help;
  line-height: 0;
}

.navigator-settings-menu__info-trigger:hover {
  color: hsl(var(--foreground));
}

.navigator-settings-menu__info-trigger:focus-visible {
  border-radius: var(--radius-xs);
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: 2px;
}

.navigator-settings-menu__info-tooltip.sigma-ui-tooltip-content {
  max-width: 240px;
}

.navigator-settings-menu__switch.sigma-ui-switch {
  width: 1.75rem;
  height: 1rem;
}

.navigator-settings-menu__switch .sigma-ui-switch__thumb {
  width: 0.75rem;
  height: 0.75rem;
}

.navigator-settings-menu__switch .sigma-ui-switch__thumb[data-state="checked"] {
  transform: translateX(0.75rem);
}
</style>
