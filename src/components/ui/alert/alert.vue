<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}>(), {
  description: '',
  tone: 'info',
});

const iconComponent = computed(() => {
  if (props.tone === 'success') return CircleCheckIcon;
  if (props.tone === 'warning' || props.tone === 'error') return TriangleAlertIcon;
  return InfoIcon;
});
</script>

<template>
  <div
    class="sigma-ui-alert"
    :class="`sigma-ui-alert--${tone}`"
  >
    <component
      :is="iconComponent"
      :size="16"
      class="sigma-ui-alert__icon"
    />
    <div class="sigma-ui-alert__content">
      <div class="sigma-ui-alert__title">
        {{ title }}
      </div>
      <p
        v-if="description"
        class="sigma-ui-alert__description"
      >
        {{ description }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.sigma-ui-alert {
  display: flex;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 10px;
}

.sigma-ui-alert--info {
  border-color: hsl(217deg 91% 60% / 28%);
  background-color: hsl(217deg 91% 60% / 10%);
  color: hsl(217deg 91% 60%);
}

.sigma-ui-alert--success {
  border-color: hsl(142deg 76% 36% / 28%);
  background-color: hsl(142deg 76% 36% / 10%);
  color: hsl(142deg 76% 36%);
}

.sigma-ui-alert--warning {
  border-color: hsl(38deg 92% 50% / 30%);
  background-color: hsl(38deg 92% 50% / 10%);
  color: hsl(38deg 92% 50%);
}

.sigma-ui-alert--error {
  border-color: hsl(0deg 84% 60% / 30%);
  background-color: hsl(0deg 84% 60% / 12%);
  color: hsl(0deg 84% 60%);
}

.sigma-ui-alert__icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.sigma-ui-alert__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.sigma-ui-alert__title {
  color: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
}

.sigma-ui-alert__description {
  color: inherit;
  font-size: 0.8125rem;
  line-height: 1.5;
  opacity: 0.92;
}
</style>
