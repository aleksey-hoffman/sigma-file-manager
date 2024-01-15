<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Divider} from '@/types/dirEntry';

interface Props {
  dirEntry: Divider;
  hoverEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hoverEnabled: true
});
</script>

<template>
  <div class="dir-entry-divider sub-title">
    {{ props.dirEntry.title }}
  </div>
</template>

<style>
.dir-entry-divider {
  z-index: 1;
  display: flex;
  overflow: hidden;
  align-items: center;
  border-bottom: 1px solid var(--divider-color);
  margin-bottom: 0;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;
}
</style>