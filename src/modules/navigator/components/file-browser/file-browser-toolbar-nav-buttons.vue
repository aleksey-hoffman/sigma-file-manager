<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EllipsisIcon,
  FilePlusIcon,
  FolderPlusIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
} from '@lucide/vue';
import { useTextDirection } from '@/composables/use-text-direction';
import FileBrowserThumbnailSizeDialog from './file-browser-thumbnail-size-dialog.vue';
import type { ThumbnailSize } from './types';

const props = defineProps<{
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  isLoading: boolean;
  // FORK-MODIFICATION: layout toggle moved here from window toolbar (issue TBD)
  currentLayout: 'list' | 'grid';
  /**
   * FORK-MODIFICATION 2026-10-20：当前目录能不能「新建空文件」。远程一律不行。
   *
   * 这个「⋯」下拉是**第三个**渲染「新建文件」的地方（另两个是工具栏的「＋」
   * 下拉和右键「新建」子菜单）。三处都要各自接门禁 —— 少接一处，
   * 远程目录里就还留着一个能点到的入口。
   */
  canCreateFile: boolean;
}>();

const emit = defineEmits<{
  (event: 'goBack'): void;
  (event: 'goForward'): void;
  (event: 'goUp'): void;
  (event: 'goHome'): void;
  (event: 'refresh'): void;
  (event: 'createNewDirectory'): void;
  (event: 'createNewFile'): void;
  (event: 'toggle-layout'): void;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const { isRtl } = useTextDirection();
const backHistoryIcon = computed(() => isRtl.value ? ArrowRightIcon : ArrowLeftIcon);
const forwardHistoryIcon = computed(() => isRtl.value ? ArrowLeftIcon : ArrowRightIcon);

// 图标语义：显示当前所在视图（与 Windows 资源管理器一致）。
// aria-label 显示将切到的目标视图。详见 docs/superpowers/specs/2026-10-12-navigator-polish-pack-design.md §5.2。
const isGridLayout = computed(() => props.currentLayout === 'grid');
const nextLayoutLabelKey = computed(() => isGridLayout.value ? 'list' : 'grid');

// FORK-MODIFICATION: 缩略图大小三档弹窗入口（紧跟 layout toggle 按钮）。
const userSettingsStore = useUserSettingsStore();
const thumbnailSize = computed<ThumbnailSize>(
  () => userSettingsStore.userSettings.navigator.thumbnailSize,
);
const isThumbnailSizeDialogOpen = ref(false);
function openThumbnailSizeDialog() {
  isThumbnailSizeDialogOpen.value = true;
}
</script>

<template>
  <div class="file-browser-toolbar-nav-buttons file-browser-toolbar-nav-buttons--expanded">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoBack"
          @click="emit('goBack')"
        >
          <component
            :is="backHistoryIcon"
            class="file-browser-toolbar-nav-buttons__icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-toolbar-nav-buttons__tooltip-row">
          {{ t('fileBrowser.goBack') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('navigateHistoryBack') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoForward"
          @click="emit('goForward')"
        >
          <component
            :is="forwardHistoryIcon"
            class="file-browser-toolbar-nav-buttons__icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-toolbar-nav-buttons__tooltip-row">
          {{ t('fileBrowser.goForward') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('navigateHistoryForward') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="!canGoUp"
          @click="emit('goUp')"
        >
          <ArrowUpIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-toolbar-nav-buttons__tooltip-row">
          {{ t('fileBrowser.goUp') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('goUpDirectory') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          data-test="go-locations-button"
          @click="emit('goHome')"
        >
          <HomeIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t('locations') }}</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <RefreshCwIcon
            class="file-browser-toolbar-nav-buttons__icon"
            :class="{ 'file-browser-toolbar-nav-buttons__icon--spin': isLoading }"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-toolbar-nav-buttons__tooltip-row">
          {{ t('fileBrowser.refresh') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('reloadCurrentDirectory') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          data-test="toggle-layout-button"
          :aria-label="t(nextLayoutLabelKey)"
          @click="emit('toggle-layout')"
        >
          <LayoutGridIcon
            v-if="isGridLayout"
            class="file-browser-toolbar-nav-buttons__icon"
          />
          <ListIcon
            v-else
            class="file-browser-toolbar-nav-buttons__icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {{ t(nextLayoutLabelKey) }}
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          data-test="thumbnail-size-button"
          :aria-label="t('settings.general.fileView.thumbnailSizeTitle')"
          @click="openThumbnailSizeDialog"
        >
          <ImageIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('settings.general.fileView.thumbnailSizeTitle') }}
      </TooltipContent>
    </Tooltip>
  </div>
  <div class="file-browser-toolbar-nav-buttons file-browser-toolbar-nav-buttons--collapsed">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          :title="t('settingsCategories.navigation')"
        >
          <EllipsisIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        class="file-browser-toolbar-nav-buttons__dropdown"
      >
        <DropdownMenuItem
          :disabled="!canGoBack"
          @click="emit('goBack')"
        >
          <component
            :is="backHistoryIcon"
            :size="14"
          />
          {{ t('fileBrowser.goBack') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!canGoForward"
          @click="emit('goForward')"
        >
          <component
            :is="forwardHistoryIcon"
            :size="14"
          />
          {{ t('fileBrowser.goForward') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!canGoUp"
          @click="emit('goUp')"
        >
          <ArrowUpIcon :size="14" />
          {{ t('fileBrowser.goUp') }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="emit('goHome')">
          <HomeIcon :size="14" />
          {{ t('locations') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <RefreshCwIcon :size="14" />
          {{ t('fileBrowser.refresh') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-test="toggle-layout-menu-item"
          @click="emit('toggle-layout')"
        >
          <LayoutGridIcon
            v-if="isGridLayout"
            :size="14"
          />
          <ListIcon
            v-else
            :size="14"
          />
          {{ isGridLayout ? t('list') : t('grid') }}
        </DropdownMenuItem>
        <!-- FORK-MODIFICATION: 缩略图大小此前只挂在宽屏那排图标上，
             窄屏折叠进「⋯」后就找不到了。位置对齐宽屏的顺序：紧跟在视图切换之后。 -->
        <DropdownMenuItem
          data-test="thumbnail-size-menu-item"
          @click="openThumbnailSizeDialog"
        >
          <ImageIcon :size="14" />
          {{ t('settings.general.fileView.thumbnailSizeTitle') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="file-browser-toolbar-nav-buttons__menu-item-with-shortcut"
          data-test="create-new-directory-menu-item"
          @click="emit('createNewDirectory')"
        >
          <FolderPlusIcon :size="14" />
          <span>{{ t('navigator.newDirectory') }}</span>
          <ContextMenuShortcut>
            {{ shortcutsStore.getShortcutLabel('createNewDirectory') }}
          </ContextMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="props.canCreateFile"
          class="file-browser-toolbar-nav-buttons__menu-item-with-shortcut"
          data-test="create-new-file-menu-item"
          @click="emit('createNewFile')"
        >
          <FilePlusIcon :size="14" />
          <span>{{ t('navigator.newFile') }}</span>
          <ContextMenuShortcut>
            {{ shortcutsStore.getShortcutLabel('createNewFile') }}
          </ContextMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <!-- FORK-MODIFICATION: 弹窗挂在两个容器**之外**。
       窄屏时上面那个 --expanded div 是 display:none，弹窗在里面虽然
       （reka 会 teleport 到 body）多半还能显示，但那是运气不是设计。 -->
  <FileBrowserThumbnailSizeDialog
    v-model:open="isThumbnailSizeDialogOpen"
    v-model:model-value="thumbnailSize"
  />
</template>

<style scoped>
.file-browser-toolbar-nav-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.file-browser-toolbar-nav-buttons--expanded {
  display: flex;
}

.file-browser-toolbar-nav-buttons--collapsed {
  display: none;
}

.file-browser-toolbar-nav-buttons__button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar-nav-buttons__icon {
  width: 18px;
  height: 18px;
}

.file-browser-toolbar-nav-buttons__icon--spin {
  animation: toolbar-nav-buttons-spin 1s linear infinite;
}

@keyframes toolbar-nav-buttons-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.file-browser-toolbar-nav-buttons__dropdown {
  min-width: 180px;
}

.file-browser-toolbar-nav-buttons__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-browser-toolbar-nav-buttons__menu-item-with-shortcut {
  display: flex;
  align-items: center;
}

@container (width < 600px) {
  .file-browser-toolbar-nav-buttons--expanded {
    display: none;
  }

  .file-browser-toolbar-nav-buttons--collapsed {
    display: flex;
  }
}
</style>
