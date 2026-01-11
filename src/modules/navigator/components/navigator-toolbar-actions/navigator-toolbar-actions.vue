<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import {
  FlipHorizontalIcon,
  PanelRightIcon,
  LayoutGridIcon,
  ListIcon,
  EllipsisVerticalIcon,
} from 'lucide-vue-next';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

type LayoutType = 'list' | 'grid';

const props = defineProps<{
  isSplitView: boolean;
  showInfoPanel: boolean;
}>();

const emit = defineEmits<{
  'toggle-split-view': [];
  'toggle-info-panel': [];
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const isLayoutPopoverOpen = ref(false);

const currentLayout = computed(() => {
  const layoutName = userSettingsStore.userSettings.navigator.layout.type.name;
  return layoutName === 'compact-list' ? 'list' : layoutName;
});

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);

async function setLayout(layoutName: LayoutType) {
  const layoutTitle = layoutName === 'grid' ? 'gridLayout' : 'listLayout';
  await userSettingsStore.set('navigator.layout.type', {
    title: layoutTitle,
    name: layoutName,
  });
  isLayoutPopoverOpen.value = false;
}

function handleToggleHiddenFiles(checked: boolean) {
  userSettingsStore.set('navigator.showHiddenFiles', checked);
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
            <DropdownMenuLabel>{{ t('settings.navigator.navigatorOptions') }}</DropdownMenuLabel>
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
          </DropdownMenuContent>
          <TooltipContent>
            {{ t('settings.navigator.navigatorOptions') }}
          </TooltipContent>
        </Tooltip>
      </DropdownMenu>

      <Popover
        :open="isLayoutPopoverOpen"
        @update:open="isLayoutPopoverOpen = $event"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
              >
                <LayoutGridIcon
                  v-if="currentLayout === 'grid'"
                  :size="16"
                  class="navigator-toolbar-actions__icon"
                />
                <ListIcon
                  v-else
                  :size="16"
                  class="navigator-toolbar-actions__icon"
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <PopoverContent
            :side="'bottom'"
            :align="'end'"
            class="navigator-layout-popover"
          >
            <button
              class="navigator-layout-option"
              :class="{ 'navigator-layout-option--active': currentLayout === 'list' }"
              @click="setLayout('list')"
            >
              <ListIcon :size="16" />
              <span>{{ t('listLayout') }}</span>
            </button>
            <button
              class="navigator-layout-option"
              :class="{ 'navigator-layout-option--active': currentLayout === 'grid' }"
              @click="setLayout('grid')"
            >
              <LayoutGridIcon :size="16" />
              <span>{{ t('gridLayout') }}</span>
            </button>
          </PopoverContent>
          <TooltipContent>
            {{ t('settings.navigator.navigatorViewLayout') }}
          </TooltipContent>
        </Tooltip>
      </Popover>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'navigator-toolbar-actions__button--active': props.isSplitView }"
            @click="emit('toggle-split-view')"
          >
            <FlipHorizontalIcon
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('splitView') }}
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
  stroke: hsl(var(--icon));
}

.navigator-toolbar-actions__button--active {
  background-color: hsl(var(--secondary));
}

.navigator-toolbar-actions__button--active .navigator-toolbar-actions__icon {
  stroke: hsl(var(--primary));
}

.navigator-layout-popover.sigma-ui-popover-content {
  display: flex;
  width: auto;
  flex-direction: column;
  padding: 4px;
  gap: 2px;
}

.navigator-layout-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 13px;
  gap: 8px;
  transition: background-color 0.15s;
}

.navigator-layout-option:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.navigator-layout-option:hover {
  background-color: hsl(var(--secondary));
}

.navigator-layout-option--active {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.navigator-layout-option--active:hover {
  background-color: hsl(var(--primary) / 25%);
}

.navigator-settings-menu.sigma-ui-dropdown-menu-content {
  min-width: 200px;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: default;
  gap: 12px;
}

.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:focus,
.navigator-settings-menu__item.sigma-ui-dropdown-menu-item:hover {
  background-color: transparent;
  color: inherit;
}

.navigator-settings-menu__item-label {
  flex: 1;
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
