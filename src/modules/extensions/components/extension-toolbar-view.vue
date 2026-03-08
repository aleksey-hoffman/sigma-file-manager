<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import type { UIElement } from '@/types/extension';

defineOptions({ name: 'ExtensionToolbarView' });

const props = defineProps<{
  elements: UIElement[];
  onButtonClick?: (buttonId: string) => void;
}>();

function handleButtonClick(buttonId: string): void {
  props.onButtonClick?.(buttonId);
}

function getButtonVariant(element: UIElement): 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link' {
  if (element.variant === 'danger') return 'destructive';
  if (element.variant === 'primary') return 'default';
  return 'outline';
}
</script>

<template>
  <div class="extension-toolbar-view">
    <template
      v-for="(element, elementIndex) in elements"
      :key="element.id || `element-${elementIndex}`"
    >
      <span
        v-if="element.type === 'text'"
        class="extension-toolbar-view__text"
      >
        {{ element.value }}
      </span>
      <Button
        v-else-if="element.type === 'button'"
        :variant="getButtonVariant(element)"
        :size="element.size || 'xs'"
        :disabled="element.disabled"
        @click="handleButtonClick(element.id || '')"
      >
        {{ element.label }}
      </Button>
    </template>
  </div>
</template>

<style scoped>
.extension-toolbar-view {
  display: flex;
  align-items: center;
  gap: 12px;
}

.extension-toolbar-view__text {
  margin-right: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
