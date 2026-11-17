<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpenIcon, TerminalSquareIcon } from '@lucide/vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DefaultTerminalMode } from '@/types/user-settings';
import {
  normalizeDefaultTerminalSettings,
  normalizeTerminalProgram,
  splitTerminalArguments,
  TERMINAL_DIRECTORY_PLACEHOLDER,
} from '@/utils/default-terminal';

type DefaultTerminalOption = {
  value: string;
  name: string;
  mode: DefaultTerminalMode;
  terminalId: string;
};

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const userPathsStore = useUserPathsStore();
const terminalsStore = useTerminalsStore();

const customCommand = ref(userSettingsStore.userSettings.terminal?.customCommand ?? '');
const customArgs = ref(userSettingsStore.userSettings.terminal?.customArgs ?? '');
const commandError = ref<string | null>(null);

const terminalOptions = computed<DefaultTerminalOption[]>(() => {
  const normalized = normalizeDefaultTerminalSettings(userSettingsStore.userSettings.terminal);
  const options: DefaultTerminalOption[] = [
    {
      value: 'system',
      name: t('settings.general.defaultTerminal.systemDefault'),
      mode: 'system',
      terminalId: '',
    },
    ...terminalsStore.terminals.map(terminal => ({
      value: `detected:${terminal.id}`,
      name: terminal.name,
      mode: 'detected' as const,
      terminalId: terminal.id,
    })),
  ];

  const selectedIsListed = !normalized.terminalId
    || options.some(option => option.mode === 'detected' && option.terminalId === normalized.terminalId);

  if (normalized.mode === 'detected' && normalized.terminalId && !selectedIsListed) {
    options.push({
      value: `detected:${normalized.terminalId}`,
      name: normalized.terminalId,
      mode: 'detected',
      terminalId: normalized.terminalId,
    });
  }

  options.push({
    value: 'custom',
    name: t('settings.general.defaultTerminal.custom'),
    mode: 'custom',
    terminalId: '',
  });

  return options;
});

const selectedValue = computed(() => {
  const normalized = normalizeDefaultTerminalSettings(userSettingsStore.userSettings.terminal);

  if (normalized.mode === 'custom') {
    return 'custom';
  }

  if (normalized.mode === 'detected' && normalized.terminalId) {
    return `detected:${normalized.terminalId}`;
  }

  return 'system';
});

const selectedOption = computed({
  get: () => terminalOptions.value.find(option => option.value === selectedValue.value) ?? terminalOptions.value[0],
  set: (option: DefaultTerminalOption | undefined) => {
    if (!option) {
      return;
    }

    const save = option.mode === 'detected'
      ? userSettingsStore.setMany([
          {
            key: 'terminal.mode',
            value: 'detected',
          },
          {
            key: 'terminal.terminalId',
            value: option.terminalId,
          },
        ])
      : userSettingsStore.set('terminal.mode', option.mode);

    save.catch((saveError: unknown) => {
      console.error('Failed to save default terminal:', saveError);
    });
  },
});

const missingDetectedTerminal = computed(() => {
  const normalized = normalizeDefaultTerminalSettings(userSettingsStore.userSettings.terminal);

  if (!terminalsStore.hasLoaded || normalized.mode !== 'detected' || !normalized.terminalId) {
    return false;
  }

  return !terminalsStore.terminals.some(terminal => terminal.id === normalized.terminalId);
});

const argsError = computed(() => {
  if (selectedOption.value?.mode !== 'custom') {
    return null;
  }

  const splitArguments = splitTerminalArguments(customArgs.value);
  return splitArguments.ok
    ? null
    : t('settings.general.defaultTerminal.argumentsInvalid');
});

const placeholderText = computed(() => ({ placeholder: TERMINAL_DIRECTORY_PLACEHOLDER }));

let customTerminalSaveQueue: Promise<void> = Promise.resolve();

function queueCustomTerminalSave(command: string, args: string) {
  customTerminalSaveQueue = customTerminalSaveQueue
    .then(async () => {
      await userSettingsStore.setMany([
        {
          key: 'terminal.customCommand',
          value: command,
        },
        {
          key: 'terminal.customArgs',
          value: args,
        },
      ]);
      await validateCustomCommand(command);
    })
    .catch((saveError: unknown) => {
      console.error('Failed to save custom terminal:', saveError);
    });
}

async function validateCustomCommand(command: string) {
  if (selectedOption.value?.mode !== 'custom') {
    commandError.value = null;
    return;
  }

  if (!command.trim()) {
    commandError.value = null;
    return;
  }

  const program = normalizeTerminalProgram(command, userPathsStore.userPaths.homeDir);

  if (!program) {
    commandError.value = t('settings.general.defaultTerminal.commandInvalid');
    return;
  }

  try {
    const programExists = await invoke<boolean>('validate_custom_terminal_program', { program });
    commandError.value = programExists
      ? null
      : t('settings.general.defaultTerminal.commandNotFound');
  }
  catch {
    commandError.value = t('settings.general.defaultTerminal.commandNotFound');
  }
}

watch([customCommand, customArgs], ([command, args]) => {
  queueCustomTerminalSave(command, args);
});

watch(() => selectedOption.value?.mode, (mode) => {
  if (mode !== 'custom') {
    return;
  }

  validateCustomCommand(customCommand.value).catch((validationError: unknown) => {
    console.error('Failed to validate custom terminal:', validationError);
  });
}, { immediate: true });

onMounted(async () => {
  if (!terminalsStore.hasLoaded) {
    await terminalsStore.init();
  }
});

async function handleBrowse() {
  const selected = await open({
    directory: false,
    multiple: false,
  });

  if (typeof selected === 'string' && selected) {
    customCommand.value = selected;
  }
}
</script>

<template>
  <SettingsItem
    :title="t('settings.general.defaultTerminal.title')"
    :description="t('settings.general.defaultTerminal.description')"
    :icon="TerminalSquareIcon"
  >
    <Select
      v-model="selectedOption"
      by="value"
    >
      <SelectTrigger class="default-terminal-select-trigger">
        <SelectValue>
          {{ selectedOption?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in terminalOptions"
          :key="option.value"
          :value="option"
        >
          <SelectItemText>
            {{ option.name }}
          </SelectItemText>
        </SelectItem>
      </SelectContent>
    </Select>

    <template
      v-if="selectedOption?.mode === 'custom' || missingDetectedTerminal"
      #nested
    >
      <p
        v-if="missingDetectedTerminal"
        class="default-terminal-note"
      >
        {{ t('settings.general.defaultTerminal.notInstalled') }}
      </p>
      <div
        v-if="selectedOption?.mode === 'custom'"
        class="default-terminal-custom"
      >
        <div class="default-terminal-field">
          <label
            for="default-terminal-command"
            class="default-terminal-field__label"
          >
            {{ t('settings.general.defaultTerminal.command') }}
          </label>
          <div class="default-terminal-field__row">
            <Input
              id="default-terminal-command"
              v-model="customCommand"
              spellcheck="false"
              :placeholder="t('settings.general.defaultTerminal.commandPlaceholder')"
              :class="{ 'default-terminal-field__input--error': commandError }"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="secondary"
                  size="icon"
                  :aria-label="t('browse')"
                  @click="handleBrowse"
                >
                  <FolderOpenIcon :size="16" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ t('browse') }}
              </TooltipContent>
            </Tooltip>
          </div>
          <p
            v-if="commandError"
            class="default-terminal-field__error"
          >
            {{ commandError }}
          </p>
        </div>
        <div class="default-terminal-field">
          <label
            for="default-terminal-arguments"
            class="default-terminal-field__label"
          >
            {{ t('settings.general.defaultTerminal.arguments') }}
          </label>
          <Input
            id="default-terminal-arguments"
            v-model="customArgs"
            spellcheck="false"
            :placeholder="t('settings.general.defaultTerminal.argumentsPlaceholder', placeholderText)"
            :class="{ 'default-terminal-field__input--error': argsError }"
          />
          <p class="default-terminal-field__hint">
            {{ t('settings.general.defaultTerminal.argumentsHint', placeholderText) }}
          </p>
          <p
            v-if="argsError"
            class="default-terminal-field__error"
          >
            {{ argsError }}
          </p>
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.default-terminal-select-trigger {
  min-width: 220px;
}

.default-terminal-note,
.default-terminal-custom {
  width: 100%;
}

.default-terminal-note {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.default-terminal-custom {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.default-terminal-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.default-terminal-field__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.default-terminal-field__row {
  display: flex;
  gap: 0.5rem;
}

.default-terminal-field__row :deep(.sigma-ui-input) {
  flex: 1;
}

.default-terminal-field__input--error {
  border-color: hsl(var(--destructive));
}

.default-terminal-field__hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.4;
}

.default-terminal-field__error {
  margin: 0;
  color: hsl(var(--destructive));
  font-size: 0.75rem;
}
</style>
