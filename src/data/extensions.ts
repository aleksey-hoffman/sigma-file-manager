// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { compare as compareSemver } from 'semver';

export const EXTENSION_REGISTRY_SCHEMA_VERSION = '1.0.0';
export const EXTENSION_MANIFEST_SCHEMA_VERSION = '1.0.0';
export const EXTENSION_REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000;

export const EXTENSION_CATEGORIES = [
  'File Management',
  'Media',
  'Security',
  'Backup & Sync',
  'Productivity',
  'Search & Filter',
  'Appearance',
  'Integration',
  'Developer Tools',
  'Example',
  'Other',
] as const;

export type ExtensionCategory = typeof EXTENSION_CATEGORIES[number];

export const EXTENSION_CATEGORIES_INFO: Record<ExtensionCategory, {
  description: string;
  icon: string;
}> = {
  'File Management': {
    description: 'Core file operations, batch processing, organization, and file utilities',
    icon: 'FolderIcon',
  },
  'Media': {
    description: 'Video/audio downloading, media conversion, thumbnails, and playback',
    icon: 'VideoIcon',
  },
  'Security': {
    description: 'Encryption, hash computing, secure delete, and file verification',
    icon: 'ShieldIcon',
  },
  'Backup & Sync': {
    description: 'Backup tools, sync utilities, and file versioning',
    icon: 'CloudIcon',
  },
  'Productivity': {
    description: 'Quick actions, workflows, automation, and time-saving tools',
    icon: 'ZapIcon',
  },
  'Search & Filter': {
    description: 'Advanced search, filtering, sorting, and file discovery',
    icon: 'SearchIcon',
  },
  'Appearance': {
    description: 'Themes, icons, UI customization, and visual enhancements',
    icon: 'PaletteIcon',
  },
  'Integration': {
    description: 'Cloud storage, external services, and third-party app connections',
    icon: 'PlugIcon',
  },
  'Developer Tools': {
    description: 'Terminal integration, scripts, git tools, and development utilities',
    icon: 'TerminalIcon',
  },
  'Example': {
    description: 'Demo and starter extensions to learn extension development',
    icon: 'BookOpenIcon',
  },
  'Other': {
    description: 'Extensions that do not fit into other categories',
    icon: 'PackageIcon',
  },
};

export const EXTENSION_PERMISSIONS_INFO: Record<string, {
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high' | 'highest';
}> = {
  'contextMenu': {
    title: 'Context Menu',
    description: 'Add items to the file browser context menu',
    risk: 'low',
  },
  'sidebar': {
    title: 'Sidebar',
    description: 'Add pages to the sidebar navigation',
    risk: 'low',
  },
  'toolbar': {
    title: 'Toolbar',
    description: 'Add dropdown menus to the window toolbar',
    risk: 'low',
  },
  'commands': {
    title: 'Commands',
    description: 'Register commands that can be executed via keyboard shortcuts or command palette',
    risk: 'low',
  },
  'fs.read': {
    title: 'File System Read',
    description: 'Read files and directories within approved folders',
    risk: 'medium',
  },
  'fs.write': {
    title: 'File System Write',
    description: 'Write and modify files within approved folders',
    risk: 'high',
  },
  'notifications': {
    title: 'Notifications',
    description: 'Show notification messages',
    risk: 'low',
  },
  'dialogs': {
    title: 'Dialogs',
    description: 'Show dialog windows for user interaction',
    risk: 'low',
  },
  'shell': {
    title: 'Shell Commands',
    description: 'Execute shell commands and external programs on your system',
    risk: 'highest',
  },
};

export const EXTENSION_TYPES_INFO: Record<string, {
  title: string;
  description: string;
  security: 'high' | 'medium';
}> = {
  api: {
    title: 'API Extension',
    description: 'Runs JavaScript code with access to the extension API. Best for adding features like context menu items, commands, and toolbar buttons.',
    security: 'medium',
  },
  iframe: {
    title: 'Iframe Extension',
    description: 'Runs in a sandboxed iframe with communication via postMessage. High security isolation.',
    security: 'high',
  },
  webview: {
    title: 'Webview Extension',
    description: 'Runs in a separate Tauri webview window with IPC communication. Can render full page content.',
    security: 'high',
  },
};

export function getExtensionRawFileUrl(repository: string, branch: string, filePath: string): string {
  const match = repository.match(/github\.com\/([^/]+)\/([^/]+)/);

  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repository}`);
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${filePath}`;
}

export function getExtensionAssetUrl(repository: string, versionOrBranch: string, filePath: string): string {
  const normalizedPath = filePath.replace(/^\/+/, '');
  return getExtensionRawFileUrl(repository, versionOrBranch, normalizedPath);
}

export function getExtensionManifestUrl(repository: string, branch = 'main'): string {
  return getExtensionRawFileUrl(repository, branch, 'package.json');
}

export function getExtensionReadmeUrl(repository: string, branch = 'main'): string {
  return getExtensionRawFileUrl(repository, branch, 'README.md');
}

export function getExtensionChangelogUrl(repository: string, branch = 'main'): string {
  return getExtensionRawFileUrl(repository, branch, 'CHANGELOG.md');
}

export function getExtensionVersionUrl(repository: string, version: string): string {
  return `${repository}/releases/tag/v${version}`;
}

export function getExtensionDownloadUrl(repository: string, version: string): string {
  const match = repository.match(/github\.com\/([^/]+)\/([^/]+)/);

  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repository}`);
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  return `https://github.com/${owner}/${cleanRepo}/archive/refs/tags/v${version}.zip`;
}

export const OFFICIAL_EXTENSION_ORG = 'sigma-hub';

export function isOfficialExtension(repository: string): boolean {
  const match = repository.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return false;
  const [, owner] = match;
  return owner.toLowerCase() === OFFICIAL_EXTENSION_ORG.toLowerCase();
}

export function getGitHubRepoInfo(repository: string): {
  owner: string;
  repo: string;
} | null {
  const match = repository.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
  };
}

export async function fetchGitHubTags(repository: string): Promise<string[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string[]>('fetch_github_tags', { repository });
}

export type FetchUrlResult = {
  ok: boolean;
  status: number;
  body: string;
};

export async function fetchUrlText(url: string): Promise<FetchUrlResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<FetchUrlResult>('fetch_url_text', { url });
}

export function parseVersionFromTag(tagName: string): string | null {
  const versionMatch = tagName.match(/^v?(\d+\.\d+\.\d+(?:-[\w.]+)?)$/);
  return versionMatch ? versionMatch[1] : null;
}

export function compareVersions(versionA: string, versionB: string): number {
  return compareSemver(versionA, versionB);
}

export function sortVersionsDescending(versions: string[]): string[] {
  return [...versions].sort((versionA, versionB) => compareVersions(versionB, versionA));
}
