<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDownIcon, XIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPathDisplayValue } from '@/utils/normalize-path';
import { shortenPath } from '@/utils/shorten-path';
import ToastCard from './toast-card.vue';
import ToastHeader from './toast-header.vue';

const VISIBLE_SOURCE_PATHS_LIMIT = 3;

type ToastStaticItem = {
  data: {
    title: string;
    subtitle?: string;
    description?: string;
    paths?: {
      sources: string[];
      destination?: string;
    };
    actionText?: string;
    onAction?: () => void;
    secondaryActionText?: string;
    onSecondaryAction?: () => void;
    onDismiss?: () => void;
    itemCount?: number;
    extensionId?: string;
    extensionIconPath?: string;
  };
};

const props = defineProps<ToastStaticItem>();
const { t } = useI18n();

const visibleSourcePaths = computed(() => (
  props.data.paths?.sources.slice(0, VISIBLE_SOURCE_PATHS_LIMIT) ?? []
));
const hiddenSourcePathCount = computed(() => (
  (props.data.paths?.sources.length ?? 0) - visibleSourcePaths.value.length
));
</script>

<template>
  <ToastCard class="sigma-ui-toast-static">
    <div class="sigma-ui-toast-static__head">
      <ToastHeader
        class="sigma-ui-toast-static__header"
        :title="props.data.title"
        :subtitle="props.data.subtitle"
        :item-count="props.data.itemCount"
        :extension-id="props.data.extensionId"
        :extension-icon-path="props.data.extensionIconPath"
      />
      <Button
        v-if="props.data.onDismiss"
        variant="ghost"
        size="xs"
        class="sigma-ui-toast-static__close"
        type="button"
        :aria-label="t('notifications.hideNotification')"
        @click="props.data.onDismiss()"
      >
        <XIcon :size="16" />
      </Button>
    </div>
    <div
      v-if="props.data.paths"
      class="sigma-ui-toast-static__paths"
    >
      <div
        v-for="path in visibleSourcePaths"
        :key="path"
        class="sigma-ui-toast-static__path"
        dir="ltr"
        :title="getPathDisplayValue(path)"
      >
        {{ shortenPath(path) }}
      </div>
      <div v-if="hiddenSourcePathCount > 0">
        {{ t('topLevelConflictDialog.moreItems', { count: hiddenSourcePathCount }, hiddenSourcePathCount) }}
      </div>
      <template v-if="props.data.paths.destination">
        <ArrowDownIcon
          :size="14"
          class="sigma-ui-toast-static__paths-arrow"
        />
        <div
          class="sigma-ui-toast-static__path sigma-ui-toast-static__path--destination"
          dir="ltr"
          :title="getPathDisplayValue(props.data.paths.destination)"
        >
          {{ shortenPath(props.data.paths.destination) }}
        </div>
      </template>
    </div>
    <ScrollArea
      v-if="props.data.description"
      class="sigma-ui-toast-static__description-scroll"
    >
      <div class="sigma-ui-toast-static__description">
        {{ props.data.description }}
      </div>
    </ScrollArea>
    <div
      v-if="props.data.actionText || props.data.secondaryActionText"
      class="sigma-ui-toast-static__toolbar"
    >
      <div class="sigma-ui-toast-static__toolbar-buttons">
        <Button
          v-if="props.data.secondaryActionText"
          size="xs"
          variant="secondary"
          @click="props.data.onSecondaryAction?.()"
        >
          {{ props.data.secondaryActionText }}
        </Button>
        <Button
          v-if="props.data.actionText"
          size="xs"
          @click="props.data.onAction?.()"
        >
          {{ props.data.actionText }}
        </Button>
      </div>
    </div>
  </ToastCard>
</template>

<style>
.sigma-ui-toast-static__head {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
  gap: 0.25rem;
}

.sigma-ui-toast-static__header {
  min-width: 0;
  flex: 1;
}

.sigma-ui-toast-static__close {
  flex-shrink: 0;
}

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

.sigma-ui-toast-static__paths {
  display: flex;
  width: 100%;
  flex-direction: column;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  gap: 0.25rem;
  line-height: 1.35;
}

.sigma-ui-toast-static__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toast-static__path--destination {
  color: hsl(var(--foreground));
}

.sigma-ui-toast-static__paths-arrow {
  flex-shrink: 0;
}

.sigma-ui-toast-static__toolbar {
  display: flex;
  width: 100%;
  align-items: center;
  padding-top: 0.25rem;
}

.sigma-ui-toast-static__toolbar-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}
</style>
