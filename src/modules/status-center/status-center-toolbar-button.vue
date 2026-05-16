<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { ActivityIcon, ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStatusCenterStore } from '@/stores/runtime/status-center';
import StatusCenterOperationRow from './status-center-operation-row.vue';
import { useCancelOperation } from './use-cancel-operation';

const { t } = useI18n();
const statusCenterStore = useStatusCenterStore();
const { cancelOperations } = useCancelOperation();

const statusCenterPopoverOpen = computed({
  get: () => statusCenterStore.isOpen,
  set: (open) => {
    statusCenterStore.setOpen(open);
  },
});
const hasOperations = computed(() => statusCenterStore.operationsList.length > 0);
const hasCompletedOperations = computed(() => statusCenterStore.completedOperations.length > 0);
const hasActiveOperations = computed(() => statusCenterStore.activeCount > 0);
const isPopoverOpenWithoutActiveOperations = computed(
  () => statusCenterStore.isOpen && !hasActiveOperations.value,
);

const activeOperationsToolbarLabel = computed(() =>
  t(
    'statusCenter.toolbarActiveCount',
    { n: statusCenterStore.activeCount },
    statusCenterStore.activeCount,
  ),
);

const statusCenterTriggerAriaLabel = computed(() => {
  if (statusCenterStore.activeCount > 0) {
    return `${t('statusCenter.title')}: ${activeOperationsToolbarLabel.value}`;
  }

  return t('statusCenter.title');
});

const hasCancellableActiveOperations = computed(() =>
  statusCenterStore.activeOperations.some(
    operation => operation.status === 'in-progress' || operation.status === 'pending',
  ),
);

const completedSectionOpen = ref(true);
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const pillInnerRef = ref<HTMLElement | null>(null);
const expandedPillMaxWidthPx = ref(28);
const PILL_MAX_WIDTH_CAP_PX = 240;
const PILL_MIN_EXPANDED_WIDTH_PX = 56;

let pillResizeObserver: ResizeObserver | null = null;

function disconnectPillResizeObserver() {
  if (pillResizeObserver) {
    pillResizeObserver.disconnect();
    pillResizeObserver = null;
  }
}

function measureExpandedPillMaxWidthPx() {
  const inner = pillInnerRef.value;

  if (!inner) {
    return;
  }

  const measured = Math.ceil(inner.scrollWidth);
  expandedPillMaxWidthPx.value = Math.min(
    PILL_MAX_WIDTH_CAP_PX,
    Math.max(measured, PILL_MIN_EXPANDED_WIDTH_PX),
  );
}

const statusCenterPillButtonStyle = computed(() => {
  if (!hasActiveOperations.value) {
    return undefined;
  }

  return { maxWidth: `${expandedPillMaxWidthPx.value}px` };
});

watch(hasActiveOperations, async (active) => {
  disconnectPillResizeObserver();

  if (!active) {
    expandedPillMaxWidthPx.value = 28;
    return;
  }

  expandedPillMaxWidthPx.value = 28;
  await nextTick();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      measureExpandedPillMaxWidthPx();
      const inner = pillInnerRef.value;

      if (!inner) {
        return;
      }

      pillResizeObserver = new ResizeObserver(() => {
        measureExpandedPillMaxWidthPx();
      });
      pillResizeObserver.observe(inner);
    });
  });
});

watch(activeOperationsToolbarLabel, async () => {
  if (!hasActiveOperations.value) {
    return;
  }

  await nextTick();
  measureExpandedPillMaxWidthPx();
});

onScopeDispose(() => {
  disconnectPillResizeObserver();
});

function scrollOperationsToTop() {
  const scrollAreaInstance = scrollAreaRef.value;

  if (!scrollAreaInstance) {
    return;
  }

  const rootElement = (scrollAreaInstance as unknown as { $el?: HTMLElement }).$el;
  const viewportElement = rootElement?.querySelector<HTMLElement>(
    '.sigma-ui-scroll-area__viewport',
  );

  if (viewportElement) {
    viewportElement.scrollTop = 0;
  }
}

watch(
  () => statusCenterStore.operationsList.length,
  (currentCount, previousCount) => {
    if (currentCount > (previousCount ?? 0)) {
      nextTick(scrollOperationsToTop);
    }
  },
);

async function handleCancelAllActive() {
  await cancelOperations(statusCenterStore.activeOperations);
}

function handleClearCompleted() {
  statusCenterStore.clearCompleted();
}
</script>

<template>
  <div class="status-center-toolbar-button animate-fade-in">
    <Tooltip>
      <Popover v-model:open="statusCenterPopoverOpen">
        <TooltipTrigger as-child>
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              class="status-center-toolbar-button__button"
              :class="{
                'status-center-toolbar-button__button--expanded': hasActiveOperations,
                'status-center-toolbar-button__button--open-idle': isPopoverOpenWithoutActiveOperations,
              }"
              :style="statusCenterPillButtonStyle"
              :aria-label="statusCenterTriggerAriaLabel"
            >
              <span
                ref="pillInnerRef"
                class="status-center-toolbar-button__inner"
              >
                <span class="status-center-toolbar-button__icon-wrap">
                  <ActivityIcon
                    :size="16"
                    class="status-center-toolbar-button__icon"
                    :class="{ 'status-center-toolbar-button__icon--active': hasActiveOperations }"
                  />
                </span>
                <LoaderCircleIcon
                  v-if="hasActiveOperations"
                  :size="12"
                  class="status-center-toolbar-button__loader"
                />
                <span class="status-center-toolbar-button__label">
                  {{ activeOperationsToolbarLabel }}
                </span>
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('statusCenter.title') }}
        </TooltipContent>
        <PopoverContent
          align="end"
          :side-offset="8"
          class="status-center-popover"
        >
          <div class="status-center">
            <div class="status-center__header">
              <h3 class="status-center__title">
                {{ t('statusCenter.title') }}
              </h3>
              <Button
                variant="secondary"
                size="xs"
                class="status-center__clear-btn"
                :class="{ 'status-center__clear-btn--hidden': !hasCompletedOperations }"
                :disabled="!hasCompletedOperations"
                @click="handleClearCompleted"
              >
                {{ t('statusCenter.clearCompleted') }}
              </Button>
            </div>

            <ScrollArea
              v-if="hasOperations"
              ref="scrollAreaRef"
              class="status-center__content"
            >
              <div class="status-center__sections">
                <section
                  v-if="hasActiveOperations"
                  class="status-center__section"
                >
                  <div class="status-center__section-header">
                    <div class="status-center__section-title-wrapper">
                      <LoaderCircleIcon
                        :size="14"
                        class="status-center__section-icon status-center__section-icon--spinning"
                      />
                      <span class="status-center__section-title">
                        {{ t('statusCenter.activeOperations') }}
                      </span>
                      <span class="status-center__section-count">
                        {{ statusCenterStore.activeCount }}
                      </span>
                    </div>
                    <Button
                      v-if="hasCancellableActiveOperations"
                      variant="ghost"
                      size="xs"
                      class="status-center__section-cancel"
                      @click="handleCancelAllActive"
                    >
                      {{ t('statusCenter.cancelAll') }}
                    </Button>
                  </div>

                  <div class="status-center__operations">
                    <StatusCenterOperationRow
                      v-for="operation in statusCenterStore.activeOperations"
                      :key="operation.id"
                      :operation="operation"
                    />
                  </div>
                </section>

                <Collapsible
                  v-if="hasCompletedOperations"
                  v-model:open="completedSectionOpen"
                  class="status-center__section"
                >
                  <CollapsibleTrigger>
                    <button
                      type="button"
                      class="status-center__section-header status-center__section-header--collapsible"
                    >
                      <div class="status-center__section-title-wrapper">
                        <ChevronDownIcon
                          v-if="completedSectionOpen"
                          :size="14"
                          class="status-center__section-icon"
                        />
                        <ChevronRightIcon
                          v-else
                          :size="14"
                          class="status-center__section-icon"
                        />
                        <span class="status-center__section-title">
                          {{ t('statusCenter.completedOperations') }}
                        </span>
                        <span class="status-center__section-count">
                          {{ statusCenterStore.completedCount }}
                        </span>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div class="status-center__operations">
                      <StatusCenterOperationRow
                        v-for="operation in statusCenterStore.completedOperations"
                        :key="operation.id"
                        :operation="operation"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>

            <div
              v-else
              class="status-center__empty"
            >
              <ActivityIcon
                :size="24"
                class="status-center__empty-icon"
              />
              <span>{{ t('statusCenter.noOperations') }}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  </div>
</template>

<style scoped>
.status-center-toolbar-button :deep(.sigma-ui-button.status-center-toolbar-button__button) {
  position: relative;
  display: inline-flex;
  overflow: hidden;
  width: max-content;
  max-width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 0;
  border-radius: var(--radius);
  transition:
    max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.25s ease,
    color 0.25s ease;
}

.status-center-toolbar-button :deep(.sigma-ui-button.status-center-toolbar-button__button--open-idle) {
  background-color: hsl(var(--secondary));
}

.status-center-toolbar-button
  :deep(.sigma-ui-button.status-center-toolbar-button__button--open-idle)
  .status-center-toolbar-button__icon {
  stroke: hsl(var(--primary));
}

.status-center-toolbar-button :deep(.sigma-ui-button.status-center-toolbar-button__button--expanded) {
  border-radius: 9999px;
  background: hsl(var(--primary) / 18%);
  color: hsl(var(--primary));
}

.status-center-toolbar-button :deep(.sigma-ui-button.status-center-toolbar-button__button--expanded:hover) {
  background: hsl(var(--primary) / 26%);
}

.status-center-toolbar-button__inner {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0;
  transition: gap 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-center-toolbar-button :deep(.sigma-ui-button.status-center-toolbar-button__button--expanded) .status-center-toolbar-button__inner {
  gap: 6px;
}

.status-center-toolbar-button__icon-wrap {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.status-center-toolbar-button__icon {
  flex-shrink: 0;
  stroke: hsl(var(--foreground) / 50%);
  transition: stroke 0.25s ease;
}

.status-center-toolbar-button__icon--active {
  stroke: hsl(var(--primary));
}

.status-center-toolbar-button__loader {
  flex-shrink: 0;
  animation: spin 1s linear infinite;
  opacity: 0;
  stroke: hsl(var(--primary));
  transition: opacity 0.28s ease;
}

.status-center-toolbar-button__button--expanded .status-center-toolbar-button__loader {
  opacity: 1;
}

.status-center-toolbar-button__label {
  flex-shrink: 0;
  padding-right: 10px;
  margin-left: 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.28s ease, margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-center-toolbar-button__button--expanded .status-center-toolbar-button__label {
  margin-left: 4px;
  opacity: 1;
}

:global(.status-center-popover) {
  width: 340px;
  padding: 0;
}

.status-center {
  display: flex;
  flex-direction: column;
}

.status-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border));
}

.status-center__title {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-center__clear-btn {
  min-width: 0;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  transition: opacity 0.15s ease;
}

.status-center__clear-btn--hidden {
  opacity: 0;
  pointer-events: none;
}

.status-center__content {
  --status-center-scroll-max: min(400px, calc(100vh - 82px));

  max-height: var(--status-center-scroll-max);
}

.status-center__content :deep(.sigma-ui-scroll-area__viewport) {
  max-height: var(--status-center-scroll-max);
}

.status-center__content :deep(.sigma-ui-scroll-area-scrollbar) {
  right: -6px;
}

.status-center__sections {
  padding-bottom: 4px;
}

.status-center__section {
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border) / 50%);
}

.status-center__section:last-child {
  border-bottom: none;
}

.status-center__section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
}

.status-center__section-header--collapsible {
  width: 100%;
  padding: 0;
  border: none;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.status-center__section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-center__section-icon {
  color: hsl(var(--muted-foreground));
}

.status-center__section-icon--spinning {
  animation: spin 1s linear infinite;
  color: hsl(var(--primary));
}

.status-center__section-title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-center__section-count {
  padding: 2px 6px;
  border-radius: 3px;
  background: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-size: 10px;
  font-weight: 500;
}

.status-center__section-cancel {
  height: 22px;
  padding: 0 8px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.status-center__section-cancel:hover {
  color: hsl(var(--destructive));
}

.status-center__operations {
  display: flex;
  flex-direction: column;
  padding-top: 8px;
  gap: 3px;
}

.status-center__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  gap: 6px;
}

.status-center__empty-icon {
  opacity: 0.5;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
