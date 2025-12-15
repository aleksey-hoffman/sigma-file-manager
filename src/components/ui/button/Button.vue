<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui';
import { Loader2Icon } from 'lucide-vue-next';
import { type ButtonVariants, buttonVariants } from '.';

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  isLoading?: boolean;
  loadingText?: string;
}

withDefaults(defineProps<Props>(), {
  as: 'button',
  isLoading: false,
  size: 'default',
  variant: 'default',
  loadingText: '',
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="[buttonVariants({ variant, size }), $attrs.class]"
    :disabled="isLoading || $attrs.disabled"
  >
    <Loader2Icon
      v-if="isLoading"
      class="sigma-ui-button__loader"
    />
    <template v-if="!isLoading || (isLoading && !loadingText)">
      <slot />
    </template>
    <template v-else>
      {{ loadingText }}
    </template>
  </Primitive>
</template>

<style>
.sigma-ui-button {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  transition: background-color 0.1s ease, colors 0.2s;
  user-select: none;
  white-space: nowrap;
}

.sigma-ui-button:focus-visible {
  box-shadow:
    0 0 0 2px hsl(var(--background)),
    0 0 0 4px hsl(var(--ring));
  outline: none;
}

.sigma-ui-button:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.sigma-ui-button--default {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.sigma-ui-button--default:hover {
  background-color: hsl(var(--primary) / 90%);
}

.sigma-ui-button--destructive {
  background-color: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.sigma-ui-button--destructive:hover {
  background-color: hsl(var(--destructive) / 90%);
}

.sigma-ui-button--outline {
  border: 1px solid hsl(var(--border));
  background-color: transparent;
}

.sigma-ui-button--outline:hover {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-button--secondary {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-button--secondary:hover {
  background-color: hsl(var(--secondary) / 80%);
}

.sigma-ui-button--tertiary {
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--background));
  color: hsl(var(--primary));
}

.sigma-ui-button--tertiary:hover {
  background-color: hsl(var(--secondary));
}

.sigma-ui-button--ghost:hover {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.sigma-ui-button--link {
  color: hsl(var(--primary));
  text-underline-offset: 4px;
}

.sigma-ui-button--link:hover {
  text-decoration: underline;
}

.sigma-ui-button--size-default {
  height: 2.5rem;
  padding: 0.5rem 1rem;
}

.sigma-ui-button--size-xs {
  height: 1.75rem;
  padding: 0 0.5rem;
  border-radius: 0.25rem;
}

.sigma-ui-button--size-sm {
  height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: var(--radius);
}

.sigma-ui-button--size-lg {
  height: 2.75rem;
  padding: 0 2rem;
  border-radius: var(--radius);
}

.sigma-ui-button--size-icon {
  width: 2.5rem;
  height: 2.5rem;
}

.sigma-ui-button__loader {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
