<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { Toaster, type ToasterProps } from 'vue-sonner';
import 'vue-sonner/style.css';

const props = defineProps<ToasterProps>();
</script>

<template>
  <Toaster
    v-bind="props"
    :expand="true"
    :gap="8"
    :toast-options="{
      ...props.toastOptions,
      unstyled: true,
      classes: {
        toast: 'sigma-ui-toast-shell',
      },
    }"
  />
</template>

<style>
.sigma-ui-toaster {
  position: fixed;
  z-index: 60;
  display: flex;
  max-width: 420px;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
}

[data-sonner-toaster] {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

[data-sonner-toaster][data-y-position='bottom'] {
  flex-direction: column-reverse;
}

[data-sonner-toast] {
  position: relative;
  height: auto;
  inset: unset;
  opacity: 1;
  transform: none;
  transition: none;
}

[data-sonner-toast][data-removed='true'] {
  opacity: 0;
}

[data-sonner-toast][data-mounted='false'] .sigma-ui-toast-card {
  backdrop-filter: blur(0);
  background-color: hsl(var(--background) / 0%);
}

[data-sonner-toast][data-mounted='false'] :deep(.sigma-ui-toast-static),
[data-sonner-toast][data-mounted='false'] :deep(.sigma-ui-toast-progress) {
  backdrop-filter: blur(0);
  background-color: hsl(var(--background) / 0%);
}

[data-sonner-toast][data-expanded='false'][data-front='false'] {
  overflow: hidden;
}

[data-sonner-toast][data-expanded='false'][data-front='false'] > * {
  opacity: 0;
}

.sigma-ui-toast-shell {
  display: flex;
  width: 100%;
  align-items: stretch;
  padding: 0;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: default;
  gap: 0.5rem;
}

[data-sonner-toast] > * {
  flex: 1;
}
</style>
