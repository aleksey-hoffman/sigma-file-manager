<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import { CheckIcon } from 'lucide-vue-next';
import { Button } from '.';
import { type ButtonVariants } from '.';

interface Props {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  confirmDuration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'outline',
  size: 'default',
  confirmDuration: 1000,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const isConfirmed = ref(false);
let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

async function handleClick(event: MouseEvent) {
  if (isConfirmed.value) return;

  emit('click', event);

  isConfirmed.value = true;

  if (confirmTimeout) {
    clearTimeout(confirmTimeout);
  }

  confirmTimeout = setTimeout(() => {
    isConfirmed.value = false;
    confirmTimeout = null;
  }, props.confirmDuration);
}
</script>

<template>
  <Button
    :variant="variant"
    :size="size"
    class="confirm-button"
    :class="{ 'confirm-button--confirmed': isConfirmed }"
    @click="handleClick"
  >
    <span
      class="confirm-button__content"
      :class="{ 'confirm-button__content--hidden': isConfirmed }"
    >
      <slot />
    </span>
    <Transition name="confirm-button-check">
      <span
        v-if="isConfirmed"
        class="confirm-button__check-wrapper"
      >
        <CheckIcon
          :size="14"
          class="confirm-button__check"
        />
      </span>
    </Transition>
  </Button>
</template>

<style>
.confirm-button {
  position: relative;
  overflow: hidden;
  gap: 8px;
}

.confirm-button__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.15s ease;
}

.confirm-button__content--hidden {
  opacity: 0;
}

.confirm-button__check-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
}

.confirm-button__check {
  color: hsl(var(--success, 142 76% 36%));
}

.confirm-button--confirmed {
  border-color: hsl(var(--success, 142 76% 36%) / 50%);
}

.confirm-button-check-enter-active,
.confirm-button-check-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.confirm-button-check-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}

.confirm-button-check-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}
</style>
