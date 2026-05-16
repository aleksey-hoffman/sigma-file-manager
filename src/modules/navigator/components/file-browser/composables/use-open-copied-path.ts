// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { toast } from '@/components/ui/toaster';
import normalizePath from '@/utils/normalize-path';
import type { DirEntry } from '@/types/dir-entry';

const PATH_LOOKUP_TIMEOUT_MS = 750;

type OpenCopiedPathOptions = {
  openDirectory: (path: string) => void | Promise<void>;
  openFile: (path: string) => void | Promise<void>;
};

export function useOpenCopiedPath(options: OpenCopiedPathOptions) {
  const { t } = useI18n();

  async function getClipboardPathEntry(path: string): Promise<DirEntry | null> {
    try {
      return await invoke<DirEntry>('get_dir_entry_with_timeout', {
        path,
        timeoutMs: PATH_LOOKUP_TIMEOUT_MS,
      });
    }
    catch {
      return null;
    }
  }

  function showInvalidClipboardPathToast() {
    toast.error(t('settings.addressBar.clipboardDoesntHaveValidPath'));
  }

  async function openCopiedPath(): Promise<boolean> {
    try {
      const clipboardValue: unknown = await navigator.clipboard.readText();

      if (typeof clipboardValue !== 'string') {
        showInvalidClipboardPathToast();
        return false;
      }

      const clipboardPath = normalizePath(clipboardValue.trim());

      if (!clipboardPath) {
        showInvalidClipboardPathToast();
        return false;
      }

      const entry = await getClipboardPathEntry(clipboardPath);

      if (!entry) {
        showInvalidClipboardPathToast();
        return false;
      }

      if (entry.is_dir) {
        await options.openDirectory(entry.path);
        return true;
      }

      await options.openFile(entry.path);
      return true;
    }
    catch (error) {
      console.error('Failed to read clipboard:', error);
      showInvalidClipboardPathToast();
      return false;
    }
  }

  return {
    openCopiedPath,
  };
}
