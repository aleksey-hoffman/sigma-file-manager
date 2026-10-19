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
// FORK-MODIFICATION: 本地 ↔ 远程传输（上传 / 下载）与远程权限设置。
import {
  downloadFromRemote,
  uploadToRemote,
  type RemoteTransferReport,
} from '@/modules/remote/utils/remote-transfer';
import { useRemoteTransferTargets } from '@/modules/remote/utils/remote-transfer-targets';
import { openRemotePermissionsDialog } from '@/modules/remote/utils/remote-permissions-dialog-state';

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
  const transferTargets = useRemoteTransferTargets();

  /** 汇总多次传输的结果。 */
  interface AggregatedTransfer {
    files: number;
    dirs: number;
    bytes: number;
    skipped: string[];
    failures: string[];
  }

  function emptyAggregate(): AggregatedTransfer {
    return {
      files: 0,
      dirs: 0,
      bytes: 0,
      skipped: [],
      failures: [],
    };
  }

  function mergeReport(aggregate: AggregatedTransfer, report: RemoteTransferReport) {
    aggregate.files += report.transferred_files;
    aggregate.dirs += report.transferred_dirs;
    aggregate.bytes += report.total_bytes;
    aggregate.skipped.push(...report.skipped);

    for (const failure of report.failures) {
      aggregate.failures.push(`${failure.path}: ${failure.message}`);
    }
  }

  function reportTransferOutcome(
    aggregate: AggregatedTransfer,
    successKey: string,
    failureKey: string,
  ) {
    if (aggregate.failures.length > 0) {
      toast.error(t(failureKey, {
        files: aggregate.files,
        skipped: aggregate.skipped.length,
        failed: aggregate.failures.length,
      }));

      return;
    }

    if (aggregate.skipped.length > 0) {
      toast.warning(t(successKey, {
        files: aggregate.files,
        skipped: aggregate.skipped.length,
        failed: 0,
      }));

      return;
    }

    toast.success(t(successKey, {
      files: aggregate.files,
      skipped: 0,
      failed: 0,
    }));
  }

  /**
   * 逐个上传。**顺序执行**，不并发 ——
   * 并发开多条连接会打满服务器的并发连接数，而用户一次通常也就选几个条目。
   */
  async function uploadEntries(entries: DirEntry[], remoteDir: string) {
    const aggregate = emptyAggregate();

    for (const entry of entries) {
      try {
        mergeReport(aggregate, await uploadToRemote(entry.path, remoteDir));
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        aggregate.failures.push(`${entry.path}: ${message}`);
      }
    }

    reportTransferOutcome(
      aggregate,
      'remote.transfer.uploadSucceeded',
      'remote.transfer.uploadFailed',
    );
  }

  async function downloadEntries(entries: DirEntry[], localDir: string) {
    const aggregate = emptyAggregate();

    for (const entry of entries) {
      try {
        mergeReport(aggregate, await downloadFromRemote(entry.path, localDir));
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        aggregate.failures.push(`${entry.path}: ${message}`);
      }
    }

    reportTransferOutcome(
      aggregate,
      'remote.transfer.downloadSucceeded',
      'remote.transfer.downloadFailed',
    );
  }

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

    // FORK-MODIFICATION: 「上传到远程」——目标是**对面那一格**当前所在的远程目录。
    //
    // 目标从模块级登记表取（由导航器写入）。没有对面那一格时菜单项压根不出现，
    // 所以这里拿到 `null` 只可能是状态刚变，按「什么都不做」处理。
    if (action === 'upload-to-remote') {
      const entries = options.contextMenu.value.selectedEntries;
      const target = transferTargets.remotePanePath.value;

      if (entries.length > 0 && target) {
        void uploadEntries(entries, target);
      }

      return;
    }

    // FORK-MODIFICATION: 「下载到本地」——目标是**对面那一格**当前所在的本地目录。
    if (action === 'download-to-local') {
      const entries = options.contextMenu.value.selectedEntries;
      const target = transferTargets.localPanePath.value;

      if (entries.length > 0 && target) {
        void downloadEntries(entries, target);
      }

      return;
    }

    // FORK-MODIFICATION: 「权限设置」——只对单条目有意义（多个条目权限各不相同）。
    // 可见性判定已经保证选中的全是远程条目且协议支持改权限。
    if (action === 'remote-permissions') {
      const entry = options.contextMenu.value.selectedEntries[0];

      if (entry) {
        openRemotePermissionsDialog({
          path: entry.path,
          name: entry.name,
          isDirectory: entry.is_dir,
        });
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
