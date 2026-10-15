<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { Component } from 'vue';
import { ChevronDownIcon, ChevronRightIcon, GripVerticalIcon } from '@lucide/vue';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const open = defineModel<boolean>('open', { required: true });

defineProps<{
  icon: Component;
  title: string;
  count: number;
  emptyText: string;
  isEmpty: boolean;
}>();
</script>

<template>
  <Collapsible
    v-model:open="open"
    class="quick-access-panel__section"
  >
    <div class="quick-access-panel__section-header">
      <button
        type="button"
        class="quick-access-panel__section-drag-handle"
        aria-hidden="true"
        tabindex="-1"
        @click.stop
      >
        <GripVerticalIcon :size="14" />
      </button>
      <CollapsibleTrigger class="quick-access-panel__section-trigger">
        <button
          type="button"
          class="quick-access-panel__section-toggle"
        >
          <ChevronDownIcon
            v-if="open"
            :size="14"
            class="quick-access-panel__chevron"
          />
          <ChevronRightIcon
            v-else
            :size="14"
            class="quick-access-panel__chevron"
          />
          <component
            :is="icon"
            :size="14"
            class="quick-access-panel__section-icon"
          />
          <span class="quick-access-panel__section-title">{{ title }}</span>
          <span
            v-if="count > 0"
            class="quick-access-panel__badge"
          >
            {{ count }}
          </span>
        </button>
      </CollapsibleTrigger>
      <!-- FORK-MODIFICATION: 标题右侧的附加动作（需求 N3⑤）。
           放在 CollapsibleTrigger 外面，避免点击它被折叠切换吞掉。
           同时给折叠按钮加 stop，让「点标题右侧」与「点标题其余部分」互不干扰。 -->
      <slot name="header-action" />
    </div>
    <CollapsibleContent class="quick-access-panel__section-content">
      <div
        v-if="isEmpty"
        class="quick-access-panel__empty"
      >
        {{ emptyText }}
      </div>
      <slot v-else />
    </CollapsibleContent>
  </Collapsible>
</template>

<style scoped>
.quick-access-panel__section {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
}

.quick-access-panel__section-header {
  display: flex;
  width: 100%;
  align-items: center;
  border-radius: var(--radius-sm);
  gap: 2px;
  padding-inline-start: 4px;
  transition: background-color 0.15s ease;
}

.quick-access-panel__section-header:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.quick-access-panel__section-drag-handle {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  touch-action: none;
}

.quick-access-panel__section-drag-handle:hover {
  background-color: hsl(var(--muted) / 40%);
  color: hsl(var(--foreground));
}

.quick-access-panel__section-drag-handle:active {
  cursor: grabbing;
}

.quick-access-panel__section-trigger {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.quick-access-panel__section-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  gap: 8px;
  padding-inline-start: 4px;
  text-align: start;
}

.quick-access-panel__chevron {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.quick-access-panel__section-icon {
  flex-shrink: 0;
  color: hsl(var(--icon));
}

.quick-access-panel__section-title {
  overflow: hidden;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-access-panel__badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 600;
}

/* FORK-MODIFICATION: 反馈 5b（2026-10-15）—— 20px → 28px。
   分组标题与它下面的条目要能一眼看出层级：20px 时条目的图标几乎与标题的
   收藏星/标签图标左对齐，读起来像平铺；28px 把子项明显推入一级。 */
.quick-access-panel__section-content {
  padding-bottom: 4px;
  padding-inline-start: 28px;
}

.quick-access-panel__section-content[data-state="open"] {
  overflow: visible;
}

.quick-access-panel__section-content[data-state="closed"] {
  padding-top: 0;
  padding-bottom: 0;
}

.quick-access-panel__empty {
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}
</style>
