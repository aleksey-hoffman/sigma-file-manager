<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {VirtualScroller, VirtualScrollerRow} from 'sigma-scrollkit';
import {ref, computed} from 'vue';
import {useI18n} from 'vue-i18n';
import {DirEntryGridDir, DirEntryGridFile, DirEntrySpacer, DirEntryDivider} from '@/components/navigator/dir-entry';
import {useViewFilterStore} from '@/stores/runtime/view-filter';
import uniqueId from '@/utils/unique-id';
import {filterNavigatorView} from '@/utils/view-filter';
import type {DirEntry, Divider, Spacer} from '@/types/dir-entry';
import type {Tab} from '@/types/workspaces';
import type {VirtualEntry} from 'sigma-scrollkit/types/shared';
import type {Ref, Component} from 'vue';

interface Props {
  tab: Tab;
  renderContents?: boolean;
}

interface Emits {
  (event: 'viewport-mounted', value: {viewport: Ref<HTMLElement | null>; selector: string}): void;
  (event: 'top-reached', value: boolean): void;
  (event: 'bottom-reached', value: boolean): void;
}

type VirtualEntryItem = DirEntry | Divider | Spacer;

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const {t} = useI18n();

const viewFilterStore = useViewFilterStore();

const navigatorVirtualGridRef = ref<InstanceType<typeof VirtualScroller> | null>(null);
const isScrollable = ref<boolean>(false);
const groupDirEntries = ref<boolean>(true);
const showDirEntryKindDividers = ref<boolean>(false);
const minColumnWidth = ref<number>(200);

type ComponentReferenceType = {
  [key: string]: Component | string;
};

const componentReference: ComponentReferenceType = {
  DirEntryDivider,
  DirEntrySpacer,
  DirEntryGridDir,
  DirEntryGridFile,
  div: 'div'
};

const formattedDirEntriesGrid = computed<VirtualEntry[]>(() => {
  if (props.tab.dirEntries.length === 0) {
    return [] as VirtualEntry[];
  }
  let results = [] as VirtualEntry[];

  if (groupDirEntries.value) {
    results = [
      ...dirsDividerVirtualEntry.value,
      ...dirsVirtualEntry.value,
      ...filesDividerVirtualEntry.value,
      ...filesVirtualEntry.value,
      ...bottomSpacerVirtualEntry.value
    ] as VirtualEntry[];
  } else if (showDirEntryKindDividers.value) {
    results = [
      ...dirsDividerVirtualEntry.value,
      ...dirsVirtualEntry.value,
      ...filesDividerVirtualEntry.value,
      ...imageFilesVirtualEntry.value,
      ...videoFilesVirtualEntry.value,
      ...otherFilesVirtualEntry.value
    ] as VirtualEntry[];
  } else {
    results = [
      ...dirsVirtualEntry.value,
      ...filesVirtualEntry.value
    ] as VirtualEntry[];
  }

  results.forEach(virtualEntry => {
    if (virtualEntry.type === 'dirs') {
      virtualEntry.component = 'DirEntryGridDir';
    } else if (virtualEntry.type === 'files') {
      virtualEntry.component = 'DirEntryGridFile';
    }
  });
  return results;
});

const directoryDirEntries = computed(() => [...filteredDirEntries(props.tab.dirEntries.filter(item => item.is_dir))]);
const fileDirEntries = computed(() => [...filteredDirEntries(props.tab.dirEntries.filter(item => item.is_file))]);
const imageFileDirEntries = computed(() => [...fileDirEntries.value.filter(item => item?.mime?.startsWith('image'))]);
const videoFileDirEntries = computed(() => [...fileDirEntries.value.filter(item => item?.mime?.startsWith('video'))]);
const otherFileDirEntries = computed(() => [...fileDirEntries.value.filter(item => !item?.mime?.startsWith('image') && !item?.mime?.startsWith('video'))]);

const dirsVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'dirs',
    height: 56,
    rowGap: 16,
    columnGap: 16,
    items: directoryDirEntries.value
  }] satisfies VirtualEntry[]
));

const filesVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'files',
    height: 150,
    rowGap: 16,
    columnGap: 16,
    items: fileDirEntries.value
  }] satisfies VirtualEntry[]
));

const imageFilesVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'files',
    height: 150,
    rowGap: 16,
    columnGap: 16,
    items: imageFileDirEntries.value
  }] satisfies VirtualEntry[]
));

const videoFilesVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'files',
    height: 150,
    rowGap: 16,
    columnGap: 16,
    items: videoFileDirEntries.value
  }] satisfies VirtualEntry[]
));

const otherFilesVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'files',
    height: 150,
    rowGap: 16,
    columnGap: 16,
    items: otherFileDirEntries.value
  }] satisfies VirtualEntry[]
));

const dirsDividerVirtualEntry = computed(() => (
  directoryDirEntries.value.length > 0
    ? [{
      id: uniqueId(),
      type: 'dirs-divider',
      fullWidth: true,
      height: 48,
      rowGap: 16,
      columnGap: 16,
      component: 'DirEntryDivider',
      items: directoryDividerEntry.value
    }] satisfies VirtualEntry[]
    : [] satisfies VirtualEntry[]
));

const filesDividerVirtualEntry = computed(() => (
  fileDirEntries.value.length > 0
    ? [{
      id: uniqueId(),
      type: 'files-divider',
      fullWidth: true,
      height: 48,
      rowGap: 16,
      columnGap: 16,
      component: 'DirEntryDivider',
      items: fileDividerEntry.value
    }] satisfies VirtualEntry[]
    : [] satisfies VirtualEntry[]
));

const bottomSpacerVirtualEntry = computed(() => (
  [{
    id: uniqueId(),
    type: 'bottom-spacer',
    fullWidth: true,
    height: 64,
    rowGap: 16,
    columnGap: 16,
    component: 'DirEntrySpacer',
    items: bottomSpacerEntry.value
  }] satisfies VirtualEntry[]
));

const directoryDividerEntry = computed(() => (
  directoryDirEntries.value.length > 0
    ? [{
      title: getDirEntryGroupTitle('dir'),
      type: 'dirs-divider'
    }] satisfies VirtualEntryItem[]
    : [] satisfies VirtualEntryItem[]
));

const fileDividerEntry = computed(() => (
  fileDirEntries.value.length > 0
    ? [{
      title: getDirEntryGroupTitle('file'),
      type: 'files-divider'
    }] satisfies VirtualEntryItem[]
    : [] satisfies VirtualEntryItem[]
));

const bottomSpacerEntry = computed(() => (
  [{
    type: 'bottom-spacer',
    props: {
      showScrollTopButton: isScrollable.value,
      onClick: () => {
        navigatorVirtualGridRef?.value?.scrollTop();
      }
    }
  }] satisfies VirtualEntryItem[]
));

function sortedDirEntries(dirEntries: DirEntry[]) {
  return dirEntries;
}

function filteredDirEntries(dirEntries: DirEntry[]) {
  return filterNavigatorView({
    query: props.tab.filterQuery,
    items: dirEntries,
    options: viewFilterStore.viewFilter.navigator.options,
    properties: viewFilterStore.viewFilter.navigator.properties,
    showHiddenItems: viewFilterStore.showHiddenItems
  });
}

function getDirEntryGroupTitle (type: string): string {
  if (type === 'dir') {
    const itemCount = directoryDirEntries.value.length;
    return `${t('directories')} | ${t('item', itemCount)}`;
  } else if (type === 'file') {
    const itemCount = fileDirEntries.value.length;
    return `${t('files')} | ${t('item', itemCount)}`;
  } else if (type === 'image') {
    const itemCount = imageFileDirEntries.value.length;
    return `${t('images')} | ${t('item', itemCount)}`;
  } else if (type === 'video') {
    const itemCount = videoFileDirEntries.value.length;
    return `${t('videos')} | ${t('item', itemCount)}`;
  } else if (type === 'other') {
    const itemCount = otherFileDirEntries.value.length;
    return `${t('other')} | ${t('item', itemCount)}`;
  } else {
    return '';
  }
}
</script>

<template>
  <VirtualScroller
    ref="navigatorVirtualGridRef"
    layout-type="grid"
    :scroller-id="tab.id"
    :virtual-entries="formattedDirEntriesGrid"
    :min-column-width="minColumnWidth"
    @viewport-mounted="emit('viewport-mounted', $event)"
    @top-reached="emit('top-reached', $event)"
    @bottom-reached="emit('bottom-reached', $event)"
    @is-scrollable="isScrollable = $event"
  >
    <template #viewport="{ renderedItems, scrolling, maxColumns }">
      <VirtualScrollerRow
        v-for="virtualEntry in (renderedItems as VirtualEntry[])"
        :key="virtualEntry.id"
        :virtual-entry="virtualEntry"
        :max-columns="maxColumns"
      >
        <Component
          :is="componentReference[virtualEntry.component as string]"
          v-for="(item, index) in (virtualEntry.items as DirEntry[] | Divider[] | Spacer[])"
          :key="index"
          :hover-enabled="!scrolling"
          :dir-entry="item"
          :render-contents="renderContents"
          layout-type="grid"
          v-bind="'props' in item && item.props"
          :style="`height: ${virtualEntry.height}px`"
        />
      </VirtualScrollerRow>
    </template>
  </VirtualScroller>
</template>