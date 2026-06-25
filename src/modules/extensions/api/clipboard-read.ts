// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { ExtensionClipboardImagePayload, ExtensionClipboardSnapshot } from '@sigma-file-manager/api';
import {
  buildFingerprint,
  buildImageContentFingerprint,
  hashTextSample,
  isValidPngBytes,
} from '@/modules/extensions/utils/clipboard-fingerprint';
import { isTransientClipboardAccessError } from '@/utils/system-clipboard-errors';

interface SystemClipboardFiles {
  paths: string[];
  operation: string;
}

interface SystemClipboardImageInfo {
  width: number;
  height: number;
  sizeBytes: number;
  clipboardSequence?: number | null;
}

interface SystemClipboardImagePngPayload {
  width: number;
  height: number;
  sizeBytes: number;
  pngBytes: number[];
}

function truncatePreview(text: string, maxLength = 240): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

async function readClipboardChangeToken(): Promise<string> {
  try {
    return await invoke<string>('read_system_clipboard_change_token');
  }
  catch (error) {
    if (!isTransientClipboardAccessError(error)) {
      console.error('Failed to read clipboard change token:', error);
    }

    return '';
  }
}

async function readClipboardImageInfo(): Promise<SystemClipboardImageInfo | null> {
  try {
    return await invoke<SystemClipboardImageInfo | null>('read_system_clipboard_image_info');
  }
  catch (error) {
    if (!isTransientClipboardAccessError(error)) {
      console.error('Failed to read clipboard image info:', error);
    }

    return null;
  }
}

async function readClipboardText(): Promise<string> {
  try {
    return await invoke<string>('read_system_clipboard_text');
  }
  catch (error) {
    if (!isTransientClipboardAccessError(error)) {
      console.error('Failed to read clipboard text:', error);
    }

    return '';
  }
}

function buildImageChangeToken(imageInfo: SystemClipboardImageInfo): string {
  return buildFingerprint([
    'image',
    String(imageInfo.width),
    String(imageInfo.height),
    String(imageInfo.sizeBytes),
    String(imageInfo.clipboardSequence ?? ''),
  ]);
}

export async function readExtensionClipboardImagePayload(): Promise<ExtensionClipboardImagePayload | null> {
  try {
    const payload = await invoke<SystemClipboardImagePngPayload | null>(
      'read_system_clipboard_image_png_bytes',
    );

    if (!payload?.pngBytes?.length) {
      return null;
    }

    const normalizedPngBytes = new Uint8Array(payload.pngBytes);

    if (!isValidPngBytes(normalizedPngBytes)) {
      return null;
    }

    return {
      width: payload.width,
      height: payload.height,
      sizeBytes: payload.sizeBytes,
      pngBytes: normalizedPngBytes,
      contentFingerprint: buildImageContentFingerprint(
        normalizedPngBytes,
        payload.width,
        payload.height,
      ),
    };
  }
  catch (error) {
    if (!isTransientClipboardAccessError(error)) {
      console.error('Failed to read clipboard image payload:', error);
    }

    return null;
  }
}

export async function readExtensionClipboardSnapshot(): Promise<ExtensionClipboardSnapshot> {
  const changeToken = await readClipboardChangeToken();

  try {
    const filesResult = await invoke<SystemClipboardFiles>('read_system_clipboard_files');

    if (filesResult.paths.length > 0) {
      const operation = filesResult.operation === 'move' ? 'move' : 'copy';
      const previewPath = filesResult.paths[0] ?? '';
      const previewName = previewPath.split(/[/\\]/).pop() ?? previewPath;
      const preview = filesResult.paths.length === 1
        ? previewName
        : `${previewName} (+${filesResult.paths.length - 1})`;
      const fingerprint = buildFingerprint(['files', operation, ...filesResult.paths]);

      return {
        type: 'files',
        changeToken,
        fingerprint,
        preview,
        files: {
          paths: filesResult.paths,
          operation,
        },
      };
    }
  }
  catch (error) {
    if (!isTransientClipboardAccessError(error)) {
      console.error('Failed to read clipboard files:', error);
    }
  }

  const imageInfo = await readClipboardImageInfo();

  if (imageInfo) {
    const fingerprint = buildImageChangeToken(imageInfo);

    return {
      type: 'image',
      changeToken,
      fingerprint,
      preview: `Image (${imageInfo.width}×${imageInfo.height})`,
      image: {
        width: imageInfo.width,
        height: imageInfo.height,
        sizeBytes: imageInfo.sizeBytes,
      },
    };
  }

  const text = await readClipboardText();

  if (text.length > 0) {
    return {
      type: 'text',
      changeToken,
      fingerprint: buildFingerprint(['text', hashTextSample(text), String(text.length)]),
      preview: truncatePreview(text),
      text,
    };
  }

  return {
    type: 'empty',
    changeToken,
    fingerprint: '',
    preview: '',
  };
}
