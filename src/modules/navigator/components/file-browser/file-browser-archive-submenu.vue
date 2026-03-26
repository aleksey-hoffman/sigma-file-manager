<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, inject, markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type { DirEntry } from '@/types/dir-entry';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuItem,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { FileArchiveIcon, PackageOpenIcon } from '@lucide/vue';
import { FILE_BROWSER_CONTEXT_KEY } from './composables/use-file-browser-context';
import { useArchiveJobsStore } from '@/stores/runtime/archive-jobs';
import { translateArchiveErrorMessage } from '@/utils/translate-archive-error-message';
import normalizePath, { getParentPath } from '@/utils/normalize-path';

const props = defineProps<{
  selectedEntries: DirEntry[];
}>();

const { t } = useI18n();

const fileBrowserContext = inject(FILE_BROWSER_CONTEXT_KEY, undefined);

const archiveJobsStore = useArchiveJobsStore();

function parentDirectoryOfEntry(entry: DirEntry): string {
  const path = entry.path;
  const lastSeparator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));

  if (lastSeparator > 0) {
    return path.substring(0, lastSeparator);
  }

  if (lastSeparator === 0) {
    return path.substring(0, 1);
  }

  return path;
}

const compressDestinationParentDirectory = computed(() => {
  if (fileBrowserContext) {
    return fileBrowserContext.currentPath.value;
  }

  const firstEntry = props.selectedEntries[0];

  if (!firstEntry) {
    return undefined;
  }

  return parentDirectoryOfEntry(firstEntry);
});

const extractHereDestination = computed(() => {
  if (fileBrowserContext) {
    return fileBrowserContext.currentPath.value;
  }

  const firstEntry = props.selectedEntries[0];

  if (!firstEntry) {
    return null;
  }

  return parentDirectoryOfEntry(firstEntry);
});

const zipArchiveEntry = computed(() => {
  if (props.selectedEntries.length !== 1) {
    return null;
  }

  const entry = props.selectedEntries[0];

  if (entry.is_dir) {
    return null;
  }

  const extension = (entry.ext ?? '').toLowerCase();

  if (extension !== 'zip') {
    return null;
  }

  return entry;
});

const showExtractSubmenu = computed(() => zipArchiveEntry.value !== null);

const showCompressSubmenu = computed(() => {
  if (props.selectedEntries.length === 0) {
    return false;
  }

  if (props.selectedEntries.length === 1) {
    const only = props.selectedEntries[0];

    if (!only.is_dir && (only.ext ?? '').toLowerCase() === 'zip') {
      return false;
    }
  }

  return true;
});

const archiveStemForExtractLabel = computed(() => {
  const entry = zipArchiveEntry.value;

  if (!entry) {
    return '';
  }

  const name = entry.name;

  if (name.toLowerCase().endsWith('.zip')) {
    return name.slice(0, -4);
  }

  return name;
});

const quickCompressZipFileName = computed(() => {
  if (props.selectedEntries.length === 1) {
    return `${props.selectedEntries[0].name}.zip`;
  }

  return t('fileBrowser.archive.multiSelectionArchiveFileName');
});

const defaultSaveArchivePath = computed(() => {
  const parentPath = compressDestinationParentDirectory.value;

  if (!parentPath) {
    return undefined;
  }

  const separator = parentPath.includes('\\') ? '\\' : '/';
  return `${parentPath}${separator}${quickCompressZipFileName.value}`;
});

function afterArchiveComplete(detail?: { resultPath?: string | null }) {
  if (fileBrowserContext && detail?.resultPath) {
    const entryPath = normalizePath(detail.resultPath);
    const parentPath = getParentPath(entryPath);

    if (parentPath !== null && normalizePath(fileBrowserContext.currentPath.value) === parentPath) {
      fileBrowserContext.requestFocusEntryAfterRefresh(parentPath, entryPath);
    }
  }

  fileBrowserContext?.refresh();
}

async function startArchiveJob(
  request: Parameters<typeof archiveJobsStore.startJob>[0],
  operationLabel: string,
  displayName: string,
) {
  try {
    await archiveJobsStore.startJob(request, {
      label: operationLabel,
      displayPath: displayName,
      onComplete: afterArchiveComplete,
    });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const description = translateArchiveErrorMessage(message);
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('fileBrowser.archive.operationErrorTitle'),
          description,
        },
      },
      duration: 5000,
    });
  }
}

async function handleExtractHere() {
  const archiveEntry = zipArchiveEntry.value;
  const destination = extractHereDestination.value;

  if (!archiveEntry || !destination) {
    return;
  }

  await startArchiveJob(
    {
      kind: 'extractHere',
      archivePath: archiveEntry.path,
      destinationDir: destination,
    },
    t('fileBrowser.archive.extractHere'),
    archiveEntry.name,
  );
}

async function handleExtractToNamedFolder() {
  const archiveEntry = zipArchiveEntry.value;

  if (!archiveEntry) {
    return;
  }

  await startArchiveJob(
    {
      kind: 'extractToNamedFolder',
      archivePath: archiveEntry.path,
    },
    t('fileBrowser.archive.extractToNamedFolder', {
      folderName: `${archiveStemForExtractLabel.value}/`,
    }),
    archiveEntry.name,
  );
}

async function handleExtractToPicker() {
  const archiveEntry = zipArchiveEntry.value;

  if (!archiveEntry) {
    return;
  }

  const picked = await openDialog({
    directory: true,
    multiple: false,
    title: t('fileBrowser.archive.pickExtractFolderTitle'),
  });

  if (picked === null || picked === undefined) {
    return;
  }

  const destinationDir = typeof picked === 'string' ? picked : picked[0];

  if (!destinationDir) {
    return;
  }

  await startArchiveJob(
    {
      kind: 'extractHere',
      archivePath: archiveEntry.path,
      destinationDir,
    },
    t('fileBrowser.archive.extractToPicker'),
    archiveEntry.name,
  );
}

async function handleCompressQuick() {
  if (props.selectedEntries.length === 0) {
    return;
  }

  const parentPath = compressDestinationParentDirectory.value;

  if (!parentPath) {
    return;
  }

  const separator = parentPath.includes('\\') ? '\\' : '/';
  const destinationZipPath = `${parentPath}${separator}${quickCompressZipFileName.value}`;

  const sourcePaths = props.selectedEntries.map(entry => entry.path);

  await startArchiveJob(
    {
      kind: 'compress',
      sourcePaths,
      destinationZipPath,
    },
    t('fileBrowser.archive.compressQuick', {
      name: quickCompressZipFileName.value,
    }),
    quickCompressZipFileName.value,
  );
}

async function handleCompressWithDialog() {
  if (props.selectedEntries.length === 0) {
    return;
  }

  const savedPath = await saveDialog({
    title: t('fileBrowser.archive.saveArchiveTitle'),
    defaultPath: defaultSaveArchivePath.value,
    filters: [
      {
        name: t('fileBrowser.archive.zipFilterName'),
        extensions: ['zip'],
      },
    ],
  });

  if (!savedPath) {
    return;
  }

  const sourcePaths = props.selectedEntries.map(entry => entry.path);

  await startArchiveJob(
    {
      kind: 'compress',
      sourcePaths,
      destinationZipPath: savedPath,
    },
    t('fileBrowser.archive.compressWithDialog'),
    quickCompressZipFileName.value,
  );
}
</script>

<template>
  <ContextMenuSub v-if="showExtractSubmenu">
    <ContextMenuSubTrigger class="file-browser-archive-submenu__trigger">
      <PackageOpenIcon :size="16" />
      <span>{{ t('fileBrowser.archive.extract') }}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="file-browser-archive-submenu">
      <ContextMenuItem
        :disabled="!extractHereDestination"
        @select="handleExtractHere"
      >
        {{ t('fileBrowser.archive.extractHere') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleExtractToNamedFolder">
        {{
          t('fileBrowser.archive.extractToNamedFolder', {
            folderName: `${archiveStemForExtractLabel}/`,
          })
        }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleExtractToPicker">
        {{ t('fileBrowser.archive.extractToPicker') }}
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>

  <ContextMenuSub v-if="showCompressSubmenu">
    <ContextMenuSubTrigger class="file-browser-archive-submenu__trigger">
      <FileArchiveIcon :size="16" />
      <span>{{ t('fileBrowser.archive.compress') }}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="file-browser-archive-submenu">
      <ContextMenuItem @select="handleCompressWithDialog">
        {{ t('fileBrowser.archive.compressWithDialog') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleCompressQuick">
        {{
          t('fileBrowser.archive.compressQuick', {
            name: quickCompressZipFileName,
          })
        }}
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
</template>

<style>
.file-browser-archive-submenu {
  min-width: 220px;
  padding: 8px;
}

.file-browser-archive-submenu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
