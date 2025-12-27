<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ListboxContentProps } from 'reka-ui';
import { ListboxContent, useForwardProps } from 'reka-ui';

const props = defineProps<ListboxContentProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <ListboxContent
    v-bind="forwarded"
    class="sigma-ui-command-list"
  >
    <div
      role="presentation"
      class="sigma-ui-command-list__content"
    >
      <slot />
    </div>
  </ListboxContent>
</template>

<style>
.sigma-ui-command-list {
  overflow: hidden auto;
  max-height: 300px;
}

.sigma-ui-command-list__content {
  position: relative;
}
</style>
