<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Spacer} from '@/types/dirEntry';
import AppButton from '../AppButton/AppButton.vue';

interface Props {
  dirEntry: Spacer;
  showScrollTopButton?: boolean;
  hoverEnabled?: boolean;
  onClick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  showScrollTopButton: false,
  hoverEnabled: true
});
</script>

<template>
  <div class="dir-entry-spacer">
    <AppButton
      v-if="props.showScrollTopButton"
      type="button"
      size="default"
      button-class="button-1"
      @click="props.onClick?.()"
    >
      Scroll top
    </AppButton>
  </div>
</template>

<style>
.dir-entry-spacer {
  z-index: 1;
  display: flex;
  overflow: hidden;
  align-items: center;
  margin-bottom: 0;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;
}
</style>