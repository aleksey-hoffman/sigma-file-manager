// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  buildCustomTerminalLaunch,
  createDefaultTerminalSettings,
  normalizeDefaultTerminalSettings,
  resolveTerminalLaunch,
  selectedDetectedTerminalId,
} from '@/utils/default-terminal';

const DETECTED_TERMINALS = [
  { id: 'gnome-terminal' },
  { id: 'kitty' },
];

describe('createDefaultTerminalSettings', () => {
  it('uses the system terminal so existing users keep the current behavior', () => {
    expect(createDefaultTerminalSettings()).toEqual({
      mode: 'system',
      terminalId: '',
      customCommand: '',
      customArgs: '',
    });
    expect(normalizeDefaultTerminalSettings(undefined)).toEqual(createDefaultTerminalSettings());
    expect(normalizeDefaultTerminalSettings({ mode: 'powershell' })).toEqual(createDefaultTerminalSettings());
  });

  it('keeps a saved custom command and fills missing fields', () => {
    expect(normalizeDefaultTerminalSettings({
      mode: 'custom',
      customCommand: 'kitty',
    })).toEqual({
      mode: 'custom',
      terminalId: '',
      customCommand: 'kitty',
      customArgs: '',
    });
  });
});

describe('buildCustomTerminalLaunch', () => {
  it('passes a path with shell metacharacters as one argument and as the working directory', () => {
    const directoryPath = '/tmp/My Files; rm -rf / $(calc)';

    expect(buildCustomTerminalLaunch(
      'alacritty',
      '--working-directory {directory}',
      directoryPath,
    )).toEqual({
      ok: true,
      program: 'alacritty',
      args: ['--working-directory', directoryPath],
      cwd: directoryPath,
    });
  });

  it('replaces a quoted placeholder without keeping the quotes as part of the argument', () => {
    expect(buildCustomTerminalLaunch(
      'kitty',
      '--directory "{directory}"',
      '/tmp/Project Files',
    )).toEqual({
      ok: true,
      program: 'kitty',
      args: ['--directory', '/tmp/Project Files'],
      cwd: '/tmp/Project Files',
    });
  });

  it('replaces a placeholder inside a single flag', () => {
    expect(buildCustomTerminalLaunch(
      'ghostty',
      '--working-directory={directory}',
      '/tmp/a b',
    )).toEqual({
      ok: true,
      program: 'ghostty',
      args: ['--working-directory=/tmp/a b'],
      cwd: '/tmp/a b',
    });
  });

  it('starts in the directory when the arguments do not include the placeholder', () => {
    expect(buildCustomTerminalLaunch('xterm', '', '/srv/notes')).toEqual({
      ok: true,
      program: 'xterm',
      args: [],
      cwd: '/srv/notes',
    });
  });

  it('keeps a command path with spaces and expands a leading tilde', () => {
    expect(buildCustomTerminalLaunch(
      '"C:\\Program Files\\Git\\git-bash.exe"',
      '--cd={directory}',
      'D:\\Work',
    )).toEqual({
      ok: true,
      program: 'C:/Program Files/Git/git-bash.exe',
      args: ['--cd=D:\\Work'],
      cwd: 'D:\\Work',
    });

    expect(buildCustomTerminalLaunch(
      '~/bin/kitty',
      '',
      '/tmp/work',
      '/home/user',
    )).toMatchObject({
      ok: true,
      program: '/home/user/bin/kitty',
    });
  });

  it('rejects an empty command, a command with a newline, and an unclosed quote', () => {
    expect(buildCustomTerminalLaunch('   ', '', '/tmp')).toEqual({
      ok: false,
      reason: 'empty-command',
    });
    expect(buildCustomTerminalLaunch('kitty\nrm', '', '/tmp')).toEqual({
      ok: false,
      reason: 'invalid-command',
    });
    expect(buildCustomTerminalLaunch('kitty', '--directory "', '/tmp')).toEqual({
      ok: false,
      reason: 'unclosed-quote',
    });
  });
});

describe('resolveTerminalLaunch', () => {
  it('opens the first detected terminal when the setting is missing or system', () => {
    expect(resolveTerminalLaunch({
      settings: undefined,
      detectedTerminals: DETECTED_TERMINALS,
      directoryPath: '/tmp',
    })).toEqual({
      kind: 'detected',
      terminalId: 'gnome-terminal',
      fellBackToSystemDefault: false,
      noticeKey: null,
    });
  });

  it('opens the selected installed terminal', () => {
    expect(resolveTerminalLaunch({
      settings: {
        mode: 'detected',
        terminalId: 'kitty',
      },
      detectedTerminals: DETECTED_TERMINALS,
      directoryPath: '/tmp',
    })).toMatchObject({
      kind: 'detected',
      terminalId: 'kitty',
      fellBackToSystemDefault: false,
    });
  });

  it('falls back to the system terminal when the selected one is gone', () => {
    expect(resolveTerminalLaunch({
      settings: {
        mode: 'detected',
        terminalId: 'wezterm',
      },
      detectedTerminals: DETECTED_TERMINALS,
      directoryPath: '/tmp',
    })).toEqual({
      kind: 'detected',
      terminalId: 'gnome-terminal',
      fellBackToSystemDefault: true,
      noticeKey: 'terminal.selectedTerminalMissing',
    });
  });

  it('builds a custom launch without a shell command string', () => {
    expect(resolveTerminalLaunch({
      settings: {
        mode: 'custom',
        customCommand: 'kitty',
        customArgs: '--directory {directory}',
      },
      detectedTerminals: DETECTED_TERMINALS,
      directoryPath: '/tmp/My Files',
    })).toEqual({
      kind: 'custom',
      program: 'kitty',
      args: ['--directory', '/tmp/My Files'],
      cwd: '/tmp/My Files',
    });
  });

  it('falls back when the custom command is empty and reports that no terminal exists', () => {
    expect(resolveTerminalLaunch({
      settings: {
        mode: 'custom',
        customCommand: '',
      },
      detectedTerminals: DETECTED_TERMINALS,
      directoryPath: '/tmp',
    })).toMatchObject({
      kind: 'detected',
      terminalId: 'gnome-terminal',
      fellBackToSystemDefault: true,
      noticeKey: 'terminal.customCommandMissing',
    });

    expect(resolveTerminalLaunch({
      settings: { mode: 'system' },
      detectedTerminals: [],
      directoryPath: '/tmp',
    })).toEqual({
      kind: 'unavailable',
      noticeKey: 'terminal.noTerminalAvailable',
    });
  });
});

describe('selectedDetectedTerminalId', () => {
  it('marks the terminal that Open in terminal will use', () => {
    expect(selectedDetectedTerminalId({ mode: 'system' }, DETECTED_TERMINALS)).toBe('gnome-terminal');
    expect(selectedDetectedTerminalId({
      mode: 'detected',
      terminalId: 'kitty',
    }, DETECTED_TERMINALS)).toBe('kitty');
    expect(selectedDetectedTerminalId({
      mode: 'detected',
      terminalId: 'wezterm',
    }, DETECTED_TERMINALS)).toBeNull();
    expect(selectedDetectedTerminalId({ mode: 'custom' }, DETECTED_TERMINALS)).toBeNull();
  });
});
