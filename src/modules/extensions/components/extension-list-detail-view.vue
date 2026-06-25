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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListDetailItem, ListDetailState, ModalButton } from '@/types/extension';
import { resolveExtensionStorageAssetUrl } from '@/modules/extensions/utils/resolve-extension-storage-asset-url';
import { getPrimaryModalButton, resolveModalActionButtons } from '@/modules/extensions/utils/modal-action-buttons';
import {
  keyboardShortcutMatches,
  isUnmodifiedEnterKey,
} from '@/modules/extensions/utils/modal-keyboard-shortcut';
import { useExtensionModalOtherActionsShortcut } from '@/modules/extensions/composables/use-extension-modal-other-actions-shortcut';
import ExtensionModalHeader from './extension-modal-header.vue';
import ExtensionModalActionFooter from './extension-modal-action-footer.vue';
import ExtensionListDetailFieldIcon from './extension-list-detail-field-icon.vue';

type ExtensionModalActionFooterExpose = {
  openOtherActions: () => Promise<void>;
};

const props = defineProps<{
  title: string;
  listDetail: ListDetailState;
  extensionId?: string;
  extensionIconPath?: string;
  extensionName?: string;
  commandTitle?: string;
  buttons?: ModalButton[];
  onBack?: () => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  selectionChange: [itemId: string | null];
  searchChange: [searchQuery: string];
  filterChange: [filterValue: string];
  buttonClick: [buttonId: string];
  close: [];
}>();

const rootElement = ref<HTMLElement | null>(null);
const actionFooterRef = ref<ExtensionModalActionFooterExpose | null>(null);
const searchInput = ref('');
const detailImageUrl = ref<string | undefined>();
const pendingSelectedItemId = ref<string | null>(null);

const effectiveSelectedItemId = computed(() => {
  return pendingSelectedItemId.value ?? props.listDetail.selectedItemId;
});

const actionButtons = computed(() => props.buttons ?? []);
const hasSecondaryActions = computed(() => {
  return resolveModalActionButtons(actionButtons.value).secondaryButtons.length > 0;
});

type ListDisplayGroup = {
  id: string;
  label?: string;
  items: ListDetailItem[];
};

const listDisplayGroups = computed((): ListDisplayGroup[] => {
  const { items, listGroupLabels, filterValue } = props.listDetail;
  const pinnedItems = items.filter(item => item.pinned);
  const recentItems = items.filter(item => !item.pinned);
  const groups: ListDisplayGroup[] = [];

  if (pinnedItems.length > 0) {
    const showPinnedLabel = Boolean(listGroupLabels?.pinned)
      && (recentItems.length > 0 || filterValue === 'pinned');

    groups.push({
      id: 'pinned',
      label: showPinnedLabel ? listGroupLabels?.pinned : undefined,
      items: pinnedItems,
    });
  }

  if (recentItems.length > 0) {
    groups.push({
      id: 'recent',
      label: pinnedItems.length > 0 ? listGroupLabels?.recent : undefined,
      items: recentItems,
    });
  }

  return groups;
});

const { tryOpenOtherActions, focusModalRoot } = useExtensionModalOtherActionsShortcut({
  rootElement,
  actionFooterRef,
  hasSecondaryActions,
});

function handleButtonClick(buttonId: string): void {
  const button = actionButtons.value.find(actionButton => actionButton.id === buttonId);

  if (button?.disabled) {
    return;
  }

  emit('buttonClick', buttonId);
}

function triggerPrimaryAction(): void {
  const primaryButton = getPrimaryModalButton(actionButtons.value);

  if (primaryButton) {
    handleButtonClick(primaryButton.id);
  }
}

function getSelectedIndex(): number {
  const { items } = props.listDetail;
  const selectedItemId = effectiveSelectedItemId.value;

  if (!selectedItemId) {
    return -1;
  }

  return items.findIndex(item => item.id === selectedItemId);
}

async function scrollSelectedItemIntoView(): Promise<void> {
  await nextTick();

  const selectedItem = rootElement.value?.querySelector(
    '.ext-list-detail-view__list-item--selected',
  );

  selectedItem?.scrollIntoView({ block: 'nearest' });
}

function selectItemAtIndex(index: number): void {
  const item = props.listDetail.items[index];

  if (!item) {
    return;
  }

  handleItemSelect(item.id);
  void scrollSelectedItemIntoView();
}

function moveSelection(offset: number): void {
  const { items } = props.listDetail;

  if (items.length === 0) {
    return;
  }

  const currentIndex = getSelectedIndex();
  const startIndex = currentIndex === -1
    ? (offset > 0 ? 0 : items.length - 1)
    : currentIndex;
  const nextIndex = Math.max(0, Math.min(items.length - 1, startIndex + offset));

  selectItemAtIndex(nextIndex);
  rootElement.value?.focus();
}

function handleShortcutKeydown(event: KeyboardEvent): void {
  for (const button of actionButtons.value) {
    if (button.disabled) {
      continue;
    }

    if (button.shortcut && keyboardShortcutMatches(event, button.shortcut)) {
      event.preventDefault();
      handleButtonClick(button.id);
      return;
    }
  }
}

function handleSearchKeydown(event: KeyboardEvent): void {
  if (tryOpenOtherActions(event)) {
    event.stopPropagation();
    return;
  }

  handleShortcutKeydown(event);

  if (event.defaultPrevented) {
    event.stopPropagation();
    return;
  }

  if (isUnmodifiedEnterKey(event)) {
    event.preventDefault();
    event.stopPropagation();
    triggerPrimaryAction();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    moveSelection(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    moveSelection(-1);
  }
}

function handleRootKeydown(event: KeyboardEvent): void {
  const target = event.target;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1);
    return;
  }

  if (tryOpenOtherActions(event)) {
    return;
  }

  handleShortcutKeydown(event);

  if (event.defaultPrevented) {
    return;
  }

  if (isUnmodifiedEnterKey(event)) {
    event.preventDefault();
    triggerPrimaryAction();
    return;
  }
}

function handleItemSelect(itemId: string): void {
  pendingSelectedItemId.value = itemId;
  emit('selectionChange', itemId);
}

function handleSearchInput(value: string | number | undefined): void {
  const nextValue = value === undefined ? '' : String(value);
  searchInput.value = nextValue;
  emit('searchChange', nextValue);
}

function handleFilterChange(value: unknown): void {
  if (value == null) {
    return;
  }

  emit('filterChange', String(value));
}

function getItemIconLabel(icon?: string): string {
  switch (icon) {
    case 'image':
      return 'IMG';
    case 'files':
      return 'DIR';
    default:
      return 'TXT';
  }
}

watch(
  () => props.listDetail.searchQuery,
  (nextValue) => {
    searchInput.value = nextValue;
  },
  { immediate: true },
);

watch(
  () => [
    props.extensionId,
    props.listDetail.detail?.type,
    props.listDetail.detail?.imageUrl,
    props.listDetail.detail?.imageStoragePath,
  ] as const,
  async ([extensionId, detailType, imageUrl, imageStoragePath]) => {
    if (detailType !== 'image') {
      detailImageUrl.value = undefined;
      return;
    }

    if (imageUrl) {
      detailImageUrl.value = imageUrl;
      return;
    }

    if (extensionId && imageStoragePath) {
      detailImageUrl.value = await resolveExtensionStorageAssetUrl(extensionId, imageStoragePath);
      return;
    }

    detailImageUrl.value = undefined;
  },
  { immediate: true },
);

watch(
  () => props.listDetail.selectedItemId,
  (selectedItemId) => {
    if (selectedItemId === pendingSelectedItemId.value) {
      pendingSelectedItemId.value = null;
    }

    void scrollSelectedItemIntoView();
  },
);

onMounted(async () => {
  await nextTick();
  rootElement.value?.focus();
});
</script>

<template>
  <div
    ref="rootElement"
    class="ext-list-detail-view"
    tabindex="-1"
    @keydown="handleRootKeydown"
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

    <div class="ext-list-detail-view__toolbar">
      <Input
        :model-value="searchInput"
        :placeholder="listDetail.searchPlaceholder || 'Search...'"
        class="ext-list-detail-view__search"
        @update:model-value="handleSearchInput"
        @keydown="handleSearchKeydown"
      />
      <Select
        :model-value="listDetail.filterValue"
        @update:model-value="handleFilterChange"
      >
        <SelectTrigger class="ext-list-detail-view__filter">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in listDetail.filterOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="ext-list-detail-view__body">
      <ScrollArea class="ext-list-detail-view__list-panel">
        <div
          v-if="listDetail.items.length === 0"
          class="ext-list-detail-view__empty"
        >
          <div class="ext-list-detail-view__empty-title">
            {{ listDetail.emptyListTitle || 'No items' }}
          </div>
          <div>{{ listDetail.emptyListDescription || '' }}</div>
        </div>

        <template v-else>
          <template
            v-for="group in listDisplayGroups"
            :key="group.id"
          >
            <div
              v-if="group.label"
              class="ext-list-detail-view__list-group-title"
            >
              {{ group.label }}
            </div>

            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              :class="[
                'ext-list-detail-view__list-item',
                { 'ext-list-detail-view__list-item--selected': item.id === effectiveSelectedItemId },
              ]"
              :aria-selected="item.id === effectiveSelectedItemId"
              @click="handleItemSelect(item.id)"
            >
              <div class="ext-list-detail-view__item-icon">
                <img
                  v-if="item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  alt=""
                >
                <span v-else>{{ getItemIconLabel(item.icon) }}</span>
              </div>
              <div
                class="ext-list-detail-view__item-content"
                :class="{ 'ext-list-detail-view__item-content--has-badge': item.badge }"
              >
                <span
                  v-if="item.badge"
                  class="ext-list-detail-view__item-badge"
                >{{ item.badge }}</span>
                <div class="ext-list-detail-view__item-title">
                  {{ item.title }}
                </div>
                <div
                  v-if="item.subtitle"
                  class="ext-list-detail-view__item-subtitle"
                >
                  {{ item.subtitle }}
                </div>
              </div>
            </button>
          </template>
        </template>
      </ScrollArea>

      <div
        :key="listDetail.selectedItemId ?? 'none'"
        class="ext-list-detail-view__detail-panel"
      >
        <template v-if="listDetail.detail">
          <ScrollArea class="ext-list-detail-view__preview-scroll">
            <div class="ext-list-detail-view__preview">
              <img
                v-if="listDetail.detail.type === 'image' && detailImageUrl"
                :src="detailImageUrl"
                alt=""
                class="ext-list-detail-view__preview-image"
              >
              <div
                v-else-if="listDetail.detail.type === 'image'"
                class="ext-list-detail-view__empty"
              >
                <div class="ext-list-detail-view__empty-title">
                  {{ listDetail.emptyDetailTitle || 'Image preview unavailable' }}
                </div>
              </div>
              <div
                v-else-if="listDetail.detail.type === 'text'"
                class="ext-list-detail-view__preview-text"
              >
                {{ listDetail.detail.text }}
              </div>
              <div
                v-else-if="listDetail.detail.type === 'files'"
                class="ext-list-detail-view__preview-files"
              >
                <div
                  v-for="filePath in listDetail.detail.filePaths"
                  :key="filePath"
                  class="ext-list-detail-view__file-path"
                >
                  {{ filePath }}
                </div>
              </div>
            </div>
          </ScrollArea>

          <ScrollArea class="ext-list-detail-view__meta-scroll">
            <div class="ext-list-detail-view__meta">
              <div
                v-for="(field, fieldIndex) in listDetail.detailFields"
                :key="`${field.label}-${fieldIndex}`"
                class="ext-list-detail-view__meta-row"
              >
                <span class="ext-list-detail-view__meta-label">{{ field.label }}</span>
                <span class="ext-list-detail-view__meta-value">
                  <ExtensionListDetailFieldIcon
                    :icon-url="field.iconUrl"
                    :system-icon-path="field.systemIconPath"
                  />
                  <span>{{ field.value }}</span>
                </span>
              </div>
            </div>
          </ScrollArea>
        </template>

        <div
          v-else
          class="ext-list-detail-view__empty"
        >
          <div class="ext-list-detail-view__empty-title">
            {{ listDetail.emptyDetailTitle || 'Select an item' }}
          </div>
          <div>{{ listDetail.emptyDetailDescription || '' }}</div>
        </div>
      </div>
    </div>

    <ExtensionModalActionFooter
      ref="actionFooterRef"
      :buttons="actionButtons"
      :modal-focus-target="rootElement"
      @button-click="handleButtonClick"
      @other-actions-closed="focusModalRoot"
    />
  </div>
</template>

<style scoped>
.ext-list-detail-view {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  outline: none;
}

.ext-list-detail-view__toolbar {
  display: flex;
  gap: 8px;
}

.ext-list-detail-view__search {
  min-width: 0;
  flex: 1;
}

.ext-list-detail-view__filter {
  width: 140px;
  flex-shrink: 0;
}

.ext-list-detail-view__body {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ext-list-detail-view__list-panel {
  width: 240px;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  flex: 0 0 240px;
  border-right: 1px solid hsl(var(--border));
}

.ext-list-detail-view__detail-panel {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.ext-list-detail-view__list-group-title {
  padding: 8px 12px 4px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 20%);
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ext-list-detail-view__list-item {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid hsl(var(--border));
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 10px;
  text-align: left;
}

.ext-list-detail-view__list-item:hover {
  background: hsl(var(--accent) / 40%);
}

.ext-list-detail-view__list-item--selected {
  background: hsl(var(--accent));
  box-shadow: inset 3px 0 0 hsl(var(--primary));
  color: hsl(var(--accent-foreground));
}

.ext-list-detail-view__item-icon {
  display: flex;
  overflow: hidden;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
}

.ext-list-detail-view__item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ext-list-detail-view__item-content {
  position: relative;
  min-width: 0;
  flex: 1;
}

.ext-list-detail-view__item-title {
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ext-list-detail-view__item-content--has-badge .ext-list-detail-view__item-title {
  padding-right: 52px;
}

.ext-list-detail-view__item-content--has-badge .ext-list-detail-view__item-subtitle {
  padding-right: 52px;
}

.ext-list-detail-view__item-badge {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.65rem;
  font-weight: 400;
  line-height: 1.4;
  white-space: nowrap;
}

.ext-list-detail-view__item-subtitle {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ext-list-detail-view__empty {
  display: flex;
  height: 100%;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: hsl(var(--muted-foreground));
  gap: 6px;
  text-align: center;
}

.ext-list-detail-view__empty-title {
  color: hsl(var(--foreground));
  font-size: 0.9375rem;
  font-weight: 600;
}

.ext-list-detail-view__detail-panel > .ext-list-detail-view__empty {
  min-height: 0;
  flex: 1;
}

.ext-list-detail-view__preview-scroll {
  min-height: 0;
  flex: 0 0 50%;
  border-bottom: 1px solid hsl(var(--border));
}

.ext-list-detail-view__preview {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  padding: 16px;
}

.ext-list-detail-view__preview-image {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  margin: auto;
  object-fit: contain;
}

.ext-list-detail-view__preview-text {
  min-height: 0;
  flex: 1;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted) / 30%);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.ext-list-detail-view__preview-files {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.ext-list-detail-view__file-path {
  padding: 8px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  word-break: break-all;
}

.ext-list-detail-view__meta-scroll {
  min-height: 0;
  flex: 0 0 50%;
}

.ext-list-detail-view__meta {
  padding: 4px 20px 4px 16px;
}

.ext-list-detail-view__meta-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid hsl(var(--border));
  gap: 16px;
}

.ext-list-detail-view__meta-label {
  color: hsl(var(--muted-foreground));
}

.ext-list-detail-view__meta-value {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  overflow-wrap: anywhere;
  text-align: right;
}
</style>
