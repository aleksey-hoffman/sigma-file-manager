// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ComputedRef, Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { quickViewSupportedPathsFromVisibleEntries } from '@/stores/runtime/quick-view';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useRouter } from 'vue-router';
import { openNativeProperties } from '@/utils/open-native-properties';
import { revealInExplorer } from '@/utils/open-in-explorer';
import { openNavigatorRevealEntry } from '@/utils/open-navigator-directory';
import { isContextMenuActionVisible } from '@/modules/navigator/components/file-browser/utils/context-menu-action-visibility';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { markRaw } from 'vue';
import { useI18n } from 'vue-i18n';

type ContextMenuState = {
  targetEntry: DirEntry | null;
  selectedEntries: DirEntry[];
};

type QuickViewStore = {
  toggleQuickView: (path: string, siblingPaths?: string[] | null) => Promise<boolean>;
  openPrintViewFromMainWindow: (path: string) => Promise<boolean>;
};

export function useFileBrowserActions(options: {
  contextMenu: Ref<ContextMenuState>;
  selectedEntries: Ref<DirEntry[]>;
  visibleEntries: ComputedRef<DirEntry[]>;
  quickViewStore: QuickViewStore;
  handleContextMenuAction: (action: ContextMenuAction) => void;
  openOpenWithDialog: (entries: DirEntry[]) => void;
  handleEntryMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  handleEntryMouseUp: (entry: DirEntry, event: MouseEvent) => void;
  handleDragMouseDown?: (entry: DirEntry, event: MouseEvent) => void;
  isDragging?: Ref<boolean>;
  /**
   * FORK-MODIFICATION: 反馈 3（2026-10-15）——当前过滤词。
   * 「打开所属目录」要把它交接给拆出来的右格 pane，否则右格挂载时是空的，
   * 用户要的「右边保持搜索结果」就变回「右边是搜索前的目录」。
   * 用 getter 而不是值：右键菜单弹出到点选之间用户仍可能在过滤框里打字。
   */
  getFilterQuery?: () => string;
}) {
  const { t } = useI18n();
  const platformStore = usePlatformStore();
  const router = useRouter();

  function canPerformAction(action: ContextMenuAction, entries: DirEntry[]): boolean {
    return isContextMenuActionVisible(action, entries, {
      platform: platformStore.currentPlatform,
    });
  }

  async function openProperties(entries: DirEntry[]) {
    if (!canPerformAction('properties', entries)) {
      return;
    }

    if (!platformStore.isWindows || entries.length === 0) {
      return;
    }

    const result = await openNativeProperties(entries);

    if (!result.success) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('fileBrowser.actions.propertiesFailed'),
            description: result.error || '',
          },
        },
      });
    }
  }

  async function quickView(entry?: DirEntry) {
    const targetEntry = entry || options.selectedEntries.value[options.selectedEntries.value.length - 1];

    if (!targetEntry || !canPerformAction('quick-view', [targetEntry])) {
      return;
    }

    if (targetEntry.is_file) {
      const siblingPaths = quickViewSupportedPathsFromVisibleEntries(options.visibleEntries.value);
      await options.quickViewStore.toggleQuickView(targetEntry.path, siblingPaths);
    }
  }

  async function printEntry(entry?: DirEntry) {
    const targetEntry = entry || options.selectedEntries.value[options.selectedEntries.value.length - 1];

    if (!targetEntry || !canPerformAction('print', [targetEntry])) {
      return;
    }

    if (targetEntry.is_file) {
      await options.quickViewStore.openPrintViewFromMainWindow(targetEntry.path);
    }
  }

  function onContextMenuAction(action: ContextMenuAction) {
    if (action === 'open-with') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0 && canPerformAction('open-with', entries)) {
        options.openOpenWithDialog(entries);
      }

      return;
    }

    if (action === 'quick-view') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0 && entries[0].is_file) {
        void quickView(entries[0]);
      }

      return;
    }

    if (action === 'print') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0 && entries[0].is_file) {
        void printEntry(entries[0]);
      }

      return;
    }

    if (action === 'properties') {
      const entries = options.contextMenu.value.selectedEntries;

      if (entries.length > 0) {
        void openProperties(entries);
      }

      return;
    }

    if (action === 'open-containing-directory') {
      const entries = options.contextMenu.value.selectedEntries;

      // 仅 file 节点触发（visibility 规则已保证 directory 不会进来）
      for (const entry of entries) {
        if (!entry.is_dir) {
          void revealInExplorer(entry.path).catch((err: unknown) => {
            console.error('revealInExplorer failed:', err);
          });
        }
      }

      return;
    }

    // FORK-MODIFICATION: 搜索结果「打开所属目录」——把父目录放进结果列表旁边的
    // 导航器 pane 并选中该条目。
    // FORK-MODIFICATION: 这里**不能**关全局搜索面板。搜索面板本身就在布局左侧，
    // 它就是用户要的「保持打开、内容不变」的那一格；关掉之后 `openNavigatorRevealEntry`
    // 填进去的是右侧导航器 pane，左侧列表整格消失，正是 2026-10-15 用户指出的错。
    // FORK-MODIFICATION（反馈 3）：过滤词一并传下去。全局搜索面板开着时它是空串 ——
    // 那条通道的结果列表在面板里，导航器 pane 不需要它。
    if (action === 'open-containing-directory-in-app') {
      const entries = options.contextMenu.value.selectedEntries;
      const targetEntry = entries[0];

      if (!targetEntry) {
        return;
      }

      openNavigatorRevealEntry(router, targetEntry.path, {
        filterQuery: options.getFilterQuery?.() ?? '',
      });

      return;
    }

    options.handleContextMenuAction(action);
  }

  function onEntryMouseDown(entry: DirEntry, event: MouseEvent) {
    options.handleEntryMouseDown(entry, event);

    if (options.handleDragMouseDown && event.button === 0) {
      options.handleDragMouseDown(entry, event);
    }
  }

  function onEntryMouseUp(entry: DirEntry, event: MouseEvent) {
    if (options.isDragging?.value) {
      return;
    }

    options.handleEntryMouseUp(entry, event);
  }

  return {
    quickView,
    printEntry,
    openProperties,
    onContextMenuAction,
    onEntryMouseDown,
    onEntryMouseUp,
  };
}
