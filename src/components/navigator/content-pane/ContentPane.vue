<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {DirEntrySection} from '@/components/navigator/dir-entry-section';
import {WorkspaceToolbar} from '@/components/navigator/workspace-toolbar';
import type {Tab} from '@/types/workspaces';

interface Props {
  tab: Tab;
  renderContents?: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <div class="navigator-content-pane">
    <WorkspaceToolbar
      :tab="props.tab"
    />
    <DirEntrySection
      :tab="props.tab"
      :render-contents="renderContents"
    />
    <!-- <Suspense>
      <template #default>
        <DirEntryCardSection :tab="tab" />
      </template>
      <template #fallback>
        Loading...
      </template>
    </Suspense> -->
  </div>
</template>

<style>
.navigator-content-pane {
  height: var(--workspace-toolbar-height);
}
</style>