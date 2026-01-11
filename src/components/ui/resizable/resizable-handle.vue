<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SplitterResizeHandle, type SplitterResizeHandleEmits, type SplitterResizeHandleProps, useForwardPropsEmits } from 'reka-ui';
import { GripVerticalIcon } from 'lucide-vue-next';

const props = defineProps<SplitterResizeHandleProps & { withHandle?: boolean }>();
const emits = defineEmits<SplitterResizeHandleEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SplitterResizeHandle
    v-bind="forwarded"
    class="sigma-ui-resizable-handle"
  >
    <template v-if="props.withHandle">
      <div class="sigma-ui-resizable-handle__grip">
        <GripVerticalIcon class="sigma-ui-resizable-handle__grip-icon" />
      </div>
    </template>
  </SplitterResizeHandle>
</template>

<style>
.sigma-ui-resizable-handle {
  position: relative;
  display: flex;
  width: 1px;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--border));
}

.sigma-ui-resizable-handle::after {
  position: absolute;
  left: 50%;
  width: 4px;
  content: '';
  inset-block: 0;
  transform: translateX(-50%);
}

.sigma-ui-resizable-handle:focus-visible {
  outline: 1px solid hsl(var(--ring));
  outline-offset: 1px;
}

.sigma-ui-resizable-handle[data-orientation="vertical"] {
  width: 100%;
  height: 1px;
}

.sigma-ui-resizable-handle[data-orientation="vertical"]::after {
  left: 0;
  width: 100%;
  height: 4px;
  transform: translateY(-50%);
}

.sigma-ui-resizable-handle[data-orientation="vertical"] > div {
  transform: rotate(90deg);
}

.sigma-ui-resizable-handle__grip {
  z-index: 10;
  display: flex;
  width: 0.75rem;
  height: 1rem;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--border));
}

.sigma-ui-resizable-handle__grip-icon {
  width: 0.625rem;
  height: 0.625rem;
}
</style>
