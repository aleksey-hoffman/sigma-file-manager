<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

FORK-MODIFICATION: tree view. Keep during upstream sync.
Tracking issue: aleksey-hoffman/sigma-file-manager#499

v6: this component is now store-driven (no defineExpose, no template ref
forwarding). Expansion state lives in `useFolderTreeStore`; this component
just renders `rows` computed from `useFileTree({ expandedPaths, ... })`,
where `useFileTree` itself watches `expandedPaths` and lazy-loads children.
When `store.selectedPath` changes, ancestors are added to the dynamic root
list and loaded. Failures surface via `store.markLoadError` and the row
stays visible (just with no children). See handoff-2026-09-26-tree-sync-retro.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FileIcon,
  HardDriveIcon,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import {
  computeAncestorPaths,
  useFolderTreeStore,
} from '@/stores/runtime/folder-tree';
import { useFileTree } from '@/modules/navigator/composables/use-file-tree';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { revealInExplorer } from '@/utils/open-in-explorer';
import { openNativeProperties } from '@/utils/open-native-properties';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import FileTreeContextMenu from './file-tree-context-menu.vue';
import type { DirEntry } from '@/types/dir-entry';

const props = withDefaults(defineProps<{
  /** Root directory paths (typically the drives from `useDrives()`).
   *  Ancestors of the selected path that are *not* in this list are still
   *  loadable — `useFileTree` walks up to a known ancestor in the tree
   *  instead of duplicating the path as a new root. This keeps the depth
   *  display correct (see handoff-2026-09-26-tree-sync-v6-3.md). */
  rootPaths?: string[];
  /** v6.4: optional display-name overrides for root paths (e.g. drive
   *  volume labels like "系统盘 (C:)"). Pass the drives' names here. */
  rootLabels?: Record<string, string>;
  /** v6.4: paths that are drive roots (vs regular folders). Used by the
   *  template to swap the folder icon for a hard-drive icon. */
  drivePaths?: string[];
}>(), {
  rootPaths: () => [],
  rootLabels: () => ({}),
  drivePaths: () => [],
});

const emit = defineEmits<{
  activate: [path: string];
}>();

const folderTreeStore = useFolderTreeStore();
const { expandedPaths, selectedPath } = storeToRefs(folderTreeStore);

// FORK-MODIFICATION: 目录树右键菜单（C 范围）。详见 spec §5.4。
// tree 节点的 FileTreeFlatRow 不是完整 DirEntry；右键菜单只需 path + isDirectory。
// reka-ui ContextMenuRoot 自己管 open 状态,这里只记 target 即可。
const clipboardStore = useClipboardStore();

interface TreeMenuTarget {
  path: string;
  isDirectory: boolean;
}
const contextMenuTarget = ref<TreeMenuTarget | null>(null);

function openContextMenu(row: { path: string; isDirectory: boolean }) {
  contextMenuTarget.value = { path: row.path, isDirectory: row.isDirectory };
}

function closeContextMenu() {
  contextMenuTarget.value = null;
}

async function handleContextAction(name: string) {
  const target = contextMenuTarget.value;
  closeContextMenu();
  if (!target) {
    return;
  }

  switch (name) {
    case 'copy-path': {
      await navigator.clipboard.writeText(target.path).catch((err: unknown) => {
        console.error('clipboard writeText failed:', err);
      });
      break;
    }
    case 'paste': {
      if (clipboardStore.pasteItems && target.isDirectory) {
        try {
          await clipboardStore.pasteItems(target.path);
        }
        catch (err) {
          console.error('paste failed:', err);
        }
      }
      break;
    }
    case 'open-containing-directory': {
      if (!target.isDirectory) {
        try {
          await revealInExplorer(target.path);
        }
        catch (err) {
          console.error('revealInExplorer failed:', err);
        }
      }
      break;
    }
    case 'properties': {
      if (target.isDirectory) {
        // 对目录构造最小 DirEntry（openNativeProperties 接受数组）
        const fakeEntry = {
          path: target.path,
          name: target.path.split(/[\\/]/).pop() ?? '',
          is_dir: true,
        } as unknown as DirEntry;
        await openNativeProperties([fakeEntry]).catch((err: unknown) => {
          console.error('openNativeProperties failed:', err);
        });
      }
      break;
    }
    default:
      // 其他 action 由父级扩展；本轮范围 C 不覆盖
      break;
  }
}

// Set for O(1) drive-path lookup during template render.
const drivePathSet = computed<Set<string>>(() => new Set(props.drivePaths ?? []));

function isDrivePath(path: string): boolean {
  return drivePathSet.value.has(path);
}

const { rows, ensureAncestorsLoaded, invalidate } = useFileTree({
  rootPaths: () => props.rootPaths,
  rootLabels: () => props.rootLabels ?? {},
  expandedPaths,
  onLoadStart: (path) => {
    folderTreeStore.markLoadError(path, false);
    folderTreeStore.markLoading(path, true);
  },
  onLoadEnd: (path) => {
    folderTreeStore.markLoading(path, false);
  },
  onLoadError: (path, err) => {
    folderTreeStore.markLoading(path, false);
    folderTreeStore.markLoadError(path, true);
    console.error('[file-browser-tree-view] failed to load', path, err);
  },
});

// v6.5: filesystem mutations (create / rename / delete) run in the file browser
// panes, which know nothing about the tree and cannot reach it. They publish
// the affected directory into the folder-tree store; this is the single place
// that turns those into an actual re-read. `immediate` so a mount also picks
// up invalidations published while the tree panel was hidden.
watch(() => folderTreeStore.staleTreeRevision, () => {
  for (const stalePath of folderTreeStore.consumeStaleTreePaths()) {
    void invalidate(stalePath);
  }
}, { immediate: true });

// Whenever the selected path changes, make sure every ancestor directory has
// its children loaded so the user sees the selected entry highlighted in its
// expanded ancestor chain.
watch(selectedPath, async (path) => {
  if (!path) return;
  await ensureAncestorsLoaded(computeAncestorPaths(path));
}, { immediate: true });

// v6.3: separate the chevron click (expand/collapse only) from the row
// click (emit activate → parent navigates). Per user feedback: clicking the
// icon should expand/collapse without changing the current path; clicking
// the name (or row body) should open/navigate.
function onChevronClick(row: { path: string }) {
  folderTreeStore.toggleExpanded(row.path);
}

function onRowClick(row: { path: string; isDirectory: boolean }) {
  emit('activate', row.path);
  // Don't manually toggle expand on name click — the store's
  // setSelectedPath already auto-expands ancestors when the parent
  // (navigator.vue) syncs the new selected path into the store.
}

function isRowSelected(path: string): boolean {
  return folderTreeStore.selectedPath === path;
}

function isRowLoading(path: string): boolean {
  return folderTreeStore.isLoading(path);
}

function isRowLoadError(path: string): boolean {
  return folderTreeStore.hasLoadError(path);
}

function getRowIcon(row: { path: string; isDirectory: boolean }): typeof FolderIcon {
  if (!row.isDirectory) return FileIcon;
  // v6.4: drive roots use the hard-drive icon to distinguish them from
  // regular folders.
  return isDrivePath(row.path) ? HardDriveIcon : FolderIcon;
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div class="file-tree-view" data-e2e-root="file-tree-view">
        <div
          v-for="row in rows"
          :key="row.path"
          class="file-tree-row"
          :class="{
            'file-tree-row--selected': isRowSelected(row.path),
            'file-tree-row--loading': isRowLoading(row.path),
            'file-tree-row--error': isRowLoadError(row.path),
          }"
          :style="{ paddingLeft: `${row.depth * 16 + 8}px` }"
          :aria-expanded="row.isDirectory ? row.isExpanded : undefined"
          :data-tree-path="row.path"
          :data-selected="isRowSelected(row.path) || undefined"
          :title="row.path"
          @click="onRowClick(row)"
          @contextmenu="openContextMenu(row)"
        >
          <component
            :is="row.isDirectory && row.isExpanded ? ChevronDownIcon : ChevronRightIcon"
            v-if="row.isDirectory"
            :size="14"
            class="file-tree-row__chevron"
            @click.stop="onChevronClick(row)"
          />
          <span v-else class="file-tree-row__spacer" />
          <component
            :is="getRowIcon(row)"
            :size="14"
          />
          <span class="file-tree-row__name" :title="row.name">{{ row.name }}</span>
          <span
            v-if="isRowLoadError(row.path)"
            class="file-tree-row__error-marker"
            title="Failed to load children"
          >!</span>
        </div>
      </div>
    </ContextMenuTrigger>
    <!--
      FORK-MODIFICATION: 目录树右键菜单(C 范围)。FileTreeContextMenu 内部
      第一行是 <ContextMenuContent>,从最近的 ContextMenuRoot 取上下文;
      用 v-if 让组件在 target 缺失时整体不挂载,避免空内容弹位置。
    -->
    <FileTreeContextMenu
      v-if="contextMenuTarget"
      :target="contextMenuTarget"
      @action="handleContextAction"
      @close="closeContextMenu"
    />
  </ContextMenu>
</template>

<style scoped>
.file-tree-view {
  overflow-y: auto;
  height: 100%;
  font-size: 13px;
}

.file-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 0;
  cursor: pointer;
  user-select: none;
}

.file-tree-row:hover {
  background-color: hsl(var(--muted) / 50%);
}

.file-tree-row--selected {
  background-color: hsl(var(--primary) / 18%);
}

.file-tree-row--loading {
  opacity: 0.6;
}

.file-tree-row__spacer {
  display: inline-block;
  width: 14px;
}

/* v6.3: chevron is a dedicated expand/collapse affordance — show its
 * own pointer cursor + hover background so the user can discover that
 * clicking it expands/collapses without navigating (the row body click
 * still navigates per the v6.2 contract). */
.file-tree-row__chevron {
  display: inline-flex;
  cursor: pointer;
  border-radius: 3px;
  padding: 1px;
  flex-shrink: 0;
}

.file-tree-row__chevron:hover {
  background-color: hsl(var(--muted) / 70%);
}

.file-tree-row__name {
  /* Keep one line per tree depth level so siblings align; long names clip
   * with ellipsis. The full path/name is also exposed via the `title`
   * attribute on the row + name span so hovering shows the whole thing in
   * a native tooltip — see handoff-2026-09-26-tree-sync-v6-2.md. */
  overflow-wrap: anywhere;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.file-tree-row__error-marker {
  margin-left: auto;
  color: hsl(var(--destructive));
  font-weight: 700;
}
</style>
