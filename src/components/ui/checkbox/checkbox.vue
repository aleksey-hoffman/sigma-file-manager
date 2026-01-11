<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootEmits,
  type CheckboxRootProps,
  useForwardPropsEmits,
} from 'reka-ui';
import { CheckIcon } from 'lucide-vue-next';

const props = defineProps<CheckboxRootProps>();

const emits = defineEmits<CheckboxRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    class="sigma-ui-checkbox"
  >
    <CheckboxIndicator class="sigma-ui-checkbox__indicator">
      <CheckIcon class="sigma-ui-checkbox__icon" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<style>
.sigma-ui-checkbox {
  display: flex;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--primary));
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition-duration: 150ms;
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-checkbox:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.sigma-ui-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sigma-ui-checkbox[data-state="checked"] {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.sigma-ui-checkbox[data-state="unchecked"] {
  background-color: transparent;
}

.sigma-ui-checkbox__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sigma-ui-checkbox__icon {
  width: 0.75rem;
  height: 0.75rem;
  stroke-width: 3;
}
</style>
