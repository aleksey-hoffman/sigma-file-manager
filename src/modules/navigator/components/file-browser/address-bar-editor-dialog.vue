<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { useDebounceFn } from '@vueuse/core';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FolderIcon,
  HardDriveIcon,
  MapPinIcon,
  TagIcon,
} from '@lucide/vue';
import {
  CommandDialog,
  CommandInput,
} from '@/components/ui/command';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui';
import { ScrollBar } from '@/components/ui/scroll-area';
import Separator from '@/components/ui/separator/separator.vue';
import AddressBarSuggestionRow from './address-bar-editor-suggestion-row.vue';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useUserDirectories, type UserDirectory } from '@/modules/home/composables';
import { useAddressBarStableDriveList } from './composables/use-address-bar-stable-drive-list';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { matchesShortcut, useShortcutsStore } from '@/stores/runtime/shortcuts';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';
import normalizePath, { canonicalizePath, getParentPath, getPathDisplayName } from '@/utils/normalize-path';
import {
  resolveDirEntry,
  resolveDirectoryContents,
  virtualLocationPathExists,
} from '@/utils/virtual-locations';
import {
  createFileBrowserQuickSearchCache,
  createFileBrowserQuickSearchMatcher,
} from './utils/file-browser-entry-quick-search';
import { useVerticalVirtualList } from '@/composables/use-vertical-virtual-list';
import {
  addressBarPathHasNoParentDirectory,
  addressBarTrimmedQueryLooksLikeFilesystemPath,
  createRecentSuggestionGroup,
  createTaggedSuggestionGroups,
  createSystemDrivesSuggestionGroup,
  createLocationsSuggestionGroup,
  createUserDirectoriesSuggestionGroup,
  ensureAddressBarDirectoryQuery,
  flattenAddressBarSuggestionGroups,
  getAddressBarRevealTarget,
  isAddressBarDirectoryShortcutCandidate,
  resolveAddressBarSuggestions,
  type AddressBarEditorMode,
  type AddressBarSuggestion,
  type AddressBarSuggestionGroup,
  type AddressBarSuggestionState,
} from './address-bar-editor-utils';

type RefreshSuggestionsKeyboardSelection = 'reset' | 'preserve';

const props = defineProps<{
  currentPath: string;
  currentDirContents?: DirContents | null;
}>();

const emit = defineEmits<{
  openDirectory: [path: string];
  openFile: [path: string];
  reveal: [parentPath: string, entryPath: string];
}>();

interface RenderedSuggestionGroup extends AddressBarSuggestionGroup {
  headerIndex?: number;
  firstItemIndex: number;
}

type AddressBarEditorVirtualRow
  = | {
    type: 'collapsible-header';
    key: string;
    size: number;
    navigationIndex: number;
    itemCount: number;
    group: RenderedSuggestionGroup;
  }
  | {
    type: 'group-heading';
    key: string;
    size: number;
    group: RenderedSuggestionGroup;
  }
  | {
    type: 'suggestion';
    key: string;
    size: number;
    navigationIndex: number;
    groupId: string;
    suggestion: AddressBarSuggestion;
  };

const RECENT_ENTRY_LIMIT = 10;
const PATH_LOOKUP_TIMEOUT_MS = 750;
const SUGGESTION_DEBOUNCE_MS = 120;
const COLLAPSIBLE_GROUP_HEADER_HEIGHT_PX = 38;
const GROUP_HEADING_HEIGHT_PX = 28;
const SUGGESTION_ROW_HEIGHT_PX = 32;
const hintKeyLabels = {
  navigate: 'Up/Down',
  expand: 'Tab',
  open: 'Enter',
  reveal: 'Ctrl+Enter',
  close: 'Escape',
};

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const platformStore = usePlatformStore();
const userStatsStore = useUserStatsStore();
const { userDirectories, refresh: refreshUserDirectories } = useUserDirectories();
const {
  stableDriveListSnapshot,
  seedStableDriveListSnapshotFromLiveCache,
  hydrateStableDriveListSnapshotFromRust,
  clearStableDriveListSnapshotForAddressBar,
} = useAddressBarStableDriveList();
const dirSizesStore = useDirSizesStore();

const isOpen = ref(false);
const mode = ref<AddressBarEditorMode>('path');
const query = ref('');
const selectedIndex = ref(-1);
const suggestionState = shallowRef<AddressBarSuggestionState>({
  kind: 'empty',
  groups: [],
  exactEntry: null,
  directoryPath: null,
});
const lastDirectoryEntries = shallowRef<DirEntry[]>([]);
const groupOpenState = ref<Record<string, boolean>>({});
const quickSearchCache = ref(createFileBrowserQuickSearchCache());
let suggestionRequestId = 0;
const addressBarCommandInputMountReference = shallowRef<HTMLElement | null>(null);
const suppressDebouncedSuggestionsOnQueryMutation = ref(false);
const addressEditorNavigationSteps = ref<string[]>([]);
const addressEditorNavigationIndex = ref(0);

const dialogOpen = computed({
  get: () => isOpen.value,
  set: (value: boolean) => {
    isOpen.value = value;
  },
});

const inputPlaceholder = computed(() => t('settings.addressBar.enterValidPath'));

function getUserDirectorySuggestionDisplayName(directory: UserDirectory): string {
  const customTitle = directory.customTitle?.trim();

  if (customTitle) {
    return customTitle;
  }

  if (directory.titleKey) {
    return t(directory.titleKey);
  }

  return getPathDisplayName(directory.path) || directory.path;
}

const entryModeGroups = computed(() => {
  const groups: AddressBarSuggestionGroup[] = [
    createLocationsSuggestionGroup(t('locations')),
  ];

  const recentGroup = createRecentSuggestionGroup(
    userStatsStore.sortedHistory,
    t('settings.addressBar.recent'),
    RECENT_ENTRY_LIMIT,
  );

  if (recentGroup.items.length > 0) {
    groups.push(recentGroup);
  }

  const userDirectoryRows = userDirectories.value.map(directory => ({
    path: directory.path,
    displayName: getUserDirectorySuggestionDisplayName(directory),
  }));

  if (userDirectoryRows.length > 0) {
    groups.push(
      createUserDirectoriesSuggestionGroup(
        userDirectoryRows,
        t('settings.addressBar.userLocations'),
      ),
    );
  }

  if (stableDriveListSnapshot.value.length > 0) {
    groups.push(
      createSystemDrivesSuggestionGroup(
        stableDriveListSnapshot.value,
        platformStore.isWindows ? t('drives') : t('locations'),
      ),
    );
  }

  groups.push(
    ...createTaggedSuggestionGroups(
      userStatsStore.taggedItems,
      userStatsStore.tags,
      t('quickAccess.unknownTagGroup'),
    ),
  );

  return groups;
});

function isGroupOpen(groupId: string): boolean {
  return groupOpenState.value[groupId] ?? true;
}

function mapVisibleSuggestionGroups(groups: AddressBarSuggestionGroup[]): AddressBarSuggestionGroup[] {
  return groups.map((group) => {
    if (!group.collapsible || isGroupOpen(group.id)) {
      return group;
    }

    return {
      ...group,
      items: [],
    };
  });
}

const visibleSuggestionGroups = computed(() =>
  mapVisibleSuggestionGroups(suggestionState.value.groups));

const renderedGroups = computed<RenderedSuggestionGroup[]>(() => {
  let rowIndex = 0;

  return visibleSuggestionGroups.value.map((group) => {
    let headerIndex: number | undefined;

    if (group.collapsible) {
      headerIndex = rowIndex;
      rowIndex += 1;
    }

    const firstItemIndex = rowIndex;
    rowIndex += group.items.length;

    return {
      ...group,
      headerIndex,
      firstItemIndex,
    };
  });
});

const suggestionVirtualRows = computed<AddressBarEditorVirtualRow[]>(() => {
  const rows: AddressBarEditorVirtualRow[] = [];
  const originalItemCountByGroupId = new Map(
    suggestionState.value.groups.map(group => [group.id, group.items.length]),
  );

  for (const group of renderedGroups.value) {
    if (group.collapsible && group.headerIndex !== undefined) {
      rows.push({
        type: 'collapsible-header',
        key: `group-header:${group.id}`,
        size: COLLAPSIBLE_GROUP_HEADER_HEIGHT_PX,
        navigationIndex: group.headerIndex,
        itemCount: originalItemCountByGroupId.get(group.id) ?? group.items.length,
        group,
      });
    }
    else if (group.items.length > 0) {
      rows.push({
        type: 'group-heading',
        key: `group-heading:${group.id}`,
        size: GROUP_HEADING_HEIGHT_PX,
        group,
      });
    }

    for (const [itemOffset, suggestion] of group.items.entries()) {
      rows.push({
        type: 'suggestion',
        key: `suggestion:${group.id}:${suggestion.id}`,
        size: SUGGESTION_ROW_HEIGHT_PX,
        navigationIndex: group.firstItemIndex + itemOffset,
        groupId: group.id,
        suggestion,
      });
    }
  }

  return rows;
});

const virtualRowIndexByNavigationIndex = computed(() => {
  const rowIndexByNavigationIndex = new Map<number, number>();

  suggestionVirtualRows.value.forEach((row, rowIndex) => {
    if (row.type !== 'group-heading') {
      rowIndexByNavigationIndex.set(row.navigationIndex, rowIndex);
    }
  });

  return rowIndexByNavigationIndex;
});

const suggestionVirtualList = useVerticalVirtualList({
  items: suggestionVirtualRows,
  getItemSize: row => row.size,
});
const visibleSuggestionVirtualRows = suggestionVirtualList.visibleItems;
const suggestionVirtualSpacerStyle = suggestionVirtualList.spacerStyle;
const suggestionVirtualWindowStyle = suggestionVirtualList.windowStyle;
const suggestionVirtualViewportHeight = suggestionVirtualList.viewportHeight;

const flatNavigableRowCount = computed(() => {
  let count = 0;

  for (const group of renderedGroups.value) {
    if (group.collapsible) {
      count += 1;
    }

    count += group.items.length;
  }

  return count;
});

const showsPathBesideSuggestionName = computed(() => mode.value === 'entry');

const allowAddressBarFilesystemNavigationShortcuts = computed(() => {
  return mode.value === 'path'
    || suggestionState.value.kind === 'directory'
    || suggestionState.value.kind === 'exact';
});

const pathEditorYieldMarkerBindings = computed(() => {
  if (!isOpen.value || !allowAddressBarFilesystemNavigationShortcuts.value) {
    return {};
  }

  return { 'data-address-bar-editor-path': 'open' };
});

const addressBarNavigatorShortcutHintLabels = computed(() => ({
  goUpDirectory: shortcutsStore.getShortcutLabel('goUpDirectory'),
  navigateHistoryBack: shortcutsStore.getShortcutLabel('navigateHistoryBack'),
  navigateHistoryForward: shortcutsStore.getShortcutLabel('navigateHistoryForward'),
}));

watch(entryModeGroups, (groups) => {
  for (const group of groups) {
    if (groupOpenState.value[group.id] === undefined) {
      groupOpenState.value[group.id] = true;
    }
  }
}, { immediate: true });

async function readDir(path: string): Promise<DirContents> {
  const currentDirContents = props.currentDirContents;

  if (
    currentDirContents
    && canonicalizePath(currentDirContents.path) === canonicalizePath(path)
  ) {
    return toRaw(currentDirContents);
  }

  return resolveDirectoryContents(path);
}

async function getDirEntry(path: string): Promise<DirEntry> {
  const dirEntry = await resolveDirEntry(path, PATH_LOOKUP_TIMEOUT_MS);

  if (!dirEntry) {
    throw new Error(`Path does not exist: ${path}`);
  }

  return dirEntry;
}

async function invokePathExistsForAddressBar(pathArgument: string): Promise<boolean> {
  if (virtualLocationPathExists(pathArgument)) {
    return true;
  }

  try {
    const existsFlag = await invoke<boolean | null>('path_exists_with_timeout', {
      path: pathArgument,
      timeoutMs: PATH_LOOKUP_TIMEOUT_MS,
    });

    return existsFlag === true;
  }
  catch {
    return false;
  }
}

function createSearchMatcher(searchQuery: string): (entry: DirEntry) => boolean {
  return createFileBrowserQuickSearchMatcher(searchQuery, dirSizesStore, quickSearchCache.value);
}

async function applyEditorQueryWithoutDebouncedWatch(nextQueryExact: string): Promise<void> {
  suppressDebouncedSuggestionsOnQueryMutation.value = true;
  query.value = nextQueryExact;
  suppressDebouncedSuggestionsOnQueryMutation.value = false;
  await refreshSuggestions(nextQueryExact);
}

function appendEditorNavigateForwardStep(nextQueryExact: string): void {
  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return;
  }

  const trimmedNext = normalizePath(nextQueryExact).trim();

  addressEditorNavigationSteps.value = addressEditorNavigationSteps.value.slice(
    0,
    addressEditorNavigationIndex.value + 1,
  );

  const lastStepAfterSlice = addressEditorNavigationSteps.value[
    addressEditorNavigationSteps.value.length - 1
  ];

  if (
    typeof lastStepAfterSlice === 'string'
    && normalizePath(lastStepAfterSlice).trim() === trimmedNext
  ) {
    addressEditorNavigationIndex.value = addressEditorNavigationSteps.value.length - 1;
    return;
  }

  addressEditorNavigationSteps.value.push(nextQueryExact);
  addressEditorNavigationIndex.value = addressEditorNavigationSteps.value.length - 1;
}

function replaceEditorNavigationHistoryTipFromPaneSync(nextTipQuery: string): void {
  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return;
  }

  if (addressEditorNavigationSteps.value.length === 0) {
    addressEditorNavigationSteps.value = [nextTipQuery];
    addressEditorNavigationIndex.value = 0;
    return;
  }

  addressEditorNavigationSteps.value = addressEditorNavigationSteps.value.slice(
    0,
    addressEditorNavigationIndex.value + 1,
  );

  addressEditorNavigationSteps.value[addressEditorNavigationIndex.value] = nextTipQuery;
}

async function editorHistoryGoBack(): Promise<boolean> {
  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return false;
  }

  if (addressEditorNavigationIndex.value <= 0) {
    return false;
  }

  addressEditorNavigationIndex.value -= 1;

  await applyEditorQueryWithoutDebouncedWatch(
    addressEditorNavigationSteps.value[addressEditorNavigationIndex.value] ?? '',
  );

  return true;
}

async function editorHistoryGoForward(): Promise<boolean> {
  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return false;
  }

  const lastStepIndex = addressEditorNavigationSteps.value.length - 1;

  if (addressEditorNavigationIndex.value >= lastStepIndex) {
    return false;
  }

  addressEditorNavigationIndex.value += 1;

  await applyEditorQueryWithoutDebouncedWatch(
    addressEditorNavigationSteps.value[addressEditorNavigationIndex.value] ?? '',
  );

  return true;
}

async function editorFallbackClearQueryIntoEntryPalette(): Promise<void> {
  addressEditorNavigationSteps.value = [];
  addressEditorNavigationIndex.value = 0;
  suppressDebouncedSuggestionsOnQueryMutation.value = true;
  query.value = '';
  suppressDebouncedSuggestionsOnQueryMutation.value = false;
  selectedIndex.value = -1;
  await refreshSuggestions('');
}

async function editorGoUpDirectory(): Promise<boolean> {
  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return false;
  }

  const trimmedTip = canonicalizePath(normalizePath(query.value).trim());

  if (!trimmedTip) {
    return false;
  }

  const parentPathResolved = getParentPath(trimmedTip);

  if (!parentPathResolved) {
    return false;
  }

  const parentBrowseQuery = ensureAddressBarDirectoryQuery(parentPathResolved);

  appendEditorNavigateForwardStep(parentBrowseQuery);
  await applyEditorQueryWithoutDebouncedWatch(parentBrowseQuery);

  return true;
}

async function refreshSuggestions(
  nextQuery = query.value,
  keyboardSelection: RefreshSuggestionsKeyboardSelection = 'reset',
): Promise<void> {
  const requestId = ++suggestionRequestId;

  const normalizedTrimmedQuery = normalizePath(nextQuery).trim();

  let modeForResolve: AddressBarEditorMode = 'entry';

  if (normalizedTrimmedQuery !== '') {
    let pathExistsOnFilesystem = false;

    if (addressBarTrimmedQueryLooksLikeFilesystemPath(normalizedTrimmedQuery)) {
      pathExistsOnFilesystem = await invokePathExistsForAddressBar(normalizedTrimmedQuery);
    }

    if (requestId !== suggestionRequestId) {
      return;
    }

    modeForResolve = pathExistsOnFilesystem ? 'path' : 'entry';
  }
  else if (requestId !== suggestionRequestId) {
    return;
  }

  mode.value = modeForResolve;

  if (modeForResolve === 'entry') {
    addressEditorNavigationSteps.value = [];
    addressEditorNavigationIndex.value = 0;
  }
  else if (addressEditorNavigationSteps.value.length === 0 && normalizedTrimmedQuery !== '') {
    addressEditorNavigationSteps.value = [nextQuery];
    addressEditorNavigationIndex.value = 0;
  }

  const nextState = await resolveAddressBarSuggestions({
    query: nextQuery,
    mode: modeForResolve,
    currentPath: props.currentPath,
    directoryGroupLabel: t('settings.addressBar.directoryEntries'),
    exactGroupLabel: t('settings.addressBar.exactMatch'),
    resultsGroupLabel: t('settings.addressBar.results'),
    entryModeGroups: entryModeGroups.value,
    lastDirectoryEntries: lastDirectoryEntries.value,
    lookup: {
      readDir,
      getDirEntry,
    },
    createSearchMatcher,
  });

  if (requestId !== suggestionRequestId) {
    return;
  }

  suggestionState.value = nextState;
  quickSearchCache.value = createFileBrowserQuickSearchCache();

  if (nextState.kind === 'directory') {
    lastDirectoryEntries.value = flattenAddressBarSuggestionGroups(nextState.groups).map(suggestion => suggestion.entry);
  }

  for (const group of nextState.groups) {
    if (groupOpenState.value[group.id] === undefined) {
      groupOpenState.value[group.id] = true;
    }
  }

  await nextTick();

  if (keyboardSelection === 'reset') {
    syncSelectionToNavigableRows();
  }
  else {
    clampKeyboardSelectionAfterSuggestionRefresh();
  }
}

function syncSelectionToNavigableRows(): void {
  if (flatNavigableRowCount.value === 0) {
    selectedIndex.value = -1;
    return;
  }

  selectedIndex.value = 0;
  scrollSelectedIntoView();
}

function clampKeyboardSelectionAfterSuggestionRefresh(): void {
  const rowTotal = flatNavigableRowCount.value;

  if (rowTotal === 0) {
    selectedIndex.value = -1;
    return;
  }

  if (selectedIndex.value < 0) {
    return;
  }

  if (selectedIndex.value >= rowTotal) {
    selectedIndex.value = rowTotal - 1;
  }

  scrollSelectedIntoView();
}

async function removeRecentHistoryRow(suggestion: AddressBarSuggestion, rowIndex: number) {
  const openedAt = suggestion.historyOpenedAt;

  if (openedAt == null) {
    return;
  }

  const previousSelected = selectedIndex.value;

  await userStatsStore.removeFromHistory(suggestion.path, openedAt);

  if (rowIndex < previousSelected) {
    selectedIndex.value = previousSelected - 1;
  }

  await refreshSuggestions(query.value, 'preserve');
}

const debouncedRefreshSuggestions = useDebounceFn(refreshSuggestions, SUGGESTION_DEBOUNCE_MS);

watch(flatNavigableRowCount, (count) => {
  if (count === 0) {
    selectedIndex.value = -1;
    return;
  }

  if (selectedIndex.value >= count) {
    selectedIndex.value = count - 1;
    scrollSelectedIntoView();
  }
});

watch(query, (value) => {
  if (!isOpen.value) return;

  if (suppressDebouncedSuggestionsOnQueryMutation.value) {
    return;
  }

  selectedIndex.value = -1;
  debouncedRefreshSuggestions(value);
});

watch(isOpen, (open) => {
  if (open) {
    void refreshUserDirectories();
    return;
  }

  clearStableDriveListSnapshotForAddressBar();
});

watch(userDirectories, () => {
  if (!isOpen.value) {
    return;
  }

  void refreshSuggestions(query.value);
}, { deep: true });

watch(
  () => props.currentPath,
  async (nextPath, previousPath) => {
    if (!isOpen.value || !allowAddressBarFilesystemNavigationShortcuts.value) {
      return;
    }

    const normalizedPrevious = normalizePath(previousPath ?? '');
    const normalizedNext = normalizePath(nextPath ?? '');

    if (normalizedNext === normalizedPrevious) {
      return;
    }

    const syncedQuery = ensureAddressBarDirectoryQuery(props.currentPath);
    replaceEditorNavigationHistoryTipFromPaneSync(syncedQuery);
    suppressDebouncedSuggestionsOnQueryMutation.value = true;
    query.value = syncedQuery;
    suppressDebouncedSuggestionsOnQueryMutation.value = false;
    await refreshSuggestions(query.value);
  },
);

function setGroupOpen(groupId: string, value: boolean): void {
  groupOpenState.value[groupId] = value;
}

function getSelectedCollapsibleGroup(): RenderedSuggestionGroup | null {
  for (const group of renderedGroups.value) {
    if (group.collapsible && group.headerIndex === selectedIndex.value) {
      return group;
    }
  }

  return null;
}

function isCollapsibleGroupHeaderSelected(): boolean {
  return getSelectedCollapsibleGroup() !== null;
}

function getSelectedSuggestion(): AddressBarSuggestion | null {
  if (selectedIndex.value < 0) {
    return null;
  }

  for (const group of renderedGroups.value) {
    if (group.collapsible && group.headerIndex === selectedIndex.value) {
      return null;
    }

    const itemOffset = selectedIndex.value - group.firstItemIndex;

    if (itemOffset >= 0 && itemOffset < group.items.length) {
      return group.items[itemOffset] ?? null;
    }
  }

  return null;
}

function getActiveEntry(): DirEntry | null {
  const suggestion = getSelectedSuggestion();

  if (suggestion) {
    return suggestion.entry;
  }

  if (isCollapsibleGroupHeaderSelected()) {
    return null;
  }

  return suggestionState.value.exactEntry;
}

function moveSelection(offset: number): void {
  const rowTotal = flatNavigableRowCount.value;

  if (rowTotal === 0) {
    selectedIndex.value = -1;
    return;
  }

  if (selectedIndex.value < 0) {
    if (offset > 0) {
      selectedIndex.value = 0;
      scrollSelectedIntoView();
    }

    return;
  }

  const nextIndex = selectedIndex.value + offset;

  if (nextIndex < 0 || nextIndex >= rowTotal) {
    return;
  }

  selectedIndex.value = nextIndex;
  scrollSelectedIntoView();
}

function scrollSelectedIntoView(): void {
  nextTick(() => {
    const virtualRowIndex = virtualRowIndexByNavigationIndex.value.get(selectedIndex.value);

    if (virtualRowIndex !== undefined) {
      suggestionVirtualList.scrollItemIntoView(virtualRowIndex);
    }
  });
}

function selectCollapsibleGroupHeader(group: RenderedSuggestionGroup): void {
  if (group.headerIndex === undefined) {
    return;
  }

  selectedIndex.value = group.headerIndex;
  scrollSelectedIntoView();
}

async function expandSuggestion(): Promise<void> {
  for (const group of renderedGroups.value) {
    if (!group.collapsible || group.headerIndex !== selectedIndex.value) {
      continue;
    }

    setGroupOpen(group.id, true);
    await nextTick();

    const freshGroup = renderedGroups.value.find(candidate => candidate.id === group.id);

    if (freshGroup && freshGroup.items.length > 0) {
      selectedIndex.value = freshGroup.firstItemIndex;
      scrollSelectedIntoView();
      await expandSuggestion();
    }

    return;
  }

  const suggestion = getSelectedSuggestion();

  if (!suggestion) {
    return;
  }

  if (suggestion.isDirectory) {
    const nextQuery = ensureAddressBarDirectoryQuery(suggestion.path);
    appendEditorNavigateForwardStep(nextQuery);
    await applyEditorQueryWithoutDebouncedWatch(nextQuery);
    return;
  }

  if (isAddressBarDirectoryShortcutCandidate(suggestion.entry)) {
    const target = await resolveNavigableItemTarget(suggestion.path, true);

    if (!target.opensAsFile) {
      const directoryQuery = ensureAddressBarDirectoryQuery(target.targetPath);
      appendEditorNavigateForwardStep(directoryQuery);
      await applyEditorQueryWithoutDebouncedWatch(directoryQuery);
      return;
    }
  }

  const pathQuery = normalizePath(suggestion.path);
  appendEditorNavigateForwardStep(pathQuery);
  await applyEditorQueryWithoutDebouncedWatch(pathQuery);
}

async function openEntry(entry: DirEntry): Promise<void> {
  isOpen.value = false;

  if (entry.is_dir) {
    emit('openDirectory', entry.path);
    return;
  }

  emit('openFile', entry.path);
}

async function openActiveEntry(): Promise<void> {
  const selectedCollapsibleGroup = getSelectedCollapsibleGroup();

  if (selectedCollapsibleGroup) {
    setGroupOpen(selectedCollapsibleGroup.id, !isGroupOpen(selectedCollapsibleGroup.id));
    return;
  }

  const entry = getActiveEntry();

  if (!entry) {
    return;
  }

  await openEntry(entry);
}

function revealActiveEntry(): void {
  if (isCollapsibleGroupHeaderSelected()) {
    return;
  }

  const entry = getActiveEntry();

  if (!entry) {
    return;
  }

  const revealTarget = getAddressBarRevealTarget(entry.path);

  if (!revealTarget) {
    if (entry.is_dir) {
      isOpen.value = false;
      emit('openDirectory', entry.path);
    }

    return;
  }

  isOpen.value = false;
  emit('reveal', revealTarget.parentPath, revealTarget.entryPath);
}

async function maybeHandleNavigatorPaneShortcut(event: KeyboardEvent): Promise<boolean> {
  const goUpKeys = shortcutsStore.getShortcutKeys('goUpDirectory');

  if (matchesShortcut(event, goUpKeys)) {
    if (!allowAddressBarFilesystemNavigationShortcuts.value) {
      return false;
    }

    const movedUp = await editorGoUpDirectory();

    if (movedUp) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    const trimmedQueryNormalized = normalizePath(query.value).trim();

    if (addressBarPathHasNoParentDirectory(trimmedQueryNormalized)) {
      await editorFallbackClearQueryIntoEntryPalette();
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  if (!allowAddressBarFilesystemNavigationShortcuts.value) {
    return false;
  }

  const historyBackKeys = shortcutsStore.getShortcutKeys('navigateHistoryBack');

  if (matchesShortcut(event, historyBackKeys)) {
    const movedBackward = await editorHistoryGoBack();

    if (!movedBackward) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  const historyForwardKeys = shortcutsStore.getShortcutKeys('navigateHistoryForward');

  if (matchesShortcut(event, historyForwardKeys)) {
    const movedForward = await editorHistoryGoForward();

    if (!movedForward) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}

async function handleInputKeydown(event: KeyboardEvent): Promise<void> {
  if ((await maybeHandleNavigatorPaneShortcut(event))) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    moveSelection(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    moveSelection(-1);
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    await expandSuggestion();
    return;
  }

  if (event.key === ' ') {
    if (query.value.length > 0 || event.isComposing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectedCollapsibleGroup = getSelectedCollapsibleGroup();

    if (selectedCollapsibleGroup) {
      setGroupOpen(selectedCollapsibleGroup.id, !isGroupOpen(selectedCollapsibleGroup.id));
    }

    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      revealActiveEntry();
      return;
    }

    await openActiveEntry();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    isOpen.value = false;
  }
}

function groupIcon(group: AddressBarSuggestionGroup) {
  if (group.id === 'userDirectories') {
    return MapPinIcon;
  }

  if (group.id === 'systemDrives') {
    return HardDriveIcon;
  }

  if (group.id === 'recent') {
    return ClockIcon;
  }

  if (group.id.startsWith('tag:')) {
    return TagIcon;
  }

  return FolderIcon;
}

async function open(modeToOpen: AddressBarEditorMode): Promise<void> {
  mode.value = modeToOpen;
  selectedIndex.value = -1;
  isOpen.value = true;

  await nextTick();
  suppressDebouncedSuggestionsOnQueryMutation.value = true;

  const initialQuery = modeToOpen === 'path' ? ensureAddressBarDirectoryQuery(props.currentPath) : '';

  query.value = initialQuery;
  suppressDebouncedSuggestionsOnQueryMutation.value = false;

  if (modeToOpen === 'path') {
    addressEditorNavigationSteps.value = initialQuery !== '' ? [initialQuery] : [];
    addressEditorNavigationIndex.value = 0;
  }
  else {
    addressEditorNavigationSteps.value = [];
    addressEditorNavigationIndex.value = 0;
  }

  seedStableDriveListSnapshotFromLiveCache();

  suggestionState.value = {
    kind: 'empty',
    groups: modeToOpen === 'entry' ? entryModeGroups.value : [],
    exactEntry: null,
    directoryPath: null,
  };

  await nextTick();
  await refreshSuggestions(query.value);

  void hydrateStableDriveListSnapshotFromRust().then(async () => {
    if (!isOpen.value) {
      return;
    }

    await refreshSuggestions(query.value, 'preserve');
  });

  await moveAddressBarInputCaretToEndAfterPaint();
}

async function moveAddressBarInputCaretToEndAfterPaint(): Promise<void> {
  await nextTick();
  requestAnimationFrame(() => {
    const inputElement = getAddressBarInputElement();

    if (!inputElement) {
      return;
    }

    const length = inputElement.value.length;
    inputElement.setSelectionRange(length, length);
  });
}

function getAddressBarInputElement(): HTMLInputElement | null {
  return addressBarCommandInputMountReference.value?.querySelector('input') ?? null;
}

function restoreAddressBarInputFocusAfterScrollbarPointerDown(event: PointerEvent): void {
  const pointerTarget = event.target;

  if (
    !(pointerTarget instanceof Element)
    || !pointerTarget.closest('.sigma-ui-scroll-area-scrollbar')
  ) {
    return;
  }

  requestAnimationFrame(() => {
    if (isOpen.value) {
      getAddressBarInputElement()?.focus({ preventScroll: true });
    }
  });
}

function close(): void {
  isOpen.value = false;
}

defineExpose({
  open,
  close,
});
</script>

<template>
  <CommandDialog
    v-model:open="dialogOpen"
    command-ignore-filter
    :command-reset-search-term-on-blur="false"
    :command-reset-search-term-on-select="false"
    :accessible-title="t('settings.addressBar.editAddress')"
    :accessible-description="t('settings.addressBar.dialogAccessibleDescription')"
  >
    <div ref="addressBarCommandInputMountReference">
      <CommandInput
        v-bind="pathEditorYieldMarkerBindings"
        v-model="query"
        :placeholder="inputPlaceholder"
        @keydown="handleInputKeydown"
      />
    </div>
    <ScrollAreaRoot
      v-bind="pathEditorYieldMarkerBindings"
      type="auto"
      class="sigma-ui-scroll-area address-bar-editor__scroll-root"
      @pointerdown.capture="restoreAddressBarInputFocusAfterScrollbarPointerDown"
    >
      <ScrollAreaViewport
        :ref="suggestionVirtualList.setScrollViewportRef"
        class="sigma-ui-scroll-area__viewport address-bar-editor__viewport"
        @scroll.passive="suggestionVirtualList.handleScroll"
      >
        <div
          v-if="flatNavigableRowCount === 0"
          class="address-bar-editor__empty"
        >
          {{ t('settings.addressBar.noMatchingEntries') }}
        </div>
        <div
          v-else
          class="address-bar-editor__scroll-inner"
          :style="suggestionVirtualSpacerStyle"
          :data-virtual-total-rows="suggestionVirtualRows.length"
          :data-virtual-visible-rows="visibleSuggestionVirtualRows.length"
          :data-virtual-viewport-height="suggestionVirtualViewportHeight"
        >
          <div
            class="address-bar-editor__virtual-window"
            :style="suggestionVirtualWindowStyle"
          >
            <template
              v-for="virtualRow in visibleSuggestionVirtualRows"
              :key="virtualRow.item.key"
            >
              <button
                v-if="virtualRow.item.type === 'collapsible-header'"
                type="button"
                class="address-bar-editor__group-trigger"
                :style="{ height: `${virtualRow.size}px` }"
                :aria-expanded="isGroupOpen(virtualRow.item.group.id)"
                :data-address-bar-editor-index="virtualRow.item.navigationIndex"
                :data-selected="virtualRow.item.navigationIndex === selectedIndex ? true : undefined"
                @mousedown.prevent="selectCollapsibleGroupHeader(virtualRow.item.group)"
                @click="setGroupOpen(
                  virtualRow.item.group.id,
                  !isGroupOpen(virtualRow.item.group.id),
                )"
              >
                <ChevronDownIcon
                  v-if="isGroupOpen(virtualRow.item.group.id)"
                  :size="14"
                />
                <ChevronRightIcon
                  v-else
                  :size="14"
                />
                <component
                  :is="groupIcon(virtualRow.item.group)"
                  :size="14"
                  class="address-bar-editor__group-icon"
                />
                <span class="address-bar-editor__group-label">{{ virtualRow.item.group.label }}</span>
                <span class="address-bar-editor__group-count">{{ virtualRow.item.itemCount }}</span>
              </button>
              <div
                v-else-if="virtualRow.item.type === 'group-heading'"
                class="address-bar-editor__group-heading"
                :style="{ height: `${virtualRow.size}px` }"
              >
                {{ virtualRow.item.group.label }}
              </div>
              <AddressBarSuggestionRow
                v-else
                :style="{ height: `${virtualRow.size}px` }"
                :suggestion="virtualRow.item.suggestion"
                :item-index="virtualRow.item.navigationIndex"
                :shows-path-beside-name="showsPathBesideSuggestionName"
                :selected="virtualRow.item.navigationIndex === selectedIndex"
                :recent-entry-remove-label="virtualRow.item.groupId === 'recent' ? t('settings.addressBar.removeRecentEntry') : undefined"
                @activate="openEntry(virtualRow.item.suggestion.entry)"
                @remove-recent-entry="removeRecentHistoryRow(
                  virtualRow.item.suggestion,
                  virtualRow.item.navigationIndex,
                )"
              />
            </template>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaCorner />
    </ScrollAreaRoot>
    <Separator />
    <div class="address-bar-editor__hints">
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ hintKeyLabels.navigate }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.navigate') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ hintKeyLabels.expand }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.expand') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ hintKeyLabels.open }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.open') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ hintKeyLabels.reveal }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.reveal') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ addressBarNavigatorShortcutHintLabels.navigateHistoryBack }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.historyBack') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ addressBarNavigatorShortcutHintLabels.navigateHistoryForward }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.historyForward') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ addressBarNavigatorShortcutHintLabels.goUpDirectory }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.goUp') }}</span>
      </div>
      <div class="address-bar-editor__hint-block">
        <span class="address-bar-editor__hint-key">{{ hintKeyLabels.close }}</span>
        <span class="address-bar-editor__hint-label">{{ t('settings.addressBar.hints.close') }}</span>
      </div>
    </div>
  </CommandDialog>
</template>

<style>
.sigma-ui-dialog-overlay:has(+ .sigma-ui-command-dialog .address-bar-editor__scroll-root) {
  backdrop-filter: none;
  background-color: transparent;
  pointer-events: none;
}

.sigma-ui-command-dialog:has(.address-bar-editor__scroll-root) {
  width: 90vw;
  max-width: 860px;
  height: 86vh;
}

@media (width >= 900px) {
  .sigma-ui-command-dialog:has(.address-bar-editor__scroll-root) {
    width: 65vw;
  }
}

.sigma-ui-command-dialog:has(.address-bar-editor__scroll-root) .sigma-ui-command-dialog__command {
  min-height: 0;
}

.address-bar-editor__scroll-root {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.address-bar-editor__viewport {
  height: 100%;
  min-height: 0;
  overscroll-behavior: contain;
}

.address-bar-editor__scroll-inner {
  --address-bar-editor-row-py: 6px;
  --address-bar-editor-row-px: 16px;
  --address-bar-editor-grid-columns: minmax(0, 1fr);

  position: relative;
  width: 100%;
}

.address-bar-editor__virtual-window {
  position: absolute;
  display: flex;
  flex-direction: column;
  inset-inline: 0;
  will-change: transform;
}

.address-bar-editor__empty {
  padding: 1.5rem 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: var(--text-sm);
  text-align: center;
}

.address-bar-editor__group-heading {
  flex-shrink: 0;
  padding: 0.5rem 1rem 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
}

.address-bar-editor__group-trigger {
  display: flex;
  width: 100%;
  flex-shrink: 0;
  align-items: center;
  padding: 0.375rem 1rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  gap: 0.375rem;
  padding-inline-end: 1.5rem;
  text-align: start;
}

.address-bar-editor__group-trigger:hover:not([data-selected]) {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.address-bar-editor__group-trigger[data-selected] {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 40%);
  color: hsl(var(--foreground));
}

.address-bar-editor__group-trigger[data-selected]:hover {
  background-color: hsl(var(--primary) / 18%);
}

.address-bar-editor__group-icon {
  flex-shrink: 0;
}

.address-bar-editor__group-label {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-bar-editor__group-count {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
}

.address-bar-editor__hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 0.5rem 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  gap: 8px;
}

.address-bar-editor__hint-block {
  display: flex;
  height: 20px;
  align-items: center;
  border-radius: var(--radius-sm);
  gap: 2px;
}

.address-bar-editor__hint-label {
  display: flex;
  height: 100%;
  align-items: center;
  padding: 0.075rem 0;
  line-height: 1.2;
}

.address-bar-editor__hint-key {
  display: flex;
  height: 100%;
  flex-shrink: 0;
  align-items: center;
  padding: 0.0625rem 0.3125rem;
  border-radius: calc(var(--radius-sm) - 1px);
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
}
</style>
