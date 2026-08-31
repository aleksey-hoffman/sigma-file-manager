<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FlipHorizontalIcon,
  PanelLeftRightDashedIcon,
  PanelRightOpenIcon,
  LayoutGridIcon,
  GalleryVerticalEndIcon,
  ListIcon,
  CircleHelpIcon,
  EllipsisVerticalIcon,
  EyeOffIcon,
  InfoIcon,
  PanelRightIcon,
} from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import type { SplitViewMode } from '@/types/user-settings';
import { useNavigatorFolderSettings } from '@/modules/navigator/composables/use-navigator-folder-settings';
import type {
  NavigatorFolderSettingsPatch,
  NavigatorOptionsScope,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import NavigatorLayoutSortControls from './navigator-layout-sort-controls.vue';

type LayoutType = 'list' | 'grid' | 'gallery';

const props = defineProps<{
  isSplitView: boolean;
  showInfoPanel: boolean;
  isGlobalSearchOpen: boolean;
  activePath?: string;
  canUseFolderSettings?: boolean;
}>();

const emit = defineEmits<{
  'toggle-split-view': [];
  'toggle-info-panel': [];
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();

const settingsScope = ref<NavigatorOptionsScope>('global');
const {
  applied: appliedFolderSettings,
  canUseFolderSettings,
  clearFolderSettings,
  globalSnapshot,
  hasFolderSettings,
  persistForScope,
} = useNavigatorFolderSettings(
  () => props.activePath,
  () => Boolean(props.canUseFolderSettings),
);
const showFolderSettingsReset = computed(() => (
  settingsScope.value === 'folder' && hasFolderSettings.value
));
const showGlobalOnlySettings = computed(() => settingsScope.value === 'global');
const scopedSettings = computed(() => (
  settingsScope.value === 'folder'
    ? appliedFolderSettings.value
    : globalSnapshot.value
));
const currentLayout = computed(() => scopedSettings.value.layout);
const showHiddenFiles = computed(() => scopedSettings.value.showHiddenFiles);
const infoPanelDynamicSize = computed(() => (
  userSettingsStore.userSettings.navigator.infoPanel.dynamicSize
));
const splitViewMode = computed(() => (
  userSettingsStore.userSettings.navigator.splitViewMode
));

function selectDefaultSettingsScope() {
  settingsScope.value = hasFolderSettings.value ? 'folder' : 'global';
}

function handleMenuOpenChange(isOpen: boolean) {
  if (isOpen) {
    selectDefaultSettingsScope();
  }
}

watch(canUseFolderSettings, (isEnabled) => {
  if (!isEnabled) {
    settingsScope.value = 'global';
  }
});

function persistScopedPatch(patch: NavigatorFolderSettingsPatch) {
  return persistForScope(settingsScope.value, patch);
}

function setSplitViewMode(mode: SplitViewMode) {
  if (props.isGlobalSearchOpen || settingsScope.value === 'folder') {
    return;
  }

  userSettingsStore.set('navigator.splitViewMode', mode);
}

async function setLayout(layoutName: LayoutType) {
  if (layoutName === 'gallery' && props.isSplitView) {
    return;
  }

  await persistScopedPatch({ layout: layoutName });
}

function handleToggleHiddenFiles(checked: boolean) {
  persistScopedPatch({ showHiddenFiles: checked });
}

async function handleToggleInfoPanelDynamicSize(enabled: boolean) {
  await userSettingsStore.set('navigator.infoPanel.dynamicSize', enabled);
}

function handleUseGlobalSettings() {
  clearFolderSettings();
  settingsScope.value = 'global';
}

function handleSettingsScopeChange(value: string | number) {
  settingsScope.value = value === 'folder' ? 'folder' : 'global';
}
</script>

<template>
  <Teleport to=".window-toolbar-secondary-teleport-target">
    <div class="navigator-toolbar-actions animate-fade-in">
      <DropdownMenu @update:open="handleMenuOpenChange">
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
                <DropdownMenuItem
                  @select.prevent
                  class="navigator-settings-menu__item navigator-settings-menu__item--scope"
                >
                  <div class="navigator-settings-menu__layout-label">
                    {{ t('settings.navigator.settingsScope') }}
                  </div>
                  <Tabs
                    :model-value="settingsScope"
                    class="navigator-settings-menu__scope-tabs"
                    @update:model-value="handleSettingsScopeChange"
                  >
                    <TabsList class="navigator-settings-menu__scope-tabs-list">
                      <TabsTrigger
                        value="global"
                        class="navigator-settings-menu__scope-tab"
                      >
                        {{ t('settings.navigator.settingsScopeGlobal') }}
                      </TabsTrigger>
                      <TabsTrigger
                        value="folder"
                        class="navigator-settings-menu__scope-tab"
                        :disabled="!canUseFolderSettings"
                      >
                        {{ t('settings.navigator.settingsScopeThisFolder') }}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Collapsible
                    :open="showFolderSettingsReset"
                    class="navigator-settings-menu__reset-collapsible"
                  >
                    <CollapsibleContent class="navigator-settings-menu__reset-content">
                      <div class="navigator-settings-menu__reset-row">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <button
                              type="button"
                              class="navigator-settings-menu__info-trigger navigator-settings-menu__info-trigger--folder"
                              :aria-label="t('settings.navigator.folderSettingsDifferFromGlobal')"
                              @click.stop
                            >
                              <InfoIcon :size="14" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            class="navigator-settings-menu__info-tooltip"
                          >
                            {{ t('settings.navigator.folderSettingsDifferFromGlobal') }}
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="default"
                          size="sm"
                          class="navigator-settings-menu__reset-button"
                          @click="handleUseGlobalSettings"
                        >
                          {{ t('settings.navigator.useGlobalSettings') }}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                      <ListIcon :size="24" />
                      <span>{{ t('list') }}</span>
                    </button>
                    <button
                      type="button"
                      class="navigator-settings-menu__layout-option"
                      :class="{ 'navigator-settings-menu__layout-option--active': currentLayout === 'grid' }"
                      @click="setLayout('grid')"
                    >
                      <LayoutGridIcon :size="24" />
                      <span>{{ t('grid') }}</span>
                    </button>
                    <button
                      type="button"
                      class="navigator-settings-menu__layout-option"
                      :class="{ 'navigator-settings-menu__layout-option--active': currentLayout === 'gallery' }"
                      :disabled="props.isSplitView"
                      @click="setLayout('gallery')"
                    >
                      <GalleryVerticalEndIcon :size="24" />
                      <span>{{ t('gallery') }}</span>
                    </button>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  @select.prevent
                  class="navigator-settings-menu__item navigator-settings-menu__item--layout"
                >
                  <div class="navigator-settings-menu__layout-label">
                    {{ t('settings.navigator.sorting') }}
                  </div>
                  <NavigatorLayoutSortControls
                    :sort-layout="currentLayout"
                    :sort-source="scopedSettings"
                    @persist="persistScopedPatch"
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  @select.prevent
                  class="navigator-settings-menu__item navigator-settings-menu__item--layout"
                >
                  <div class="navigator-settings-menu__layout-label">
                    {{ t('settings.navigator.display') }}
                  </div>
                  <div class="navigator-settings-menu__display-rows">
                    <div class="navigator-settings-menu__toggle-row">
                      <div class="navigator-settings-menu__item-start">
                        <EyeOffIcon
                          :size="16"
                          class="navigator-settings-menu__item-icon"
                        />
                        <span class="navigator-settings-menu__item-label">{{ t('filter.showHiddenItems') }}</span>
                      </div>
                      <Switch
                        class="navigator-settings-menu__switch"
                        :model-value="showHiddenFiles"
                        @update:model-value="handleToggleHiddenFiles(!showHiddenFiles)"
                      />
                    </div>
                    <Collapsible
                      :open="showGlobalOnlySettings"
                      class="navigator-settings-menu__reset-collapsible"
                    >
                      <CollapsibleContent class="navigator-settings-menu__reset-content">
                        <div class="navigator-settings-menu__toggle-row navigator-settings-menu__toggle-row--nested">
                          <div class="navigator-settings-menu__item-start">
                            <PanelRightIcon
                              :size="16"
                              class="navigator-settings-menu__item-icon"
                            />
                            <span class="navigator-settings-menu__item-label">{{ t('settings.infoPanel.dynamicSize') }}</span>
                          </div>
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
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </DropdownMenuItem>
                <Collapsible
                  :open="showGlobalOnlySettings"
                  class="navigator-settings-menu__reset-collapsible"
                >
                  <CollapsibleContent class="navigator-settings-menu__reset-content">
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
                          <FlipHorizontalIcon :size="24" />
                          <span>{{ t('splitViewModeSplit') }}</span>
                        </button>
                        <button
                          type="button"
                          class="navigator-settings-menu__layout-option"
                          :class="{ 'navigator-settings-menu__layout-option--active': splitViewMode === 'linked' }"
                          @click="setSplitViewMode('linked')"
                        >
                          <PanelLeftRightDashedIcon :size="24" />
                          <span>{{ t('splitViewModeLinked') }}</span>
                        </button>
                      </div>
                    </DropdownMenuItem>
                  </CollapsibleContent>
                </Collapsible>
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
            :disabled="props.isGlobalSearchOpen || currentLayout === 'gallery'"
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
            :disabled="currentLayout === 'gallery'"
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

.navigator-settings-menu__layout-label {
  padding-bottom: 4px;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.navigator-settings-menu__layout-row {
  display: flex;
  width: 100%;
  height: 56px;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.navigator-settings-menu__item--layout.sigma-ui-dropdown-menu-item,
.navigator-settings-menu__item--scope.sigma-ui-dropdown-menu-item {
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
  border: none;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 60%);
  color: hsl(var(--foreground) / 60%);
  cursor: pointer;
  font-size: 12px;
  gap: 0;
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
  background-color: hsl(var(--muted));
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 10%),
    0 1px 2px -1px rgb(0 0 0 / 10%);
  color: hsl(var(--foreground));
}

.navigator-settings-menu__layout-option--active:hover {
  background-color: hsl(var(--muted));
}

.navigator-settings-menu__layout-option svg {
  flex-shrink: 0;
}

.navigator-settings-menu.sigma-ui-dropdown-menu-content {
  --navigator-settings-menu-scroll-max: min(
    80vh,
    var(--reka-dropdown-menu-content-available-height, calc(100vh - var(--window-toolbar-height) - 12px))
  );

  width: 280px;
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

.navigator-settings-menu .sigma-ui-dropdown-menu-separator {
  margin-inline: 0.5rem;
}

.navigator-settings-menu__item--scope.sigma-ui-dropdown-menu-item {
  padding-block: 4px;
}

.navigator-settings-menu__scope-tabs {
  width: 100%;
}

.navigator-settings-menu__scope-tabs-list.sigma-ui-tabs-list {
  width: 100%;
  height: 1.75rem;
  padding: 1px;
}

.navigator-settings-menu__scope-tab {
  min-width: 0;
  flex: 1 1 0;
  font-size: 12px;
  padding-inline: 0.5rem;
}

.navigator-settings-menu__toggle-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.navigator-settings-menu__display-rows {
  display: flex;
  width: 100%;
  flex-direction: column;
}

.navigator-settings-menu__toggle-row--nested {
  margin-top: 8px;
}

.navigator-settings-menu__reset-collapsible {
  width: 100%;
}

.navigator-settings-menu__reset-content {
  width: 100%;
}

.navigator-settings-menu__reset-row {
  display: flex;
  width: 100%;
  align-items: center;
  margin-top: 6px;
  gap: 8px;
}

.navigator-settings-menu__reset-button.sigma-ui-button {
  height: 28px;
  flex: 1;
  font-size: 12px;
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

.navigator-settings-menu__item-start {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
}

.navigator-settings-menu__item-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
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

.navigator-settings-menu__info-trigger--folder {
  color: hsl(var(--primary));
}

.navigator-settings-menu__info-trigger--folder:hover {
  color: hsl(var(--primary));
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
