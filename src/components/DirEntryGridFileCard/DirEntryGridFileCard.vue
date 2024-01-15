<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {Icon} from '@iconify/vue';
import {DirEntryCardBase} from '@/components/DirEntryCardBase';
import toReadableBytes from '@/utils/toReadableBytes';

import type {DirEntry} from '@/types/dirEntry';

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
const dirEntryRef = ref<HTMLElement | null>(null);
const mediaType = computed(() => props.dirEntry?.mime?.split('/')[0]);
</script>

<template>
  <div
    ref="dirEntryRef"
    class="dir-entry-grid-file-card"
    :entry-path="props.dirEntry.path"
    :layout-type="props.layoutType"
    :entry-type="props.dirEntry.is_dir ? 'dir' : 'file'"
    :media-type="mediaType"
  >
    <DirEntryCardBase
      :card-design="cardDesign"
      :hover-enabled="props.hoverEnabled"
      :render-contents="renderContents"
    >
      <div class="dir-entry-grid-file-card__overlay" />
      <div class="dir-entry-grid-file-card__overlay-2" />
      <div class="dir-entry-grid-file-card__overlay-3" />
      <div class="dir-entry-grid-file-card__preview-blur" />
      <div class="dir-entry-grid-file-card__preview" />
      <div class="dir-entry-grid-file-card__icon">
        <Icon
          icon="ph:file-text-light"
        />
      </div>
      <div class="dir-entry-grid-file-card__content">
        <div class="dir-entry-grid-file-card__bottom-container">
          <div class="dir-entry-grid-file-card__bottom-container-title">
            {{ props.dirEntry.name }}
          </div>
          <div class="dir-entry-grid-file-card__bottom-container-description">
            {{ toReadableBytes(props.dirEntry.size) }} {{ props.dirEntry.mime ? `| ${props.dirEntry.mime}` : '' }}
          </div>
        </div>
      </div>
    </DirEntryCardBase>
  </div>
</template>

<style>
.dir-entry-grid-file-card {
  --content-bottom-container-height: 56px;

  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background-color: var(--highlight-color-opacity-5);
  transition: var(--dir-entry-card-transition);
  user-select: none;
}

.dir-entry-grid-file-card__icon {
  position: absolute;
  z-index: 0;
  top: 32px;
  left: calc(50% - (32px / 2));
  width: 100%;
  height: 100%;
  font-size: 32px;
}

.dir-entry-grid-file-card__preview {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.dir-entry-grid-file-card__preview-blur {
  --image-blur-size: 8px;

  position: absolute;
  z-index: 1;
  top: calc(var(--image-blur-size) * -1);
  left: calc(var(--image-blur-size) * -1);
  overflow: hidden;
  width: calc(100% + (var(--image-blur-size) * 2));
  height: calc(100% + (var(--image-blur-size) * 2));
  opacity: 0.6;
  transform: translate3d(0, 0, 0); /* enable GPU acceleration */

  /* Causes freezes on some linux configs */

  /* filter: blur(96px); */
}

.dir-entry-grid-file-card__preview-blur-image {
  width: 100%;
  height: 100%;
  filter: brightness(0.9) contrast(1.1) invert(0.1) saturate(2); /* even out the colors  */
}

.dir-entry-grid-file-card__preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translate3d(0, 0, 0); /* enable GPU acceleration */
}

.dir-entry-grid-file-card__content {
  position: absolute;
  z-index: 3;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.dir-entry-grid-file-card__bottom-container {
  position: absolute;
  z-index: 3;
  bottom: 0;
  left: 0;
  display: flex;
  width: 100%;
  height: var(--content-bottom-container-height);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 16px;
  backdrop-filter: blur(12px);
  text-align: center;
  transform: translate3d(0, 0, 0); /* enable GPU acceleration */
}

.dir-entry-grid-file-card__bottom-container-title {
  overflow: hidden;
  max-width: 90%;
  color: var(--color-lighter-1);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-entry-grid-file-card__bottom-container-description {
  overflow: hidden;
  max-width: 90%;
  color: var(--color);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-entry-grid-file-card[media-type="image"]
  .dir-entry-grid-file-card__overlay {
    position: absolute;
    z-index: 3;
    bottom: -1px;
    left: 0;
    width: 100%;
    height: var(--content-bottom-container-height);
    background-image: linear-gradient(0deg, rgb(0 0 0 / 10%) 0%, rgb(0 0 0 / 50%) 30%, rgb(0 0 0 / 0%) 100%);
  }
</style>