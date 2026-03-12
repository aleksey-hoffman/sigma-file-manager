<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ToastCard from './toast-card.vue';
import ToastHeader from './toast-header.vue';

type ToastStaticItem = {
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    actionText?: string;
    onAction?: () => void;
    itemCount?: number;
    extensionId?: string;
    extensionIconPath?: string;
  };
};

const props = defineProps<ToastStaticItem>();
</script>

<template>
  <ToastCard class="sigma-ui-toast-static">
    <ToastHeader
      :title="props.data.title"
      :subtitle="props.data.subtitle"
      :item-count="props.data.itemCount"
      :extension-id="props.data.extensionId"
      :extension-icon-path="props.data.extensionIconPath"
    />
    <ScrollArea
      v-if="props.data.description"
      class="sigma-ui-toast-static__description-scroll"
    >
      <div class="sigma-ui-toast-static__description">
        {{ props.data.description }}
      </div>
    </ScrollArea>
    <div
      v-if="props.data.actionText"
      class="sigma-ui-toast-static__toolbar"
    >
      <Button
        size="xs"
        @click="props.data.onAction?.()"
      >
        {{ props.data.actionText }}
      </Button>
    </div>
  </ToastCard>
</template>

<style>
.sigma-ui-toast-static__description-scroll {
  width: 100%;
  max-height: 200px;
}

.sigma-ui-toast-static__description {
  width: 100%;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.sigma-ui-toast-static__toolbar {
  display: flex;
  width: 100%;
  align-items: center;
  padding-top: 0.25rem;
}
</style>
