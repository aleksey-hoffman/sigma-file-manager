// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ComputedRef, Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { quickViewSupportedPathsFromVisibleEntries } from '@/stores/runtime/quick-view';
import { usePlatformStore } from '@/stores/runtime/platform';
import { openNativeProperties } from '@/utils/open-native-properties';
import { canPerformContextMenuAction } from '@/modules/navigator/components/file-browser/utils/context-menu-action-visibility';
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
}) {
  const { t } = useI18n();
  const platformStore = usePlatformStore();

  function canPerformAction(action: ContextMenuAction, entries: DirEntry[]): boolean {
    return canPerformContextMenuAction(action, entries, {
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
