<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import type { DrawerRootEmits, DrawerRootProps } from 'vaul-vue';
import { DrawerRoot } from 'vaul-vue';
import { useForwardPropsEmits } from 'reka-ui';

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
});

const emits = defineEmits<DrawerRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
const forwardedBindings = forwarded as unknown as Record<string, unknown>;
</script>

<template>
  <DrawerRoot v-bind="forwardedBindings">
    <slot />
  </DrawerRoot>
</template>
