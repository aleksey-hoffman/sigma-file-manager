<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { DirEntry } from '@/types/dir-entry';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  FolderOpenIcon,
  Loader2Icon,
  InfoIcon,
  PlusIcon,
  Trash2Icon,
  PlayIcon,
  FileIcon,
} from 'lucide-vue-next';

interface CustomCommand {
  id: string;
  name: string;
  programPath: string;
  arguments: string;
}

interface OpenWithResult {
  success: boolean;
  error: string | null;
}

const props = defineProps<{
  entries: DirEntry[];
}>();

const emit = defineEmits<{
  close: [];
  opened: [];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const isOpening = ref(false);
const loadError = ref<string | null>(null);

const customCommands = ref<CustomCommand[]>([]);
const selectedCommandId = ref<string | null>(null);

const isAddingCommand = ref(false);
const editingCommandId = ref<string | null>(null);

const newCommandName = ref('');
const newCommandPath = ref('');
const newCommandArgs = ref('');

const firstEntry = computed(() => props.entries[0]);
const fileExtension = computed(() => {
  if (!firstEntry.value) return '';
  const name = firstEntry.value.name;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(lastDot) : '';
});

function loadCustomCommands() {
  const stored = localStorage.getItem('sigma-custom-open-commands');

  if (stored) {
    try {
      customCommands.value = JSON.parse(stored);
    }
    catch {
      customCommands.value = [];
    }
  }
}

function saveCustomCommands() {
  localStorage.setItem('sigma-custom-open-commands', JSON.stringify(customCommands.value));
}

watch(isOpen, (open) => {
  if (open) {
    loadCustomCommands();
    selectedCommandId.value = null;
    isAddingCommand.value = false;
    editingCommandId.value = null;
    resetNewCommandForm();
    loadError.value = null;
  }
});

function resetNewCommandForm() {
  newCommandName.value = '';
  newCommandPath.value = '';
  newCommandArgs.value = '';
}

function startAddingCommand() {
  isAddingCommand.value = true;
  editingCommandId.value = null;
  resetNewCommandForm();
}

function startEditingCommand(command: CustomCommand) {
  isAddingCommand.value = false;
  editingCommandId.value = command.id;
  newCommandName.value = command.name;
  newCommandPath.value = command.programPath;
  newCommandArgs.value = command.arguments;
}

function cancelEditing() {
  isAddingCommand.value = false;
  editingCommandId.value = null;
  resetNewCommandForm();
}

async function handleSelectProgram() {
  const selected = await openDialog({
    title: t('openWith.selectProgram'),
    filters: [
      {
        name: 'Executables',
        extensions: ['exe', 'bat', 'cmd', 'com'],
      },
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  });

  if (selected && typeof selected === 'string') {
    newCommandPath.value = selected;
  }
}

function saveCommand() {
  if (!newCommandName.value.trim() || !newCommandPath.value.trim()) {
    return;
  }

  if (editingCommandId.value) {
    const index = customCommands.value.findIndex(cmd => cmd.id === editingCommandId.value);

    if (index !== -1) {
      customCommands.value[index] = {
        id: editingCommandId.value,
        name: newCommandName.value.trim(),
        programPath: newCommandPath.value.trim(),
        arguments: newCommandArgs.value.trim(),
      };
    }
  }
  else {
    customCommands.value.push({
      id: crypto.randomUUID(),
      name: newCommandName.value.trim(),
      programPath: newCommandPath.value.trim(),
      arguments: newCommandArgs.value.trim(),
    });
  }

  saveCustomCommands();
  cancelEditing();
}

function deleteCommand(commandId: string) {
  customCommands.value = customCommands.value.filter(cmd => cmd.id !== commandId);
  saveCustomCommands();

  if (selectedCommandId.value === commandId) {
    selectedCommandId.value = null;
  }

  if (editingCommandId.value === commandId) {
    cancelEditing();
  }
}

function parseArguments(argsString: string): string[] {
  if (!argsString.trim()) return [];

  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of argsString) {
    if ((char === '"' || char === '\'') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    }
    else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    }
    else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    }
    else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

async function runCommand(command: CustomCommand) {
  isOpening.value = true;
  loadError.value = null;

  try {
    const args = parseArguments(command.arguments);

    for (const entry of props.entries) {
      const result = await invoke<OpenWithResult>('open_with_program', {
        filePath: entry.path,
        programPath: command.programPath,
        arguments: args,
      });

      if (!result.success) {
        loadError.value = result.error || t('openWith.failedToOpenFile');
        isOpening.value = false;
        return;
      }
    }

    emit('opened');
    isOpen.value = false;
  }
  catch (invokeError) {
    loadError.value = String(invokeError);
  }
  finally {
    isOpening.value = false;
  }
}

function handleRunSelected() {
  const command = customCommands.value.find(cmd => cmd.id === selectedCommandId.value);

  if (command) {
    runCommand(command);
  }
}

function handleClose() {
  emit('close');
  isOpen.value = false;
}

const canRun = computed(() => {
  return selectedCommandId.value !== null;
});

const canSaveCommand = computed(() => {
  return newCommandName.value.trim() !== '' && newCommandPath.value.trim() !== '';
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="custom-command-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('openWith.customCommands') }}</DialogTitle>
      </DialogHeader>

      <div class="custom-command-dialog__content">
        <div
          v-if="loadError"
          class="custom-command-dialog__error"
        >
          {{ loadError }}
        </div>

        <div class="custom-command-dialog__section">
          <div class="custom-command-dialog__section-header">
            <span class="custom-command-dialog__section-label">{{ t('openWith.customCommands') }}</span>
            <Button
              variant="ghost"
              size="sm"
              @click="startAddingCommand"
            >
              <PlusIcon :size="16" />
              {{ t('openWith.addCustomCommand') }}
            </Button>
          </div>

          <ScrollArea
            v-if="customCommands.length > 0"
            class="custom-command-dialog__commands-list"
          >
            <div
              v-for="command in customCommands"
              :key="command.id"
              class="custom-command-dialog__command"
              :class="{ 'custom-command-dialog__command--selected': selectedCommandId === command.id }"
              @click="selectedCommandId = command.id"
              @dblclick="runCommand(command)"
            >
              <div class="custom-command-dialog__command-info">
                <FileIcon
                  :size="16"
                  class="custom-command-dialog__command-icon"
                />
                <div class="custom-command-dialog__command-details">
                  <span class="custom-command-dialog__command-name">{{ command.name }}</span>
                  <span class="custom-command-dialog__command-path">{{ command.programPath }}</span>
                </div>
              </div>
              <div class="custom-command-dialog__command-actions">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="xs"
                      @click.stop="runCommand(command)"
                    >
                      <PlayIcon :size="14" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('run') }}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="xs"
                      @click.stop="startEditingCommand(command)"
                    >
                      <InfoIcon :size="14" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('edit') }}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="xs"
                      class="custom-command-dialog__delete-btn"
                      @click.stop="deleteCommand(command.id)"
                    >
                      <Trash2Icon :size="14" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ t('fileBrowser.actions.delete') }}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </ScrollArea>

          <div
            v-else-if="!isAddingCommand"
            class="custom-command-dialog__empty"
          >
            {{ t('openWith.noCustomCommands') }}
          </div>
        </div>

        <div
          v-if="isAddingCommand || editingCommandId"
          class="custom-command-dialog__form"
        >
          <div class="custom-command-dialog__form-header">
            <span class="custom-command-dialog__section-label">
              {{ editingCommandId ? t('openWith.editCustomCommand') : t('openWith.addCustomCommand') }}
            </span>
          </div>

          <div class="custom-command-dialog__field">
            <label class="custom-command-dialog__label">{{ t('openWith.commandName') }}</label>
            <Input
              v-model="newCommandName"
              :placeholder="t('openWith.commandNamePlaceholder')"
            />
          </div>

          <div class="custom-command-dialog__field">
            <label class="custom-command-dialog__label">{{ t('openWith.programPath') }}</label>
            <div class="custom-command-dialog__path-row">
              <Input
                v-model="newCommandPath"
                :placeholder="t('openWith.enterProgramPath')"
                class="custom-command-dialog__path-input"
              />
              <Button
                variant="outline"
                size="icon"
                :title="t('browse')"
                @click="handleSelectProgram"
              >
                <FolderOpenIcon :size="16" />
              </Button>
            </div>
          </div>

          <div class="custom-command-dialog__field">
            <div class="custom-command-dialog__label-row">
              <label class="custom-command-dialog__label">{{ t('openWith.arguments') }}</label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <InfoIcon
                    :size="14"
                    class="custom-command-dialog__info-icon"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{{ t('openWith.argumentsHint') }}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              v-model="newCommandArgs"
              :placeholder="t('openWith.argumentsPlaceholder')"
            />
          </div>

          <div class="custom-command-dialog__form-actions">
            <Button
              variant="ghost"
              @click="cancelEditing"
            >
              {{ t('cancel') }}
            </Button>
            <Button
              :disabled="!canSaveCommand"
              @click="saveCommand"
            >
              {{ t('save') }}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter class="custom-command-dialog__footer">
        <Button
          variant="ghost"
          :disabled="isOpening"
          @click="handleClose"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          :disabled="!canRun || isOpening"
          @click="handleRunSelected"
        >
          <Loader2Icon
            v-if="isOpening"
            :size="16"
            class="custom-command-dialog__spinner"
          />
          {{ t('openWith.open') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.custom-command-dialog {
  width: 480px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.custom-command-dialog > * {
  min-width: 0;
}

.custom-command-dialog__content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.custom-command-dialog__error {
  padding: 12px;
  border-radius: var(--radius);
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
  font-size: 13px;
}

.custom-command-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-command-dialog__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-command-dialog__section-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.custom-command-dialog__commands-list {
  max-height: 200px;
}

.custom-command-dialog__command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  gap: 8px;
  transition: background-color 0.15s ease;
}

.custom-command-dialog__command:hover {
  background-color: hsl(var(--muted) / 50%);
}

.custom-command-dialog__command--selected {
  background-color: hsl(var(--primary) / 15%);
}

.custom-command-dialog__command--selected:hover {
  background-color: hsl(var(--primary) / 20%);
}

.custom-command-dialog__command-info {
  display: flex;
  overflow: hidden;
  flex: 1;
  align-items: center;
  gap: 10px;
}

.custom-command-dialog__command-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.custom-command-dialog__command-details {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  gap: 2px;
}

.custom-command-dialog__command-name {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
}

.custom-command-dialog__command-path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-command-dialog__command-actions {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.custom-command-dialog__command:hover .custom-command-dialog__command-actions {
  opacity: 1;
}

.custom-command-dialog__delete-btn:hover {
  color: hsl(var(--destructive));
}

.custom-command-dialog__empty {
  padding: 24px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}

.custom-command-dialog__form {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  gap: 12px;
}

.custom-command-dialog__form-header {
  margin-bottom: 4px;
}

.custom-command-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.custom-command-dialog__label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-command-dialog__label {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
}

.custom-command-dialog__info-icon {
  color: hsl(var(--muted-foreground));
  cursor: help;
}

.custom-command-dialog__path-row {
  display: flex;
  gap: 8px;
}

.custom-command-dialog__path-input {
  flex: 1;
}

.custom-command-dialog__form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  gap: 8px;
}

.custom-command-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.custom-command-dialog__spinner {
  animation: custom-command-spin 1s linear infinite;
}

@keyframes custom-command-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
