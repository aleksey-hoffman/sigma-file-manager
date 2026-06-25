<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted, watch, nextTick,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { BlocksIcon } from '@lucide/vue';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { getKeybindingParts } from '@/modules/extensions/api';
import { getBuiltinCommandDefinitions } from '@/modules/extensions/builtin-commands';
import { getPaletteCommandEntries } from '@/modules/extensions/utils/command-display';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import type { ExtensionCommand } from '@/types/extension';
import {
  registerPaletteFormHandler,
  unregisterPaletteFormHandler,
  updateModalValue,
  submitModal,
  closeModal,
  type ModalInstance,
} from '@/modules/extensions/api/modal-state';
import { createListDetailModalHandlers } from '@/modules/extensions/utils/list-detail-modal-handlers';
import ExtensionIcon from './extension-icon.vue';
import ExtensionFormView from './extension-form-view.vue';
import ExtensionListDetailView from './extension-list-detail-view.vue';
import { useExtensionDisplayInfo } from '@/modules/extensions/composables/use-extension-display-info';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const extensionsStore = useExtensionsStore();

const builtinCommandTitleKeys: Record<string, string> = {
  'sigma.app.openSettings': 'openSettings',
  'sigma.app.openExtensions': 'openExtensions',
  'sigma.app.reloadWindow': 'trayMenu.reloadWindow',
};

const isOpen = ref(false);
const paletteModal = ref<ModalInstance | null>(null);
const paletteCommandTitle = ref<string | undefined>(undefined);

const isInFormMode = computed(() => paletteModal.value !== null);

const isListDetailMode = computed(() => paletteModal.value?.options.layout === 'listDetail');

const paletteExtensionDisplay = useExtensionDisplayInfo(
  computed(() => paletteModal.value?.extensionId),
);

const dialogOpen = computed({
  get: () => isOpen.value,
  set: (value: boolean) => {
    if (!value && isInFormMode.value) {
      exitFormMode();
      return;
    }

    isOpen.value = value;
  },
});

const allCommands = computed(() => {
  const entries: Array<{
    extensionId: string;
    command: ExtensionCommand;
  }> = getPaletteCommandEntries(
    extensionsStore.enabledExtensions,
    extensionsStore.commands,
  );
  const existingIds = new Set(entries.map(entry => entry.command.id));

  const builtinCommands = getBuiltinCommandDefinitions();

  for (const builtin of builtinCommands) {
    if (!builtin.showInPalette) continue;
    if (existingIds.has(builtin.id)) continue;

    existingIds.add(builtin.id);
    entries.push({
      extensionId: 'sigma',
      command: {
        id: builtin.id,
        title: builtin.title,
      },
    });
  }

  return entries;
});

const recentCommands = computed(() => {
  const recentIds = extensionsStore.recentCommandIds;
  if (recentIds.length === 0) return [];

  return recentIds
    .map(id => allCommands.value.find(cmd => cmd.command.id === id))
    .filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined);
});

const otherCommands = computed(() => {
  const recentIds = new Set(extensionsStore.recentCommandIds);
  if (recentIds.size === 0) return allCommands.value;

  return allCommands.value.filter(cmd => !recentIds.has(cmd.command.id));
});

function getExtensionName(extensionId: string): string {
  const installed = extensionsStore.installedExtensions.find(ext => ext.id === extensionId);

  if (installed?.manifest?.name) {
    return installed.manifest.name;
  }

  const registryEntry = extensionsStore.availableExtensions.find(ext => ext.id === extensionId);

  if (registryEntry?.name) {
    return registryEntry.name;
  }

  const parts = extensionId.split('.');
  return parts[parts.length - 1]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getExtensionIconPath(extensionId: string): string | undefined {
  const enabledExtension = extensionsStore.enabledExtensions.find(
    extensionItem => extensionItem.id === extensionId,
  );

  if (enabledExtension?.manifest?.icon) {
    return enabledExtension.manifest.icon;
  }

  const installedExtension = extensionsStore.installedExtensions.find(
    extensionItem => extensionItem.id === extensionId,
  );

  return installedExtension?.manifest?.icon;
}

function getCommandShortcutParts(commandId: string): string[] {
  const keybinding = extensionsStore.getCommandShortcut(commandId);

  if (keybinding?.keys?.key) {
    return getKeybindingParts(keybinding.keys);
  }

  return [];
}

function getCommandShortcutLabel(commandId: string): string {
  return getCommandShortcutParts(commandId).join('+');
}

function getCommandTitle(command: ExtensionCommand): string {
  const builtinTitleKey = builtinCommandTitleKeys[command.id];

  if (builtinTitleKey) {
    return t(builtinTitleKey);
  }

  return command.title;
}

function exitFormMode(): void {
  if (paletteModal.value) {
    closeModal(paletteModal.value.id);
    paletteModal.value = null;
  }

  paletteCommandTitle.value = undefined;
}

async function handleSelect(_extensionId: string, command: ExtensionCommand) {
  paletteCommandTitle.value = getCommandTitle(command);

  extensionsStore.executeCommand(command.id).catch((error) => {
    console.error(`Failed to execute command ${command.id}:`, error);
  });

  await nextTick();

  if (paletteModal.value) return;

  await new Promise(resolve => setTimeout(resolve, 150));

  if (!paletteModal.value) {
    isOpen.value = false;
  }
}

function handleFormValueChange(elementId: string, value: unknown): void {
  if (paletteModal.value) {
    updateModalValue(paletteModal.value.id, elementId, value);
  }
}

async function handleFormButtonClick(buttonId: string): Promise<void> {
  if (!paletteModal.value) return;

  const submittedModalId = paletteModal.value.id;
  const modalWasClosed = await submitModal(submittedModalId, buttonId);

  if (!modalWasClosed) {
    return;
  }

  if (paletteModal.value?.id === submittedModalId) {
    paletteModal.value = null;
    isOpen.value = false;
  }
}

function handleFormClose(): void {
  exitFormMode();
  isOpen.value = false;
}

function handleFormBack(): void {
  exitFormMode();
}

const {
  handleSelectionChange: handleListDetailSelectionChange,
  handleSearchChange: handleListDetailSearchChange,
  handleFilterChange: handleListDetailFilterChange,
} = createListDetailModalHandlers(() => paletteModal.value?.id);

function handlePaletteFormRequest(modal: ModalInstance): void {
  paletteModal.value = modal;
}

watch(isOpen, (newValue) => {
  if (newValue) {
    registerPaletteFormHandler(handlePaletteFormRequest);
  }
  else {
    unregisterPaletteFormHandler();

    if (paletteModal.value) {
      closeModal(paletteModal.value.id);
      paletteModal.value = null;
    }
  }
});

function open() {
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

function toggle() {
  isOpen.value = !isOpen.value;
}

onMounted(() => {
  shortcutsStore.registerHandler('toggleCommandPalette', () => {
    toggle();
    return true;
  });
});

onUnmounted(() => {
  shortcutsStore.unregisterHandler('toggleCommandPalette');
  unregisterPaletteFormHandler();
});

defineExpose({
  open,
  close,
  toggle,
  isOpen,
});
</script>

<template>
  <CommandDialog
    v-model:open="dialogOpen"
    :use-command-root="!isInFormMode"
  >
    <template v-if="!isInFormMode">
      <CommandInput :placeholder="t('commandPalette.searchPlaceholder')" />
      <CommandList>
        <CommandEmpty>{{ t('commandPalette.noResults') }}</CommandEmpty>

        <template v-if="allCommands.length === 0">
          <div class="command-palette__empty">
            <BlocksIcon :size="32" />
            <p>{{ t('commandPalette.noCommands') }}</p>
          </div>
        </template>

        <CommandGroup
          v-if="recentCommands.length > 0"
          :heading="t('commandPalette.recentHeading')"
        >
          <CommandItem
            v-for="cmd in recentCommands"
            :key="cmd.command.id"
            :value="`${getExtensionName(cmd.extensionId)}: ${getCommandTitle(cmd.command)}`"
            @select="handleSelect(cmd.extensionId, cmd.command)"
          >
            <ExtensionIcon
              class="command-palette__icon"
              :extension-id="cmd.extensionId"
              :icon-path="getExtensionIconPath(cmd.extensionId)"
              :size="18"
            />
            <span class="command-palette__extension-name">{{ getExtensionName(cmd.extensionId) }}:</span>
            <span>{{ getCommandTitle(cmd.command) }}</span>
            <CommandShortcut v-if="getCommandShortcutLabel(cmd.command.id)">
              {{ getCommandShortcutLabel(cmd.command.id) }}
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup
          v-if="otherCommands.length > 0"
          :heading="recentCommands.length > 0 ? t('commandPalette.otherCommandsHeading') : undefined"
        >
          <CommandItem
            v-for="cmd in otherCommands"
            :key="cmd.command.id"
            :value="`${getExtensionName(cmd.extensionId)}: ${getCommandTitle(cmd.command)}`"
            @select="handleSelect(cmd.extensionId, cmd.command)"
          >
            <ExtensionIcon
              class="command-palette__icon"
              :extension-id="cmd.extensionId"
              :icon-path="getExtensionIconPath(cmd.extensionId)"
              :size="18"
            />
            <span class="command-palette__extension-name">{{ getExtensionName(cmd.extensionId) }}:</span>
            <span>{{ getCommandTitle(cmd.command) }}</span>
            <CommandShortcut v-if="getCommandShortcutLabel(cmd.command.id)">
              {{ getCommandShortcutLabel(cmd.command.id) }}
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </template>

    <template v-else>
      <div
        :class="[
          'command-palette__form-view',
          { 'command-palette__form-view--list-detail': isListDetailMode },
        ]"
      >
        <ExtensionListDetailView
          v-if="isListDetailMode && paletteModal?.listDetail"
          :title="paletteModal!.options.title"
          :extension-id="paletteModal!.extensionId"
          :extension-icon-path="paletteExtensionDisplay.extensionIconPath"
          :extension-name="paletteExtensionDisplay.extensionName"
          :command-title="paletteModal!.options.commandTitle ?? paletteCommandTitle"
          :list-detail="paletteModal!.listDetail"
          :buttons="paletteModal!.options.buttons"
          :on-back="handleFormBack"
          @selection-change="handleListDetailSelectionChange"
          @search-change="handleListDetailSearchChange"
          @filter-change="handleListDetailFilterChange"
          @button-click="handleFormButtonClick"
          @close="handleFormClose"
        />
        <ExtensionFormView
          v-else
          :title="paletteModal!.options.title"
          :extension-id="paletteModal!.extensionId"
          :extension-icon-path="paletteExtensionDisplay.extensionIconPath"
          :extension-name="paletteExtensionDisplay.extensionName"
          :command-title="paletteModal!.options.commandTitle ?? paletteCommandTitle"
          :content="paletteModal!.options.content ?? []"
          :buttons="paletteModal!.options.buttons"
          :values="paletteModal!.values"
          :on-back="handleFormBack"
          @value-change="handleFormValueChange"
          @button-click="handleFormButtonClick"
          @close="handleFormClose"
        />
      </div>
    </template>
  </CommandDialog>
</template>

<style>
.command-palette__icon {
  width: 18px;
  height: 18px;
  margin-right: 0.5rem;
  color: hsl(var(--primary));
}

.command-palette__extension-name {
  margin-right: 0.25rem;
  color: hsl(var(--muted-foreground));
}

.command-palette__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: hsl(var(--muted-foreground));
  gap: 12px;
  text-align: center;
}

.command-palette__empty p {
  font-size: 0.875rem;
}

.command-palette__form-view {
  display: flex;
  overflow: hidden;
  min-height: 0;
  max-height: min(80vh, 600px);
  flex-direction: column;
  padding: 12px;
}

.command-palette__form-view--list-detail {
  width: 100%;
  max-height: min(85vh, 720px);
}

.sigma-ui-command-dialog.sigma-ui-dialog-content:has(.command-palette__form-view--list-detail) {
  width: min(92vw, 920px);
  max-width: min(92vw, 920px);
}

.sigma-ui-command-dialog .command-palette__form-view .ext-form-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: none;
}

.sigma-ui-command-dialog .command-palette__form-view .ext-list-detail-view {
  width: 100%;
  height: 100%;
  min-height: 420px;
  max-height: none;
}
</style>
