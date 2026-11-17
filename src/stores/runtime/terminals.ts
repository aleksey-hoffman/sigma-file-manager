// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  resolveTerminalLaunch,
  terminalErrorDescription,
  type ResolvedTerminalLaunch,
} from '@/utils/default-terminal';

interface TerminalInfo {
  id: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
}

interface GetAvailableTerminalsResult {
  success: boolean;
  terminals: TerminalInfo[];
  error: string | null;
}

type TerminalErrorCode
  = | 'directory-not-found'
    | 'command-invalid'
    | 'arguments-invalid'
    | 'command-not-found'
    | 'admin-cancelled'
    | 'admin-unavailable'
    | 'open-failed';

interface OpenTerminalResult {
  success: boolean;
  error: string | null;
  allowFallback?: boolean;
  errorCode?: TerminalErrorCode | null;
}

type OpenTerminalOptions = {
  reportError?: boolean;
};

export type { TerminalInfo };

export const useTerminalsStore = defineStore('terminals', () => {
  const terminals = ref<TerminalInfo[]>([]);
  const loadError = ref<string | null>(null);
  const hasLoaded = ref(false);
  let loadTask: Promise<void> | null = null;

  async function init() {
    if (!loadTask) {
      loadTask = loadTerminals().finally(() => {
        loadTask = null;
      });
    }

    await loadTask;
  }

  async function loadTerminals() {
    loadError.value = null;

    try {
      const result = await invoke<GetAvailableTerminalsResult>('get_available_terminals');

      if (result.success) {
        terminals.value = result.terminals;
        hasLoaded.value = true;
        loadIconsAsync();
      }
      else {
        loadError.value = result.error || 'Failed to load terminals';
        hasLoaded.value = true;
      }
    }
    catch (invokeError) {
      loadError.value = String(invokeError);
      hasLoaded.value = true;
    }
  }

  async function loadIconsAsync() {
    try {
      const iconsMap = await invoke<Record<string, string>>('get_terminal_icons');
      terminals.value = terminals.value.map(terminal => ({
        ...terminal,
        icon: iconsMap[terminal.id] ?? terminal.icon,
      }));
    }
    catch (iconError) {
      console.error('Failed to load terminal icons:', iconError);
    }
  }

  function showTerminalError(detail: string, openedFallback = false) {
    const title = i18n.global.t('terminal.errorTitle');
    const description = terminalErrorDescription(
      detail,
      openedFallback ? i18n.global.t('terminal.openedSystemDefault') : null,
    );

    if (!description || description === title) {
      toast.error(title);
      return;
    }

    toast.error(title, { description });
  }

  async function openTerminal(
    directoryPath: string,
    terminalId: string,
    asAdmin: boolean,
    options?: OpenTerminalOptions,
  ): Promise<boolean> {
    const reportError = options?.reportError !== false;

    try {
      const result = await invoke<OpenTerminalResult>('open_terminal', {
        directoryPath,
        terminalId,
        asAdmin,
      });

      if (!result.success) {
        console.error('Failed to open terminal:', result.error);

        if (reportError) {
          showTerminalError(result.error || i18n.global.t('terminal.openFailed'));
        }

        return false;
      }

      return true;
    }
    catch (invokeError) {
      console.error('Failed to open terminal:', invokeError);

      if (reportError) {
        showTerminalError(i18n.global.t('terminal.openFailed'));
      }

      return false;
    }
  }

  function customTerminalErrorMessage(result: OpenTerminalResult): string {
    const code = result.errorCode ?? null;

    switch (code) {
      case null:
      case 'open-failed':
        return result.error || i18n.global.t('terminal.openFailed');
      case 'command-not-found':
        return i18n.global.t('terminal.customCommandNotFound');
      case 'command-invalid':
        return i18n.global.t('terminal.customCommandInvalid');
      case 'arguments-invalid':
        return i18n.global.t('terminal.customArgumentsInvalid');
      case 'directory-not-found':
        return i18n.global.t('terminal.directoryNotFound', { path: result.error ?? '' });
      case 'admin-cancelled':
        return i18n.global.t('terminal.adminCancelled');
      case 'admin-unavailable':
        return i18n.global.t('terminal.adminUnavailable');

      default: {
        const unexpectedCode: never = code;
        return unexpectedCode;
      }
    }
  }

  async function openCustomTerminal(
    launch: Extract<ResolvedTerminalLaunch, { kind: 'custom' }>,
    asAdmin: boolean,
  ): Promise<{
    opened: boolean;
    error: string;
    allowFallback: boolean;
  }> {
    try {
      const result = await invoke<OpenTerminalResult>('open_custom_terminal', {
        program: launch.program,
        args: launch.args,
        directoryPath: launch.cwd,
        asAdmin,
      });

      if (result.success) {
        return {
          opened: true,
          error: '',
          allowFallback: false,
        };
      }

      console.error('Failed to open terminal:', result.error);

      return {
        opened: false,
        error: customTerminalErrorMessage(result),
        allowFallback: result.allowFallback === true,
      };
    }
    catch (invokeError) {
      console.error('Failed to open terminal:', invokeError);
      return {
        opened: false,
        error: i18n.global.t('terminal.openFailed'),
        allowFallback: true,
      };
    }
  }

  async function openConfiguredTerminal(directoryPath: string, asAdmin: boolean) {
    if (!hasLoaded.value) {
      await init();
    }

    const userSettingsStore = useUserSettingsStore();
    const userPathsStore = useUserPathsStore();
    const resolved = resolveTerminalLaunch({
      settings: userSettingsStore.userSettings.terminal,
      detectedTerminals: terminals.value,
      directoryPath,
      homeDir: userPathsStore.userPaths.homeDir,
    });

    switch (resolved.kind) {
      case 'unavailable':
        showTerminalError(i18n.global.t(resolved.noticeKey));
        return;

      case 'detected': {
        if (!resolved.noticeKey) {
          await openTerminal(directoryPath, resolved.terminalId, asAdmin);
          return;
        }

        const openedFallback = await openTerminal(directoryPath, resolved.terminalId, asAdmin, {
          reportError: false,
        });
        showTerminalError(i18n.global.t(resolved.noticeKey), openedFallback);
        return;
      }

      case 'custom': {
        const customResult = await openCustomTerminal(resolved, asAdmin);

        if (customResult.opened) {
          return;
        }

        const systemTerminalId = terminals.value[0]?.id;

        if (customResult.allowFallback && systemTerminalId) {
          const openedFallback = await openTerminal(directoryPath, systemTerminalId, asAdmin, {
            reportError: false,
          });
          showTerminalError(customResult.error, openedFallback);
          return;
        }

        showTerminalError(customResult.error);
        return;
      }

      default: {
        const exhaustiveCheck: never = resolved;
        return exhaustiveCheck;
      }
    }
  }

  return {
    terminals,
    loadError,
    hasLoaded,
    init,
    openTerminal,
    openConfiguredTerminal,
  };
});
