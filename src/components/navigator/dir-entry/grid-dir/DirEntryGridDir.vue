<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {ref} from 'vue';
import {DirEntryBase} from '@/components/navigator/dir-entry';
import type {DirEntry} from '@/types/dir-entry';

interface Props {
  dirEntry: DirEntry;
  layoutType: 'list' | 'grid';
  hoverEnabled?: boolean;
  renderContents?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hoverEnabled: true,
  renderContents: true
});

const cardDesign = ref('infusive-flat-glow');
</script>

<template>
  <div
    ref="dirEntryRef"
    class="dir-entry-grid-dir"
    :entry-path="props.dirEntry.path"
    :layout-type="props.layoutType"
    :entry-type="props.dirEntry.is_dir ? 'dir' : 'file'"
  >
    <DirEntryBase
      :card-design="cardDesign"
      :hover-enabled="props.hoverEnabled"
      :render-contents="renderContents"
    >
      <div class="dir-entry-grid-dir__preview">
        <Icon
          icon="mdi:folder-outline"
          width="28"
        />
      </div>
      <div class="dir-entry-grid-dir__content">
        <div class="dir-entry-grid-dir__content-title">
          {{ props.dirEntry.name }}
        </div>
        <div class="dir-entry-grid-dir__content-description">
          {{ $t('item', { n: props.dirEntry.item_count }) }}
        </div>
      </div>
    </DirEntryBase>
  </div>
</template>

<style>
.dir-entry-grid-dir {
  position: relative;
  color: var(--color-darker-2);
  transition: var(--dir-entry-transition);
  user-select: none;
}

.dir-entry-grid-dir
  .dir-entry-base {
    background-color: rgb(255 255 255 / 2%);
  }

.dir-entry-grid-dir
  .dir-entry-base__inner {
    display: grid;
    grid-template-columns: 64px 1fr;
  }

.dir-entry-grid-dir__preview {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.dir-entry-grid-dir__content {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  justify-content: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-entry-grid-dir__content-title {
  overflow: hidden;
  max-width: 90%;
  color: var(--color-darker-2);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-entry-grid-dir__content-description {
  overflow: hidden;
  max-width: 90%;
  color: var(--color-darker-4);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>