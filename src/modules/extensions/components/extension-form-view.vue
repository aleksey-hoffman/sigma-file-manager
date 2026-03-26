<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from 'vue';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ArrowLeftIcon, XIcon } from '@lucide/vue';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { UIElement, ModalButton, KeyboardShortcut } from '@/types/extension';
import { renderTextWithLinksToSafeHtml } from '@/utils/safe-html';

const props = defineProps<{
  title: string;
  content: UIElement[];
  buttons?: ModalButton[];
  values: Record<string, unknown>;
  onBack?: () => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  valueChange: [elementId: string, value: unknown];
  buttonClick: [buttonId: string];
  close: [];
}>();

const formRootElement = ref<HTMLElement | null>(null);

function getElementValue(element: UIElement): unknown {
  if (!element.id) return element.value;
  return props.values[element.id] ?? element.value;
}

function handleValueChange(elementId: string, value: unknown): void {
  emit('valueChange', elementId, value);
}

function handleButtonClick(buttonId: string): void {
  emit('buttonClick', buttonId);
}

const buttonsWithShortcuts = computed(() => {
  return (props.buttons ?? []).filter(
    (button: ModalButton) => button.shortcut,
  );
});

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const modifiers = shortcut.modifiers ?? [];
  const needsCtrl = modifiers.includes('ctrl');
  const needsShift = modifiers.includes('shift');
  const needsAlt = modifiers.includes('alt');
  const needsMeta = modifiers.includes('meta');

  if (event.ctrlKey !== needsCtrl) return false;
  if (event.shiftKey !== needsShift) return false;
  if (event.altKey !== needsAlt) return false;
  if (event.metaKey !== needsMeta) return false;

  return event.key.toLowerCase() === shortcut.key.toLowerCase()
    || event.code.toLowerCase() === shortcut.key.toLowerCase();
}

function getShortcutParts(shortcut: KeyboardShortcut): string[] {
  const parts: string[] = [];
  const modifiers = shortcut.modifiers ?? [];

  if (modifiers.includes('ctrl')) parts.push('Ctrl');
  if (modifiers.includes('shift')) parts.push('Shift');
  if (modifiers.includes('alt')) parts.push('Alt');
  if (modifiers.includes('meta')) parts.push('⌘');

  const keyName = shortcut.key === 'Enter' ? '↵' : shortcut.key.toUpperCase();
  parts.push(keyName);

  return parts;
}

function handleFormKeydown(event: KeyboardEvent): void {
  for (const button of buttonsWithShortcuts.value) {
    if (button.shortcut && matchesShortcut(event, button.shortcut)) {
      event.preventDefault();
      handleButtonClick(button.id);
      return;
    }
  }
}

function parseSkeletonDimensions(value: unknown): { width?: string;
  height?: string; } {
  const str = String(value ?? '');
  const match = str.match(/^(\d+)x(\d+)$/);

  if (match) {
    return {
      width: `${match[1]}px`,
      height: `${match[2]}px`,
    };
  }

  return {};
}

function formatTextWithLinks(text: string): string {
  return renderTextWithLinksToSafeHtml(text, 'ext-form-view__link');
}

function handleFormLinkClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor?.href) return;
  const url = anchor.getAttribute('href') ?? '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    event.preventDefault();
    openUrl(url);
  }
}

async function focusFirstInteractiveField(): Promise<void> {
  await nextTick();

  if (!formRootElement.value) return;

  const activeElement = document.activeElement as HTMLElement | null;

  if (activeElement) {
    const formField = activeElement.closest?.(
      'input, textarea, [role="combobox"], .sigma-ui-select-trigger',
    );

    if (formField && formRootElement.value.contains(formField)) return;
  }

  const firstFocusableElement = formRootElement.value.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled]), .sigma-ui-select-trigger:not([disabled])',
  );

  if (firstFocusableElement) {
    firstFocusableElement.focus();
  }
  else {
    formRootElement.value.focus();
  }
}

onMounted(() => {
  void focusFirstInteractiveField();
});

async function scrollContentToTop(): Promise<void> {
  await nextTick();
  const viewport = formRootElement.value?.querySelector<HTMLElement>(
    '[data-radix-scroll-area-viewport], .sigma-ui-scroll-area__viewport',
  );

  if (viewport) {
    viewport.scrollTop = 0;
  }
}

watch(
  () => props.content,
  async () => {
    await scrollContentToTop();
    void focusFirstInteractiveField();
  },
  { deep: true },
);
</script>

<template>
  <div
    ref="formRootElement"
    class="ext-form-view"
    tabindex="-1"
    @keydown="handleFormKeydown"
    @click="handleFormLinkClick"
  >
    <div class="ext-form-view__header">
      <button
        v-if="onBack"
        class="ext-form-view__header-action"
        @click="onBack"
      >
        <ArrowLeftIcon :size="16" />
      </button>
      <button
        v-else-if="onClose"
        class="ext-form-view__header-action"
        @click="onClose"
      >
        <XIcon :size="16" />
      </button>
      <span class="ext-form-view__title">{{ title }}</span>
    </div>

    <ScrollArea class="ext-form-view__scroll-area">
      <div class="ext-form-view__content">
        <template
          v-for="(element, elementIndex) in content"
          :key="element.id || `element-${elementIndex}`"
        >
          <div
            v-if="element.type === 'input'"
            :class="[
              'ext-form-view__field',
              { 'ext-form-view__field--no-label': !element.label },
            ]"
          >
            <Label
              v-if="element.label"
              :for="element.id"
              class="ext-form-view__label"
            >
              {{ element.label }}
            </Label>
            <Input
              :id="element.id"
              :model-value="String(getElementValue(element) ?? '')"
              :placeholder="element.placeholder"
              :disabled="element.disabled"
              @update:model-value="(value?: string | number) => { if (value !== undefined) handleValueChange(element.id!, value) }"
            />
          </div>

          <div
            v-else-if="element.type === 'textarea'"
            :class="[
              'ext-form-view__field',
              'ext-form-view__field--multiline',
              { 'ext-form-view__field--no-label': !element.label },
            ]"
          >
            <Label
              v-if="element.label"
              :for="element.id"
              class="ext-form-view__label"
            >
              {{ element.label }}
            </Label>
            <textarea
              :id="element.id"
              :value="String(getElementValue(element) ?? '')"
              :placeholder="element.placeholder"
              :rows="element.rows || 4"
              :disabled="element.disabled"
              class="ext-form-view__textarea"
              @input="(event: Event) => handleValueChange(element.id!, (event.target as HTMLTextAreaElement).value)"
            />
          </div>

          <div
            v-else-if="element.type === 'select'"
            :class="[
              'ext-form-view__field',
              { 'ext-form-view__field--no-label': !element.label },
            ]"
          >
            <Label
              v-if="element.label"
              :for="element.id"
              class="ext-form-view__label"
            >
              {{ element.label }}
            </Label>
            <Select
              :model-value="String(getElementValue(element) ?? '')"
              :disabled="element.disabled"
              @update:model-value="(value) => { if (value != null) handleValueChange(element.id!, value) }"
            >
              <SelectTrigger :id="element.id">
                <SelectValue :placeholder="element.placeholder || 'Select an option'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in element.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            v-else-if="element.type === 'checkbox'"
            class="ext-form-view__checkbox-field"
          >
            <Checkbox
              :id="element.id"
              :model-value="Boolean(getElementValue(element))"
              :disabled="element.disabled"
              @update:model-value="(checkboxValue: boolean | 'indeterminate') => handleValueChange(element.id!, checkboxValue === true)"
            />
            <Label
              v-if="element.label"
              :for="element.id"
              class="ext-form-view__checkbox-label"
            >
              {{ element.label }}
            </Label>
          </div>

          <Separator
            v-else-if="element.type === 'separator'"
            class="ext-form-view__separator"
          />

          <p
            v-else-if="element.type === 'text'"
            class="ext-form-view__text"
            v-html="formatTextWithLinks(String(element.value ?? ''))"
          />

          <Alert
            v-else-if="element.type === 'alert'"
            :title="String(element.label ?? '')"
            :description="String(element.value ?? '')"
            :tone="element.tone || 'info'"
            class="ext-form-view__alert"
          />

          <div
            v-else-if="element.type === 'image'"
            class="ext-form-view__image-wrapper"
          >
            <img
              :src="String(element.value ?? '')"
              :alt="element.label ?? ''"
              class="ext-form-view__image"
            >
          </div>

          <div
            v-else-if="element.type === 'previewCard'"
            class="ext-form-view__preview-card"
          >
            <img
              :src="String(element.value ?? '')"
              :alt="element.label ?? ''"
              class="ext-form-view__preview-card-image"
            >
            <div class="ext-form-view__preview-card-content">
              <span class="ext-form-view__preview-card-title">{{ element.label ?? '' }}</span>
              <span
                v-if="element.subtitle"
                class="ext-form-view__preview-card-subtitle"
              >{{ element.subtitle }}</span>
            </div>
          </div>

          <div
            v-else-if="element.type === 'previewCardSkeleton'"
            class="ext-form-view__preview-card"
          >
            <Skeleton
              class="ext-form-view__preview-card-skeleton-image"
            />
            <div class="ext-form-view__preview-card-content">
              <Skeleton
                class="ext-form-view__preview-card-skeleton-title"
              />
              <Skeleton
                class="ext-form-view__preview-card-skeleton-subtitle"
              />
            </div>
          </div>

          <div
            v-else-if="element.type === 'skeleton'"
            class="ext-form-view__skeleton-wrapper"
          >
            <Skeleton
              :class="[
                'ext-form-view__skeleton',
                element.value && 'ext-form-view__skeleton--sized',
              ]"
              :style="element.value ? parseSkeletonDimensions(element.value) : undefined"
            />
          </div>

          <Button
            v-else-if="element.type === 'button'"
            :variant="element.variant === 'danger' ? 'destructive' : element.variant === 'primary' ? 'default' : 'outline'"
            :disabled="element.disabled"
            class="ext-form-view__inline-button"
            @click="handleButtonClick(element.id || '')"
          >
            {{ element.label }}
          </Button>
        </template>
      </div>
    </ScrollArea>

    <div
      v-if="buttonsWithShortcuts.length > 0"
      class="ext-form-view__footer"
    >
      <div class="ext-form-view__action-bar">
        <button
          v-for="button in buttonsWithShortcuts"
          :key="button.id"
          :class="[
            'ext-form-view__action-button',
            button.variant === 'primary' && 'ext-form-view__action-button--primary',
            button.variant === 'danger' && 'ext-form-view__action-button--danger',
          ]"
          @click="handleButtonClick(button.id)"
        >
          <span class="ext-form-view__action-label">{{ button.label }}</span>
          <ContextMenuShortcut v-if="button.shortcut">
            {{ getShortcutParts(button.shortcut).join('+') }}
          </ContextMenuShortcut>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-form-view {
  display: flex;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  flex-direction: column;
  gap: 8px;
  outline: none;
}

.ext-form-view__header {
  display: flex;
  align-items: center;
  padding: 2px;
  padding-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 8px;
}

.ext-form-view__header-action {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.ext-form-view__header-action:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.ext-form-view__title {
  font-size: 0.875rem;
  font-weight: 500;
}

.ext-form-view__scroll-area {
  min-height: 0;
  flex: 1;
}

.ext-form-view__content {
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 8px;
}

.ext-form-view__field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ext-form-view__field--no-label {
  display: block;
}

.ext-form-view__field--multiline {
  align-items: start;
}

.ext-form-view__label {
  flex: 0 0 160px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
}

.ext-form-view__field > :last-child {
  min-width: 0;
  flex: 1 1 auto;
}

.ext-form-view__field :deep(.sigma-ui-select-trigger),
.ext-form-view__field :deep(button[role="combobox"]) {
  width: 100%;
}

.ext-form-view__checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ext-form-view__checkbox-label {
  cursor: pointer;
}

.ext-form-view__separator {
  margin: 0.5rem 0;
}

.ext-form-view__text {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.ext-form-view__text :deep(.ext-form-view__link) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ext-form-view__text :deep(.ext-form-view__link:hover) {
  opacity: 0.8;
}

.ext-form-view__alert {
  width: 100%;
}

.ext-form-view__image-wrapper {
  display: flex;
  justify-content: flex-start;
}

.ext-form-view__image {
  max-width: 100%;
  max-height: 180px;
  border-radius: 6px;
  object-fit: contain;
}

.ext-form-view__preview-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.ext-form-view__preview-card-image {
  width: 128px;
  height: auto;
  flex-shrink: 0;
  border-radius: 6px;
  object-fit: contain;
}

.ext-form-view__preview-card-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.ext-form-view__preview-card-title {
  color: hsl(var(--foreground));
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.ext-form-view__preview-card-subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.ext-form-view__preview-card-skeleton-image {
  width: 128px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 6px;
}

.ext-form-view__preview-card-skeleton-title {
  width: 100%;
  max-width: 260px;
  height: 16px;
  border-radius: 4px;
}

.ext-form-view__preview-card-skeleton-subtitle {
  width: 75%;
  max-width: 180px;
  height: 12px;
  border-radius: 4px;
}

.ext-form-view__skeleton-wrapper {
  display: flex;
  justify-content: flex-start;
}

.ext-form-view__skeleton {
  width: 100%;
  max-width: 320px;
  height: 180px;
  border-radius: 6px;
}

.ext-form-view__skeleton--sized {
  max-width: none;
}

.ext-form-view__textarea {
  display: flex;
  width: 100%;
  min-height: 80px;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  background-color: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.ext-form-view__textarea:focus {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.ext-form-view__textarea:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ext-form-view__inline-button {
  align-self: flex-start;
}

.ext-form-view__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
  gap: 8px;
}

.ext-form-view__action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ext-form-view__action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 0.875rem;
  gap: 8px;
  transition: background-color 0.15s, color 0.15s;
}

.ext-form-view__action-button:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.ext-form-view__action-button--primary {
  border-color: hsl(var(--border));
  background: transparent;
  color: hsl(var(--foreground));
}

.ext-form-view__action-button--primary:hover {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.ext-form-view__action-button--danger {
  color: hsl(var(--destructive));
}

.ext-form-view__action-button--danger:hover {
  background: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}

.ext-form-view__action-label {
  white-space: nowrap;
}
</style>
