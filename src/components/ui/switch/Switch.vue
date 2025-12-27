<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  SwitchRoot,
  type SwitchRootEmits,
  type SwitchRootProps,
  SwitchThumb,
  useForwardPropsEmits,

} from 'reka-ui';

const props = defineProps<SwitchRootProps>();

const emits = defineEmits<SwitchRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    class="sigma-ui-switch"
  >
    <SwitchThumb class="sigma-ui-switch__thumb" />
  </SwitchRoot>
</template>

<style>
.sigma-ui-switch {
  display: inline-flex;
  width: 2.75rem;
  height: 1.5rem;
  flex-shrink: 0;
  align-items: center;
  border: 2px solid transparent;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition-duration: 150ms;
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-switch:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--ring)), 0 0 0 4px hsl(var(--background));
  outline: none;
}

.sigma-ui-switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sigma-ui-switch[data-state="checked"] {
  background-color: hsl(var(--primary));
}

.sigma-ui-switch[data-state="unchecked"] {
  background-color: hsl(218deg 14% 84% / 70%);
}

.sigma-ui-switch__thumb {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  animation: none;
  background-color: hsl(var(--background));
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  pointer-events: none;
  transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sigma-ui-switch__thumb[data-state="checked"] {
  animation: sigma-ui-thumb-motion-blur-in 150ms cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(1.25rem);
}

.sigma-ui-switch__thumb[data-state="unchecked"] {
  animation: sigma-ui-thumb-motion-blur-out 150ms cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
}

@keyframes sigma-ui-thumb-motion-blur-in {
  0% {
    filter: blur(0);
  }

  50% {
    filter: blur(2px);
  }

  100% {
    filter: blur(0);
  }
}

@keyframes sigma-ui-thumb-motion-blur-out {
  0% {
    filter: blur(0);
  }

  50% {
    filter: blur(2px);
  }

  100% {
    filter: blur(0);
  }
}
</style>
