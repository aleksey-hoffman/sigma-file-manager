<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  markRaw,
  ref,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
  type Ref,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { TabBar } from '@/modules/tab-bar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useDismissalLayerStore } from '@/stores/runtime/dismissal-layer';
import { useFolderTreeStore } from '@/stores/runtime/folder-tree';
import { useDrives } from '@/modules/home/composables/use-drives';
import FileBrowserTreeView from '@/modules/navigator/components/file-browser/file-browser-tree-view.vue';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { useShortcutsStore, getSelectedTextForCopy } from '@/stores/runtime/shortcuts';
import { toast, ToastStatic } from '@/components/ui/toaster';
import {
  getVirtualLocationActionContext,
  resolveDuplicateCurrentTabShortcutTarget,
} from '@/utils/virtual-location-action-target';
import { blurFocusedDirEntry } from '@/modules/navigator/utils/blur-focused-dir-entry';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useNavigatorSelectionStore } from '@/stores/runtime/navigator-selection';
import { FileBrowser } from '@/modules/navigator/components/file-browser';
import type { AddressBarEditorMode } from '@/modules/navigator/components/file-browser/address-bar-editor-utils';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import FileBrowserTopLevelConflictDialog from '@/modules/navigator/components/file-browser/file-browser-top-level-conflict-dialog.vue';
import FileBrowserDragOverlay from '@/modules/navigator/components/file-browser/file-browser-drag-overlay.vue';
import { useActiveFileBrowserDragState } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag';
import { provideFileBrowserInternalDropHandler } from '@/modules/navigator/components/file-browser/composables/use-file-browser-internal-drop';
import { InfoPanel } from '@/modules/navigator/components/info-panel';
import {
  consumeNavigatorLayoutResetPending,
  useInfoPanelLayout,
} from '@/modules/navigator/components/info-panel/composables/use-info-panel-layout';
import { NavigatorToolbarActions } from '@/modules/navigator/components/navigator-toolbar-actions';
import { ClipboardToolbar } from '@/modules/navigator/components/clipboard-toolbar';
import { GlobalSearchView } from '@/modules/global-search';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import { useNavigatorFolderSettings } from '@/modules/navigator/composables/use-navigator-folder-settings';

import { useIsSmallScreen } from '@/composables/use-responsive-query';
import { useFileDropOperation } from '@/composables/use-file-drop-operation';
import { provideNavigatorImageThumbnails } from '@/modules/navigator/composables/use-navigator-image-thumbnails';
import { arePathsEquivalent, getParentPath } from '@/utils/file-operation-paths';
// FORK-MODIFICATION 2026-10-19：同步前先探目标是否存在（它有远程分支）。
import { resolveDirEntry } from '@/utils/virtual-locations';
// FORK-MODIFICATION 2026-10-19：跨族对应关系表只记跨族，同族要判出来。
import { isRemotePath, parseRemotePath } from '@/utils/remote-paths';
// FORK-MODIFICATION 2026-10-19：目录树切远程时要按连接定根、用连接名当标签。
import { resolveTreeActivePath, resolveTreeRoots, shouldDriveTreeSelection, type TreeConnectionInfo } from '@/modules/navigator/utils/remote-tree-roots';
// FORK-MODIFICATION: 本地 ↔ 远程传输。导航器是**唯一**知道两格分别在哪儿的地方，
// 所以传输目标（对面那一格）的登记也放在这里写。
import { setRemoteTransferTargets } from '@/modules/remote/utils/remote-transfer-targets';
import { useRemotePermissionsDialogState } from '@/modules/remote/utils/remote-permissions-dialog-state';
import RemotePermissionsDialog from '@/modules/remote/components/remote-permissions-dialog.vue';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';
import {
  decideLinkedPaneGate,
  planLinkedPaneNavigation,
  recordLinkedPanePair,
  type LinkedPanePairs,
  type LinkedPanePosition,
  type LinkedPaneTarget,
} from '@/modules/navigator/utils/linked-split-sync';
import { getPathDisplayName } from '@/utils/normalize-path';

type FileBrowserInstance = InstanceType<typeof FileBrowser> & {
  rootElement?: HTMLElement | null;
  filterQuery?: string;
  isFilterOpen?: boolean;
  currentPath?: string;
  selectedEntries?: Ref<DirEntry[]> | DirEntry[];
  focusFilter?: () => void;
  openAddressBarEditor?: (mode: AddressBarEditorMode) => void;
  openCopiedPath?: () => Promise<boolean>;
  navigateToPath?: (path: string) => Promise<void>;
  openFile?: (path: string) => Promise<void>;
  refresh?: () => void | Promise<void>;
  requestFocusEntryAfterRefresh?: (parentDirectoryPath: string, entryPath: string) => void;
  startRename?: (entry: DirEntry) => void;
  selectFirstEntry?: () => Promise<void>;
  navigateUp?: () => void;
  navigateDown?: () => void;
  navigateLeft?: () => void;
  navigateRight?: () => void;
  openSelected?: () => void;
  goBack?: () => void | Promise<void>;
  goForward?: () => void | Promise<void>;
  navigateToParent?: () => void | Promise<void>;
  openNewItemDialog?: (type: 'file' | 'directory') => void;
  printEntry?: (entry?: DirEntry) => Promise<void>;
  openProperties?: (entries: DirEntry[]) => Promise<void>;
  performSelectionAction?: (action: ContextMenuAction) => void;
};

type GlobalSearchViewInstance = InstanceType<typeof GlobalSearchView> & {
  getActiveFileBrowser?: () => FileBrowserInstance | undefined;
  clearSelections?: () => void;
};

const workspacesStore = useWorkspacesStore();
const clipboardStore = useClipboardStore();
const dismissalLayerStore = useDismissalLayerStore();
const folderTreeStore = useFolderTreeStore();
// FORK-MODIFICATION 2026-10-19：树根标签要用连接名。
const remoteConnectionsStore = useRemoteConnectionsStore();
const globalSearchStore = useGlobalSearchStore();
const shortcutsStore = useShortcutsStore();
const terminalsStore = useTerminalsStore();
const dirSizesStore = useDirSizesStore();
provideNavigatorImageThumbnails();
const navigatorSelectionStore = useNavigatorSelectionStore();
const { t } = useI18n();
const activeFileBrowserDragState = useActiveFileBrowserDragState();
const {
  conflictDialogState: internalDropConflictDialogState,
  handleConflictResolution: handleInternalDropConflictResolution,
  handleConflictCancel: handleInternalDropConflictCancel,
  topLevelNameConflictDialogState: internalDropTopLevelNameConflictDialogState,
  handleTopLevelNameConflictRename: handleInternalDropTopLevelNameConflictRename,
  handleTopLevelNameConflictMerge: handleInternalDropTopLevelNameConflictMerge,
  handleTopLevelNameConflictCancel: handleInternalDropTopLevelNameConflictCancel,
  performDrop: performInternalDrop,
} = useFileDropOperation();

provideFileBrowserInternalDropHandler(async (items, destinationPath, operation) => {
  const didCompleteSuccessfully = await performInternalDrop(
    items.map(item => item.path),
    destinationPath,
    operation,
  );

  if (!didCompleteSuccessfully) {
    return;
  }

  const pathsToRefresh = new Set<string>([destinationPath]);

  if (operation === 'move') {
    for (const item of items) {
      pathsToRefresh.add(getParentPath(item.path));
    }
  }

  await refreshFileBrowsersAtPaths([...pathsToRefresh]);
});

const TEXT_COPY_PREVIEW_MAX_LENGTH = 400;

function truncateTextCopyPreview(text: string): string {
  if (text.length <= TEXT_COPY_PREVIEW_MAX_LENGTH) {
    return text;
  }

  return `${text.slice(0, TEXT_COPY_PREVIEW_MAX_LENGTH)}…`;
}

function getDirectoryDirEntryFromTab(tab: Tab | null | undefined): DirEntry | null {
  if (!tab?.path) {
    return null;
  }

  return {
    name: getPathDisplayName(tab.path) || tab.path,
    path: tab.path,
    is_dir: true,
    is_file: false,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: tab.dirEntries.length > 0 ? tab.dirEntries.length : null,
    ext: null,
    mime: null,
  };
}

const paneRefsMap = ref<Map<string, FileBrowserInstance>>(new Map());
const singlePaneRef = ref<FileBrowserInstance | null>(null);
const globalSearchViewRef = ref<GlobalSearchViewInstance | null>(null);
const isSearchSelectionActive = ref(false);
const {
  layoutSizingKey: infoPanelLayoutSizingKey,
  setInfoPanelWidthPanelRef,
  handleInfoPanelWidthHandleDragging,
  showInfoPanelAnimated,
  hideInfoPanelAnimated,
  isInfoPanelVisibilityAnimating,
  infoPanelWidthDefault,
  infoPanelLayout,
  clearPanelRefs,
  requestLayoutReset,
} = useInfoPanelLayout();

const showInfoPanel = ref(true);
const infoPanelSlideVisible = ref(true);

const mainPanelMinSize = computed(() => {
  return showInfoPanel.value || isInfoPanelVisibilityAnimating.value
    ? infoPanelLayout.MAIN_MIN_WIDTH_PERCENT
    : 100;
});

const isInfoPanelHandleCollapsed = computed(() => {
  if (isInfoPanelVisibilityAnimating.value) {
    return !infoPanelSlideVisible.value;
  }

  return !showInfoPanel.value;
});

const infoPanelTransitionStyle = {
  '--info-panel-visibility-transition-ms': `${infoPanelLayout.SIZE_TRANSITION_MS}ms`,
  '--info-panel-visibility-transition-easing': infoPanelLayout.VISIBILITY_TRANSITION_EASING,
};
const selectedEntries = ref<DirEntry[]>([]);

watch(selectedEntries, (entries) => {
  navigatorSelectionStore.setSelectedDirEntries(entries);
}, { deep: true });

const currentDirEntry = ref<DirEntry | null>(
  getDirectoryDirEntryFromTab(workspacesStore.currentTab),
);
const activeTabId = ref<string | null>(null);
const isSmallScreen = useIsSmallScreen();

// FORK-MODIFICATION 2026-10-19（缺陷修复）：原来「分屏下把当前格的路径同步进
// 目录树 store」这条 watch 就写在这里，引用了**下面 57 行**才声明的 `isSplitView`，
// 又带 `immediate: true` —— Vue 会同步执行 source getter
// （@vue/reactivity `watch()` 里的 `job(true)`），当场命中 TDZ 抛
// `ReferenceError: Cannot access 'isSplitView' before initialization`。
//
// 页面之所以没崩：Vue 把 source getter 包在 `callWithAsyncErrorHandling` 里
// （`reactivity.cjs.js` 的 `return call ? call(s, 2) : s()`），异常被吞成控制台
// 警告。但代价是 `effect.run()` 没跑完，**一个依赖都没被收集** ——
// 这个 watch 从 2026-09-26 建好那天起就彻底是死的。
//
// 表现：分屏下目录树永远不跟着面板走，本地远程都一样，只有手动点树才动
// （那条路在下面 `onTreeEntryActivate` 里，不经过这个 watch）。
// 上一轮只修了 `computeAncestorPaths` 认得远程根，没人调用它，所以看不出变化。
//
// 现在这段挪到 `activeFolderSettingsPath` 声明之后（TDZ 安全），并且把
// 「当前格的路径」也放进 source —— 原版只盯 `activeTabId` 与 `isSplitView`，
// 面板在自己内部导航时 id 根本不变，回调不会触发。

watch(() => workspacesStore.currentTabGroup, (newGroup, oldGroup) => {
  const currentTabIds = new Set(
    workspacesStore.currentTabGroup?.map(tab => tab.id) || [],
  );

  for (const tabId of paneRefsMap.value.keys()) {
    if (!currentTabIds.has(tabId)) {
      paneRefsMap.value.delete(tabId);
    }
  }

  const newPrimaryTabId = newGroup?.[0]?.id;
  const oldPrimaryTabId = oldGroup?.[0]?.id;

  if (oldPrimaryTabId !== undefined && newPrimaryTabId !== oldPrimaryTabId) {
    selectedEntries.value = [];
    currentDirEntry.value = getDirectoryDirEntryFromTab(newGroup?.[0]);

    if (newPrimaryTabId !== undefined) {
      activeTabId.value = newPrimaryTabId;
    }
  }
});

// FORK-MODIFICATION: 拆分视图下「哪个 pane 是当前」有两份状态 ——
// `currentTabIndex` 住在 store 里，`activeTabId` 是本页局部 ref，只有
// `activateTabPane`（用户点面板）才会同时写两者。于是 store 侧被别的代码改动时
// 本页不知情：搜索结果「打开所属目录」（utils/open-navigator-directory.ts 的
// openNavigatorRevealEntry）先 toggleSplitView 再 setCurrentTabIndex(1)，
// activeTabId 却还停在原值，随后 getNavigatorPaneRef 落到 tabGroup[0]，
// 选中就出现在**左侧**面板而不是刚打开的右侧面板。
// 这里把 store 侧的变化同步回来；用户点面板时 activateTabPane 已经写过同样的值，
// 所以这条 watch 只是补上「外部改动」这条路，不会和点击互相打架。
watch(() => workspacesStore.currentTab?.id, (newCurrentTabId) => {
  if (!isSplitView.value || !newCurrentTabId) {
    return;
  }

  activeTabId.value = newCurrentTabId;
});

const infoPanelEntry = computed(() => {
  if (selectedEntries.value.length > 0) {
    return selectedEntries.value[selectedEntries.value.length - 1];
  }

  return currentDirEntry.value;
});

const isSplitView = computed(() => {
  return (workspacesStore.currentTabGroup?.length ?? 0) > 1;
});

const trackNavigatorRelativeTime = computed(() => !globalSearchStore.isOpen);

const currentActivePath = computed(() => {
  return currentDirEntry.value?.path;
});

const activeFolderSettingsPath = computed(() => {
  if (isSplitView.value && activeTabId.value) {
    const activeTab = workspacesStore.currentTabGroup?.find(tab => tab.id === activeTabId.value);

    if (activeTab?.path) {
      return activeTab.path;
    }
  }

  return currentActivePath.value ?? workspacesStore.currentTabGroup?.[0]?.path;
});

/**
 * FORK-MODIFICATION 2026-10-19：当前格的**实时**路径。
 *
 * 不能直接拿 `activeFolderSettingsPath` 展开目录树 —— 它读的是 tab 上的 path，
 * 而本文件自己写着「tab 路径有写盘延迟」（见 `collectLinkedPanePositions`）。
 * 用它的话树会慢一拍，用户看到的就是「停在上一层」。
 *
 * 这里的两个前提让实时路径可读：
 * - `paneRefsMap = ref(new Map())` —— Map 被 reactive 代理，`get` / `set` 都被追踪，
 *   所以窗格挂载与卸载都会让本 computed 重算；
 * - `FileBrowser` 用 `defineExpose({ currentPath: fb.currentPath })` 暴露的是 ref，
 *   Vue 解包后仍保持响应，面板内部导航同样会触发。
 *
 * 窗格还没挂上时退回 tab 路径 —— 慢一拍总比不展开强。
 */
const activePaneLivePath = computed<string | null>(() => {
  if (!isSplitView.value) {
    return null;
  }

  const live = activeTabId.value
    ? paneRefsMap.value.get(activeTabId.value)?.currentPath
    : null;

  return live ?? activeFolderSettingsPath.value ?? null;
});

/**
 * FORK-MODIFICATION 2026-10-19（用户第三次反馈「远程目录树仍然不正常」）：
 * 目录树的**根**与**选中路径**必须用**同一个源**。
 *
 * 之前是两个源：
 * - 根：`activeFolderSettingsPath` —— tab 上的**存档**路径；
 * - 选中路径：`activePaneLivePath` —— 窗格的**实时**路径。
 *
 * 两者不一致时，树会自相矛盾：根是本地盘符、选中路径却是远程的，
 * 于是远程那一层**根本不在树里**，展开与定位都无从谈起。
 * 真机实测（2026-10-19 装机）：切到远程格后，树里还是 Win (C:) / Program (D:) …，
 * 一个都没展开 —— 因为选中路径（远程）压根不在那棵本地树里。
 *
 * 真实路径才是对的：它就是窗格里**当前显示**的目录。
 * 分屏时取窗格实时路径；单格时 `activePaneLivePath` 恒为 null，
 * 退回 tab 路径（= 当前目录），与原来的行为一致。
 */
const treeActivePath = computed<string | undefined>(() => {
  return resolveTreeActivePath(activePaneLivePath.value, activeFolderSettingsPath.value);
});

/**
 * FORK-MODIFICATION 2026-10-19（缺陷修复）：分屏下把当前格的路径同步进目录树 store。
 *
 * 原实现放在 `activeTabId` 正下方（见那里的注释），因 TDZ + `immediate: true`
 * 从建好那天起就没生效过。这里是修好后的版本：
 *
 * - 位置在 `activePaneLivePath` 之后 —— 位置本身就是修复的一半：反向声明会命中 TDZ。
 * - source 跟着**路径**而不是 `activeTabId` —— 面板在自己内部导航时 id 根本不变，
 *   只盯 id 的 watch 永远不会触发。
 * - `isSplitView` 的守卫保留原语义：单格模式不动树（那是上游 v6.2 的原设计）。
 */
watch([isSplitView, treeActivePath], () => {
  if (!isSplitView.value) return;
  folderTreeStore.setSelectedPath(treeActivePath.value ?? null);
}, { immediate: true });

const canUseFolderSettingsForActivePath = computed(() => {
  if (!activeFolderSettingsPath.value) {
    return false;
  }

  const activeTab = workspacesStore.currentTabGroup?.find(tab => tab.id === activeTabId.value)
    ?? workspacesStore.currentTab;

  return activeTab?.type !== 'search';
});

const {
  activePath: folderSettingsActivePath,
  canUseFolderSettings,
  resolveForPath,
} = useNavigatorFolderSettings(
  () => activeFolderSettingsPath.value,
  () => canUseFolderSettingsForActivePath.value,
);

function getLayoutForPath(path: string | undefined): 'list' | 'grid' | 'tree' {
  return resolveForPath(path).layout;
}

const wasSplitViewBeforeSearch = ref(false);

watch(() => globalSearchStore.isOpen, (isOpen) => {
  if (isOpen) {
    wasSplitViewBeforeSearch.value = isSplitView.value;

    if (isSplitView.value) {
      workspacesStore.toggleSplitView();
    }
  }
  else {
    if (wasSplitViewBeforeSearch.value && !isSplitView.value) {
      workspacesStore.toggleSplitView();
    }

    if (isSearchSelectionActive.value) {
      isSearchSelectionActive.value = false;
      selectedEntries.value = [];
    }
  }
});

watch(
  () => [
    workspacesStore.pendingLaunchReveal,
    workspacesStore.currentTab?.id,
  ] as const,
  async () => {
    await nextTick();
    applyPendingLaunchReveal();
  },
  { deep: true },
);

function handleToggleSplitView() {
  if (globalSearchStore.isOpen) return;
  workspacesStore.toggleSplitView();
}

// FORK-MODIFICATION: 工具栏「左右互换」按钮 —— 把分屏两格显示的路径对调。
// 逻辑本体在 store 里（swapSplitPanePaths），这里只做一件事：
// 全局搜索开着时不许换 —— 搜索面板正在用那两个路径，换了会让搜索结果对不上。
function handleSwapSplitPanePaths() {
  if (globalSearchStore.isOpen) return;
  workspacesStore.swapSplitPanePaths();
}

const userSettingsStore = useUserSettingsStore();
const splitViewMode = computed(() => userSettingsStore.userSettings.navigator.splitViewMode);

// FORK-MODIFICATION: sidebar tree (issue #499). Persisted in user settings
// so the toggle state survives restarts. Defaults to true when the key is
// absent.
const showFolderTree = ref(
  userSettingsStore.userSettings.navigator.showFolderTree ?? true,
);
const { drives } = useDrives();

const treeDriveLabels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};

  for (const d of drives.value) {
    if (!d.path) continue;
    const name = d.name?.trim();

    if (name) {
      out[d.path] = name;
    }
    else {
      // No label from Rust — fall back to path basename.
      const parts = d.path.split(/[\\/]+/).filter(Boolean);
      out[d.path] = parts[parts.length - 1] ?? d.path;
    }
  }

  return out;
});

const treeConnections = computed<Record<string, TreeConnectionInfo>>(() => {
  const out: Record<string, TreeConnectionInfo> = {};

  for (const connection of remoteConnectionsStore.connections) {
    out[connection.id] = {
      name: connection.name,
      // 树根要用它 —— 用户 2026-10-19 要求「根显示设置里的远程目录」。
      // 连接表是异步填充的，这里读到的 initialPath 可能暂时是 undefined，
      // 那一轮先退回连接根，等表到位后 computed 重算，根和标签一起纠正。
      initialPath: connection.initialPath,
    };
  }

  return out;
});

// FORK-MODIFICATION 2026-10-19：焦点在远程目录时，目录树切到远程目录树。
// 判定本身在 `remote-tree-roots.ts`（纯函数，可单测），这里只喂数据。
//
// ⚠️ `activePath` 必须与下面 `setSelectedPath` 用的是**同一个** `treeActivePath`：
// 根与选中路径分家时，树会自相矛盾（根是本地、选中路径是远程），
// 远程那一层就不在树里，展开与定位全都无从谈起。
const treeRoots = computed(() => resolveTreeRoots({
  activePath: treeActivePath.value,
  drivePaths: drives.value.map(d => d.path),
  driveLabels: treeDriveLabels.value,
  connectionsById: treeConnections.value,
}));

const treeRootPaths = computed(() => treeRoots.value.rootPaths);
// v6.4: drive volume labels + drive path set so the sidebar tree can show
// "Win (C:)" instead of just "C:" and use a drive icon instead of a
// folder icon for drive roots.
//
// The Rust backend (DriveInfo.name) already includes the drive letter in
// the form "VolumeLabel (X:)" — e.g. "Win (C:)", "Program (D:)". Don't
// append the path again or you get "Win (C:) (C:)" (regression caught
// in v6.4 testing). Use `drive.name` as-is; fall back to the path
// basename for drives without a label.
// FORK-MODIFICATION 2026-10-19：标签跟着根走。远程根用**连接名**（「速豹堂」），
// 否则树里那行只能显示连接 id 的一串 32 位十六进制。
const treeRootLabels = computed<Record<string, string>>(() => treeRoots.value.rootLabels);

const drivePaths = computed<string[]>(() => drives.value.map(d => d.path));

watch(showFolderTree, (next) => {
  void userSettingsStore.set('navigator.showFolderTree', next);
});

function handleToggleFolderTree() {
  showFolderTree.value = !showFolderTree.value;
}

const isLinkedMode = computed(() => splitViewMode.value === 'linked' && isSplitView.value);

/**
 * FORK-MODIFICATION 2026-10-19：同步浏览从「选中驱动」改成「进目录驱动」。
 *
 * 用户实测反馈：按钮点了之后「点击进入本地或远程一个子目录（比如 wp-content)，
 * 另一侧没有同步打开」。两个错都在旧实现里：
 * - 旧实现挂的是 `update:selected-entries`，**选中**才触发。
 *   用户双击进目录时，选中态在导航瞬间被清掉，信号就丢了。
 * - 旧实现硬编码「只有 tabGroup[0]（左格）能驱动」，右格选中什么都被忽略。
 *
 * 现在由 `FileBrowser` 的 `update:currentPath` 驱动（见 file-browser.vue），
 * 谁动谁说了算。
 */

/** 我们刚下发的联动目标。用来识别回声，否则两格会互相触发到停不下来。 */
let pendingLinkedTarget: LinkedPaneTarget | null = null;

/**
 * FORK-MODIFICATION 2026-10-19：每一格**第一次**报上来的路径只算「就位」，不算「用户动了一下」。
 *
 * 用户实测反馈 1 的根因：打开连接时两格各自挂载、各自加载，先后顺序不定。
 * 联动是开着的（`splitViewMode` 持久化了），于是**先加载完的那一格会把刚打开的
 * 路径当成用户操作**，指挥另一格跳到自己路径的最后一段 ——
 * 结果两端都被推离各自配置的默认目录（`localPath` / `initialPath`），
 * 本地那格还撞上一个不存在的子目录。
 *
 * 规则：每一格的首次上报只记账；**两格都记账之后**才开始联动。
 */
const linkedPaneSettledTabIds = new Set<string>();

/**
 * FORK-MODIFICATION 2026-10-19，用户实测反馈 2：「从子目录提升到上一级目录时，
 * 由于建立关联的目录名称不同，无法同步切换」。
 *
 * 跨族只按目录名对齐管不了「上一级」：本地 `wp-content` 的父级是 `E:/website_sbt`，
 * 远端 `wp_root/wp-content` 的父级是 `…/wp_root`，名字根本不同。
 *
 * 这张表由**同步成功的事实**累积而成 —— 不是配置出来的，是两格真的对上过的路径对。
 * 每成功同步一次就记一对（连同它们的父级），点「上一级」时先查它。
 * 语义与边界全在 `linked-split-sync.ts` 里。
 */
const linkedPanePairs: LinkedPanePairs = new Map();

/** 标签组换了（新开一组、切组）就重新记账 —— 旧组的状态对新组没有意义。 */
watch(() => workspacesStore.currentTabGroup?.map(tab => tab.id).join('|'), () => {
  linkedPaneSettledTabIds.clear();
  linkedPanePairs.clear();
  pendingLinkedTarget = null;
});

/**
 * FORK-MODIFICATION 2026-10-19：两格「属于哪一边」的签名 ——
 * 本地格记 `local`，远程格记 `remote:<连接id>`。
 *
 * 只在上面那个「切标签组」的 watch 里清表是不够的：用户**在同一个标签组里**
 * 把远程格换成另一个连接时，tab id 不变，签名也不变，旧连接积累下来的路径对
 * 会继续被查用 —— 下一次同步就把另一格送到**旧连接**的目录去。
 * 那正是这个功能本来要消灭的「跳到错误目录」，只是换了个来源。
 */
watch(
  () => collectLinkedPanePositions()
    .map((pane) => {
      const connectionId = parseRemotePath(pane.path)?.connectionId;

      return connectionId ? `remote:${connectionId}` : 'local';
    })
    .sort()
    .join('|'),
  () => {
    linkedPanePairs.clear();
  },
);

/** 两格窗格各自的当前位置。路径取自窗格实例，而不是 tab —— tab 路径有写盘延迟。 */
function collectLinkedPanePositions(): LinkedPanePosition[] {
  const tabGroup = workspacesStore.currentTabGroup;

  if (!tabGroup) {
    return [];
  }

  return tabGroup.flatMap((tab) => {
    const panePath = paneRefsMap.value.get(tab.id)?.currentPath;

    return panePath
      ? [{
          tabId: tab.id,
          path: panePath,
        }]
      : [];
  });
}

/**
 * 登记「对面那一格」当前在哪儿，供传输类右键菜单（上传 / 下载）取目标。
 *
 * 路径同样取自**窗格实例**（`collectLinkedPanePositions`）而不是 tab ——
 * tab 路径有写盘延迟，用它会把文件传到上一次的目录里去，而那一步没有任何提示。
 */
watch(
  () => collectLinkedPanePositions().map(pane => pane.path).join('|'),
  () => {
    setRemoteTransferTargets(collectLinkedPanePositions().map(pane => pane.path));
  },
  { immediate: true },
);

const remotePermissionsDialog = useRemotePermissionsDialogState();

function handlePaneNavigation(path: string, tabId: string) {
  const tabGroup = workspacesStore.currentTabGroup ?? [];
  const decision = decideLinkedPaneGate({
    isLinkedMode: isLinkedMode.value,
    fromTabId: tabId,
    fromPath: path,
    allTabIds: tabGroup.map(tab => tab.id),
    settledTabIds: linkedPaneSettledTabIds,
    pending: pendingLinkedTarget,
  });

  if (decision === 'echo') {
    pendingLinkedTarget = null;

    return;
  }

  if (decision === 'settle') {
    linkedPaneSettledTabIds.add(tabId);

    return;
  }

  if (decision !== 'sync') {
    return;
  }

  const target = planLinkedPaneNavigation({
    fromTabId: tabId,
    fromPath: path,
    panes: collectLinkedPanePositions(),
    pending: pendingLinkedTarget,
    pairs: linkedPanePairs,
  });

  if (!target) {
    return;
  }

  const navigate = paneRefsMap.value.get(target.tabId)?.navigateToPath;

  if (!navigate) {
    return;
  }

  pendingLinkedTarget = target;

  // FORK-MODIFICATION 2026-10-19：目标不存在就**静默放弃**这次同步。
  //
  // 用户实测反馈 2：另一端没有同名目录时，不该把那一格推到「无法打开此文件夹」。
  // 本地 ↔ 远程按名字对齐，「同名」只是常见情况而不是保证 ——
  // 远端 `wp_root` 里的 `wp-content` 就是个空残桩，本地根本没有对应项。
  //
  // `resolveDirEntry` 已经有远程分支（`statRemoteEntry`），所以这一句两边通用。
  void resolveDirEntry(target.path)
    .then((entry) => {
      if (entry) {
        // 只记真正同步成功过的这一对 —— 对应关系得是事实，不能是猜测。
        // 同族不需要记：那边的规则是「跳到同一个绝对路径」，本来就不靠对应表。
        if (isRemotePath(path) !== isRemotePath(target.path)) {
          recordLinkedPanePair(linkedPanePairs, path, target.path);
        }

        return navigate(target.path);
      }

      pendingLinkedTarget = null;

      return undefined;
    })
    .catch(() => {
      // 探测本身失败（网络断了之类）同样按「放弃同步」处理 ——
      // 宁可不同步，也不要把错误甩到用户脸上。
      pendingLinkedTarget = null;
    });
}

async function handleToggleInfoPanel() {
  if (isSmallScreen.value) {
    showInfoPanel.value = !showInfoPanel.value;
    return;
  }

  if (showInfoPanel.value) {
    infoPanelSlideVisible.value = false;
    await hideInfoPanelAnimated();
    showInfoPanel.value = false;
    return;
  }

  infoPanelSlideVisible.value = true;
  showInfoPanel.value = true;
  await showInfoPanelAnimated();
}

function activateTabPane(tabId: string) {
  const tabIndex = workspacesStore.currentTabGroup?.findIndex(tab => tab.id === tabId) ?? -1;

  activeTabId.value = tabId;

  if (tabIndex >= 0) {
    workspacesStore.setCurrentTabIndex(tabIndex);
  }
}

function handleSelectionChange(entries: DirEntry[], tabId?: string) {
  // FORK-MODIFICATION 2026-10-19：这里原来会 `syncLinkedPane(entries, tabId)`。
  // 同步浏览已改为「进目录驱动」，见 `handlePaneNavigation`。

  if (entries.length > 0) {
    isSearchSelectionActive.value = false;
    globalSearchViewRef.value?.clearSelections?.();
    selectedEntries.value = entries;

    if (tabId) {
      activateTabPane(tabId);

      paneRefsMap.value.forEach((pane, paneTabId) => {
        if (paneTabId !== tabId) {
          pane.clearSelection();
        }
      });
    }
  }
  else if (!isSearchSelectionActive.value && entries.length === 0) {
    if (!tabId || tabId === activeTabId.value || activeTabId.value === null) {
      selectedEntries.value = [];
    }
  }
}

function handleSearchSelectionChange(entries: DirEntry[]) {
  if (entries.length > 0) {
    isSearchSelectionActive.value = true;
    selectedEntries.value = entries;

    paneRefsMap.value.forEach(pane => pane.clearSelection());

    if (singlePaneRef.value) {
      singlePaneRef.value.clearSelection();
    }
  }
  else {
    isSearchSelectionActive.value = false;
    selectedEntries.value = [];
  }
}

function handleCurrentDirChange(entry: DirEntry | null, paneId?: string) {
  currentDirEntry.value = entry;

  // FORK-MODIFICATION: tree sync v6 (issue #499). Drive the folder-tree store
  // directly here so FileBrowserTreeView (which subscribes via storeToRefs)
  // reveals the selected path's ancestor chain without any imperative ref
  // forwarding. Replaces the v0..v5 broken `treeViewRef.value?.expandToPath`
  // chain (see handoff-2026-09-26-tree-sync-retro.md).
  //
  // ⚠️ FORK-MODIFICATION 2026-10-19：只有**当前格**能改写树的选中路径。
  //
  // 分屏时**两个窗格都发**这个事件，而「最后发声的那个」不一定是当前格：
  // 远程格要建连、要读目录，比本地格慢得多，它的 current-dir-entry 后到，
  // 就把树的选中路径改成了**远程**的；而树的**根**跟着当前格走（本地盘符）。
  // 于是树自相矛盾：根是本地、选中路径是远程 —— 远程那层根本不在树里，
  // 树一个都不展开。
  //
  // 真机实测（2026-10-19 装包）：切到远程格后，树里是 Win (C:) / Program (D:) …，
  // 全部折叠，而右格明明是远程目录。
  //
  // 与 `handleSelectionChange` / `handlePaneNavigation` 一样，
  // 这里也必须知道事件来自**哪个**窗格。
  if (!shouldDriveTreeSelection(isSplitView.value, paneId, activeTabId.value)) {
    return;
  }

  folderTreeStore.setSelectedPath(entry?.path ?? null);
}

// FORK-MODIFICATION: sidebar tree handlers (issue #499).
// Activating a tree row navigates the active pane to that path (or its
// parent if the user clicked a leaf file path inside the tree, where the
// tree's root is a directory). Previews open the quick-view window.
function handleTreeActivate(path: string) {
  const pane = getNavigatorPaneRef();
  if (!pane?.navigateToPath) return;
  void pane.navigateToPath(path);
}

function handleTreePreview(path: string) {
  // The sidebar tree emits 'preview' only for file rows (file-browser-tree-view
  // emits activate for directories and preview for leaf files). Open quick
  // view for the file.
  const quickViewStore = useQuickViewStore();
  void quickViewStore.toggleQuickView(path);
}

function handlePaneFocus(tabId: string) {
  activateTabPane(tabId);
  syncActivePaneSelectionToGlobal();
}

function setPaneRef(element: FileBrowserInstance | null, tabId: string) {
  if (element) {
    paneRefsMap.value.set(tabId, element);
    applyPendingLaunchReveal();
  }
  else {
    paneRefsMap.value.delete(tabId);
  }
}

async function refreshFileBrowsersAtPaths(directoryPaths: string[]) {
  if (directoryPaths.length === 0) {
    return;
  }

  const seenPanes = new Set<FileBrowserInstance>();
  const refreshTasks: Promise<unknown>[] = [];

  function scheduleRefresh(pane: FileBrowserInstance | null | undefined) {
    if (!pane?.refresh || !pane.currentPath) {
      return;
    }

    const matchesPath = directoryPaths.some(directoryPath =>
      arePathsEquivalent(pane.currentPath!, directoryPath),
    );

    if (!matchesPath || seenPanes.has(pane)) {
      return;
    }

    seenPanes.add(pane);
    refreshTasks.push(
      Promise.resolve(pane.refresh()).catch((error: unknown) => {
        console.error('File browser refresh failed:', error);
      }),
    );
  }

  for (const pane of paneRefsMap.value.values()) {
    scheduleRefresh(pane);
  }

  scheduleRefresh(singlePaneRef.value);

  await Promise.all(refreshTasks);
}

function getFocusedSplitPaneRef(): FileBrowserInstance | undefined {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement)) {
    return undefined;
  }

  for (const pane of paneRefsMap.value.values()) {
    if (pane.rootElement?.contains(activeElement)) {
      return pane;
    }
  }

  return undefined;
}

function getNavigatorPaneRef(): FileBrowserInstance | undefined {
  if (!isSplitView.value) {
    const currentTabId = workspacesStore.currentTabGroup?.[0]?.id;

    if (currentTabId && paneRefsMap.value.has(currentTabId)) {
      return paneRefsMap.value.get(currentTabId);
    }

    return singlePaneRef.value || undefined;
  }

  const focusedPane = getFocusedSplitPaneRef();

  if (focusedPane) {
    return focusedPane;
  }

  if (activeTabId.value && paneRefsMap.value.has(activeTabId.value)) {
    return paneRefsMap.value.get(activeTabId.value);
  }

  const firstCurrentTabId = workspacesStore.currentTabGroup?.[0]?.id;

  if (firstCurrentTabId && paneRefsMap.value.has(firstCurrentTabId)) {
    return paneRefsMap.value.get(firstCurrentTabId);
  }

  return undefined;
}

function applyPendingLaunchReveal() {
  const pendingLaunchReveal = workspacesStore.pendingLaunchReveal;

  if (!pendingLaunchReveal) {
    return;
  }

  const pane = getNavigatorPaneRef();

  if (!pane?.requestFocusEntryAfterRefresh) {
    return;
  }

  pane.requestFocusEntryAfterRefresh(
    pendingLaunchReveal.parentPath,
    pendingLaunchReveal.entryPath,
  );
  workspacesStore.clearPendingLaunchReveal();
}

function getActivePaneRef(): FileBrowserInstance | undefined {
  if (isSearchSelectionActive.value && globalSearchStore.isOpen) {
    const searchFileBrowser = globalSearchViewRef.value?.getActiveFileBrowser?.();

    if (searchFileBrowser) {
      return searchFileBrowser;
    }
  }

  return getNavigatorPaneRef();
}

function readPaneSelectedEntries(pane: FileBrowserInstance): DirEntry[] {
  const paneSelection = pane.selectedEntries as Ref<DirEntry[]> | DirEntry[] | undefined;

  if (!paneSelection) {
    return [];
  }

  if (Array.isArray(paneSelection)) {
    return [...paneSelection];
  }

  return [...paneSelection.value];
}

function syncActivePaneSelectionToGlobal() {
  const pane = getActivePaneRef();

  if (!pane) {
    return;
  }

  selectedEntries.value = readPaneSelectedEntries(pane);
}

function getActivePaneSelectedEntries(): DirEntry[] {
  const pane = getActivePaneRef();

  if (pane) {
    return readPaneSelectedEntries(pane);
  }

  return selectedEntries.value;
}

function getNavigatorActionContext(currentDirectoryPath?: string) {
  return getVirtualLocationActionContext(
    getActivePaneSelectedEntries(),
    currentDirectoryPath ?? getActiveCurrentPath(),
  );
}

function getTabGroupFallbackPath(): string | undefined {
  if (isSplitView.value && activeTabId.value) {
    const activeTab = workspacesStore.currentTabGroup?.find(
      tab => tab.id === activeTabId.value,
    );

    if (activeTab?.path) {
      return activeTab.path;
    }
  }

  return workspacesStore.currentTabGroup?.[0]?.path;
}

function getActiveCurrentPath(): string | undefined {
  const pane = getActivePaneRef();

  if (pane?.currentPath) {
    return pane.currentPath;
  }

  return getTabGroupFallbackPath();
}

function getPasteTargetPath(): string | undefined {
  const currentPath = getActiveCurrentPath();
  const actionContext = getNavigatorActionContext(currentPath);

  if (actionContext.isBrowsingVirtualLocations) {
    return actionContext.actionDirectoryPath ?? undefined;
  }

  return currentPath;
}

async function handleGlobalSearchOpenEntry(entry: DirEntry) {
  const pane = getNavigatorPaneRef();
  if (!pane) return;

  if (entry.is_dir && pane.navigateToPath) {
    await pane.navigateToPath(entry.path);
  }
  else if (entry.is_file && pane.openFile) {
    await pane.openFile(entry.path);
  }
}

function handleFilterShortcut() {
  const pane = getActivePaneRef();

  if (pane) {
    pane.focusFilter?.();
  }
}

function openAddressBarEditor(mode: AddressBarEditorMode): boolean {
  const pane = getNavigatorPaneRef();

  if (!pane?.openAddressBarEditor) {
    return false;
  }

  pane.openAddressBarEditor(mode);
  return true;
}

async function handleReloadShortcut() {
  const pane = getActivePaneRef();

  if (pane?.refresh) {
    await pane.refresh();
  }
}

function handleCopyShortcut() {
  const selectedText = getSelectedTextForCopy();

  if (selectedText !== null) {
    void navigator.clipboard.writeText(selectedText).then(() => {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.copied'),
            description: truncateTextCopyPreview(selectedText),
          },
        },
        duration: 2000,
      });
    }).catch((error) => {
      console.error('Failed to copy selected text:', error);
    });
    return true;
  }

  const pane = getActivePaneRef();
  if (!pane) return;

  const activePaneSelection = getActivePaneSelectedEntries();

  if (activePaneSelection.length > 0) {
    pane.copyItems(activePaneSelection);
  }

  return true;
}

async function handleCopyCurrentDirectoryPathShortcut() {
  const currentPath = getActiveCurrentPath();
  const actionContext = getNavigatorActionContext(currentPath);

  if (actionContext.isBrowsingVirtualLocations) {
    if (actionContext.actionTargetEntries.length === 0) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(actionContext.actionTargetPathsText);
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
            description: actionContext.actionTargetPathsText,
          },
        },
        duration: 2000,
      });
      return true;
    }
    catch (error) {
      console.error('Failed to copy selected path:', error);
      return false;
    }
  }

  if (!currentPath) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(currentPath);
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
          description: currentPath,
        },
      },
      duration: 2000,
    });
    return true;
  }
  catch (error) {
    console.error('Failed to copy current directory path:', error);
    return false;
  }
}

function handleCutShortcut() {
  if (getSelectedTextForCopy() !== null) {
    return false;
  }

  const pane = getActivePaneRef();
  if (!pane) return;

  const activePaneSelection = getActivePaneSelectedEntries();

  if (activePaneSelection.length > 0) {
    pane.cutItems(activePaneSelection);
  }

  return true;
}

async function handlePasteShortcut() {
  const pane = getActivePaneRef();
  const pasteTargetPath = getPasteTargetPath();

  if (!pane || !pasteTargetPath) {
    return;
  }

  await pane.pasteItems(pasteTargetPath);
}

async function handlePasteToPane(paneIndex: number) {
  const tabGroup = workspacesStore.currentTabGroup;
  if (!tabGroup) return;

  const tab = tabGroup[paneIndex];
  if (!tab) return;

  const pane = paneRefsMap.value.get(tab.id);

  if (!pane) {
    return;
  }

  await pane.pasteItems(tab.path);
}

function handleSelectAllShortcut() {
  const pane = getActivePaneRef();

  if (pane) {
    pane.selectAll();
  }
}

async function handleDeleteShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  const activePaneSelection = getActivePaneSelectedEntries();

  if (activePaneSelection.length > 0) {
    await pane.deleteItems(activePaneSelection, true);
  }
}

async function handleDeletePermanentlyShortcut() {
  const pane = getActivePaneRef();
  if (!pane) return;

  const activePaneSelection = getActivePaneSelectedEntries();

  if (activePaneSelection.length > 0) {
    await pane.deleteItems(activePaneSelection, false);
  }
}

function clearAllSelections() {
  selectedEntries.value = [];
  paneRefsMap.value.forEach((pane) => {
    pane.clearSelection();
  });

  if (singlePaneRef.value) {
    singlePaneRef.value.clearSelection();
  }
}

function handleEscapeKey(): boolean {
  const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

  if (hasRekaDismissableLayers) {
    return false;
  }

  if (dismissalLayerStore.hasLayers) {
    return dismissalLayerStore.dismissTopLayer();
  }

  if (clipboardStore.hasItems) {
    clipboardStore.discardClipboard();
    return true;
  }

  if (selectedEntries.value.length > 0) {
    clearAllSelections();
    return true;
  }

  if (globalSearchStore.isOpen) {
    globalSearchStore.close();
    return true;
  }

  return false;
}

function hasSelectedItems(): boolean {
  return getActivePaneSelectedEntries().length > 0;
}

async function handleQuickViewShortcut() {
  const pane = getActivePaneRef();
  const activePaneSelection = getActivePaneSelectedEntries();

  if (pane && activePaneSelection.length > 0) {
    const lastSelected = activePaneSelection[activePaneSelection.length - 1];

    if (lastSelected.is_file) {
      await pane.quickView(lastSelected);
    }
  }
}

async function handlePrintShortcut() {
  const pane = getActivePaneRef();
  const activePaneSelection = getActivePaneSelectedEntries();

  if (pane && activePaneSelection.length > 0) {
    const lastSelected = activePaneSelection[activePaneSelection.length - 1];

    if (lastSelected.is_file) {
      await pane.printEntry?.(lastSelected);
    }
  }
}

async function handlePropertiesShortcut() {
  const pane = getActivePaneRef();
  const activePaneSelection = getActivePaneSelectedEntries();

  if (pane && activePaneSelection.length > 0) {
    await pane.openProperties?.(activePaneSelection);
  }
}

async function openTerminalWithOptions(asAdmin: boolean) {
  blurFocusedDirEntry();
  const actionContext = getNavigatorActionContext();

  if (!actionContext.actionDirectoryPath) {
    return;
  }

  const defaultTerminal = terminalsStore.terminals[0];
  if (!defaultTerminal) return;

  await terminalsStore.openTerminal(actionContext.actionDirectoryPath, defaultTerminal.id, asAdmin);
}

async function handleOpenNewTabShortcut() {
  await workspacesStore.openNewTabGroup();
}

async function handleDuplicateCurrentTabShortcut() {
  const currentPath = getActiveCurrentPath();
  const target = resolveDuplicateCurrentTabShortcutTarget(
    currentPath,
    getNavigatorActionContext(currentPath),
  );

  if (!target) {
    return;
  }

  switch (target.kind) {
    case 'open-selection':
      getActivePaneRef()?.performSelectionAction?.('open-in-new-tab');
      return;
    case 'clone-path':
      await workspacesStore.openNewTabGroup(target.path);
      return;

    default: {
      const exhaustiveCheck: never = target;
      return exhaustiveCheck;
    }
  }
}

async function handleCloseCurrentTabShortcut() {
  const tabGroup = workspacesStore.currentTabGroup;

  if (tabGroup) {
    await workspacesStore.closeTabGroup(tabGroup);
  }
}

async function handleRestoreLastClosedTabShortcut() {
  return workspacesStore.restoreLastClosedTabGroup();
}

async function handleSwitchToNextTabShortcut() {
  return workspacesStore.switchToAdjacentTabGroup('next');
}

async function handleSwitchToPreviousTabShortcut() {
  return workspacesStore.switchToAdjacentTabGroup('previous');
}

async function handleOpenTerminalShortcut() {
  await openTerminalWithOptions(false);
}

async function handleOpenTerminalAdminShortcut() {
  await openTerminalWithOptions(true);
}

function switchToPane(paneIndex: number): boolean {
  if (!isSplitView.value) return false;

  const tabGroup = workspacesStore.currentTabGroup;

  if (!tabGroup || !tabGroup[paneIndex]) return false;

  const targetTab = tabGroup[paneIndex];
  activateTabPane(targetTab.id);

  paneRefsMap.value.forEach((pane, tabId) => {
    if (tabId !== targetTab.id) {
      pane.clearSelection();
    }
  });

  const targetPane = paneRefsMap.value.get(targetTab.id);

  if (targetPane?.selectFirstEntry) {
    targetPane.selectFirstEntry();
  }

  return true;
}

function hasBlockingDismissalLayersForNavigatorShortcuts(): boolean {
  for (const layer of dismissalLayerStore.layers.values()) {
    if (layer.type !== 'filter') {
      return true;
    }
  }

  return false;
}

function hasBlockingRekaDismissableLayersForNavigatorShortcuts(): boolean {
  const nodes = document.querySelectorAll('[data-dismissable-layer]');

  for (const node of nodes) {
    if (!node.closest('[data-file-browser-toolbar-filter-popover]')) {
      return true;
    }
  }

  return false;
}

function callActivePaneMethod(method: keyof Pick<
  FileBrowserInstance,
  'navigateUp' | 'navigateDown' | 'navigateLeft' | 'navigateRight' | 'openSelected' | 'goBack' | 'goForward' | 'navigateToParent' | 'openCopiedPath'
>): boolean {
  if (hasBlockingDismissalLayersForNavigatorShortcuts()) return false;

  if (hasBlockingRekaDismissableLayersForNavigatorShortcuts()) return false;

  const pane = getActivePaneRef();

  if (pane?.[method]) {
    pane[method]!();
    return true;
  }

  return false;
}

function handleNavigateHistoryBackShortcut(): boolean {
  return callActivePaneMethod('goBack');
}

function handleNavigateHistoryForwardShortcut(): boolean {
  return callActivePaneMethod('goForward');
}

function handleGoUpDirectoryShortcut(): boolean {
  return callActivePaneMethod('navigateToParent');
}

function handleCreateNewItemShortcut(type: 'file' | 'directory'): boolean {
  if (globalSearchStore.isOpen) return false;

  if (hasBlockingDismissalLayersForNavigatorShortcuts()) return false;

  if (hasBlockingRekaDismissableLayersForNavigatorShortcuts()) return false;

  const pane = getNavigatorPaneRef();

  if (pane?.openNewItemDialog) {
    pane.openNewItemDialog(type);
    return true;
  }

  return false;
}

function registerShortcutHandlers() {
  shortcutsStore.registerHandler('toggleAddressBar', () => openAddressBarEditor('path'));
  shortcutsStore.registerHandler('openEntry', () => openAddressBarEditor('entry'));
  shortcutsStore.registerHandler('toggleFilter', handleFilterShortcut);
  shortcutsStore.registerHandler('reloadCurrentDirectory', handleReloadShortcut);
  shortcutsStore.registerHandler('createNewFile', () => handleCreateNewItemShortcut('file'));
  shortcutsStore.registerHandler('createNewDirectory', () => handleCreateNewItemShortcut('directory'));
  shortcutsStore.registerHandler('copyCurrentDirectoryPath', handleCopyCurrentDirectoryPathShortcut);
  shortcutsStore.registerHandler('openCopiedPath', () => callActivePaneMethod('openCopiedPath'));
  shortcutsStore.registerHandler('copy', handleCopyShortcut);
  shortcutsStore.registerHandler('cut', handleCutShortcut);
  shortcutsStore.registerHandler('paste', handlePasteShortcut);
  shortcutsStore.registerHandler('selectAll', handleSelectAllShortcut);
  shortcutsStore.registerHandler('delete', handleDeleteShortcut);
  shortcutsStore.registerHandler('deletePermanently', handleDeletePermanentlyShortcut);
  shortcutsStore.registerHandler('rename', () => {
    const pane = getActivePaneRef();
    const activePaneSelection = getActivePaneSelectedEntries();

    if (pane && activePaneSelection.length > 0) {
      pane.startRename(activePaneSelection[0]);
    }
  }, { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('escape', handleEscapeKey);
  shortcutsStore.registerHandler('quickView', handleQuickViewShortcut, { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('print', handlePrintShortcut, { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('properties', handlePropertiesShortcut, { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('openNewTab', handleOpenNewTabShortcut);
  shortcutsStore.registerHandler('duplicateCurrentTab', handleDuplicateCurrentTabShortcut);
  shortcutsStore.registerHandler('closeCurrentTab', handleCloseCurrentTabShortcut);
  shortcutsStore.registerHandler('restoreLastClosedTab', handleRestoreLastClosedTabShortcut);
  shortcutsStore.registerHandler('switchToNextTab', handleSwitchToNextTabShortcut);
  shortcutsStore.registerHandler('switchToPreviousTab', handleSwitchToPreviousTabShortcut);
  shortcutsStore.registerHandler('openTerminal', handleOpenTerminalShortcut);
  shortcutsStore.registerHandler('openTerminalAdmin', handleOpenTerminalAdminShortcut);
  shortcutsStore.registerHandler('navigateUp', () => callActivePaneMethod('navigateUp'));
  shortcutsStore.registerHandler('navigateDown', () => callActivePaneMethod('navigateDown'));
  shortcutsStore.registerHandler('navigateLeft', () => callActivePaneMethod('navigateLeft'));
  shortcutsStore.registerHandler('navigateRight', () => callActivePaneMethod('navigateRight'));
  shortcutsStore.registerHandler('openSelected', () => callActivePaneMethod('openSelected'), { checkItemSelected: hasSelectedItems });
  shortcutsStore.registerHandler('navigateHistoryBack', handleNavigateHistoryBackShortcut);
  shortcutsStore.registerHandler('navigateHistoryForward', handleNavigateHistoryForwardShortcut);
  shortcutsStore.registerHandler('goUpDirectory', handleGoUpDirectoryShortcut);
  shortcutsStore.registerHandler('switchToLeftPane', () => switchToPane(0));
  shortcutsStore.registerHandler('switchToRightPane', () => switchToPane(1));
  shortcutsStore.registerHandler('toggleSplitView', () => {
    if (globalSearchStore.isOpen) return false;
    handleToggleSplitView();
  });
}

watch(isInfoPanelVisibilityAnimating, (isAnimating, wasAnimating) => {
  if (!isAnimating && wasAnimating && showInfoPanel.value) {
    infoPanelSlideVisible.value = true;
    return;
  }

  if (!isAnimating && !showInfoPanel.value) {
    infoPanelSlideVisible.value = false;
  }
});

onMounted(async () => {
  registerShortcutHandlers();
  dirSizesStore.recoverActiveCalculations();

  if (!consumeNavigatorLayoutResetPending()) {
    return;
  }

  await nextTick();
  requestAnimationFrame(() => {
    requestLayoutReset();
  });
});

onUnmounted(() => {
  navigatorSelectionStore.setSelectedDirEntries([]);
  clearPanelRefs();
});
</script>

<template>
  <NavigatorToolbarActions
    :is-split-view="isSplitView"
    :show-info-panel="showInfoPanel"
    :show-folder-tree="showFolderTree"
    :is-global-search-open="globalSearchStore.isOpen"
    :active-path="folderSettingsActivePath"
    :can-use-folder-settings="canUseFolderSettings"
    @toggle-split-view="handleToggleSplitView"
    @toggle-info-panel="handleToggleInfoPanel"
    @toggle-folder-tree="handleToggleFolderTree"
  />
  <div class="navigator-page">
    <TabBar v-if="!isSmallScreen" />
    <div class="navigator-page__main">
      <div
        v-if="isSmallScreen"
        class="navigator-page__compact-header"
      >
        <TabBar
          teleport-target=""
          :compact="true"
        />
        <InfoPanel
          v-if="showInfoPanel"
          :selected-entry="infoPanelEntry"
          :is-current-dir="selectedEntries.length === 0 && !!currentDirEntry"
        />
      </div>
      <ResizablePanelGroup
        v-if="!isSmallScreen"
        :key="`info-panel-width-${infoPanelLayoutSizingKey}`"
        direction="horizontal"
        class="navigator-page__main-resizable"
        :class="{ 'navigator-page__main-resizable--info-panel-closed': isInfoPanelHandleCollapsed }"
        :style="infoPanelTransitionStyle"
      >
        <ResizablePanel
          :order="1"
          :default-size="100"
          :min-size="mainPanelMinSize"
        >
          <div class="navigator-page__panes-wrapper">
            <ResizablePanelGroup
              direction="horizontal"
              class="navigator-page__tree-and-panes"
              :class="{ 'navigator-page__tree-and-panes--tree-hidden': !showFolderTree }"
            >
              <ResizablePanel
                v-if="showFolderTree"
                :order="1"
                :default-size="28"
                :min-size="12"
                :max-size="48"
                class="navigator-page__folder-tree-panel"
              >
                <FileBrowserTreeView
                  class="navigator-page__folder-tree"
                  :root-paths="treeRootPaths"
                  :root-labels="treeRootLabels"
                  :drive-paths="drivePaths"
                  @activate="handleTreeActivate"
                  @preview="handleTreePreview"
                />
              </ResizablePanel>
              <ResizableHandle
                v-if="showFolderTree"
                with-handle
              />
              <ResizablePanel
                :order="2"
                :default-size="100"
                :min-size="40"
                class="navigator-page__panes-section"
              >
                <div class="navigator-page__panes-container">
                  <!-- FORK-MODIFICATION: 2026-10-16 —— 目录格在前、搜索面板在后。
                       此前 GlobalSearchView 排在 ResizablePanelGroup 之前，于是
                       「打开全局搜索」把搜索界面顶到左边、目录被挤到右边。

                       用户要的是反过来：**左侧保持目录视图，右侧切到搜索界面**。
                       这样眼睛不用来回横跨屏幕去对照「搜到的」和「在哪搜的」，
                       也和「打开所属目录」那套左目录/右结果的布局一致。
                       单格模式（下面第二处）没有左右之分，保持原样。 -->
                  <ResizablePanelGroup
                    direction="horizontal"
                    class="navigator-page__panes"
                  >
                    <template v-if="workspacesStore.currentTabGroup && isSplitView">
                      <template
                        v-for="(tab, index) in workspacesStore.currentTabGroup"
                        :key="tab.id"
                      >
                        <ResizablePanel
                          :default-size="50"
                          :min-size="15"
                          @mousedown="handlePaneFocus(tab.id)"
                        >
                          <FileBrowser
                            :ref="(el) => setPaneRef(el as FileBrowserInstance, tab.id)"
                            :tab="tab"
                            :pane-index="index"
                            :layout="getLayoutForPath(tab.path)"
                            :track-relative-time="trackNavigatorRelativeTime"
                            :is-active-pane="activeTabId ? activeTabId === tab.id : index === 0"
                            :is-split-view="true"
                            class="navigator-page__pane"
                            @swap-panes="handleSwapSplitPanePaths"
                            @update:selected-entries="(entries) => handleSelectionChange(entries, tab.id)"
                            @update:current-path="(path) => handlePaneNavigation(path, tab.id)"
                            @update:current-dir-entry="(entry) => handleCurrentDirChange(entry, tab.id)"
                          />
                        </ResizablePanel>
                        <ResizableHandle
                          v-if="index === 0"
                          with-handle
                        />
                      </template>
                    </template>
                    <template v-else-if="workspacesStore.currentTabGroup">
                      <ResizablePanel :default-size="100">
                        <FileBrowser
                          :key="workspacesStore.currentTabGroup[0].id"
                          :ref="(el) => setPaneRef(el as FileBrowserInstance, workspacesStore.currentTabGroup![0].id)"
                          :tab="workspacesStore.currentTabGroup[0]"
                          :pane-index="0"
                          :layout="getLayoutForPath(workspacesStore.currentTabGroup[0].path)"
                          :track-relative-time="trackNavigatorRelativeTime"
                          :is-active-pane="true"
                          class="navigator-page__pane"
                          @update:selected-entries="(entries) => handleSelectionChange(entries, workspacesStore.currentTabGroup![0].id)"
                          @update:current-path="(path) => handlePaneNavigation(path, workspacesStore.currentTabGroup![0].id)"
                          @update:current-dir-entry="handleCurrentDirChange"
                        />
                      </ResizablePanel>
                    </template>
                    <ResizablePanel
                      v-else
                      :default-size="100"
                    >
                      <FileBrowser
                        ref="singlePaneRef"
                        :layout="getLayoutForPath(currentActivePath)"
                        :track-relative-time="trackNavigatorRelativeTime"
                        :is-active-pane="true"
                        class="navigator-page__pane"
                        @update:selected-entries="(entries) => handleSelectionChange(entries)"
                        @update:current-dir-entry="handleCurrentDirChange"
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>

                  <GlobalSearchView
                    ref="globalSearchViewRef"
                    v-show="globalSearchStore.isOpen"
                    class="navigator-page__search-panel"
                    @close="globalSearchStore.close()"
                    @open-entry="handleGlobalSearchOpenEntry"
                    @update:selected-entries="handleSearchSelectionChange"
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
            <ClipboardToolbar
              :current-path="currentActivePath"
              :is-split-view="isSplitView"
              :pane1-path="workspacesStore.currentTabGroup?.[0]?.path"
              :pane2-path="workspacesStore.currentTabGroup?.[1]?.path"
              @paste="handlePasteShortcut"
              @paste-to-pane="handlePasteToPane"
            />
            <FileBrowserDragOverlay
              :is-active="activeFileBrowserDragState.isActive"
              :item-count="activeFileBrowserDragState.items.length"
              :operation-type="activeFileBrowserDragState.operationType"
              :cursor-x="activeFileBrowserDragState.cursorX"
              :cursor-y="activeFileBrowserDragState.cursorY"
            />
            <FileBrowserConflictDialog
              v-model:open="internalDropConflictDialogState.isOpen"
              :conflicts="internalDropConflictDialogState.conflicts"
              :operation-type="internalDropConflictDialogState.operationType"
              :is-checking-conflicts="internalDropConflictDialogState.isCheckingConflicts"
              @resolve="handleInternalDropConflictResolution"
              @cancel="handleInternalDropConflictCancel"
            />
            <FileBrowserTopLevelConflictDialog
              v-model:open="internalDropTopLevelNameConflictDialogState.isOpen"
              :conflicts="internalDropTopLevelNameConflictDialogState.conflicts"
              @rename="handleInternalDropTopLevelNameConflictRename"
              @merge="handleInternalDropTopLevelNameConflictMerge"
              @cancel="handleInternalDropTopLevelNameConflictCancel"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle
          class="navigator-page__info-panel-handle"
          :class="{ 'navigator-page__info-panel-handle--collapsed': isInfoPanelHandleCollapsed }"
          with-handle
          @dragging="handleInfoPanelWidthHandleDragging"
        />
        <ResizablePanel
          :ref="setInfoPanelWidthPanelRef"
          :order="2"
          :default-size="infoPanelWidthDefault"
          collapsible
          :collapsed-size="0"
          size-unit="px"
          :min-size="0"
          :max-size="infoPanelLayout.MAX_WIDTH_PX"
        >
          <div
            class="navigator-page__info-panel-slide"
            :class="{ 'navigator-page__info-panel-slide--visible': infoPanelSlideVisible }"
            :style="{
              ...infoPanelTransitionStyle,
              '--info-panel-content-min-width': `${infoPanelLayout.MIN_WIDTH_PX}px`,
            }"
          >
            <InfoPanel
              :selected-entry="infoPanelEntry"
              :is-current-dir="selectedEntries.length === 0 && !!currentDirEntry"
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div
        v-else
        class="navigator-page__panes-wrapper"
      >
        <ResizablePanelGroup
          direction="horizontal"
          class="navigator-page__tree-and-panes"
          :class="{ 'navigator-page__tree-and-panes--tree-hidden': !showFolderTree }"
        >
          <ResizablePanel
            v-if="showFolderTree"
            :order="1"
            :default-size="28"
            :min-size="12"
            :max-size="48"
            class="navigator-page__folder-tree-panel"
          >
            <FileBrowserTreeView
              class="navigator-page__folder-tree"
              :root-paths="treeRootPaths"
              :root-labels="treeRootLabels"
              :drive-paths="drivePaths"
              @activate="handleTreeActivate"
              @preview="handleTreePreview"
            />
          </ResizablePanel>
          <ResizableHandle
            v-if="showFolderTree"
            with-handle
          />
          <ResizablePanel
            :order="2"
            :default-size="100"
            :min-size="40"
            class="navigator-page__panes-section"
          >
            <div class="navigator-page__panes-container">
              <GlobalSearchView
                ref="globalSearchViewRef"
                v-show="globalSearchStore.isOpen"
                class="navigator-page__search-panel"
                @close="globalSearchStore.close()"
                @open-entry="handleGlobalSearchOpenEntry"
                @update:selected-entries="handleSearchSelectionChange"
              />
              <ResizablePanelGroup
                direction="horizontal"
                class="navigator-page__panes"
              >
                <template v-if="workspacesStore.currentTabGroup && isSplitView">
                  <template
                    v-for="(tab, index) in workspacesStore.currentTabGroup"
                    :key="tab.id"
                  >
                    <ResizablePanel
                      :default-size="50"
                      :min-size="15"
                      @mousedown="handlePaneFocus(tab.id)"
                    >
                      <FileBrowser
                        :ref="(el) => setPaneRef(el as FileBrowserInstance, tab.id)"
                        :tab="tab"
                        :pane-index="index"
                        :layout="getLayoutForPath(tab.path)"
                        :track-relative-time="trackNavigatorRelativeTime"
                        :is-active-pane="activeTabId ? activeTabId === tab.id : index === 0"
                        :is-split-view="true"
                        class="navigator-page__pane"
                        @swap-panes="handleSwapSplitPanePaths"
                        @update:selected-entries="(entries) => handleSelectionChange(entries, tab.id)"
                        @update:current-path="(path) => handlePaneNavigation(path, tab.id)"
                        @update:current-dir-entry="(entry) => handleCurrentDirChange(entry, tab.id)"
                      />
                    </ResizablePanel>
                    <ResizableHandle
                      v-if="index === 0"
                      with-handle
                    />
                  </template>
                </template>
                <template v-else-if="workspacesStore.currentTabGroup">
                  <ResizablePanel :default-size="100">
                    <FileBrowser
                      :key="workspacesStore.currentTabGroup[0].id"
                      :ref="(el) => setPaneRef(el as FileBrowserInstance, workspacesStore.currentTabGroup![0].id)"
                      :tab="workspacesStore.currentTabGroup[0]"
                      :pane-index="0"
                      :layout="getLayoutForPath(workspacesStore.currentTabGroup[0].path)"
                      :track-relative-time="trackNavigatorRelativeTime"
                      :is-active-pane="true"
                      class="navigator-page__pane"
                      @update:selected-entries="(entries) => handleSelectionChange(entries, workspacesStore.currentTabGroup![0].id)"
                      @update:current-path="(path) => handlePaneNavigation(path, workspacesStore.currentTabGroup![0].id)"
                      @update:current-dir-entry="handleCurrentDirChange"
                    />
                  </ResizablePanel>
                </template>
                <ResizablePanel
                  v-else
                  :default-size="100"
                >
                  <FileBrowser
                    ref="singlePaneRef"
                    :layout="getLayoutForPath(currentActivePath)"
                    :track-relative-time="trackNavigatorRelativeTime"
                    :is-active-pane="true"
                    class="navigator-page__pane"
                    @update:selected-entries="(entries) => handleSelectionChange(entries)"
                    @update:current-dir-entry="handleCurrentDirChange"
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <ClipboardToolbar
          :current-path="currentActivePath"
          :is-split-view="isSplitView"
          :pane1-path="workspacesStore.currentTabGroup?.[0]?.path"
          :pane2-path="workspacesStore.currentTabGroup?.[1]?.path"
          @paste="handlePasteShortcut"
          @paste-to-pane="handlePasteToPane"
        />
        <FileBrowserDragOverlay
          :is-active="activeFileBrowserDragState.isActive"
          :item-count="activeFileBrowserDragState.items.length"
          :operation-type="activeFileBrowserDragState.operationType"
          :cursor-x="activeFileBrowserDragState.cursorX"
          :cursor-y="activeFileBrowserDragState.cursorY"
        />
        <FileBrowserConflictDialog
          v-model:open="internalDropConflictDialogState.isOpen"
          :conflicts="internalDropConflictDialogState.conflicts"
          :operation-type="internalDropConflictDialogState.operationType"
          :is-checking-conflicts="internalDropConflictDialogState.isCheckingConflicts"
          @resolve="handleInternalDropConflictResolution"
          @cancel="handleInternalDropConflictCancel"
        />
        <FileBrowserTopLevelConflictDialog
          v-model:open="internalDropTopLevelNameConflictDialogState.isOpen"
          :conflicts="internalDropTopLevelNameConflictDialogState.conflicts"
          @rename="handleInternalDropTopLevelNameConflictRename"
          @merge="handleInternalDropTopLevelNameConflictMerge"
          @cancel="handleInternalDropTopLevelNameConflictCancel"
        />
      </div>
    </div>
    <!-- FORK-MODIFICATION: 远程权限设置对话框。整个页面**只渲染一个** ——
         对话框状态是模块级的，两格各渲染一个会出现两个弹窗。 -->
    <RemotePermissionsDialog
      v-model:open="remotePermissionsDialog.isOpen.value"
      :target="remotePermissionsDialog.target.value"
    />
  </div>
</template>

<style scoped>
.navigator-page {
  display: flex;
  overflow: hidden;
  height: calc(100vh - var(--window-toolbar-height));
  flex-direction: column;
  padding-right: 6px;
  padding-bottom: 6px;
  color: hsl(var(--foreground));
}

.navigator-page__main {
  display: flex;
  overflow: hidden;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.navigator-page__main-resizable {
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: 6px;
  transition: gap var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigator-page__main-resizable--info-panel-closed {
  gap: 0;
}

.navigator-page__main-resizable :deep(.navigator-page__info-panel-handle) {
  overflow: visible;
  min-width: 0;
  max-width: 16px;
  flex-shrink: 0;
  opacity: 1;
  transition:
    max-width var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing),
    opacity var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigator-page__main-resizable :deep(.navigator-page__info-panel-handle--collapsed) {
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  pointer-events: none;
}

.navigator-page__main-resizable :deep([data-panel]) {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.navigator-page__info-panel-slide {
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  transform: translateX(100%);
  transition: transform var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigator-page__info-panel-slide--visible {
  transform: translateX(0);
}

.navigator-page__panes {
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex: 1;
  gap: 6px;
}

.navigator-page__panes :deep([data-panel]) {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.navigator-page__panes-wrapper {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.navigator-page__tree-and-panes {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: 6px;
}

.navigator-page__tree-and-panes :deep([data-panel]) {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.navigator-page__folder-tree-panel {
  border: 1px solid hsl(var(--border) / 40%);
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-2) / 60%);
}

/* FORK-MODIFICATION: 目录树过长时无法滚动（验收反馈 2026-10-15）。
 *
 * 真机验收推翻了这个文件原先的假设，结论记在这里以免再走一遍：
 * 给面板写 `overflow-y: auto` 是**无效的**。reka-ui 的
 * `computePanelFlexBoxStyle`（node_modules/reka-ui/dist/utils/style.js）给每个
 * SplitterPanel 返回内联 `{ flexBasis:0; flexGrow:n; flexShrink:1;
 * overflow:'hidden' }`，内联样式压过任何 CSS 规则 —— 跟特异性、书写顺序无关。
 * 上一版注释里「0,3,0 压过 [data-panel] 的 0,2,0」的推理漏掉了内联这一层，
 * 所以那条规则在打包产物里编译出来了、也确实排最后，却从未生效。
 *
 * 现在滚动容器是树自己（见 file-browser-tree-view.vue 的
 * `.file-tree-view__scroll`；2026-10-19 起从 `.file-tree-view` 下移一层，
 * 因为 trigger 的直接子元素上的模板 ref 会被 reka-ui 的 Slot 删掉）。
 * 这里只保留 `flex-direction: column` —— 面板内联样式里没有 flex-direction，
 * 这条仍然有效，且让面板成为纵向 flex 容器，树才能用 flex:1 撑满并自己滚。
 * 不要在这里再加 overflow：写了也是白写，反而会让人以为滚动靠的是它。
 * 更不要改 context-menu-trigger.vue 的 display:contents —— 那会波及文件浏览器、
 * 空状态等所有 as-child 用法，回归面远大于本问题；正确的做法是在树的
 * scoped 规则里局部覆盖它。
 */
.navigator-page__tree-and-panes :deep(.navigator-page__folder-tree-panel) {
  flex-direction: column;
}

/* 原 `.navigator-page__folder-tree { width:100%; height:100%; overflow:auto }`
   已删除：它是传给 <FileBrowserTreeView> 的 class，但该组件模板是双根节点
   （FileBrowserTreeView.vue 的 <ContextMenu> + <FileBrowserRenameDialog>），
   Vue 对 fragment 根的属性透传失效，这条规则从未匹配到任何元素。
   留着它只会让人以为滚动是这么实现的。 */

.navigator-page__panes-section {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.navigator-page__panes-container {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.navigator-page__search-panel {
  min-width: 280px;
  flex: 1;
  border-radius: var(--radius-sm);
}

.navigator-page__pane {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
}

.navigator-page__compact-header {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  flex-shrink: 0;
}

.navigator-page__compact-header :deep(.info-panel) {
  padding: 8px;
  border-radius: 0;
}

@media (width <= 800px) {
  .navigator-page__main {
    flex-direction: column;
  }
}
</style>
