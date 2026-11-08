<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  ArrowUpDownIcon,
  BookmarkIcon,
  CheckIcon,
  EyeOffIcon,
  EllipsisVerticalIcon,
  LayersIcon,
  LayoutGridIcon,
  RotateCcwIcon,
} from '@lucide/vue';
import { useNavigatorFolderSettings } from '@/modules/navigator/composables/use-navigator-folder-settings';
import { persistNavigatorOptions } from '@/modules/navigator/utils/persist-navigator-folder-settings';
import type { NavigatorFolderSettingsPatch } from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import NavigatorLayoutSortControls from '@/modules/navigator/components/navigator-toolbar-actions/navigator-layout-sort-controls.vue';
import { isNavigatorGrouping } from '@/types/user-settings';
import { NAVIGATOR_GROUPING_OPTIONS } from '@/modules/navigator/utils/navigator-grouping-options';
import { canonicalizePath } from '@/utils/normalize-path';

type LayoutType = 'list' | 'grid';

const props = defineProps<{
  path: string;
}>();

const { t } = useI18n();
const {
  applied,
  clearFolderSettings,
  hasFolderSettings,
} = useNavigatorFolderSettings(() => props.path);
const canEditFolder = computed(() => Boolean(canonicalizePath(props.path)));
const currentLayout = computed(() => applied.value.layout);
const showHiddenFiles = computed(() => applied.value.showHiddenFiles);
const grouping = computed(() => applied.value.grouping);
const groupingOptions = computed(() => NAVIGATOR_GROUPING_OPTIONS.map(option => ({
  value: option.value,
  label: t(option.labelKey),
})));
const defaultSaved = ref(false);
const SAVED_CONFIRMATION_MS = 1500;
let savedConfirmationTimer = 0;

function clearSavedConfirmationTimer() {
  window.clearTimeout(savedConfirmationTimer);
  savedConfirmationTimer = 0;
}

function scheduleOverrideNoticeDismiss() {
  clearSavedConfirmationTimer();
  savedConfirmationTimer = window.setTimeout(() => {
    savedConfirmationTimer = 0;
    defaultSaved.value = false;
  }, SAVED_CONFIRMATION_MS);
}

watch(hasFolderSettings, (hasOverride) => {
  if (!hasOverride) {
    return;
  }

  clearSavedConfirmationTimer();
  defaultSaved.value = false;
});

onUnmounted(() => {
  clearSavedConfirmationTimer();
});

async function persistFolderPatch(patch: NavigatorFolderSettingsPatch) {
  if (!canonicalizePath(props.path)) {
    return;
  }

  await persistNavigatorOptions({ folder: props.path }, patch);
}

async function handleLayoutChange(value: string | number) {
  if (value !== 'list' && value !== 'grid') {
    return;
  }

  await setLayout(value);
}

async function setLayout(layoutName: LayoutType) {
  await persistFolderPatch({ layout: layoutName });
}

async function handleGroupingChange(value: unknown) {
  if (!isNavigatorGrouping(value)) {
    return;
  }

  await persistFolderPatch({ grouping: value });
}

async function handleToggleHiddenFiles(checked: boolean) {
  await persistFolderPatch({ showHiddenFiles: checked });
}

async function handleSetAsDefault() {
  if (defaultSaved.value) {
    return;
  }

  clearSavedConfirmationTimer();
  defaultSaved.value = true;

  await persistNavigatorOptions('global', applied.value);
  await clearFolderSettings();

  if (!defaultSaved.value) {
    return;
  }

  scheduleOverrideNoticeDismiss();
}

async function handleUseGlobalSettings() {
  if (defaultSaved.value) {
    return;
  }

  clearSavedConfirmationTimer();
  defaultSaved.value = false;
  await clearFolderSettings();
}
</script>

<template>
  <DropdownMenu v-if="canEditFolder">
    <Tooltip>
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="file-browser-pane-options-menu__button"
            :aria-label="t('settings.navigator.thisFolderOptions')"
          >
            <EllipsisVerticalIcon
              :size="18"
              class="file-browser-pane-options-menu__icon"
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
              {{ t('settings.navigator.thisFolderOptions') }}
            </div>
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__row"
            >
              <span class="navigator-settings-menu__row-label">
                <LayoutGridIcon
                  :size="16"
                  class="navigator-settings-menu__row-icon"
                />
                {{ t('settings.navigator.navigatorViewLayout') }}
              </span>
              <Tabs
                :model-value="currentLayout"
                class="navigator-settings-menu__choice-tabs"
                @update:model-value="handleLayoutChange"
              >
                <TabsList class="sigma-ui-tabs-list--page">
                  <TabsTrigger value="list">
                    {{ t('list') }}
                  </TabsTrigger>
                  <TabsTrigger value="grid">
                    {{ t('grid') }}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </DropdownMenuItem>
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__row"
            >
              <span class="navigator-settings-menu__row-label">
                <ArrowUpDownIcon
                  :size="16"
                  class="navigator-settings-menu__row-icon"
                />
                {{ t('settings.navigator.sorting') }}
              </span>
              <NavigatorLayoutSortControls
                :sort-layout="currentLayout"
                :sort-source="applied"
                @persist="persistFolderPatch"
              />
            </DropdownMenuItem>
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__row"
            >
              <span class="navigator-settings-menu__row-label">
                <LayersIcon
                  :size="16"
                  class="navigator-settings-menu__row-icon"
                />
                {{ t('settings.navigator.grouping') }}
              </span>
              <Select
                :model-value="grouping"
                @update:model-value="handleGroupingChange"
              >
                <SelectTrigger
                  class="navigator-settings-menu__grouping-select"
                  :aria-label="t('settings.navigator.grouping')"
                >
                  <SelectValue>
                    {{ groupingOptions.find(option => option.value === grouping)?.label }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in groupingOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    <SelectItemText>{{ option.label }}</SelectItemText>
                  </SelectItem>
                </SelectContent>
              </Select>
            </DropdownMenuItem>
            <DropdownMenuItem
              @select.prevent
              class="navigator-settings-menu__item navigator-settings-menu__row"
            >
              <span class="navigator-settings-menu__row-label">
                <EyeOffIcon
                  :size="16"
                  class="navigator-settings-menu__row-icon"
                />
                {{ t('filter.showHiddenItems') }}
              </span>
              <Switch
                class="navigator-settings-menu__switch"
                :model-value="showHiddenFiles"
                @update:model-value="handleToggleHiddenFiles"
              />
            </DropdownMenuItem>
            <Collapsible :open="hasFolderSettings || defaultSaved">
              <CollapsibleContent class="file-browser-pane-options-menu__override-content">
                <div class="file-browser-pane-options-menu__override">
                  <p class="file-browser-pane-options-menu__note">
                    <span
                      class="file-browser-pane-options-menu__override-dot"
                      aria-hidden="true"
                    />
                    {{ t('settings.navigator.thisFolderDefaultActions') }}
                  </p>
                  <DropdownMenuItem
                    class="file-browser-pane-options-menu__action"
                    @select.prevent="handleSetAsDefault"
                  >
                    <span class="file-browser-pane-options-menu__action-swap">
                      <span
                        class="file-browser-pane-options-menu__action-face"
                        :class="{ 'is-hidden': defaultSaved }"
                      >
                        <BookmarkIcon
                          :size="16"
                          class="file-browser-pane-options-menu__action-icon"
                        />
                        {{ t('settings.navigator.setAsDefault') }}
                      </span>
                      <span
                        class="file-browser-pane-options-menu__action-face file-browser-pane-options-menu__action-face--saved"
                        :class="{ 'is-hidden': !defaultSaved }"
                      >
                        <CheckIcon
                          :size="16"
                          class="file-browser-pane-options-menu__action-icon"
                        />
                        {{ t('settings.navigator.savedAsDefault') }}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <div
                    class="file-browser-pane-options-menu__reset"
                    :class="{ 'is-collapsed': defaultSaved }"
                  >
                    <div class="file-browser-pane-options-menu__reset-clip">
                      <DropdownMenuItem
                        class="file-browser-pane-options-menu__action"
                        :disabled="defaultSaved"
                        @select.prevent="handleUseGlobalSettings"
                      >
                        <RotateCcwIcon
                          :size="16"
                          class="file-browser-pane-options-menu__action-icon"
                        />
                        {{ t('settings.navigator.useGlobalSettings') }}
                      </DropdownMenuItem>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </DropdownMenuContent>
      <TooltipContent>
        {{ t('settings.navigator.thisFolderOptions') }}
      </TooltipContent>
    </Tooltip>
  </DropdownMenu>
</template>

<style scoped>
.file-browser-pane-options-menu__button {
  width: 36px;
  height: 36px;
}

.file-browser-pane-options-menu__icon {
  stroke: hsl(var(--foreground) / 70%);
}

.file-browser-pane-options-menu__override-content {
  width: 100%;
}

.file-browser-pane-options-menu__override {
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid hsl(var(--primary) / 32%);
  border-radius: var(--radius-sm);
  margin: 6px 4px 2px;
  background-color: hsl(var(--primary) / 12%);
  gap: 2px;
}

.file-browser-pane-options-menu__action-swap {
  display: grid;
  width: 100%;
}

.file-browser-pane-options-menu__action-face {
  display: flex;
  align-items: center;
  font-size: 13px;
  gap: 8px;
  grid-area: 1 / 1;
  opacity: 1;
  transition: opacity 0.18s ease;
}

.file-browser-pane-options-menu__action-face.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.file-browser-pane-options-menu__action-face--saved .file-browser-pane-options-menu__action-icon {
  color: hsl(var(--primary));
}

.file-browser-pane-options-menu__note {
  display: flex;
  align-items: flex-start;
  padding: 4px 6px 2px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  gap: 8px;
  letter-spacing: 0.01em;
  line-height: 1.35;
}

.file-browser-pane-options-menu__override-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 999px;
  margin-top: 0.28rem;
  background-color: hsl(var(--primary));
}

.file-browser-pane-options-menu__reset {
  display: grid;
  overflow: hidden;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 0.2s ease-out, opacity 0.2s ease-out;
}

.file-browser-pane-options-menu__reset.is-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
}

.file-browser-pane-options-menu__reset-clip {
  overflow: hidden;
  min-height: 0;
}

.file-browser-pane-options-menu__action {
  display: flex;
  align-items: center;
  font-size: 13px;
  gap: 8px;
}

.file-browser-pane-options-menu__action-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}
</style>
