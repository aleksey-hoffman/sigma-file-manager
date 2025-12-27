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
    :toast-options="{
      ...props.toastOptions,
      unstyled: true,
      classes: {
        toast: 'sigma-ui-toast',
        description: 'sigma-ui-toast__description',
        actionButton: 'sigma-ui-toast__action-button',
        cancelButton: 'sigma-ui-toast__cancel-button',
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
  gap: 10px;
  pointer-events: auto;
}

.sigma-ui-toast {
  display: flex;
  width: 100%;
  align-items: center;
  border-radius: var(--radius);
  background-color: hsl(var(--background));
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  color: hsl(var(--foreground));
  cursor: default;
  gap: 0.5rem;
}

.sigma-ui-toast[data-type="default"] {
  padding: 0.75rem 1rem;
  border: 1px solid hsl(var(--border));
}

.sigma-ui-toast[data-type="default"] [data-content] {
  display: flex;
  flex: 1;
}

.sigma-ui-toast[data-type="default"] .sigma-ui-toast__description {
  width: 100%;
}

.sigma-ui-toast[data-type="default"] .sigma-ui-toast__action-button {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.sigma-ui-toast[data-type="default"] .sigma-ui-toast__action-button:hover {
  opacity: 0.9;
}

.sigma-ui-toast[data-type="default"] .sigma-ui-toast__cancel-button {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.sigma-ui-toast[data-type="default"] .sigma-ui-toast__cancel-button:hover {
  opacity: 0.9;
}
</style>
