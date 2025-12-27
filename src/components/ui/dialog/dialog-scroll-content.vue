<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import { XIcon } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const props = defineProps<DialogContentProps>();
const emits = defineEmits<DialogContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
const { t } = useI18n();
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="sigma-ui-dialog-scroll-overlay"
    >
      <DialogContent
        class="sigma-ui-dialog-scroll-content"
        :class="[$attrs.class]"
        v-bind="forwarded"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose class="sigma-ui-dialog-scroll-close">
          <XIcon class="sigma-ui-dialog-scroll-close__icon" />
          <span class="sigma-ui-dialog-scroll-close__label">{{ t('close') }}</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>

<style>
.sigma-ui-dialog-scroll-overlay {
  position: fixed;
  z-index: 50;
  display: grid;
  animation: sigma-ui-fade-in 0.2s ease-out;
  background-color: rgb(0 0 0 / 80%);
  inset: 0;
  overflow-y: auto;
  place-items: center;
}

.sigma-ui-dialog-scroll-overlay[data-state="open"] {
  animation: sigma-ui-fade-in 0.2s ease-out;
}

.sigma-ui-dialog-scroll-overlay[data-state="closed"] {
  animation: sigma-ui-fade-out 0.2s ease-in;
}

.sigma-ui-dialog-scroll-content {
  position: relative;
  z-index: 50;
  display: grid;
  width: 100%;
  max-width: 32rem;
  padding: 1.5rem;
  border: 1px solid hsl(var(--border));
  margin: 2rem 0;
  background-color: hsl(var(--background));
  box-shadow: var(--shadow-lg);
  gap: 1rem;
  transition-duration: 200ms;
}

.sigma-ui-dialog-scroll-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.125rem;
  border-radius: var(--radius-md);
  transition-duration: 150ms;
  transition-property: background-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-dialog-scroll-close:hover {
  background-color: hsl(var(--secondary));
}

.sigma-ui-dialog-scroll-close__icon {
  width: 1rem;
  height: 1rem;
}

.sigma-ui-dialog-scroll-close__label {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  border-width: 0;
  margin: -1px;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (width >= 640px) {
  .sigma-ui-dialog-scroll-content {
    border-radius: var(--radius-lg);
  }
}

@media (width >= 768px) {
  .sigma-ui-dialog-scroll-content {
    width: 100%;
  }
}
</style>
