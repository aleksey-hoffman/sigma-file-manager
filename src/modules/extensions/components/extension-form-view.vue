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
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import type { UIElement, ModalButton } from '@/types/extension';
import { renderTextWithLinksToSafeHtml } from '@/utils/safe-html';
import {
  keyboardShortcutMatches,
  isUnmodifiedEnterKey,
} from '@/modules/extensions/utils/modal-keyboard-shortcut';
import { getPrimaryModalButton, resolveModalActionButtons } from '@/modules/extensions/utils/modal-action-buttons';
import { useExtensionModalOtherActionsShortcut } from '@/modules/extensions/composables/use-extension-modal-other-actions-shortcut';
import ExtensionModalHeader from './extension-modal-header.vue';
import ExtensionModalActionFooter from './extension-modal-action-footer.vue';

type ExtensionModalActionFooterExpose = {
  openOtherActions: () => Promise<void>;
};

const props = defineProps<{
  title: string;
  content: UIElement[];
  contentRevision?: number;
  buttons?: ModalButton[];
  values: Record<string, unknown>;
  extensionId?: string;
  extensionIconPath?: string;
  extensionName?: string;
  commandTitle?: string;
  onBack?: () => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  valueChange: [elementId: string, value: unknown];
  buttonClick: [buttonId: string];
  close: [];
}>();

const formRootElement = ref<HTMLElement | null>(null);
const actionFooterRef = ref<ExtensionModalActionFooterExpose | null>(null);

function getElementValue(element: UIElement): unknown {
  if (!element.id) return element.value;
  return props.values[element.id] ?? element.value;
}

function getSelectDisplayLabel(element: UIElement, value: unknown): string {
  if (element.type !== 'select') {
    return '';
  }

  const stringValue = String(value ?? '');

  if (stringValue.length === 0) {
    return '';
  }

  const matchedOption = element.options?.find(option => option.value === stringValue);
  return matchedOption?.label ?? stringValue;
}

function handleValueChange(elementId: string, value: unknown): void {
  emit('valueChange', elementId, value);
}

function resizeTextareaToContent(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function resizeTextareas(): void {
  const textareas = formRootElement.value?.querySelectorAll<HTMLTextAreaElement>(
    '.ext-form-view__textarea',
  );

  textareas?.forEach(resizeTextareaToContent);
}

function handleTextareaInput(event: Event, elementId: string): void {
  const textarea = event.target as HTMLTextAreaElement;
  handleValueChange(elementId, textarea.value);
  resizeTextareaToContent(textarea);
}

function getTextareaScrollStyle(rows: number | undefined): Record<string, string> {
  const rowCount = Math.max(rows ?? 4, 2);
  return {
    height: `${rowCount * 1.5 + 1}rem`,
  };
}

function handleButtonClick(buttonId: string): void {
  emit('buttonClick', buttonId);
}

const actionButtons = computed(() => props.buttons ?? []);
const hasSecondaryActions = computed(() => {
  return resolveModalActionButtons(actionButtons.value).secondaryButtons.length > 0;
});

const { focusModalRoot } = useExtensionModalOtherActionsShortcut({
  rootElement: formRootElement,
  actionFooterRef,
  hasSecondaryActions,
  handleKeyboardShortcut: handleFormKeyboardShortcut,
});

function triggerPrimaryAction(): void {
  const primaryButton = getPrimaryModalButton(actionButtons.value);

  if (primaryButton) {
    handleButtonClick(primaryButton.id);
  }
}

function handleFormKeyboardShortcut(event: KeyboardEvent): void {
  for (const button of actionButtons.value) {
    if (button.shortcut && keyboardShortcutMatches(event, button.shortcut)) {
      event.preventDefault();
      handleButtonClick(button.id);
      return;
    }
  }

  const target = event.target;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (isUnmodifiedEnterKey(event)) {
      event.preventDefault();
      triggerPrimaryAction();
    }

    return;
  }

  if (isUnmodifiedEnterKey(event)) {
    event.preventDefault();
    triggerPrimaryAction();
  }
}

function handleFormMouseDown(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Element) || !formRootElement.value) {
    return;
  }

  const interactiveField = target.closest(
    'input, textarea, button, a, [role="combobox"], .sigma-ui-select-trigger, .sigma-ui-checkbox, label',
  );

  if (interactiveField && formRootElement.value.contains(interactiveField)) {
    return;
  }

  focusModalRoot();
}

function parseSkeletonDimensions(value: unknown): {
  width?: string;
  height?: string;
} {
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

  if (isFocusWithinFormInteraction()) return;

  const firstFocusableElement = formRootElement.value.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled]), button[role="checkbox"]:not([disabled]), .sigma-ui-select-trigger:not([disabled]), .sigma-ui-checkbox:not([disabled])',
  );

  if (firstFocusableElement) {
    firstFocusableElement.focus();
  }
  else {
    formRootElement.value.focus();
  }
}

function isFocusWithinFormInteraction(): boolean {
  if (!formRootElement.value) return false;

  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement) return false;

  const interactiveField = activeElement.closest?.(
    'input, textarea, [role="combobox"], .sigma-ui-select-trigger, button[role="checkbox"], .sigma-ui-checkbox, label',
  );

  return Boolean(interactiveField && formRootElement.value.contains(interactiveField));
}

onMounted(() => {
  void focusFirstInteractiveField();
  void nextTick(resizeTextareas);
});

watch(
  () => props.content,
  () => {
    void nextTick(resizeTextareas);
  },
  { deep: true },
);
</script>

<template>
  <div
    ref="formRootElement"
    class="ext-form-view"
    tabindex="-1"
    @mousedown="handleFormMouseDown"
    @click="handleFormLinkClick"
  >
    <ExtensionModalHeader
      :title="title"
      :extension-id="extensionId"
      :extension-icon-path="extensionIconPath"
      :extension-name="extensionName"
      :command-title="commandTitle"
      :on-back="onBack"
      :on-close="onClose"
    />

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
            <ScrollArea
              class="ext-form-view__textarea-scroll"
              :style="getTextareaScrollStyle(element.rows)"
            >
              <textarea
                :id="element.id"
                :value="String(getElementValue(element) ?? '')"
                :placeholder="element.placeholder"
                :rows="element.rows || 4"
                :disabled="element.disabled"
                class="ext-form-view__textarea"
                @input="(event: Event) => handleTextareaInput(event, element.id!)"
              />
            </ScrollArea>
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
                <SelectValue :placeholder="element.placeholder || 'Select an option'">
                  {{ getSelectDisplayLabel(element, getElementValue(element)) }}
                </SelectValue>
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

    <ExtensionModalActionFooter
      ref="actionFooterRef"
      :buttons="actionButtons"
      :modal-focus-target="formRootElement"
      @button-click="handleButtonClick"
      @other-actions-closed="focusModalRoot"
    />
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

.ext-form-view__textarea-scroll {
  width: 100%;
  min-height: 80px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  background-color: transparent;
  resize: vertical;
}

.ext-form-view__textarea-scroll:focus-within {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.ext-form-view__textarea-scroll:has(.ext-form-view__textarea:disabled) {
  opacity: 0.5;
}

.ext-form-view__textarea {
  display: block;
  overflow: hidden;
  width: 100%;
  min-height: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  background-color: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  outline: none;
  resize: none;
}

.ext-form-view__textarea::placeholder {
  color: hsl(var(--muted-foreground));
}

.ext-form-view__textarea:disabled {
  cursor: not-allowed;
}

.ext-form-view__inline-button {
  align-self: flex-start;
}
</style>
