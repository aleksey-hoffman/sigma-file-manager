<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ref, watch} from 'vue';
import {DirEntryListSection} from '@/components/DirEntryListSection';
import {DirEntryGridSection} from '@/components/DirEntryGridSection';
import {useUserSettingsStore} from '@/stores/storage/userSettings';
import {useOverlayScrollbars} from 'overlayscrollbars-vue';
import getOverlayScrollbarsOptions from '@/utils/getOverlayScrollbarsOptions';
import animateRange from '@/utils/animateRange';
import type {Tab} from '@/types/workspaces';

interface Props {
  tab: Tab;
  renderContents?: boolean;
}

const props = defineProps<Props>();

const userSettingsStore = useUserSettingsStore();

const [initialize] = useOverlayScrollbars({options: getOverlayScrollbarsOptions(), defer: false});

const rootRef = ref<HTMLElement | null>(null);
const bottomFadeMaskHeight = ref<number>(10);
const bottomFadeMaskHeightCurrentValue = ref<number>(10);
const topReached = ref<boolean>(false);
const bottomReached = ref<boolean>(false);

watch(bottomReached, newValue => {
  console.log('bottomReached');
  if (newValue) {
    animateRange({
      start: bottomFadeMaskHeight.value,
      end: 0,
      steps: 10,
      stepDuration: 2,
      target: bottomFadeMaskHeightCurrentValue
    });
  } else {
    animateRange({
      start: 0,
      end: bottomFadeMaskHeight.value,
      steps: 10,
      stepDuration: 2,
      target: bottomFadeMaskHeightCurrentValue
    });
  }
});

function virtualScrollerViewportMounted (params) {
  if (!rootRef.value) {
    return;
  }

  initialize({
    target: rootRef.value,
    elements: {
      viewport: params.viewport.value
    }
  });
}
</script>

<template>
  <div
    ref="rootRef"
    data-overlayscrollbars
    class="dir-entry-card-section fade-mask--bottom"
    :style="{
      '--fade-mask-bottom': `${bottomFadeMaskHeightCurrentValue}%`
    }"
  >
    <DirEntryGridSection
      v-if="userSettingsStore.userSettings.navigator.layout.type.name === 'grid'"
      :tab="props.tab"
      :render-contents="renderContents"
      @viewport-mounted="virtualScrollerViewportMounted"
      @top-reached="topReached = $event"
      @bottom-reached="bottomReached = $event"
    />
    <DirEntryListSection
      v-if="userSettingsStore.userSettings.navigator.layout.type.name === 'list'"
      :tab="props.tab"
      :render-contents="renderContents"
      @viewport-mounted="virtualScrollerViewportMounted"
      @top-reached="topReached = $event"
      @bottom-reached="bottomReached = $event"
    />
  </div>
</template>

<style>
.dir-entry-card-section {
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--navigator-toolbar-height)
  );
  padding: 0 24px;
}

.dir-entry-card-section[sorting-display-type="toolbar"] {
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--navigator-toolbar-height) -
    var(--navigator-sorting-header-height)
  );
}
</style>