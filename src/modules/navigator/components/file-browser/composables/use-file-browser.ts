// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, nextTick, toRef } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useFileBrowserNavigation } from './use-file-browser-navigation';
import { useFileBrowserSelection } from './use-file-browser-selection';
import { useFileBrowserEntries } from './use-file-browser-entries';
import { useFileBrowserFilter } from './use-file-browser-filter';
import { useFileBrowserFocus } from './use-file-browser-focus';
import { useFileBrowserDialogs } from './use-file-browser-dialogs';
import { useFileBrowserActions } from './use-file-browser-actions';
import { useFileBrowserKeyboardNavigation } from './use-file-browser-keyboard-navigation';
import { useFileBrowserLifecycle } from './use-file-browser-lifecycle';
import { useFileBrowserDrag } from './use-file-browser-drag';
import { useFileBrowserExternalDrop } from './use-file-browser-external-drop';
import { useVideoThumbnails } from './use-video-thumbnails';
import { sortFileBrowserEntries } from '../utils/file-browser-sort';

export interface UseFileBrowserOptions {
  tab: () => Tab | undefined;
  layout: () => 'list' | 'grid' | undefined;
  externalEntries?: () => DirEntry[];
  basePath?: () => string;
  onSelectedEntriesChange: (entries: DirEntry[]) => void;
  onCurrentDirEntryChange: (entry: DirEntry | null) => void;
  onOpenEntry: (entry: DirEntry) => void;
  componentRef: Ref<HTMLElement | null>;
}

interface DataSource {
  entries: ComputedRef<DirEntry[]>;
  currentPath: ComputedRef<string>;
  isDirectoryEmpty: ComputedRef<boolean>;
  dirContents: Ref<DirContents | null>;
  isLoading: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  error: Ref<string | null>;
  pathInput: Ref<string>;
  canGoBack: Ref<boolean>;
  canGoForward: Ref<boolean>;
  parentPath: ComputedRef<string | null> | Ref<string | null>;
  navigateToPath: (path: string) => Promise<void>;
  navigateToEntry: (entry: DirEntry) => Promise<void>;
  navigateToParent: () => Promise<void>;
  navigateToHome: () => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  handlePathSubmit: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  silentRefresh: () => void;
  filterQuery: Ref<string>;
  isFilterOpen: Ref<boolean>;
  toggleFilter: () => void;
  openFilter: () => void;
  closeFilter: () => void;
}

function setupNavigationDataSource(
  options: UseFileBrowserOptions,
  onNavigationCleanup: () => void,
): DataSource {
  const userSettingsStore = useUserSettingsStore();
  const dismissalLayerStore = useDismissalLayerStore();
  const globalSearchStore = useGlobalSearchStore();

  const navigation = useFileBrowserNavigation(
    options.tab,
    dirEntry => options.onCurrentDirEntryChange(dirEntry),
    onNavigationCleanup,
  );

  const filter = useFileBrowserFilter({
    userSettingsStore,
    dismissalLayerStore,
    globalSearchStore,
  });

  const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);
  const listSortColumn = computed(() => userSettingsStore.userSettings.navigator.listSortColumn);
  const listSortDirection = computed(() => userSettingsStore.userSettings.navigator.listSortDirection);
  const applyListSort = computed(() => options.layout() === 'list');
  const {
    entries: filteredEntries,
    isDirectoryEmpty: filteredIsDirectoryEmpty,
  } = useFileBrowserEntries(
    navigation.dirContents,
    filter.filterQuery,
    showHiddenFiles,
    listSortColumn,
    listSortDirection,
    applyListSort,
  );

  const tabRef = toRef(options.tab);

  useFileBrowserLifecycle({
    tabRef,
    readDir: navigation.readDir,
    init: navigation.init,
  });

  return {
    entries: computed(() => filteredEntries.value),
    currentPath: computed(() => navigation.currentPath.value),
    isDirectoryEmpty: computed(() => filteredIsDirectoryEmpty.value),
    dirContents: navigation.dirContents,
    isLoading: navigation.isLoading,
    isRefreshing: navigation.isRefreshing,
    error: navigation.error,
    pathInput: navigation.pathInput,
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    parentPath: navigation.parentPath,
    navigateToPath: navigation.navigateToPath,
    navigateToEntry: navigation.navigateToEntry,
    navigateToParent: navigation.navigateToParent,
    navigateToHome: navigation.navigateToHome,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    refresh: navigation.refresh,
    handlePathSubmit: navigation.handlePathSubmit,
    openFile: navigation.openFile,
    silentRefresh: navigation.silentRefresh,
    filterQuery: filter.filterQuery,
    isFilterOpen: filter.isFilterOpen,
    toggleFilter: filter.toggleFilter,
    openFilter: filter.openFilter,
    closeFilter: filter.closeFilter,
  };
}

function setupExternalDataSource(options: UseFileBrowserOptions): DataSource {
  const globalSearchStore = useGlobalSearchStore();
  const userSettingsStore = useUserSettingsStore();
  const dirSizesStore = useDirSizesStore();
  const getEntries = options.externalEntries ?? (() => []);
  const getBasePath = options.basePath ?? (() => '');

  const listSortColumn = computed(() => userSettingsStore.userSettings.navigator.listSortColumn);
  const listSortDirection = computed(() => userSettingsStore.userSettings.navigator.listSortDirection);

  const entries = computed(() => {
    const rawEntries = getEntries();

    if (options.layout() !== 'list') {
      return rawEntries;
    }

    const column = listSortColumn.value ?? 'name';
    return sortFileBrowserEntries(rawEntries, column, listSortDirection.value, dirSizesStore);
  });

  return {
    entries,
    currentPath: computed(() => getBasePath()),
    isDirectoryEmpty: computed(() => getEntries().length === 0),
    dirContents: ref(null),
    isLoading: ref(false),
    isRefreshing: ref(false),
    error: ref(null),
    pathInput: ref(''),
    canGoBack: ref(false),
    canGoForward: ref(false),
    parentPath: ref(null),
    navigateToPath: async () => {},
    navigateToEntry: async () => {},
    navigateToParent: async () => {},
    navigateToHome: async () => {},
    goBack: () => {},
    goForward: () => {},
    refresh: () => {},
    handlePathSubmit: async () => {},
    openFile: async () => {},
    silentRefresh: () => {
      globalSearchStore.search();
    },
    filterQuery: ref(''),
    isFilterOpen: ref(false),
    toggleFilter: () => {},
    openFilter: () => {},
    closeFilter: () => {},
  };
}

export function useFileBrowser(options: UseFileBrowserOptions) {
  const isExternalMode = !!options.externalEntries;
  const quickViewStore = useQuickViewStore();
  const clipboardStore = useClipboardStore();

  const dataSource = isExternalMode
    ? setupExternalDataSource(options)
    : setupNavigationDataSource(options, () => {
        selection.clearSelection();
        selection.resetMouseState();
      });

  const selection = useFileBrowserSelection(
    dataSource.entries,
    dataSource.currentPath,
    selectedItems => options.onSelectedEntriesChange(selectedItems),
    async (entry) => {
      if (isExternalMode) {
        options.onOpenEntry(entry);
        return;
      }

      if (entry.is_dir) {
        await dataSource.navigateToEntry(entry);
      }
      else {
        await dataSource.openFile(entry.path);
      }
    },
    dataSource.silentRefresh,
  );

  const { entriesContainerRef, setEntriesContainerRef } = useFileBrowserFocus({
    entries: dataSource.entries,
    pendingFocusRequest: selection.pendingFocusRequest,
    currentPath: dataSource.currentPath,
    selectEntryByPath: selection.selectEntryByPath,
    clearPendingFocusRequest: selection.clearPendingFocusRequest,
  });

  const videoThumbnails = !isExternalMode
    ? useVideoThumbnails()
    : { getVideoThumbnail: () => undefined };

  const dialogs = useFileBrowserDialogs({
    renameState: selection.renameState,
    cancelRename: selection.cancelRename,
    confirmRename: selection.confirmRename,
    createNewItem: selection.createNewItem,
  });

  const drag = useFileBrowserDrag({
    selectedEntries: selection.selectedEntries,
    currentPath: dataSource.currentPath,
    componentRef: options.componentRef,
    isEntrySelected: selection.isEntrySelected,
    replaceSelection: selection.replaceSelection,
    entriesContainerRef,
    disableBackgroundDrop: isExternalMode,
    onDrop: async (items, destinationPath, operation) => {
      clipboardStore.isToolbarSuppressed = true;

      if (operation === 'copy') {
        selection.copyItems(items);
      }
      else {
        selection.cutItems(items);
      }

      const success = await selection.pasteItems(destinationPath);

      if (!success && clipboardStore.hasItems) {
        clipboardStore.clearClipboard();
      }
    },
  });

  const externalDrop = useFileBrowserExternalDrop({
    componentRef: options.componentRef,
    currentPath: dataSource.currentPath,
    entriesContainerRef,
    disableBackgroundDrop: isExternalMode,
    onDrop: (sourcePaths, targetPath, operation) => {
      selection.handleExternalDrop(sourcePaths, targetPath, operation);
    },
  });

  const actions = useFileBrowserActions({
    contextMenu: selection.contextMenu,
    selectedEntries: selection.selectedEntries,
    quickViewStore,
    handleContextMenuAction: selection.handleContextMenuAction,
    openOpenWithDialog: dialogs.openOpenWithDialog,
    handleEntryMouseDown: selection.handleEntryMouseDown,
    handleEntryMouseUp: selection.handleEntryMouseUp,
    handleDragMouseDown: drag.handleDragMouseDown,
    isDragging: drag.isDragging,
  });

  const keyboardNavDefaults = {
    navigateUp: () => {},
    navigateDown: () => {},
    navigateLeft: () => {},
    navigateRight: () => {},
    openSelected: () => {},
    navigateBack: () => {},
  };

  const keyboardNav = !isExternalMode
    ? useFileBrowserKeyboardNavigation({
        entries: dataSource.entries,
        selectedEntries: selection.selectedEntries,
        layout: options.layout,
        selectEntryByPath: selection.selectEntryByPath,
        goBack: dataSource.goBack,
        openEntry: async (entry) => {
          if (entry.is_dir) {
            await dataSource.navigateToEntry(entry);
          }
          else {
            await dataSource.openFile(entry.path);
          }
        },
        entriesContainerRef,
      })
    : keyboardNavDefaults;

  async function selectFirstEntry() {
    if (dataSource.entries.value.length === 0) return;

    const firstEntry = dataSource.entries.value[0];
    selection.selectEntryByPath(firstEntry.path);
    await nextTick();

    if (entriesContainerRef.value) {
      const element = entriesContainerRef.value.querySelector<HTMLElement>(
        `[data-entry-path="${CSS.escape(firstEntry.path)}"]`,
      );

      if (element) {
        element.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
        element.focus({ preventScroll: true });
      }
    }
  }

  return {
    isExternalMode,

    entries: dataSource.entries,
    currentPath: dataSource.currentPath,
    isDirectoryEmpty: dataSource.isDirectoryEmpty,
    dirContents: dataSource.dirContents,
    isLoading: dataSource.isLoading,
    isRefreshing: dataSource.isRefreshing,
    error: dataSource.error,

    pathInput: dataSource.pathInput,
    canGoBack: dataSource.canGoBack,
    canGoForward: dataSource.canGoForward,
    parentPath: dataSource.parentPath,
    navigateToPath: dataSource.navigateToPath,
    navigateToParent: dataSource.navigateToParent,
    navigateToHome: dataSource.navigateToHome,
    goBack: dataSource.goBack,
    goForward: dataSource.goForward,
    refresh: dataSource.refresh,
    handlePathSubmit: dataSource.handlePathSubmit,
    openFile: dataSource.openFile,

    filterQuery: dataSource.filterQuery,
    isFilterOpen: dataSource.isFilterOpen,
    toggleFilter: dataSource.toggleFilter,
    openFilter: dataSource.openFilter,
    closeFilter: dataSource.closeFilter,

    selectedEntries: selection.selectedEntries,
    contextMenu: selection.contextMenu,
    renameState: selection.renameState,
    isEntrySelected: selection.isEntrySelected,
    clearSelection: selection.clearSelection,
    selectAll: selection.selectAll,
    selectEntryByPath: selection.selectEntryByPath,
    removeFromSelection: selection.removeFromSelection,
    handleEntryContextMenu: selection.handleEntryContextMenu,
    copyItems: selection.copyItems,
    cutItems: selection.cutItems,
    pasteItems: selection.pasteItems,
    deleteItems: selection.deleteItems,
    startRename: selection.startRename,
    conflictDialogState: selection.conflictDialogState,
    handleConflictResolution: selection.handleConflictResolution,
    handleConflictCancel: selection.handleConflictCancel,

    getVideoThumbnail: videoThumbnails.getVideoThumbnail,
    entriesContainerRef,
    setEntriesContainerRef,

    openWithState: dialogs.openWithState,
    newItemDialogState: dialogs.newItemDialogState,
    isRenameDialogOpen: dialogs.isRenameDialogOpen,
    isNewItemDialogOpen: dialogs.isNewItemDialogOpen,
    openOpenWithDialog: dialogs.openOpenWithDialog,
    closeOpenWithDialog: dialogs.closeOpenWithDialog,
    openNewItemDialog: dialogs.openNewItemDialog,
    handleRenameConfirm: dialogs.handleRenameConfirm,
    handleRenameCancel: dialogs.handleRenameCancel,
    handleNewItemConfirm: dialogs.handleNewItemConfirm,
    handleNewItemCancel: dialogs.handleNewItemCancel,

    isDragging: drag.isDragging,
    dragItems: drag.dragItems,
    dragOperationType: drag.operationType,
    dragCursorX: drag.cursorX,
    dragCursorY: drag.cursorY,
    isCrossPaneTarget: drag.isCrossPaneTarget,

    isExternalDragActive: externalDrop.isExternalDragActive,
    externalDragItemCount: externalDrop.externalDragItemCount,
    externalDragOperationType: externalDrop.externalDragOperationType,
    isCurrentDirLocked: externalDrop.isCurrentDirLocked,
    isTargetingEntry: externalDrop.isTargetingEntry,

    onContextMenuAction: actions.onContextMenuAction,
    onEntryMouseDown: actions.onEntryMouseDown,
    onEntryMouseUp: actions.onEntryMouseUp,

    quickView: actions.quickView,
    selectFirstEntry,

    navigateUp: keyboardNav.navigateUp,
    navigateDown: keyboardNav.navigateDown,
    navigateLeft: keyboardNav.navigateLeft,
    navigateRight: keyboardNav.navigateRight,
    openSelected: keyboardNav.openSelected,
    navigateBack: keyboardNav.navigateBack,
  };
}
