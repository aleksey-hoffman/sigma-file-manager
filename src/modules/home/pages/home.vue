<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import {
  DrivesSection,
  HomeBanner,
  UserDirectoriesSection,
} from '@/modules/home/components';
import { PageHomeLayout } from '@/layouts';
import { usePageDropZone } from '@/composables/use-page-drop-zone';
import { useFileDropOperation } from '@/composables/use-file-drop-operation';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';

const dropContainerRef = ref<HTMLElement | null>(null);

const {
  conflictDialogState,
  handleConflictResolution,
  handleConflictCancel,
  performDrop,
} = useFileDropOperation();

usePageDropZone({
  containerRef: dropContainerRef,
  onDrop: (sourcePaths, targetPath, operation) => {
    performDrop(sourcePaths, targetPath, operation);
  },
});
</script>

<template>
  <PageHomeLayout>
    <HomeBanner />

    <div
      ref="dropContainerRef"
      class="home-page__content"
    >
      <UserDirectoriesSection v-bind="getStaggerSlideUpBinding(0, {initialDelayMs: 0, stepMs: 300})" />
      <DrivesSection v-bind="getStaggerSlideUpBinding(1, {initialDelayMs: 0, stepMs: 300})" />
    </div>

    <FileBrowserConflictDialog
      v-model:open="conflictDialogState.isOpen"
      :conflicts="conflictDialogState.conflicts"
      :operation-type="conflictDialogState.operationType"
      :is-checking-conflicts="conflictDialogState.isCheckingConflicts"
      @resolve="handleConflictResolution"
      @cancel="handleConflictCancel"
    />
  </PageHomeLayout>
</template>

<style>
.home-page__content {
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 8px;
}
</style>
