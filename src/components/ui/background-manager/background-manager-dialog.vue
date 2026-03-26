<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { GlobeIcon, LoaderCircleIcon, PlusIcon, Trash2Icon } from '@lucide/vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useBackgroundMedia,
  type MediaItem,
  type MediaSelectionState,
  type ResolvedMediaSelection,
} from '@/modules/home/composables/use-background-media';
import { useBackgroundMediaStore } from '@/stores/runtime/background-media';
const props = defineProps<{
  open: boolean;
  selectionState?: MediaSelectionState;
  defaultMediaId?: string;
  onApplySelection?: (selection: ResolvedMediaSelection) => Promise<void> | void;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t } = useI18n();
const backgroundMediaStore = useBackgroundMediaStore();
const backgroundMediaTarget = props.selectionState && props.onApplySelection
  ? {
      getSelection: () => props.selectionState as MediaSelectionState,
      applySelection: (selection: ResolvedMediaSelection) => props.onApplySelection?.(selection),
      defaultMediaId: props.defaultMediaId,
    }
  : undefined;
const {
  allMediaItems,
  currentIndex,
  getMediaUrl,
  getPreviewUrl,
  selectMedia,
  openFilePicker,
  addFilesFromPaths,
  addMediaUrl,
  removeCustomMedia,
  customItems,
} = useBackgroundMedia(backgroundMediaTarget);

const isAddingFiles = ref(false);
const isContentReady = ref(false);
const urlInput = ref('');
const isDraggingOver = ref(false);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await backgroundMediaStore.refreshCustomBackgrounds();
      setTimeout(() => {
        isContentReady.value = true;
      }, 350);
    }
    else {
      isContentReady.value = false;
    }
  },
  { immediate: true },
);

async function handleAddUrl() {
  const url = urlInput.value.trim();

  if (!url) {
    return;
  }

  await addMediaUrl(url);
  urlInput.value = '';
}

async function handleDropZoneClick() {
  try {
    isAddingFiles.value = true;
    await openFilePicker();
  }
  catch (error) {
    console.error('Failed to add media:', error);
  }
  finally {
    isAddingFiles.value = false;
  }
}

function getItemDisplayName(item: MediaItem): string {
  if (item.kind === 'builtin') {
    return item.data.name;
  }

  return item.fileName;
}

function getItemType(item: MediaItem): 'image' | 'video' {
  if (item.kind === 'builtin') {
    return item.data.type;
  }

  return item.type;
}

function getFlatIndex(item: MediaItem): number {
  if (item.kind === 'custom') {
    return item.index;
  }

  return customItems.value.length + item.index;
}

let unlistenDrop: (() => void) | null = null;

onMounted(() => {
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
  const videoExts = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']);

  getCurrentWebview()
    .onDragDropEvent(async (event) => {
      if (!props.open) {
        return;
      }

      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        isDraggingOver.value = true;
      }
      else if (event.payload.type === 'leave') {
        isDraggingOver.value = false;
      }
      else if (event.payload.type === 'drop') {
        isDraggingOver.value = false;

        const paths = (event.payload.paths as string[]) ?? [];
        const filtered = paths.filter((path) => {
          const ext = path.split('.').pop()?.toLowerCase() ?? '';
          return imageExts.has(ext) || videoExts.has(ext);
        });

        if (filtered.length > 0) {
          await addFilesFromPaths(filtered);
        }
      }
    })
    .then((unlisten) => {
      unlistenDrop = unlisten;
    });
});

onUnmounted(() => {
  if (unlistenDrop) {
    unlistenDrop();
  }
});
</script>

<template>
  <Drawer
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DrawerContent class="background-manager-dialog">
      <DrawerHeader>
        <DrawerTitle>
          {{ t('home.backgroundManager') }}
        </DrawerTitle>
      </DrawerHeader>

      <ScrollArea class="background-manager__scroll-area">
        <div
          v-if="!isContentReady"
          class="background-manager__loader"
        >
          <LoaderCircleIcon
            :size="28"
            class="background-manager__loader-icon"
          />
        </div>

        <div
          v-else
          class="background-manager__body animate-fade-in"
        >
          <div class="background-manager__section">
            <h3 class="background-manager__section-title">
              {{ t('dialogs.homeBannerPickerDialog.customBackgrounds') }}
            </h3>
            <div class="background-manager__url-input-row">
              <GlobeIcon
                :size="16"
                class="background-manager__url-input-icon"
              />
              <Input
                v-model="urlInput"
                class="background-manager__url-input"
                :placeholder="t('home.addMediaUrlPlaceholder')"
                @keydown.enter="handleAddUrl"
              />
              <Button
                variant="secondary"
                size="sm"
                :disabled="!urlInput.trim()"
                @click="handleAddUrl"
              >
                {{ t('add') }}
              </Button>
            </div>
            <div class="background-manager__grid">
              <button
                type="button"
                class="background-manager__drop-zone"
                :class="{
                  'background-manager__drop-zone--loading': isAddingFiles,
                  'background-manager__drop-zone--drag-over': isDraggingOver,
                }"
                @click="handleDropZoneClick"
              >
                <PlusIcon
                  :size="32"
                  class="background-manager__drop-zone-icon"
                />
                <span class="background-manager__drop-zone-title">
                  {{ t('home.dropZoneClickToBrowse') }}
                </span>
                <span class="background-manager__drop-zone-hint">
                  {{ t('home.dropZoneOrDropFiles') }}
                </span>
              </button>

              <div
                v-for="item in allMediaItems.filter(mediaItem => mediaItem.kind === 'custom')"
                :key="item.id"
                class="background-manager__item"
                :class="{ 'background-manager__item--selected': getFlatIndex(item) === currentIndex }"
                @click="selectMedia(getFlatIndex(item))"
              >
                <div class="background-manager__item-thumb">
                  <img
                    v-if="getItemType(item) === 'image'"
                    :src="getMediaUrl(item)"
                    :alt="getItemDisplayName(item)"
                    class="background-manager__item-media"
                    loading="lazy"
                  >
                  <video
                    v-else
                    :src="getMediaUrl(item) + '#t=0.5'"
                    class="background-manager__item-media"
                    muted
                    preload="metadata"
                  />
                </div>

                <div class="background-manager__item-overlay">
                  <div class="background-manager__item-overlay-text">
                    <span class="background-manager__item-name">{{ getItemDisplayName(item) }}</span>
                    <span class="background-manager__item-type">
                      {{ t(getItemType(item) === 'image' ? 'image' : 'video') }}
                    </span>
                  </div>
                </div>

                <div class="background-manager__item-actions">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="background-manager__item-delete"
                        @click.stop="removeCustomMedia(item.path)"
                      >
                        <Trash2Icon :size="16" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ t('fileBrowser.actions.delete') }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          <div class="background-manager__section">
            <h3 class="background-manager__section-title">
              {{ t('dialogs.homeBannerPickerDialog.defaultBackgrounds') }}
            </h3>

            <div class="background-manager__grid animate-fade-in">
              <div
                v-for="item in allMediaItems.filter(mediaItem => mediaItem.kind === 'builtin')"
                :key="item.data.fileName"
                class="background-manager__item"
                :class="{ 'background-manager__item--selected': getFlatIndex(item) === currentIndex }"
                @click="selectMedia(getFlatIndex(item))"
              >
                <div class="background-manager__item-thumb">
                  <img
                    :src="getPreviewUrl(item)"
                    :alt="getItemDisplayName(item)"
                    class="background-manager__item-media"
                    loading="lazy"
                  >
                </div>

                <div class="background-manager__item-overlay">
                  <div class="background-manager__item-overlay-text">
                    <span class="background-manager__item-name">{{ getItemDisplayName(item) }}</span>
                    <span class="background-manager__item-type">
                      {{ item.data.author }} · {{ t(getItemType(item) === 'image' ? 'image' : 'video') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </DrawerContent>
  </Drawer>
</template>

<style>
.background-manager-dialog {
  display: flex;
  overflow: hidden;
  height: min(500px, 80vh);
  min-height: 0;
  flex-direction: column;
}

.background-manager__scroll-area {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.background-manager__loader {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.background-manager__loader-icon {
  animation: spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.background-manager__body {
  padding: 8px 24px 24px;
}

.background-manager__section {
  margin-bottom: 32px;
}

.background-manager__section:last-child {
  margin-bottom: 0;
}

.background-manager__section-title {
  margin: 0 0 8px;
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 600;
}

.background-manager__grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 1fr;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.background-manager__drop-zone {
  display: flex;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 2px dashed hsl(var(--border));
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  background: hsl(var(--muted) / 30%);
  cursor: pointer;
  transition: all 0.2s ease;
}

.background-manager__drop-zone:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.background-manager__drop-zone--loading {
  cursor: wait;
  opacity: 0.7;
}

.background-manager__drop-zone--drag-over {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
}

.background-manager__drop-zone--drag-over .background-manager__drop-zone-icon {
  color: hsl(var(--primary));
}

.background-manager__drop-zone-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.background-manager__drop-zone:hover .background-manager__drop-zone-icon {
  color: hsl(var(--primary));
}

.background-manager__drop-zone-title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
}

.background-manager__drop-zone-hint {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.background-manager__url-input-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.background-manager__url-input-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.background-manager__url-input {
  height: 2rem;
  flex: 1;
  font-size: 13px;
}

.background-manager__item {
  position: relative;
  overflow: hidden;
  min-height: 0;
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  cursor: pointer;
  -webkit-mask-image: radial-gradient(white, black);
  transition: box-shadow 0.2s ease;
}

.background-manager__item:hover {
  box-shadow: 0 4px 12px hsl(0deg 0% 0% / 25%);
}

.background-manager__item--selected::before {
  position: absolute;
  z-index: 5;
  border: 2px solid hsl(var(--primary));
  border-radius: var(--radius-md);
  content: '';
  inset: 0;
  pointer-events: none;
}

.background-manager__item-thumb {
  position: absolute;
  inset: 0;
}

.background-manager__item-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-manager__item-overlay {
  position: absolute;
  z-index: 1;
  right: -1px;
  bottom: -1px;
  left: -1px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12px;
  backdrop-filter: blur(8px);
  background: linear-gradient(to top, hsl(0deg 0% 0% / 70%), hsl(0deg 0% 0% / 20%));
  gap: 8px;
  transition: all 0.2s ease;
}

.background-manager__item:hover .background-manager__item-overlay {
  background: linear-gradient(to top, hsl(0deg 0% 0% / 79%), hsl(0deg 0% 0% / 25%));
}

.background-manager__item-overlay-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.background-manager__item-name {
  display: block;
  overflow: hidden;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.background-manager__item-type {
  color: hsl(0deg 0% 100% / 80%);
  font-size: 11px;
}

.background-manager__item-actions {
  position: absolute;
  z-index: 6;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.background-manager__item-delete {
  background: hsl(0deg 0% 0% / 50%) !important;
  color: #ffffff !important;
  opacity: 0;
}

.background-manager__item:hover .background-manager__item-delete {
  opacity: 1;
}

.background-manager__item--selected .background-manager__item-delete {
  opacity: 1;
}
</style>
