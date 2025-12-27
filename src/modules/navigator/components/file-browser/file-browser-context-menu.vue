<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import {
  PencilIcon,
  CopyIcon,
  ScissorsIcon,
  Trash2Icon,
  ExternalLinkIcon,
  EyeIcon,
  Share2Icon,
  PanelRightIcon,
} from 'lucide-vue-next';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import { useContextMenuItems } from './composables/use-context-menu-items';
import { toRef } from 'vue';

const props = defineProps<{
  selectedEntries: DirEntry[];
}>();

const emit = defineEmits<{
  action: [action: ContextMenuAction];
}>();

const { t } = useI18n();

const { isActionVisible } = useContextMenuItems(toRef(props, 'selectedEntries'));
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <div class="file-browser-context-menu__quick-actions">
      <ContextMenuItem
        v-if="isActionVisible('rename')"
        as-child
        @select="emit('action', 'rename')"
      >
        <Button
          variant="ghost"
          size="icon"
          :title="t('fileBrowser.actions.rename')"
        >
          <PencilIcon :size="16" />
        </Button>
      </ContextMenuItem>
      <ContextMenuItem
        v-if="isActionVisible('copy')"
        as-child
        @select="emit('action', 'copy')"
      >
        <Button
          variant="ghost"
          size="icon"
          :title="t('fileBrowser.actions.copy')"
        >
          <CopyIcon :size="16" />
        </Button>
      </ContextMenuItem>
      <ContextMenuItem
        v-if="isActionVisible('cut')"
        as-child
        @select="emit('action', 'cut')"
      >
        <Button
          variant="ghost"
          size="icon"
          :title="t('fileBrowser.actions.cut')"
        >
          <ScissorsIcon :size="16" />
        </Button>
      </ContextMenuItem>
      <ContextMenuItem
        v-if="isActionVisible('delete')"
        as-child
        @select="emit('action', 'delete')"
      >
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-context-menu__action--danger"
          :title="t('fileBrowser.actions.delete')"
        >
          <Trash2Icon :size="16" />
        </Button>
      </ContextMenuItem>
    </div>
    <ContextMenuSeparator />
    <ContextMenuItem
      v-if="isActionVisible('open-with')"
      @select="emit('action', 'open-with')"
    >
      <ExternalLinkIcon :size="16" />
      <span>{{ t('fileBrowser.actions.openWith') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isActionVisible('quick-view')"
      @select="emit('action', 'quick-view')"
    >
      <EyeIcon :size="16" />
      <span>{{ t('fileBrowser.actions.quickView') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isActionVisible('share')"
      @select="emit('action', 'share')"
    >
      <Share2Icon :size="16" />
      <span>{{ t('fileBrowser.actions.share') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isActionVisible('open-in-new-tab')"
      @select="emit('action', 'open-in-new-tab')"
    >
      <PanelRightIcon :size="16" />
      <span>{{ t('fileBrowser.actions.openInNewTab') }}</span>
    </ContextMenuItem>
  </ContextMenuContent>
</template>

<style>
.file-browser-context-menu.sigma-ui-context-menu-content {
  width: 200px;
  padding: 8px;
}

.file-browser-context-menu__quick-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.file-browser-context-menu__action--danger:hover {
  color: hsl(var(--destructive));
}
</style>
