// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DefaultTerminalSettings } from '@/types/user-settings';
import {
  expandLeadingTilde,
  stripOnePairOfMatchingQuotes,
} from '@/utils/expand-leading-tilde';

export const TERMINAL_DIRECTORY_PLACEHOLDER = '{directory}';

const TERMINAL_SENTENCE_END = /[.!?。！？؟।۔։]$/u;

export type TerminalLaunchNoticeKey
  = | 'terminal.noTerminalAvailable'
    | 'terminal.customCommandMissing'
    | 'terminal.customCommandInvalid'
    | 'terminal.customArgumentsInvalid'
    | 'terminal.selectedTerminalMissing';

export type CustomTerminalLaunch
  = | {
    ok: true;
    program: string;
    args: string[];
    cwd: string;
  }
  | {
    ok: false;
    reason: 'empty-command' | 'invalid-command' | 'unclosed-quote';
  };

export type ResolvedTerminalLaunch
  = | {
    kind: 'detected';
    terminalId: string;
    fellBackToSystemDefault: boolean;
    noticeKey: TerminalLaunchNoticeKey | null;
  }
  | {
    kind: 'custom';
    program: string;
    args: string[];
    cwd: string;
  }
  | {
    kind: 'unavailable';
    noticeKey: TerminalLaunchNoticeKey;
  };

type DetectedTerminalRef = {
  id: string;
};

export function createDefaultTerminalSettings(): DefaultTerminalSettings {
  return {
    mode: 'system',
    terminalId: '',
    customCommand: '',
    customArgs: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeDefaultTerminalSettings(value: unknown): DefaultTerminalSettings {
  const defaults = createDefaultTerminalSettings();

  if (!isRecord(value)) {
    return defaults;
  }

  if (value.mode !== 'system' && value.mode !== 'detected' && value.mode !== 'custom') {
    return defaults;
  }

  return {
    mode: value.mode,
    terminalId: typeof value.terminalId === 'string' ? value.terminalId : '',
    customCommand: typeof value.customCommand === 'string' ? value.customCommand : '',
    customArgs: typeof value.customArgs === 'string' ? value.customArgs : '',
  };
}

function containsControlCharacter(value: string): boolean {
  return value.includes('\0') || value.includes('\n') || value.includes('\r');
}

export function normalizeTerminalProgram(command: string, homeDir = ''): string | null {
  const stripped = stripOnePairOfMatchingQuotes(command).trim();

  if (!stripped || containsControlCharacter(stripped)) {
    return null;
  }

  const looksLikePath = stripped.startsWith('~')
    || stripped.includes('/')
    || stripped.includes('\\');
  const program = looksLikePath
    ? expandLeadingTilde(stripped, homeDir).trim()
    : stripped;

  if (!program || containsControlCharacter(program)) {
    return null;
  }

  return program;
}

export function splitTerminalArguments(template: string): {
  ok: true;
  args: string[];
} | {
  ok: false;
  reason: 'unclosed-quote';
} {
  const args: string[] = [];
  let current = '';
  let quote: '"' | '\'' | null = null;
  let hasToken = false;

  for (const character of template) {
    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }

      current += character;
      hasToken = true;
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      hasToken = true;
      continue;
    }

    if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
      if (hasToken) {
        args.push(current);
        current = '';
        hasToken = false;
      }

      continue;
    }

    current += character;
    hasToken = true;
  }

  if (quote) {
    return {
      ok: false,
      reason: 'unclosed-quote',
    };
  }

  if (hasToken) {
    args.push(current);
  }

  return {
    ok: true,
    args,
  };
}

export function buildCustomTerminalLaunch(
  command: string,
  argsTemplate: string,
  directoryPath: string,
  homeDir = '',
): CustomTerminalLaunch {
  if (!command.trim()) {
    return {
      ok: false,
      reason: 'empty-command',
    };
  }

  const program = normalizeTerminalProgram(command, homeDir);

  if (!program) {
    return {
      ok: false,
      reason: 'invalid-command',
    };
  }

  const splitArguments = splitTerminalArguments(argsTemplate);

  if (!splitArguments.ok) {
    return splitArguments;
  }

  return {
    ok: true,
    program,
    args: splitArguments.args.map(argument => argument.replaceAll(
      TERMINAL_DIRECTORY_PLACEHOLDER,
      directoryPath,
    )),
    cwd: directoryPath,
  };
}

function detectedTerminalLaunch(
  detectedTerminals: readonly DetectedTerminalRef[],
  noticeKey: TerminalLaunchNoticeKey | null,
): ResolvedTerminalLaunch {
  const terminalId = detectedTerminals[0]?.id;

  if (!terminalId) {
    return {
      kind: 'unavailable',
      noticeKey: noticeKey ?? 'terminal.noTerminalAvailable',
    };
  }

  return {
    kind: 'detected',
    terminalId,
    fellBackToSystemDefault: noticeKey !== null,
    noticeKey,
  };
}

function noticeForCustomLaunch(launch: Extract<CustomTerminalLaunch, { ok: false }>): TerminalLaunchNoticeKey {
  switch (launch.reason) {
    case 'empty-command':
      return 'terminal.customCommandMissing';
    case 'invalid-command':
      return 'terminal.customCommandInvalid';
    case 'unclosed-quote':
      return 'terminal.customArgumentsInvalid';

    default: {
      const exhaustiveCheck: never = launch.reason;
      return exhaustiveCheck;
    }
  }
}

export function resolveTerminalLaunch(input: {
  settings: unknown;
  detectedTerminals: readonly DetectedTerminalRef[];
  directoryPath: string;
  homeDir?: string;
}): ResolvedTerminalLaunch {
  const settings = normalizeDefaultTerminalSettings(input.settings);

  switch (settings.mode) {
    case 'system':
      return detectedTerminalLaunch(input.detectedTerminals, null);

    case 'detected': {
      if (!settings.terminalId) {
        return detectedTerminalLaunch(input.detectedTerminals, null);
      }

      const terminalIsInstalled = input.detectedTerminals.some(
        terminal => terminal.id === settings.terminalId,
      );

      if (terminalIsInstalled) {
        return {
          kind: 'detected',
          terminalId: settings.terminalId,
          fellBackToSystemDefault: false,
          noticeKey: null,
        };
      }

      return detectedTerminalLaunch(input.detectedTerminals, 'terminal.selectedTerminalMissing');
    }

    case 'custom': {
      const launch = buildCustomTerminalLaunch(
        settings.customCommand,
        settings.customArgs,
        input.directoryPath,
        input.homeDir ?? '',
      );

      if (!launch.ok) {
        return detectedTerminalLaunch(input.detectedTerminals, noticeForCustomLaunch(launch));
      }

      return {
        kind: 'custom',
        program: launch.program,
        args: launch.args,
        cwd: launch.cwd,
      };
    }

    default: {
      const exhaustiveCheck: never = settings.mode;
      return exhaustiveCheck;
    }
  }
}

export function terminalErrorDescription(detail: string, fallbackSentence: string | null): string {
  const trimmedDetail = detail.trim();

  if (!fallbackSentence) {
    return trimmedDetail;
  }

  const fallback = fallbackSentence.trim();

  if (!trimmedDetail) {
    return fallback;
  }

  if (TERMINAL_SENTENCE_END.test(trimmedDetail)) {
    return `${trimmedDetail} ${fallback}`;
  }

  return `${trimmedDetail}. ${fallback}`;
}

export function selectedDetectedTerminalId(
  settings: unknown,
  detectedTerminals: readonly DetectedTerminalRef[],
): string | null {
  const normalized = normalizeDefaultTerminalSettings(settings);

  switch (normalized.mode) {
    case 'custom':
      return null;
    case 'system':
      return detectedTerminals[0]?.id ?? null;
    case 'detected':
      return detectedTerminals.find(terminal => terminal.id === normalized.terminalId)?.id ?? null;

    default: {
      const exhaustiveCheck: never = normalized.mode;
      return exhaustiveCheck;
    }
  }
}
