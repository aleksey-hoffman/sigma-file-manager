<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {ref} from 'vue';
import {DynamicText} from '@/components/app/dynamic-text';
import {DirEntryBase} from '@/components/navigator/dir-entry';
import type {DirEntry} from '@/types/dir-entry';

interface Props {
  dirEntry: DirEntry;
  height: number;
  layoutType: 'list' | 'grid';
  fontSize?: number;
  minFontSize?: number;
  maxFontSize?: number;
  hoverEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hoverEnabled: true,
  fontSize: 16,
  minFontSize: 12,
  maxFontSize: 16
});

const cardDesign = ref('infusive-flat-glow');
</script>

<template>
  <DirEntryBase
    :card-design="cardDesign"
    :hover-enabled="props.hoverEnabled"
  >
    <div
      class="dir-entry-list-file"
      :layout-type="props.layoutType"
      :entry-type="props.dirEntry.is_dir ? 'dir' : 'file'"
      :style="`grid-template-columns: ${props.height}px 1fr;`"
    >
      <div class="dir-entry-list-file__preview">
        <!-- Use dynamic component -->
        <Icon
          v-if="dirEntry.is_dir"
          icon="mdi:folder-outline"
          width="24"
        />
        <Icon
          v-else-if="dirEntry.is_file"
          icon="mdi:file-outline"
          width="24"
        />
        <!-- <img
          v-else-if="dirEntry.is_file && dirEntry?.mime?.startsWith('image')"
          :src="dirEntry.path"
        > -->
      </div>
      <DynamicText
        class="dir-entry-list-file__content"
        :height="props.height"
      >
        <div class="dir-entry-list-file__content-block">
          {{ props.dirEntry.name }}
        </div>
      </DynamicText>
    </div>
  </DirEntryBase>
</template>

<style>
.dir-entry-list-file {
  position: relative;
  z-index: 1;
  display: grid;
  overflow: hidden;
  height: 100%;
  align-items: center;
  padding-right: 12px;
  color: var(--color-darker-2);
  gap: 16px;
  grid-template-columns: 64px 1fr;
  transition: var(--dir-entry-transition);
  user-select: none;
}

.dir-entry-list-file__preview {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background-color: rgb(255 255 255 / 4%);
}

.dir-entry-list-file__content {
  overflow: auto;
}

.dir-entry-list-file__content-block {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
</style>