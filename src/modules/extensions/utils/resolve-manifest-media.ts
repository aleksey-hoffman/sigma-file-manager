// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import type { ExtensionManifest } from '@sigma-file-manager/api';
import { getExtensionAssetUrl } from '@/data/extensions';
import { isQuickViewSupported } from '@/stores/runtime/quick-view';

export type ResolvedManifestMediaItem = {
  title: string;
  type: 'image' | 'video';
  previewUrl: string;
  quickViewPath?: string;
  quickViewSiblingPaths?: string[];
  remoteOpenUrl?: string;
};

function normalizeMediaSrc(src: string): string {
  return src.trim().replace(/^\.?\//, '');
}

function isAbsoluteHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

export function normalizeManifestMediaItems(manifest: ExtensionManifest | undefined): ReadonlyArray<{
  title: string;
  src: string;
  type: 'image' | 'video';
}> {
  const raw = manifest?.media;

  if (!Array.isArray(raw)) {
    return [];
  }

  const result: {
    title: string;
    src: string;
    type: 'image' | 'video';
  }[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const src = typeof item.src === 'string' ? item.src.trim() : '';
    const type = item.type === 'video' || item.type === 'image' ? item.type : null;

    if (!title || !src || !type) {
      continue;
    }

    result.push({
      title,
      src,
      type,
    });
  }

  return result;
}

export function getGitHubRefForRemoteMedia(options: {
  isInstalled: boolean;
  selectedVersion: string;
  installedVersion?: string | null;
  latestVersion: string | null;
}): string {
  if (options.isInstalled) {
    const version = options.installedVersion || options.selectedVersion || options.latestVersion;

    if (version) {
      const trimmed = version.trim();
      return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
    }

    return 'main';
  }

  const version = options.selectedVersion || options.latestVersion;

  if (version) {
    const trimmed = version.trim();
    return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
  }

  return 'main';
}

export function manifestHasMediaItems(manifest: ExtensionManifest | undefined): boolean {
  return normalizeManifestMediaItems(manifest).length > 0;
}

async function buildResolvedItemsFromRemoteUrls(options: {
  items: ReadonlyArray<{
    title: string;
    src: string;
    type: 'image' | 'video';
  }>;
  repository: string;
  remoteRef: string;
}): Promise<ResolvedManifestMediaItem[]> {
  const { items, repository, remoteRef } = options;
  const previewUrls: string[] = [];

  for (const item of items) {
    try {
      previewUrls.push(
        isAbsoluteHttpUrl(item.src)
          ? item.src
          : getExtensionAssetUrl(repository, remoteRef, normalizeMediaSrc(item.src)),
      );
    }
    catch {
      previewUrls.push('');
    }
  }

  const quickViewUrls = previewUrls.filter(url => url.length > 0 && isQuickViewSupported(url));

  const resolved: ResolvedManifestMediaItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const previewUrl = previewUrls[index];

    if (!previewUrl) {
      continue;
    }

    const item = items[index];
    const quickViewOk = isQuickViewSupported(previewUrl);
    resolved.push({
      title: item.title,
      type: item.type,
      previewUrl,
      quickViewPath: quickViewOk ? previewUrl : undefined,
      quickViewSiblingPaths: quickViewOk ? quickViewUrls : undefined,
      remoteOpenUrl: quickViewOk ? undefined : previewUrl,
    });
  }

  return resolved;
}

export async function resolveManifestMediaItems(options: {
  manifest: ExtensionManifest | undefined;
  extensionId: string;
  isInstalled: boolean;
  repository: string;
  remoteRef: string;
}): Promise<ResolvedManifestMediaItem[]> {
  const items = normalizeManifestMediaItems(options.manifest);

  if (items.length === 0) {
    return [];
  }

  if (options.isInstalled) {
    try {
      const extensionPath = await invoke<string>('get_extension_path', { extensionId: options.extensionId });
      const resolved: ResolvedManifestMediaItem[] = [];
      const pathsForQuickView: string[] = [];

      for (const item of items) {
        if (isAbsoluteHttpUrl(item.src)) {
          if (isQuickViewSupported(item.src)) {
            pathsForQuickView.push(item.src);
          }

          continue;
        }

        const relativePath = normalizeMediaSrc(item.src);

        if (relativePath.includes('..')) {
          continue;
        }

        const fullPath = await join(extensionPath, relativePath);

        if (isQuickViewSupported(fullPath)) {
          pathsForQuickView.push(fullPath);
        }
      }

      for (const item of items) {
        if (isAbsoluteHttpUrl(item.src)) {
          const quickViewOk = isQuickViewSupported(item.src);
          resolved.push({
            title: item.title,
            type: item.type,
            previewUrl: item.src,
            quickViewPath: quickViewOk ? item.src : undefined,
            quickViewSiblingPaths: quickViewOk ? pathsForQuickView : undefined,
            remoteOpenUrl: quickViewOk ? undefined : item.src,
          });
          continue;
        }

        const relativePath = normalizeMediaSrc(item.src);

        if (relativePath.includes('..')) {
          continue;
        }

        const fullPath = await join(extensionPath, relativePath);
        const quickViewOk = isQuickViewSupported(fullPath);
        resolved.push({
          title: item.title,
          type: item.type,
          previewUrl: convertFileSrc(fullPath),
          quickViewPath: quickViewOk ? fullPath : undefined,
          quickViewSiblingPaths: quickViewOk ? pathsForQuickView : undefined,
        });
      }

      return resolved;
    }
    catch {
      return buildResolvedItemsFromRemoteUrls({
        items,
        repository: options.repository,
        remoteRef: options.remoteRef,
      });
    }
  }

  return buildResolvedItemsFromRemoteUrls({
    items,
    repository: options.repository,
    remoteRef: options.remoteRef,
  });
}
