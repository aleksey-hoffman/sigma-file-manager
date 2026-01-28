<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  SparklesIcon,
  CalendarIcon,
  ChevronDownIcon,
  XIcon,
} from 'lucide-vue-next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useChangelog, type Release } from '@/modules/changelog/composables/use-changelog';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const { releases, appVersion, isOpen, markAsSeen } = useChangelog();

const selectedVersion = ref<string>(releases[0]?.version || '');
const isMobileNavOpen = ref(false);

const selectedRelease = computed<Release | undefined>(() => {
  return releases.find(release => release.version === selectedVersion.value);
});

const showOnUpdate = computed({
  get: () => userSettingsStore.userSettings.changelog.showOnUpdate,
  set: async (value: boolean) => {
    await userSettingsStore.set('changelog.showOnUpdate', value);
  },
});

watch(isOpen, (newValue) => {
  if (newValue) {
    const currentVersionRelease = releases.find(release => release.version === appVersion.value);
    selectedVersion.value = currentVersionRelease?.version || releases[0]?.version || '';
    isMobileNavOpen.value = false;
    markAsSeen();
  }
});

function selectVersion(version: string) {
  selectedVersion.value = version;
  isMobileNavOpen.value = false;
}

function isSelected(version: string) {
  return selectedVersion.value === version;
}

function isCurrentVersion(version: string) {
  return appVersion.value === version;
}

function toggleMobileNav() {
  isMobileNavOpen.value = !isMobileNavOpen.value;
}

function closeMobileNav() {
  isMobileNavOpen.value = false;
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
};

function getVideoMimeType(path: string): string | null {
  const lowerPath = path.toLowerCase();

  for (const [ext, mimeType] of Object.entries(VIDEO_MIME_TYPES)) {
    if (lowerPath.endsWith(ext)) {
      return mimeType;
    }
  }

  return null;
}

function renderMedia(alt: string, src: string): string {
  const resolvedSrc = src.replace(/^\.\/public/, '');
  const mimeType = getVideoMimeType(resolvedSrc);

  if (mimeType) {
    return `<div class="changelog-dialog__feature-media-container"><video class="changelog-dialog__feature-video" controls muted loop playsinline><source src="${resolvedSrc}" type="${mimeType}"></video></div>`;
  }

  return `<div class="changelog-dialog__feature-media-container"><img src="${resolvedSrc}" alt="${alt}" class="changelog-dialog__feature-image"></div>`;
}

function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const mediaMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const htmlVideoMatch = trimmedLine.match(/<video[^>]*src="([^"]+)"[^>]*>/i);

    if (mediaMatch) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }

      result.push(renderMedia(mediaMatch[1], mediaMatch[2]));
    }
    else if (htmlVideoMatch) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }

      result.push(renderMedia('', htmlVideoMatch[1]));
    }
    else if (trimmedLine.startsWith('#### ')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }

      result.push(`<h4 class="changelog-dialog__feature-subheading">${trimmedLine.slice(5)}</h4>`);
    }
    else if (trimmedLine.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="changelog-dialog__feature-list">');
        inList = true;
      }

      result.push(`<li>${trimmedLine.slice(2)}</li>`);
    }
    else if (trimmedLine) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }

      result.push(`<p>${trimmedLine}</p>`);
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="changelog-dialog">
      <DialogHeader class="changelog-dialog__header">
        <DialogTitle class="changelog-dialog__title">
          <SparklesIcon
            :size="20"
            class="changelog-dialog__title-icon"
          />
          {{ t('changelog.title') }}
        </DialogTitle>
      </DialogHeader>

      <div class="changelog-dialog__mobile-bar">
        <Button
          variant="outline"
          size="sm"
          class="changelog-dialog__mobile-version-btn"
          @click="toggleMobileNav"
        >
          <span>{{ selectedRelease?.version || t('changelog.selectVersion') }}</span>
          <ChevronDownIcon
            :size="16"
            class="changelog-dialog__mobile-version-icon"
            :class="{ 'changelog-dialog__mobile-version-icon--open': isMobileNavOpen }"
          />
        </Button>

        <div class="changelog-dialog__mobile-toggle">
          <label
            for="changelog-show-on-update-mobile"
            class="changelog-dialog__mobile-toggle-label"
          >
            {{ t('changelog.showOnUpdate') }}
          </label>
          <Switch
            id="changelog-show-on-update-mobile"
            :model-value="showOnUpdate"
            @update:model-value="showOnUpdate = $event"
          />
        </div>
      </div>

      <div class="changelog-dialog__body">
        <aside
          class="changelog-dialog__sidebar"
          :class="{ 'changelog-dialog__sidebar--open': isMobileNavOpen }"
        >
          <div class="changelog-dialog__sidebar-header">
            <span class="changelog-dialog__sidebar-header-title">{{ t('changelog.selectVersion') }}</span>
            <Button
              variant="ghost"
              size="icon"
              class="changelog-dialog__sidebar-close"
              @click="closeMobileNav"
            >
              <XIcon :size="18" />
            </Button>
          </div>

          <div class="changelog-dialog__sidebar-toggle">
            <label
              for="changelog-show-on-update"
              class="changelog-dialog__sidebar-toggle-label"
            >
              {{ t('changelog.showOnUpdate') }}
            </label>
            <Switch
              id="changelog-show-on-update"
              :model-value="showOnUpdate"
              @update:model-value="showOnUpdate = $event"
            />
          </div>

          <ScrollArea class="changelog-dialog__sidebar-scroll">
            <nav class="changelog-dialog__nav">
              <button
                v-for="release in releases"
                :key="release.version"
                type="button"
                class="changelog-dialog__nav-item"
                :class="{
                  'changelog-dialog__nav-item--selected': isSelected(release.version),
                  'changelog-dialog__nav-item--current': isCurrentVersion(release.version),
                }"
                @click="selectVersion(release.version)"
              >
                <div>
                  <div class="changelog-dialog__nav-item-version">
                    {{ release.version }}
                  </div>
                  <div class="changelog-dialog__nav-item-date">
                    {{ release.date }}
                  </div>
                </div>
                <div
                  v-if="isCurrentVersion(release.version)"
                  class="changelog-dialog__nav-item-badge"
                >
                  {{ t('changelog.current') }}
                </div>
              </button>
            </nav>
          </ScrollArea>
        </aside>

        <div
          v-if="isMobileNavOpen"
          class="changelog-dialog__overlay"
          @click="closeMobileNav"
        />

        <main class="changelog-dialog__content">
          <ScrollArea class="changelog-dialog__content-scroll">
            <div
              v-if="selectedRelease"
              class="changelog-dialog__release"
            >
              <header class="changelog-dialog__release-header">
                <span class="changelog-dialog__release-label">{{ t('changelog.title') }}</span>
                <div class="changelog-dialog__release-title-row">
                  <h2 class="changelog-dialog__release-title">
                    {{ selectedRelease.version }}
                  </h2>
                  <span class="changelog-dialog__release-date">
                    <CalendarIcon :size="14" />
                    {{ selectedRelease.date }}
                  </span>
                </div>
              </header>

              <p class="changelog-dialog__release-summary">
                <span class="changelog-dialog__release-summary-label">{{ t('changelog.summary') }}:</span>
                {{ selectedRelease.summary }}
              </p>

              <div class="changelog-dialog__features">
                <article
                  v-for="(feature, featureIndex) in selectedRelease.features"
                  :key="featureIndex"
                  class="changelog-dialog__feature"
                >
                  <h3 class="changelog-dialog__feature-title">
                    {{ feature.title }}
                  </h3>
                  <div
                    class="changelog-dialog__feature-description"
                    v-html="renderMarkdown(feature.description)"
                  />
                </article>
              </div>
            </div>
          </ScrollArea>
        </main>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style>
.changelog-dialog.sigma-ui-dialog-content {
  display: flex;
  overflow: hidden;
  width: 80vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  flex-direction: column;
  padding: 0;
  gap: 0;
}

.changelog-dialog__header {
  flex-shrink: 0;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.changelog-dialog__title {
  display: flex;
  align-items: center;
  font-size: 1.125rem;
  font-weight: 600;
  gap: 0.5rem;
}

.changelog-dialog__title-icon {
  color: hsl(var(--primary));
}

.changelog-dialog__mobile-bar {
  display: none;
}

.changelog-dialog__body {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
}

.changelog-dialog__sidebar {
  display: flex;
  width: 240px;
  min-width: 240px;
  flex-direction: column;
  border-right: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 30%);
}

.changelog-dialog__sidebar-header {
  display: none;
}

.changelog-dialog__sidebar-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  gap: 0.5rem;
}

.changelog-dialog__sidebar-toggle-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.changelog-dialog__sidebar-scroll {
  min-height: 0;
  flex: 1;
}

.changelog-dialog__nav {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  gap: 0.25rem;
}

.changelog-dialog__nav-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  gap: 0.25rem;
  text-align: left;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.changelog-dialog__nav-item:hover {
  background-color: hsl(var(--muted));
}

.changelog-dialog__nav-item--selected {
  border-color: hsl(var(--primary) / 50%);
  background-color: hsl(var(--primary) / 10%);
}

.changelog-dialog__nav-item--selected:hover {
  background-color: hsl(var(--primary) / 15%);
}

.changelog-dialog__nav-item-badge {
  align-self: flex-start;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  margin-bottom: 0.25rem;
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.changelog-dialog__nav-item-version {
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.85rem;
  font-weight: 500;
}

.changelog-dialog__nav-item-date {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.changelog-dialog__overlay {
  display: none;
}

.changelog-dialog__content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.changelog-dialog__content-scroll {
  min-height: 0;
  flex: 1;
}

.changelog-dialog__release {
  padding: 1.5rem 2rem 2rem;
}

.changelog-dialog__release-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 1rem;
  gap: 0.25rem;
}

.changelog-dialog__release-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.changelog-dialog__release-title-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.changelog-dialog__release-title {
  margin-bottom: 0;
  color: hsl(var(--foreground));
  font-size: 1.5rem;
  font-weight: 700;
}

.changelog-dialog__release-date {
  display: flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  gap: 0.375rem;
}

.changelog-dialog__release-summary {
  padding: 1rem;
  border-radius: var(--radius);
  margin-bottom: 2rem;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 0.9375rem;
  line-height: 1.6;
}

.changelog-dialog__release-summary-label {
  color: hsl(var(--foreground));
  font-weight: 500;
}

.changelog-dialog__features {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.changelog-dialog__feature {
  padding-bottom: 2rem;
  border-bottom: 1px solid hsl(var(--border));
}

.changelog-dialog__feature:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.changelog-dialog__feature-title {
  margin-bottom: 0.5rem;
  color: hsl(var(--foreground));
  font-size: 1.125rem;
  font-weight: 600;
}

.changelog-dialog__feature-description {
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.9375rem;
  line-height: 1.6;
}

.changelog-dialog__feature-description p {
  margin: 0 0 0.5rem;
}

.changelog-dialog__feature-description p:last-child {
  margin-bottom: 0;
}

.changelog-dialog__feature-subheading {
  margin: 1rem 0 0.5rem;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.changelog-dialog__feature-list {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  list-style-type: disc;
}

.changelog-dialog__feature-list li {
  margin-bottom: 0.25rem;
}

.changelog-dialog__feature-media-container {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  margin: 24px;
  box-shadow: 0 2px 24px rgb(0 0 0 / 20%);
}

.changelog-dialog__feature-image {
  width: 100%;
  object-fit: cover;
}

.changelog-dialog__feature-video {
  display: block;
  width: 100%;
}

@media (width <= 768px) {
  .changelog-dialog.sigma-ui-dialog-content {
    width: 95vw;
    height: 90vh;
    max-height: none;
  }

  .changelog-dialog__header {
    padding: 1rem;
  }

  .changelog-dialog__mobile-bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid hsl(var(--border));
    background-color: hsl(var(--muted) / 30%);
    gap: 0.75rem;
  }

  .changelog-dialog__mobile-version-btn {
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .changelog-dialog__mobile-version-icon {
    transition: transform 0.2s ease;
  }

  .changelog-dialog__mobile-version-icon--open {
    transform: rotate(180deg);
  }

  .changelog-dialog__mobile-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .changelog-dialog__mobile-toggle-label {
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .changelog-dialog__sidebar {
    position: absolute;
    z-index: 10;
    top: 0;
    left: 0;
    width: 280px;
    height: 100%;
    border-right: 1px solid hsl(var(--border));
    background-color: hsl(var(--background));
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateX(-100%);
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
  }

  .changelog-dialog__sidebar--open {
    opacity: 1;
    transform: translateX(0);
  }

  .changelog-dialog__sidebar-header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid hsl(var(--border));
  }

  .changelog-dialog__sidebar-header-title {
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    font-weight: 500;
  }

  .changelog-dialog__sidebar-close {
    width: 32px;
    height: 32px;
  }

  .changelog-dialog__sidebar-toggle {
    display: none;
  }

  .changelog-dialog__overlay {
    position: absolute;
    z-index: 5;
    display: block;
    backdrop-filter: blur(2px);
    background-color: hsl(var(--background) / 50%);
    inset: 0;
  }

  .changelog-dialog__release {
    padding: 1rem;
  }

  .changelog-dialog__release-title {
    font-size: 1.25rem;
  }

  .changelog-dialog__release-summary {
    padding: 0.75rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .changelog-dialog__feature-title {
    font-size: 1rem;
  }

  .changelog-dialog__feature-description {
    font-size: 0.875rem;
  }

  .changelog-dialog__feature-image {
    height: 180px;
  }

  .changelog-dialog__feature-video {
    max-height: 280px;
  }
}
</style>
