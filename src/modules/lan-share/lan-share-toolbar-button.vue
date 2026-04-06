<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Share2Icon, PlayIcon, FolderIcon, InfoIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useLanShareStore } from '@/stores/runtime/lan-share';
import { useNavigatorSelectionStore } from '@/stores/runtime/navigator-selection';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useLanShare } from '@/composables/use-lan-share';

const { t } = useI18n();
const lanShareStore = useLanShareStore();
const { activeSession, isPopoverOpen, qrDataUrl } = storeToRefs(lanShareStore);
const workspacesStore = useWorkspacesStore();
const navigatorSelectionStore = useNavigatorSelectionStore();
const { selectedDirEntries } = storeToRefs(navigatorSelectionStore);

const {
  startShareCurrentDirectory,
  startShareSelectedItems,
  switchLanShareMode,
  stopShare,
  copyLanShareAddress,
} = useLanShare();

const canShareCurrentDirectory = computed(() => {
  const tab = workspacesStore.currentTab;
  return Boolean(tab && tab.type === 'directory' && tab.path);
});

const canShareSelectedItems = computed(() => selectedDirEntries.value.length > 0);

const selectedItemCount = computed(() => selectedDirEntries.value.length);

const isHubSession = computed(() => (activeSession.value?.hubPaths?.length ?? 0) >= 2);
</script>

<template>
  <div class="lan-share-toolbar-button animate-fade-in">
    <Popover v-model:open="isPopoverOpen">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="lan-share-toolbar-button__trigger"
          :class="{ 'lan-share-toolbar-button__trigger--active': activeSession }"
          :aria-label="t('lanShare.toolbarTooltip')"
          :title="t('lanShare.toolbarTooltip')"
        >
          <Share2Icon
            :size="16"
            class="lan-share-toolbar-button__icon"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        :side-offset="8"
        class="lan-share-toolbar-popover"
      >
        <div
          v-if="activeSession"
          class="lan-share-toolbar__active"
        >
          <div class="lan-share-toolbar__header">
            <span class="lan-share-toolbar__header-title">{{ t('lanShare.serverActive') }}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="lan-share-toolbar__not-working"
                  >
                    {{ t('lanShare.notWorkingHint') }}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  class="lan-share-toolbar__not-working-tooltip"
                >
                  <ul class="lan-share-toolbar__not-working-list">
                    <li>{{ t('lanShare.notWorkingReasonVpn') }}</li>
                    <li>{{ t('lanShare.notWorkingReasonFirewall') }}</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div class="lan-share-toolbar__body">
            <div class="lan-share-toolbar__qr-section">
              <img
                v-if="qrDataUrl"
                class="lan-share-toolbar__qr-image"
                :src="qrDataUrl"
                alt=""
                width="128"
                height="128"
              >
            </div>

            <div class="lan-share-toolbar__info">
              <div class="lan-share-toolbar__address-group">
                <div class="lan-share-toolbar__address-label-row">
                  <div class="lan-share-toolbar__address-label">
                    {{ t('dialogs.localShareManagerDialog.localServerAddress') }}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="lan-share-toolbar__info-icon"
                          @click="copyLanShareAddress(activeSession.address)"
                        >
                          <InfoIcon :size="13" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p class="lan-share-toolbar__tooltip-text">
                          {{ t('lanShare.urlHintDirect') }}: {{ activeSession.address }}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div
                  v-if="activeSession.mdnsAddress"
                  class="lan-share-toolbar__address-row"
                >
                  <span class="lan-share-toolbar__hint">{{ t('lanShare.urlHintMain') }}:</span>
                  <button
                    type="button"
                    class="lan-share-toolbar__address"
                    @click="copyLanShareAddress(activeSession.mdnsAddress!)"
                  >
                    {{ activeSession.mdnsAddress }}
                  </button>
                </div>
                <div
                  v-else
                  class="lan-share-toolbar__address-row"
                >
                  <span class="lan-share-toolbar__hint">{{ t('lanShare.urlHintMain') }}:</span>
                  <button
                    type="button"
                    class="lan-share-toolbar__address"
                    @click="copyLanShareAddress(activeSession.address)"
                  >
                    {{ activeSession.address }}
                  </button>
                </div>
                <div
                  v-if="activeSession.iosAddress"
                  class="lan-share-toolbar__address-row"
                >
                  <span class="lan-share-toolbar__hint">{{ t('lanShare.secondaryHint') }}:</span>
                  <button
                    type="button"
                    class="lan-share-toolbar__address"
                    @click="copyLanShareAddress(activeSession.iosAddress!)"
                  >
                    {{ activeSession.iosAddress }}
                  </button>
                </div>
              </div>

              <div class="lan-share-toolbar__path-group">
                <div class="lan-share-toolbar__path-label">
                  {{ activeSession.isFile
                    ? t('dialogs.localShareManagerDialog.sharedFile')
                    : t('dialogs.localShareManagerDialog.sharedDirectory')
                  }}
                </div>
                <div class="lan-share-toolbar__path">
                  {{ activeSession.sharedPath }}
                </div>
              </div>
            </div>
          </div>

          <div class="lan-share-toolbar__mode-selector">
            <button
              type="button"
              class="lan-share-toolbar__mode-card"
              :class="{ 'lan-share-toolbar__mode-card--active': activeSession.mode === 'stream' }"
              @click="switchLanShareMode('stream')"
            >
              <PlayIcon
                :size="18"
                class="lan-share-toolbar__mode-card-icon"
              />
              <div class="lan-share-toolbar__mode-card-text">
                <div class="lan-share-toolbar__mode-card-title">
                  {{ t('lanShare.modeStream') }}
                </div>
                <div class="lan-share-toolbar__mode-card-description">
                  {{ t('lanShare.modeStreamDescription') }}
                </div>
              </div>
            </button>
            <button
              type="button"
              class="lan-share-toolbar__mode-card"
              :class="{
                'lan-share-toolbar__mode-card--active': activeSession.mode === 'ftp',
                'lan-share-toolbar__mode-card--disabled': isHubSession,
              }"
              :disabled="isHubSession"
              @click="switchLanShareMode('ftp')"
            >
              <FolderIcon
                :size="18"
                class="lan-share-toolbar__mode-card-icon"
              />
              <div class="lan-share-toolbar__mode-card-text">
                <div class="lan-share-toolbar__mode-card-title">
                  {{ t('lanShare.modeFtp') }}
                </div>
                <div class="lan-share-toolbar__mode-card-description">
                  {{ t('lanShare.modeFtpDescription') }}
                </div>
              </div>
            </button>
          </div>

          <div class="lan-share-toolbar__footer">
            <Button
              variant="secondary"
              size="xs"
              @click="stopShare()"
            >
              {{ t('lanShare.stopSharing') }}
            </Button>
          </div>
        </div>

        <div
          v-else
          class="lan-share-toolbar__idle"
        >
          <EmptyState
            class="lan-share-toolbar__idle-empty"
            :icon="Share2Icon"
            :icon-size="40"
            :title="t('lanShare.idleEmptyTitle')"
            :description="t('lanShare.idleHint')"
            :bordered="true"
          >
            <template #footer>
              <div class="lan-share-toolbar__idle-actions">
                <Button
                  size="sm"
                  class="lan-share-toolbar__idle-btn"
                  :disabled="!canShareCurrentDirectory"
                  @click="startShareCurrentDirectory"
                >
                  {{ t('lanShare.shareCurrentDirectory') }}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  class="lan-share-toolbar__idle-btn"
                  :disabled="!canShareSelectedItems"
                  @click="startShareSelectedItems"
                >
                  {{ t('lanShare.shareSelectedItemsWithCount', { count: selectedItemCount }) }}
                </Button>
              </div>
            </template>
          </EmptyState>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.lan-share-toolbar-button :deep(.sigma-ui-button) {
  position: relative;
  width: 28px;
  height: 28px;
}

.lan-share-toolbar-button__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.lan-share-toolbar-button__trigger--active :deep(.sigma-ui-button) {
  background: hsl(var(--primary) / 10%);
}

.lan-share-toolbar-button__trigger--active .lan-share-toolbar-button__icon {
  stroke: hsl(var(--primary));
}
</style>

<style>
.lan-share-toolbar-popover {
  width: min(400px, calc(100vw - 32px));
  padding: 0;
}

.lan-share-toolbar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  gap: 0.5rem;
}

.lan-share-toolbar__header-title {
  min-width: 0;
  text-transform: uppercase;
}

.lan-share-toolbar__not-working {
  all: unset;
  flex-shrink: 0;
  color: hsl(var(--primary));
  cursor: help;
  font-size: 11px;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: hsl(var(--primary) / 35%);
  text-underline-offset: 2px;
}

.lan-share-toolbar__not-working:hover {
  text-decoration-color: hsl(var(--primary) / 55%);
}

.sigma-ui-tooltip-content.lan-share-toolbar__not-working-tooltip {
  overflow: visible;
  max-width: 16.5rem;
}

.lan-share-toolbar__not-working-list {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  list-style-position: outside;
  list-style-type: disc;
  padding-inline-start: 1.25rem;
  text-align: start;
}

.lan-share-toolbar__not-working-list li + li {
  margin-top: 0.35rem;
}

.lan-share-toolbar__active {
  display: flex;
  flex-direction: column;
}

.lan-share-toolbar__body {
  display: flex;
  width: 100%;
  padding: 0.5rem 0.75rem 0.25rem;
  gap: 1rem;
}

.lan-share-toolbar__qr-section {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
}

.lan-share-toolbar__qr-image {
  display: block;
  border-radius: 4px;
}

.lan-share-toolbar__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 24px;
}

.lan-share-toolbar__address-group,
.lan-share-toolbar__path-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lan-share-toolbar__address-label-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.lan-share-toolbar__address-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
}

.lan-share-toolbar__address-label,
.lan-share-toolbar__path-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lan-share-toolbar__info-icon {
  all: unset;
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 120ms, background 120ms;
}

.lan-share-toolbar__info-icon:hover {
  background: hsl(var(--muted-foreground) / 15%);
  color: hsl(var(--foreground));
}

.lan-share-toolbar__tooltip-text {
  font-size: 0.75rem;
  line-height: 1.3;
}

.lan-share-toolbar__address {
  all: unset;
  overflow: hidden;
  width: fit-content;
  color: hsl(var(--primary));
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lan-share-toolbar__address-row .lan-share-toolbar__address {
  width: auto;
  min-width: 0;
  flex: 1;
}

.lan-share-toolbar__address:hover {
  text-decoration: underline;
}

.lan-share-toolbar__hint {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
}

.lan-share-toolbar__path {
  overflow: hidden;
  color: hsl(var(--foreground) / 60%);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lan-share-toolbar__mode-selector {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  gap: 0.375rem;
}

.lan-share-toolbar__mode-card {
  all: unset;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.625rem;
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  gap: 0.625rem;
  transition: background 120ms, border-color 120ms;
}

.lan-share-toolbar__mode-card:hover {
  background: hsl(var(--muted) / 40%);
}

.lan-share-toolbar__mode-card--active {
  border-color: hsl(var(--primary) / 50%);
  background: hsl(var(--primary) / 6%);
}

.lan-share-toolbar__mode-card--active:hover {
  background: hsl(var(--primary) / 10%);
}

.lan-share-toolbar__mode-card--disabled {
  opacity: 0.45;
  pointer-events: none;
}

.lan-share-toolbar__mode-card-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.lan-share-toolbar__mode-card--active .lan-share-toolbar__mode-card-icon {
  color: hsl(var(--primary));
}

.lan-share-toolbar__mode-card-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.0625rem;
}

.lan-share-toolbar__mode-card-title {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
}

.lan-share-toolbar__mode-card-description {
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.3;
}

.lan-share-toolbar__footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid hsl(var(--border) / 50%);
  gap: 0.5rem;
}

.lan-share-toolbar__idle {
  padding: 0.5rem 0.75rem 0.75rem;
}

.lan-share-toolbar__idle-empty {
  width: 100%;
  box-sizing: border-box;
  padding: 1.125rem 0.875rem 1rem;
  gap: 0.625rem;
}

.lan-share-toolbar__idle-empty .empty-state__title {
  font-size: 1rem;
}

.lan-share-toolbar__idle-empty .empty-state__description {
  max-width: none;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.lan-share-toolbar__idle-empty .empty-state__footer {
  width: 100%;
  margin-top: 0.125rem;
}

.lan-share-toolbar__idle-actions {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.35rem;
}

.lan-share-toolbar__idle-btn {
  width: 100%;
  justify-content: center;
}
</style>
