// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, computed, nextTick, toRef, onMounted, onUnmounted, watch,
} from 'vue';
import type { Ref, ComputedRef, ComponentPublicInstance } from 'vue';
import type { HostKeyTrustPrompt } from '@/utils/remote-directory';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import {
  registerNavigationProvider,
  unregisterNavigationProvider,
  emitPathChange,
  emitSelectionChange,
} from '@/modules/extensions/context';
import {
  registerNavigateToPath,
  registerOpenNavigatorFile,
  unregisterNavigateToPath,
  unregisterOpenNavigatorFile,
} from '@/modules/extensions/builtin-commands';
import { useScrollRestoration } from '@/composables/use-scroll-restoration';
import type { DirEntry, DirContents } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useFileBrowserNavigation } from './use-file-browser-navigation';
import { useFileBrowserSelection } from './use-file-browser-selection';
import { useFileBrowserEntries } from './use-file-browser-entries';
import { useFileBrowserSearchOptions } from './use-file-browser-search-options';
import { useFileBrowserFilter } from './use-file-browser-filter';
import { useFileBrowserFocus } from './use-file-browser-focus';
import { useFileBrowserDialogs } from './use-file-browser-dialogs';
import { useFileBrowserActions } from './use-file-browser-actions';
import { useFileBrowserKeyboardNavigation } from './use-file-browser-keyboard-navigation';
import { useFileBrowserLifecycle } from './use-file-browser-lifecycle';
import { useFileBrowserLinkMetadata } from './use-file-browser-link-metadata';
import { useFileBrowserItemCounts } from './use-file-browser-item-counts';
import { useFileBrowserDrag } from './use-file-browser-drag';
import { useFileBrowserInternalDropHandler } from './use-file-browser-internal-drop';
import { useFileBrowserExternalDrop } from './use-file-browser-external-drop';
import { useFileBrowserVirtualLayout } from './use-file-browser-virtual-layout';
import { useFileBrowserBoxSelection } from './use-file-browser-box-selection';
import { useNavigatorImageThumbnails } from '@/modules/navigator/composables/use-navigator-image-thumbnails';
// FORK-MODIFICATION 2026-10-20：传输完成后目标那一格要刷新。
import { subscribeRemoteTransferCompleted } from '@/modules/remote/utils/remote-transfer-refresh';
import { useRemoteTransferRefresh } from './use-remote-transfer-refresh';
import { useVideoThumbnails } from './use-video-thumbnails';
import {
  getNavigatorSortSettingsForLayout,
  type NavigatorSortSource,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import { resolveNavigatorFolderSettings } from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import { resolveThumbnailMetrics } from '../utils/file-browser-thumbnail-sizes';

function createNavigatorSortSettingsComputed(
  getSource: () => NavigatorSortSource,
  layout: () => 'list' | 'grid' | 'tree' | undefined,
) {
  return computed(() => getNavigatorSortSettingsForLayout(getSource(), layout()));
}

function shouldApplyNavigatorSort(layout: 'list' | 'grid' | 'tree' | undefined) {
  return layout === 'list' || layout === 'grid';
}

export interface UseFileBrowserOptions {
  tab: () => Tab | undefined;
  layout: () => 'list' | 'grid' | 'tree' | undefined;
  externalEntries?: () => DirEntry[];
  basePath?: () => string;
  onSelectedEntriesChange: (entries: DirEntry[]) => void;
  onCurrentDirEntryChange: (entry: DirEntry | null) => void;
  onOpenEntry: (entry: DirEntry) => void;
  componentRef: Ref<HTMLElement | null>;
  isDefaultPane?: boolean;
  isActivePane?: () => boolean;
  entryDescription?: (entry: DirEntry) => string | undefined;
  scrollStateKey?: () => string | undefined;
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
  navigateToLocations: () => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  handlePathSubmit: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  silentRefresh: () => void;
  // FORK-MODIFICATION 2026-10-18：主机公钥信任流（阶段 2 决策 3）。
  // 非 null 时 file-browser.vue 弹窗等用户决定。
  hostKeyPrompt: Ref<HostKeyTrustPrompt | null>;
  confirmHostKeyTrust: () => Promise<void>;
  dismissHostKeyTrust: () => void;
  filterQuery: Ref<string>;
  isFilterOpen: Ref<boolean>;
  shouldFocusFilterInput: Ref<boolean>;
  toggleFilter: () => void;
  openFilter: () => void;
  focusFilter: () => void;
  clearFilterInputFocusRequest: () => void;
  closeFilter: () => void;
}

function setupNavigationDataSource(
  options: UseFileBrowserOptions,
  onNavigationCleanup: () => void,
): DataSource {
  const userSettingsStore = useUserSettingsStore();
  const dismissalLayerStore = useDismissalLayerStore();
  const globalSearchStore = useGlobalSearchStore();
  const workspacesStore = useWorkspacesStore();

  const navigation = useFileBrowserNavigation(
    options.tab,
    dirEntry => options.onCurrentDirEntryChange(dirEntry),
    onNavigationCleanup,
  );

  const filter = useFileBrowserFilter({
    dismissalLayerStore,
    globalSearchStore,
    currentPath: navigation.currentPath,
    componentRef: options.componentRef,
    isDefaultPane: options.isDefaultPane ?? true,
    isActivePane: options.isActivePane,
    // FORK-MODIFICATION: 反馈 3（2026-10-15）——接管 tab 上的运行期过滤词交接位。
    // 只有工具栏过滤通道的「打开所属目录」会写它；其余 pane 拿到的都是 undefined。
    initialFilterQuery: options.tab?.()?.pendingFilterQuery,
  });

  const appliedFolderSettings = computed(() => resolveNavigatorFolderSettings(
    userSettingsStore.userSettings.navigator,
    navigation.currentPath.value,
  ));
  const showHiddenFiles = computed(() => appliedFolderSettings.value.showHiddenFiles);
  const sortSettings = createNavigatorSortSettingsComputed(
    () => appliedFolderSettings.value,
    options.layout,
  );
  const sortColumn = computed(() => sortSettings.value.column);
  const sortDirection = computed(() => sortSettings.value.direction);
  const applySort = computed(() => shouldApplyNavigatorSort(options.layout()));
  const foldersFirst = computed(() => userSettingsStore.userSettings.navigator.foldersFirst);
  // FORK-MODIFICATION: 需求反馈 3 —— 递归通道的状态（isRecursiveSearching /
  // recursiveSearchUnavailable）目前只在 useFileBrowserEntries 内部用于合并结果，
  // 暂不向上透传：过滤框里没有位置放「正在搜索子目录…」的指示，先不做半成品 UI。
  const {
    entries: filteredEntries,
    isDirectoryEmpty: filteredIsDirectoryEmpty,
  } = useFileBrowserEntries(
    navigation.dirContents,
    filter.filterQuery,
    showHiddenFiles,
    sortColumn,
    sortDirection,
    foldersFirst,
    applySort,
    navigation.currentPath,
  );

  const tabRef = toRef(options.tab);

  useFileBrowserLifecycle({
    tabRef,
    currentPath: navigation.currentPath,
    readDir: navigation.readDir,
    init: navigation.init,
    shouldAddExternalPathToHistory: workspacesStore.consumeCurrentTabPathNavigationRequest,
  });

  return {
    entries: computed(() => filteredEntries.value),
    currentPath: computed(() => navigation.currentPath.value),
    isDirectoryEmpty: computed(() => filteredIsDirectoryEmpty.value),
    dirContents: navigation.dirContents,
    // FORK-MODIFICATION 2026-10-18：主机公钥信任流（阶段 2 决策 3）。
    // 非 null 时 file-browser.vue 弹窗等用户决定。
    hostKeyPrompt: navigation.hostKeyPrompt,
    confirmHostKeyTrust: navigation.confirmHostKeyTrust,
    dismissHostKeyTrust: navigation.dismissHostKeyTrust,
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
    navigateToLocations: navigation.navigateToLocations,
    goBack: navigation.goBack,
    goForward: navigation.goForward,
    refresh: navigation.refresh,
    handlePathSubmit: navigation.handlePathSubmit,
    openFile: navigation.openFile,
    silentRefresh: navigation.silentRefresh,
    filterQuery: filter.filterQuery,
    isFilterOpen: filter.isFilterOpen,
    shouldFocusFilterInput: filter.shouldFocusFilterInput,
    toggleFilter: filter.toggleFilter,
    openFilter: filter.openFilter,
    focusFilter: filter.focusFilter,
    clearFilterInputFocusRequest: filter.clearFilterInputFocusRequest,
    closeFilter: filter.closeFilter,
  };
}

function setupExternalDataSource(options: UseFileBrowserOptions): DataSource {
  const globalSearchStore = useGlobalSearchStore();
  const userSettingsStore = useUserSettingsStore();
  const getEntries = options.externalEntries ?? (() => []);
  const getBasePath = options.basePath ?? (() => '');

  const externalDirContents = computed(() => ({ entries: getEntries() }));
  const showAllEntries = computed(() => true);
  const emptyFilterQuery = ref('');
  const sortSettings = createNavigatorSortSettingsComputed(
    () => userSettingsStore.userSettings.navigator,
    options.layout,
  );
  const sortColumn = computed(() => sortSettings.value.column);
  const sortDirection = computed(() => sortSettings.value.direction);
  const applySort = computed(() => shouldApplyNavigatorSort(options.layout()));
  const foldersFirst = computed(() => userSettingsStore.userSettings.navigator.foldersFirst);
  const {
    entries: sortedEntries,
    isDirectoryEmpty,
  } = useFileBrowserEntries(
    externalDirContents,
    emptyFilterQuery,
    showAllEntries,
    sortColumn,
    sortDirection,
    foldersFirst,
    applySort,
  );

  return {
    entries: sortedEntries,
    currentPath: computed(() => getBasePath()),
    isDirectoryEmpty,
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
    navigateToLocations: async () => {},
    goBack: () => {},
    goForward: () => {},
    refresh: () => {},
    handlePathSubmit: async () => {},
    openFile: async () => {},
    silentRefresh: () => {
      globalSearchStore.search();
    },
    // FORK-MODIFICATION 2026-10-18：外部模式没有导航，也就不存在「为远程目录建连」
    // 这条链路，主机密钥信任流在这里只能是惰性桩。
    // 刻意不是 `undefined`：DataSource 是契约，让调用方不必分支就能安全解构。
    hostKeyPrompt: ref(null),
    confirmHostKeyTrust: async () => {},
    dismissHostKeyTrust: () => {},
    filterQuery: ref(''),
    isFilterOpen: ref(false),
    shouldFocusFilterInput: ref(false),
    toggleFilter: () => {},
    openFilter: () => {},
    focusFilter: () => {},
    clearFilterInputFocusRequest: () => {},
    closeFilter: () => {},
  };
}

export function useFileBrowser(options: UseFileBrowserOptions) {
  const isExternalMode = !!options.externalEntries;
  const quickViewStore = useQuickViewStore();
  const internalDropHandler = useFileBrowserInternalDropHandler();
  const userSettingsStore = useUserSettingsStore();
  const enableBoxSelection = computed(
    () => userSettingsStore.userSettings.navigator.enableBoxSelection,
  );
  const increaseFileViewGaps = computed(
    () => userSettingsStore.userSettings.navigator.increaseFileViewGaps,
  );
  // FORK-MODIFICATION: 框选命中测试必须和虚拟布局用同一档位的最小列宽，
  // 否则列数变了框选还会按旧列宽选到另一张卡片。
  const thumbnailMetrics = computed(
    () => resolveThumbnailMetrics(userSettingsStore.userSettings.navigator.thumbnailSize),
  );

  const dataSource = isExternalMode
    ? setupExternalDataSource(options)
    : setupNavigationDataSource(options, () => {
        selection.clearSelection();
        selection.resetMouseState();
        boxSelection.stopBoxSelection();
      });
  const visualEntries = computed(() => dataSource.entries.value);

  let openPropertiesForSelection: (entries: DirEntry[]) => void = () => {};

  // FORK-MODIFICATION: 「添加到收藏」要多一步选分类，而分类对话框挂在 file-browser.vue 上，
  // selection 自己拿不到。与 openPropertiesForSelection 同一套「先占位、后回填」的接法。
  let openFavoriteCategoryDialogForSelection: (entries: DirEntry[]) => void = () => {};

  const selection = useFileBrowserSelection(
    visualEntries,
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
    (entries) => {
      openPropertiesForSelection(entries);
    },
    (entries) => {
      openFavoriteCategoryDialogForSelection(entries);
    },
    dataSource.silentRefresh,
    options.layout,
  );

  const virtualLayout = useFileBrowserVirtualLayout({
    entries: visualEntries,
    layout: options.layout,
    entryDescription: options.entryDescription,
    increaseFileViewGaps: () => increaseFileViewGaps.value,
    thumbnailSize: () => userSettingsStore.userSettings.navigator.thumbnailSize,
  });
  const scrollStateKey = computed(() => options.scrollStateKey?.());

  useScrollRestoration({
    stateKey: scrollStateKey,
    scrollContainerRef: virtualLayout.scrollViewportRef,
    setScrollTop: virtualLayout.setScrollTop,
    restoreTriggers: [dataSource.isLoading, virtualLayout.totalSize],
  });

  const linkMetadata = useFileBrowserLinkMetadata({
    enabled: !isExternalMode,
    currentPath: dataSource.currentPath,
    directoryEntries: computed(() => dataSource.dirContents.value?.entries ?? []),
    visibleRows: virtualLayout.visibleRows,
    layout: options.layout,
  });
  useFileBrowserItemCounts({
    enabled: !isExternalMode,
    currentPath: dataSource.currentPath,
    directoryEntries: computed(() => dataSource.dirContents.value?.entries ?? []),
    visibleRows: virtualLayout.visibleRows,
    layout: options.layout,
  });

  const { entriesContainerRef, setEntriesContainerRef: setFocusEntriesContainerRef } = useFileBrowserFocus({
    entries: visualEntries,
    pendingFocusRequest: selection.pendingFocusRequest,
    currentPath: dataSource.currentPath,
    selectEntryByPath: selection.selectEntryByPath,
    clearPendingFocusRequest: selection.clearPendingFocusRequest,
    scrollToPath: virtualLayout.scrollToPath,
    getEntryElement: virtualLayout.getEntryElement,
  });

  function setEntriesContainerRef(element: Element | ComponentPublicInstance | null) {
    setFocusEntriesContainerRef(element);
    virtualLayout.scheduleViewportSizeUpdate();
  }

  const videoThumbnails = !isExternalMode
    ? useVideoThumbnails()
    : {
        getVideoThumbnail: () => undefined,
        cancelVideoThumbnail: () => undefined,
        clearThumbnails: () => undefined,
      };
  const imageThumbnails = !isExternalMode
    ? useNavigatorImageThumbnails()
    : {
        getImageThumbnail: () => undefined,
        getImageThumbnailPlaceholder: () => undefined,
        shouldShowImageThumbnailFallback: () => true,
        cancelImageThumbnail: () => undefined,
        clearThumbnails: () => undefined,
      };

  const dialogs = useFileBrowserDialogs({
    renameState: selection.renameState,
    cancelRename: selection.cancelRename,
    confirmRename: selection.confirmRename,
    createNewItem: selection.createNewItem,
    // FORK-MODIFICATION 2026-10-20：远程「新建空文件」是永久非目标，
    // 守卫要靠这一格当前所在目录判断目标是远程还是本地。
    currentPath: dataSource.currentPath,
  });

  // selection 必须早于 dialogs 创建（dialogs 依赖 selection 的 renameState），
  // 所以打开批量改名对话框的回调在这里后填。
  selection.setOpenBatchRenameDialogHandler(dialogs.openBatchRenameDialog);

  const drag = useFileBrowserDrag({
    selectedEntries: selection.selectedEntries,
    currentPath: dataSource.currentPath,
    componentRef: options.componentRef,
    isEntrySelected: selection.isEntrySelected,
    replaceSelection: selection.replaceSelection,
    entriesContainerRef,
    disableBackgroundDrop: isExternalMode,
    fallbackDropHandler: internalDropHandler,
    onDrop: async (items, destinationPath, operation) => {
      await selection.handleExternalDrop(
        items.map(item => item.path),
        destinationPath,
        operation,
      );
    },
  });

  const boxSelection = useFileBrowserBoxSelection({
    enabled: enableBoxSelection,
    layout: options.layout,
    paneElementRef: options.componentRef,
    scrollViewportRef: virtualLayout.scrollViewportRef,
    entriesContainerRef,
    viewportWidth: virtualLayout.viewportWidth,
    virtualContentOffset: virtualLayout.virtualContentOffset,
    scrollTop: virtualLayout.scrollTop,
    virtualRows: virtualLayout.rows,
    increaseFileViewGaps,
    gridMinColumnWidth: computed(() => thumbnailMetrics.value.gridMinColumnWidth),
    getSelectedEntries: () => selection.selectedEntries.value,
    applySelection: selection.setSelection,
    clearSelection: selection.clearSelection,
    isFileDragActive: drag.isDragging,
  });

  const externalDrop = useFileBrowserExternalDrop({
    componentRef: options.componentRef,
    currentPath: dataSource.currentPath,
    entriesContainerRef,
    disableBackgroundDrop: isExternalMode,
    onDrop: (sourcePaths, targetPath, operation) => {
      selection.handleExternalDrop(sourcePaths, targetPath, operation);
    },
    onUrlDrop: (urls, targetPath) => {
      selection.handleExternalUrlDrop(urls, targetPath);
    },
  });

  // FORK-MODIFICATION: 需求反馈 2 —— 搜索选项在这里单独建一份，供工具栏的选项面板读写。
  // useFileBrowserEntries 内部也建了一份，但那份只用于**过滤**，不用于 UI：
  // 让 UI 拿「过滤实际用的那份」而不是另取一遍，避免以后有人改了其中一处忘了另一处，
  // 于是面板上的勾和列表里的结果对不上（那种 bug 从界面上完全看不出来）。
  const fileBrowserSearch = useFileBrowserSearchOptions();

  const actions = useFileBrowserActions({
    contextMenu: selection.contextMenu,
    selectedEntries: selection.selectedEntries,
    visibleEntries: visualEntries,
    quickViewStore,
    handleContextMenuAction: selection.handleContextMenuAction,
    openOpenWithDialog: dialogs.openOpenWithDialog,
    handleEntryMouseDown: selection.handleEntryMouseDown,
    handleEntryMouseUp: selection.handleEntryMouseUp,
    handleDragMouseDown: drag.handleDragMouseDown,
    isDragging: drag.isDragging,
    // FORK-MODIFICATION: 反馈 3 ——「打开所属目录」要把过滤词交给拆出来的右格。
    getFilterQuery: () => dataSource.filterQuery.value,
  });

  openPropertiesForSelection = (entries) => {
    void actions.openProperties(entries);
  };

  openFavoriteCategoryDialogForSelection = (entries) => {
    dialogs.openFavoriteCategoryDialog(entries);
  };

  const keyboardNav = useFileBrowserKeyboardNavigation({
    entries: visualEntries,
    selectedEntries: selection.selectedEntries,
    lastSelectedEntry: selection.lastSelectedEntry,
    focusedEntry: selection.focusedEntry,
    layout: options.layout,
    selectEntryByPath: selection.selectEntryByPath,
    selectRange: selection.selectRange,
    scrollToPath: virtualLayout.scrollToPath,
    getEntryElement: virtualLayout.getEntryElement,
    getGridNavigationEntry: virtualLayout.getGridNavigationEntry,
    goBack: dataSource.goBack,
    openEntry: isExternalMode
      ? (entry) => { options.onOpenEntry(entry); }
      : async (entry) => {
        if (entry.is_dir) {
          await dataSource.navigateToEntry(entry);
        }
        else {
          await dataSource.openFile(entry.path);
        }
      },
    entriesContainerRef,
  });

  async function selectFirstEntry() {
    if (visualEntries.value.length === 0) return;

    const firstEntry = visualEntries.value[0];
    selection.selectEntryByPath(firstEntry.path);
    await virtualLayout.scrollToPath(firstEntry.path);
    await nextTick();

    const element = virtualLayout.getEntryElement(firstEntry.path);

    if (element) {
      element.focus({ preventScroll: true });
    }
  }

  function handleVirtualScroll(event: Event) {
    virtualLayout.handleScroll(event);

    if (externalDrop.isExternalDragActive.value) {
      externalDrop.refreshDropTargets();
    }
  }

  async function applyFilteredFirstEntrySelection(entries: DirEntry[], isCancelled: () => boolean) {
    await nextTick();

    if (isCancelled()) {
      return;
    }

    if (entries.length === 0) {
      selection.clearSelection();
      return;
    }

    const firstEntry = entries[0];
    selection.selectEntryByPath(firstEntry.path);
    await virtualLayout.scrollToPath(firstEntry.path);
  }

  watch([dataSource.filterQuery, visualEntries], ([filterQuery, entries], _oldValue, onCleanup) => {
    let isCancelled = false;

    onCleanup(() => {
      isCancelled = true;
    });

    if (!filterQuery.trim()) {
      return;
    }

    if (selection.pendingFocusRequest.value != null) {
      return;
    }

    applyFilteredFirstEntrySelection(entries, () => isCancelled);
  });

  // FORK-MODIFICATION 2026-10-20：这一格对「传输完成」通知的反应。
  //
  // 用 silentRefresh：这一格此刻多半不是当前格，插一个加载圈反而吓人，
  // 而内容该更新还是要更新。
  const transferRefresh = useRemoteTransferRefresh({
    currentPath: () => dataSource.currentPath.value,
    refresh: dataSource.silentRefresh,
  });

  if (!isExternalMode) {
    // FORK-MODIFICATION 2026-10-20：订阅「传输完成」通知。
    //
    // 上传到远程 / 下载到本地之后，**对面那一格**要重新读一次目录，
    // 否则新传过去的文件要等用户手动刷新才出现（用户 2026-10-20 反馈）。
    //
    // 通知里只有目标目录的路径；这一格自己判断「这是不是我现在所在的目录」——
    // 是才刷。判定在 `remote-transfer-refresh.ts` 里，理由也写在那儿。
    let unsubscribeTransferRefresh: (() => void) | null = null;

    onMounted(() => {
      registerNavigationProvider({
        getCurrentPath: () => dataSource.currentPath.value || null,
        getSelectedEntries: () => selection.selectedEntries.value,
      });

      registerNavigateToPath(dataSource.navigateToPath);
      registerOpenNavigatorFile(dataSource.openFile);

      unsubscribeTransferRefresh = subscribeRemoteTransferCompleted(
        transferRefresh.handleTransferCompleted,
      );
    });

    onUnmounted(() => {
      imageThumbnails.clearThumbnails();
      videoThumbnails.clearThumbnails();
      unregisterNavigationProvider();
      unregisterNavigateToPath();
      unregisterOpenNavigatorFile();
      unsubscribeTransferRefresh?.();
      unsubscribeTransferRefresh = null;
    });

    watch(dataSource.currentPath, (newPath) => {
      imageThumbnails.clearThumbnails();
      videoThumbnails.clearThumbnails();
      emitPathChange(newPath);
    });

    watch(selection.selectedEntries, (newSelection) => {
      emitSelectionChange(newSelection);
    }, { deep: true });
  }

  // FORK-MODIFICATION: 「打开所属目录」只在搜索结果视图里有意义 —— 那里条目的父目录不在当前视图内。
  // 两条搜索通道都算：externalEntries（全局搜索结果）与工具栏快速过滤（目录搜索）。
  const isSearchResultsView = computed(() => {
    return isExternalMode || !!dataSource.filterQuery.value.trim();
  });

  return {
    isExternalMode,
    isSearchResultsView,

    entries: visualEntries,
    currentPath: dataSource.currentPath,
    isDirectoryEmpty: dataSource.isDirectoryEmpty,
    dirContents: dataSource.dirContents,
    isLoading: dataSource.isLoading,
    isLinkMetadataLoading: linkMetadata.isLinkMetadataLoading,
    isRefreshing: dataSource.isRefreshing,
    error: dataSource.error,

    pathInput: dataSource.pathInput,
    canGoBack: dataSource.canGoBack,
    canGoForward: dataSource.canGoForward,
    parentPath: dataSource.parentPath,
    navigateToPath: dataSource.navigateToPath,
    navigateToParent: dataSource.navigateToParent,
    navigateToHome: dataSource.navigateToHome,
    navigateToLocations: dataSource.navigateToLocations,
    goBack: dataSource.goBack,
    goForward: dataSource.goForward,
    refresh: dataSource.refresh,
    handlePathSubmit: dataSource.handlePathSubmit,
    openFile: dataSource.openFile,

    // FORK-MODIFICATION 2026-10-18：主机公钥信任流（阶段 2 决策 3）。
    hostKeyPrompt: dataSource.hostKeyPrompt,
    confirmHostKeyTrust: dataSource.confirmHostKeyTrust,
    dismissHostKeyTrust: dataSource.dismissHostKeyTrust,

    filterQuery: dataSource.filterQuery,
    isFilterOpen: dataSource.isFilterOpen,
    shouldFocusFilterInput: dataSource.shouldFocusFilterInput,
    toggleFilter: dataSource.toggleFilter,
    openFilter: dataSource.openFilter,
    focusFilter: dataSource.focusFilter,
    clearFilterInputFocusRequest: dataSource.clearFilterInputFocusRequest,
    closeFilter: dataSource.closeFilter,

    // FORK-MODIFICATION: 需求反馈 2 —— 与全局搜索同款的搜索选项（面板 + 写侧）。
    searchOptions: fileBrowserSearch.searchOptions,
    setIncludeFiles: fileBrowserSearch.setIncludeFiles,
    setIncludeDirectories: fileBrowserSearch.setIncludeDirectories,
    setExactMatch: fileBrowserSearch.setExactMatch,
    setTypoTolerance: fileBrowserSearch.setTypoTolerance,
    setResultLimit: fileBrowserSearch.setResultLimit,

    selectedEntries: selection.selectedEntries,
    contextMenu: selection.contextMenu,
    renameState: selection.renameState,
    isEntrySelected: selection.isEntrySelected,
    clearSelection: selection.clearSelection,
    selectAll: selection.selectAll,
    selectEntryByPath: selection.selectEntryByPath,
    requestFocusEntryAfterRefresh: selection.requestFocusEntryAfterRefresh,
    armFocusRevealStaleRestoreGuard: selection.armFocusRevealStaleRestoreGuard,
    removeFromSelection: selection.removeFromSelection,
    handleEntryFocus: selection.handleEntryFocus,
    handleEntryContextMenu: selection.handleEntryContextMenu,
    handleBackgroundContextMenu: selection.handleBackgroundContextMenu,
    closeContextMenu: selection.closeContextMenu,
    copyItems: selection.copyItems,
    cutItems: selection.cutItems,
    createLinksForEntries: selection.createLinksForEntries,
    pasteItems: selection.pasteItems,
    deleteItems: selection.deleteItems,
    startRename: selection.startRename,
    conflictDialogState: selection.conflictDialogState,
    handleConflictResolution: selection.handleConflictResolution,
    handleConflictCancel: selection.handleConflictCancel,
    topLevelNameConflictDialogState: selection.topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename: selection.handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge: selection.handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel: selection.handleTopLevelNameConflictCancel,
    permanentDeleteConfirm: selection.permanentDeleteConfirm,
    // FORK-MODIFICATION 2026-10-20：远程删除的确认框状态。
    remoteDeleteConfirm: selection.remoteDeleteConfirm,

    getImageThumbnail: imageThumbnails.getImageThumbnail,
    getImageThumbnailPlaceholder: imageThumbnails.getImageThumbnailPlaceholder,
    shouldShowImageThumbnailFallback: imageThumbnails.shouldShowImageThumbnailFallback,
    cancelImageThumbnail: imageThumbnails.cancelImageThumbnail,
    getVideoThumbnail: videoThumbnails.getVideoThumbnail,
    cancelVideoThumbnail: videoThumbnails.cancelVideoThumbnail,
    entriesContainerRef,
    setEntriesContainerRef,
    setScrollViewportRef: virtualLayout.setScrollViewportRef,
    handleVirtualScroll,
    virtualRows: virtualLayout.rows,
    visibleVirtualRows: virtualLayout.visibleRows,
    activeGridSectionRow: virtualLayout.activeGridSectionRow,
    virtualTotalSize: virtualLayout.totalSize,
    virtualOffsetY: virtualLayout.offsetY,
    virtualSpacerStyle: virtualLayout.spacerStyle,
    virtualWindowStyle: virtualLayout.windowStyle,
    virtualGridColumnCount: virtualLayout.gridColumnCount,

    openWithState: dialogs.openWithState,
    newItemDialogState: dialogs.newItemDialogState,
    isRenameDialogOpen: dialogs.isRenameDialogOpen,
    isNewItemDialogOpen: dialogs.isNewItemDialogOpen,
    isBatchRenameDialogOpen: dialogs.isBatchRenameDialogOpen,
    batchRenameState: dialogs.batchRenameState,
    favoriteCategoryDialogState: dialogs.favoriteCategoryDialogState,
    isFavoriteCategoryDialogOpen: dialogs.isFavoriteCategoryDialogOpen,
    openOpenWithDialog: dialogs.openOpenWithDialog,
    closeOpenWithDialog: dialogs.closeOpenWithDialog,
    openNewItemDialog: dialogs.openNewItemDialog,
    openBatchRenameDialog: dialogs.openBatchRenameDialog,
    closeBatchRenameDialog: dialogs.closeBatchRenameDialog,
    openFavoriteCategoryDialog: dialogs.openFavoriteCategoryDialog,
    closeFavoriteCategoryDialog: dialogs.closeFavoriteCategoryDialog,
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
    isUrlDrop: externalDrop.isUrlDrop,
    isCurrentDirLocked: externalDrop.isCurrentDirLocked,
    isTargetingEntry: externalDrop.isTargetingEntry,

    onContextMenuAction: actions.onContextMenuAction,
    onEntryMouseDown: actions.onEntryMouseDown,
    onEntryMouseUp: actions.onEntryMouseUp,
    handleEntriesContainerPointerDown: boxSelection.handleEntriesContainerPointerDown,
    increaseFileViewGaps,

    quickView: actions.quickView,
    printEntry: actions.printEntry,
    openProperties: actions.openProperties,
    performSelectionAction: selection.performSelectionAction,
    selectFirstEntry,

    navigateUp: keyboardNav.navigateUp,
    navigateDown: keyboardNav.navigateDown,
    navigateLeft: keyboardNav.navigateLeft,
    navigateRight: keyboardNav.navigateRight,
    openSelected: keyboardNav.openSelected,
  };
}
