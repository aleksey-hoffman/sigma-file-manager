<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowLeftIcon, XIcon } from '@lucide/vue';
import ExtensionIcon from './extension-icon.vue';

const props = defineProps<{
  title: string;
  extensionId?: string;
  extensionIconPath?: string;
  extensionName?: string;
  commandTitle?: string;
  onBack?: () => void;
  onClose?: () => void;
}>();

const displayName = computed(() => props.extensionName?.trim() || props.title);

const subtitle = computed(() => {
  const extensionName = props.extensionName?.trim();
  const title = props.title.trim();
  const commandTitle = props.commandTitle?.trim();

  if (commandTitle && commandTitle !== displayName.value) {
    return commandTitle;
  }

  if (extensionName && title && extensionName !== title) {
    return title;
  }

  return '';
});

const showSubtitle = computed(() => Boolean(subtitle.value));
</script>

<template>
  <div class="ext-modal-header">
    <button
      v-if="onBack"
      type="button"
      class="ext-modal-header__action"
      @click="onBack"
    >
      <ArrowLeftIcon :size="16" />
    </button>
    <button
      v-else-if="onClose"
      type="button"
      class="ext-modal-header__action"
      @click="onClose"
    >
      <XIcon :size="16" />
    </button>

    <ExtensionIcon
      v-if="extensionId"
      class="ext-modal-header__icon"
      :extension-id="extensionId"
      :icon-path="extensionIconPath"
      :is-installed="true"
      :size="24"
    />

    <div class="ext-modal-header__title-wrap">
      <span class="ext-modal-header__title">{{ displayName }}</span>
      <span
        v-if="showSubtitle"
        class="ext-modal-header__subtitle"
      >
        {{ subtitle }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.ext-modal-header {
  display: flex;
  align-items: center;
  padding: 2px;
  padding-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 12px;
}

.ext-modal-header__action {
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
}

.ext-modal-header__action:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.ext-modal-header__icon {
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 6px;
}

.ext-modal-header__title-wrap {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0;
}

.ext-modal-header__title {
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ext-modal-header__subtitle {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
