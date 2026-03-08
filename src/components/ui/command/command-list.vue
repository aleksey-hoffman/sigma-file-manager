<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ListboxContentProps } from 'reka-ui';
import { ListboxContent, useForwardProps } from 'reka-ui';
import { ScrollArea } from '@/components/ui/scroll-area';

const props = defineProps<ListboxContentProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <ListboxContent
    v-bind="forwarded"
    class="sigma-ui-command-list"
  >
    <ScrollArea class="sigma-ui-command-list__scroll-area">
      <div
        role="presentation"
        class="sigma-ui-command-list__content"
      >
        <slot />
      </div>
    </ScrollArea>
  </ListboxContent>
</template>

<style>
.sigma-ui-command-list {
  overflow: hidden;
  max-height: 300px;
}

.sigma-ui-command-list__scroll-area {
  height: 100%;
  max-height: 300px;
}

.sigma-ui-command-list__content {
  position: relative;
}
</style>
