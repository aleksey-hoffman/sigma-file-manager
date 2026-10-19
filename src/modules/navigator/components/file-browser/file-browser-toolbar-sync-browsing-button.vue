<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  FORK-MODIFICATION 2026-10-19：同步浏览开关。

  放在「左右互换窗口」左边（用户指定的位置）。

  ⚠️ 第一版放在 navigator-toolbar-actions 里，点了没反应。
  那个组件的 `setSplitViewMode` 带一道守卫：`settingsScope === 'folder'` 时直接 return，
  而 `settingsScope` 会在打开过导航器选项菜单之后**latch 住**不回 'global'
  （用户一旦停在有目录级设置的路径上就再也变不回来）。
  工具栏按钮继承了本该只管设置菜单的那道闸门，于是变成一颗哑弹 ——
  落盘证据：`navigator.splitViewMode` 从未出现在 user-settings.json 里。

  这里直接读写 userSettingsStore，不经过那道闸门：
  同步浏览是**全局**设置，目录作用域跟它没关系。
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LinkIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const props = defineProps<{
  isSplitView: boolean;
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const isSyncBrowsing = computed(() => (
  props.isSplitView
  && userSettingsStore.userSettings.navigator.splitViewMode === 'linked'
));

function toggleSyncBrowsing() {
  void userSettingsStore.set(
    'navigator.splitViewMode',
    isSyncBrowsing.value ? 'split' : 'linked',
  );
}
</script>

<template>
  <!-- 单格没有「另一格」可同步，摆出来只会让人点它却看不到任何反应。 -->
  <Tooltip v-if="props.isSplitView">
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="file-browser-toolbar-sync-browsing-button"
        :class="{ 'file-browser-toolbar-sync-browsing-button--active': isSyncBrowsing }"
        :aria-label="isSyncBrowsing ? t('syncBrowsingOn') : t('syncBrowsing')"
        data-e2e-root="toolbar-sync-browsing"
        @click="toggleSyncBrowsing"
      >
        <LinkIcon :size="16" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <div>{{ isSyncBrowsing ? t('syncBrowsingOn') : t('syncBrowsing') }}</div>
      <div class="file-browser-toolbar-sync-browsing-button__hint">
        {{ t('syncBrowsingHint') }}
      </div>
    </TooltipContent>
  </Tooltip>
</template>

<style scoped>
.file-browser-toolbar-sync-browsing-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.file-browser-toolbar-sync-browsing-button--active {
  background-color: hsl(var(--secondary));
}

.file-browser-toolbar-sync-browsing-button--active :deep(svg) {
  stroke: hsl(var(--primary));
}

.file-browser-toolbar-sync-browsing-button__hint {
  max-width: 220px;
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.4;
}
</style>
