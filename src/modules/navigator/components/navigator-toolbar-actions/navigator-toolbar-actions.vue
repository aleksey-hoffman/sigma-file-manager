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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import {
  FlipHorizontalIcon,
  Columns2Icon,
  PanelRightIcon,
  LayoutGridIcon,
  ListIcon,
  CircleHelpIcon,
  EllipsisVerticalIcon,
} from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import type { SplitViewMode } from '@/types/user-settings';
import { useInfoPanelLayout } from '@/modules/navigator/components/info-panel/composables/use-info-panel-layout';

type LayoutType = 'list' | 'grid';

const props = defineProps<{
  isSplitView: boolean;
  showInfoPanel: boolean;
  isGlobalSearchOpen: boolean;
}>();

const emit = defineEmits<{
  'toggle-split-view': [];
  'toggle-info-panel': [];
  'set-split-view-mode': [mode: SplitViewMode];
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();

const currentLayout = computed(() => {
  const layoutName = userSettingsStore.userSettings.navigator.layout.type.name;
  return layoutName === 'compact-list' ? 'list' : layoutName;
});

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);
const {
  isDynamicSize: infoPanelDynamicSize,
  enableDynamicSize,
  disableDynamicSize,
} = useInfoPanelLayout();

const splitViewMode = computed(() => userSettingsStore.userSettings.navigator.splitViewMode);

function setSplitViewMode(mode: SplitViewMode) {
  emit('set-split-view-mode', mode);
}

async function setLayout(layoutName: LayoutType) {
  const layoutTitle = layoutName === 'grid' ? 'gridLayout' : 'listLayout';
  await userSettingsStore.set('navigator.layout.type', {
    title: layoutTitle,
    name: layoutName,
  });
}

function handleToggleHiddenFiles(checked: boolean) {
  userSettingsStore.set('navigator.showHiddenFiles', checked);
}

function handleToggleInfoPanelDynamicSize(enabled: boolean) {
  if (enabled) {
    void enableDynamicSize();
    return;
  }

  void disableDynamicSize();
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
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__item--layout"
            >
              <div class="navigator-settings-menu__layout-label">
                {{ t('settings.navigator.navigatorViewLayout') }}
              </div>
              <div class="navigator-settings-menu__layout-row">
                <button
                  type="button"
                  class="navigator-settings-menu__layout-option"
                  :class="{ 'navigator-settings-menu__layout-option--active': currentLayout === 'list' }"
                  @click="setLayout('list')"
                >
                  <ListIcon :size="20" />
                  <span>{{ t('list') }}</span>
                </button>
                <button
                  type="button"
                  class="navigator-settings-menu__layout-option"
                  :class="{ 'navigator-settings-menu__layout-option--active': currentLayout === 'grid' }"
                  @click="setLayout('grid')"
                >
                  <LayoutGridIcon :size="20" />
                  <span>{{ t('grid') }}</span>
                </button>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__item--layout"
            >
              <div class="navigator-settings-menu__layout-label">
                {{ t('splitViewMode') }}
              </div>
              <div class="navigator-settings-menu__layout-row">
                <button
                  type="button"
                  class="navigator-settings-menu__layout-option"
                  :class="{ 'navigator-settings-menu__layout-option--active': splitViewMode === 'split' }"
                  @click="setSplitViewMode('split')"
                >
                  <Columns2Icon :size="20" />
                  <span>{{ t('splitViewModeSplit') }}</span>
                </button>
                <button
                  type="button"
                  class="navigator-settings-menu__layout-option"
                  :class="{ 'navigator-settings-menu__layout-option--active': splitViewMode === 'linked' }"
                  @click="setSplitViewMode('linked')"
                >
                  <FlipHorizontalIcon :size="20" />
                  <span>{{ t('splitViewModeLinked') }}</span>
                </button>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="navigator-settings-menu__item"
              @select.prevent
            >
              <span class="navigator-settings-menu__item-label">{{ t('filter.showHiddenItems') }}</span>
              <Switch
                class="navigator-settings-menu__switch"
                :model-value="showHiddenFiles"
                @update:model-value="handleToggleHiddenFiles(!showHiddenFiles)"
              />
            </DropdownMenuItem>
            <DropdownMenuItem
              class="navigator-settings-menu__item"
              @select.prevent
            >
              <span class="navigator-settings-menu__item-label">{{ t('settings.infoPanel.dynamicSize') }}</span>
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
            <FlipHorizontalIcon
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
            <PanelRightIcon
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

.navigator-settings-menu__layout-label.sigma-ui-dropdown-menu-label {
  padding-bottom: 4px;
}

.navigator-settings-menu__layout-row {
  display: flex;
  width: 100%;
  height: 64px;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.navigator-settings-menu__item--layout.sigma-ui-dropdown-menu-item {
  flex-direction: column;
  align-items: flex-start;
}

.navigator-settings-menu__layout-option {
  display: flex;
  height: 100%;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 4px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 11px;
  gap: 2px;
  transition: background-color 0.15s, color 0.15s;
}

.navigator-settings-menu__layout-option:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.navigator-settings-menu__layout-option:hover {
  background-color: hsl(var(--secondary));
}

.navigator-settings-menu__layout-option--active {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.navigator-settings-menu__layout-option--active:hover {
  background-color: hsl(var(--primary) / 25%);
}

.navigator-settings-menu__layout-option svg {
  flex-shrink: 0;
}

.navigator-settings-menu.sigma-ui-dropdown-menu-content {
  min-width: 200px;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item {
  display: flex;
  justify-content: space-between;
  cursor: default;
  gap: 8px;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:focus,
.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:hover {
  background-color: transparent;
  color: inherit;
}

.navigator-settings-menu__item-label {
  flex: 1;
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
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
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
