<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuItemRegistration } from '@/types/extension';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { getKeybindingForContextMenuItem, formatKeybindingKeys } from '@/modules/extensions/api';
import { getLucideIcon } from '@/utils/lucide-icons';
import { ContextMenuShortcut } from '@/components/ui/context-menu';

const props = defineProps<{
  selectedEntries: DirEntry[];
  menuItemComponent: object;
  menuSeparatorComponent: object;
  menuLabelComponent?: object;
}>();

const { t } = useI18n();
const extensionsStore = useExtensionsStore();

const extensionMenuItems = computed(() => {
  const filtered = extensionsStore.contextMenuItems.filter((registration) => {
    const when = registration.item.when;
    if (!when) return true;

    const selectedEntries = props.selectedEntries;
    const selectionCount = selectedEntries.length;

    if (when.selectionType === 'single' && selectionCount !== 1) return false;
    if (when.selectionType === 'multiple' && selectionCount < 2) return false;

    if (when.entryType === 'file' && !selectedEntries.every(entry => entry.is_file)) return false;
    if (when.entryType === 'directory' && !selectedEntries.every(entry => entry.is_dir)) return false;

    if (when.fileExtensions && when.fileExtensions.length > 0) {
      const normalizedExtensions = when.fileExtensions.map(
        extension => extension.startsWith('.') ? extension.slice(1).toLowerCase() : extension.toLowerCase(),
      );
      const allEntriesMatchExtension = selectedEntries.every(entry =>
        entry.ext !== null && normalizedExtensions.includes(entry.ext.toLowerCase()),
      );
      if (!allEntriesMatchExtension) return false;
    }

    return true;
  });

  return [...filtered].sort((registrationA, registrationB) => {
    const groupA = registrationA.item.group ?? '';
    const groupB = registrationB.item.group ?? '';
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    return (registrationA.item.order ?? 0) - (registrationB.item.order ?? 0);
  });
});

const emit = defineEmits<{
  extensionAction: [registration: ContextMenuItemRegistration];
}>();

function handleExtensionAction(registration: ContextMenuItemRegistration) {
  emit('extensionAction', registration);
}

function getMenuItemShortcut(registration: ContextMenuItemRegistration): string | undefined {
  const unprefixedId = registration.item.id.replace(`${registration.extensionId}.`, '');
  const keybinding = getKeybindingForContextMenuItem(registration.extensionId, unprefixedId);

  if (keybinding && keybinding.keys.key) {
    return formatKeybindingKeys(keybinding.keys);
  }

  return undefined;
}

function getMenuItemIcon(registration: ContextMenuItemRegistration) {
  if (!registration.item.icon) return undefined;
  return getLucideIcon(registration.item.icon);
}
</script>

<template>
  <template v-if="extensionMenuItems.length > 0">
    <component :is="menuSeparatorComponent" />
    <component
      v-if="menuLabelComponent"
      :is="menuLabelComponent"
      class="file-browser-extension-menu-items__label"
    >
      {{ t('extensions.contextMenuLabel') }}
    </component>
    <component
      :is="menuItemComponent"
      v-for="registration in extensionMenuItems"
      :key="`${registration.extensionId}.${registration.item.id}`"
      class="file-browser-extension-menu-items__item"
      @select="handleExtensionAction(registration)"
    >
      <component
        :is="getMenuItemIcon(registration)"
        v-if="getMenuItemIcon(registration)"
        :size="16"
        class="file-browser-extension-menu-items__icon"
      />
      {{ registration.item.title }}
      <ContextMenuShortcut v-if="getMenuItemShortcut(registration)">
        {{ getMenuItemShortcut(registration) }}
      </ContextMenuShortcut>
    </component>
  </template>
</template>

<style>
.file-browser-extension-menu-items__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-browser-extension-menu-items__icon {
  flex-shrink: 0;
  margin-right: 8px;
  opacity: 0.7;
}

.file-browser-extension-menu-items__label {
  padding: 4px 8px;
  font-size: 11px;
  letter-spacing: 0.05em;
  opacity: 0.6;
  text-transform: uppercase;
}
</style>
