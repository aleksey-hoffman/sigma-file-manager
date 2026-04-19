// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const mockConvertFileSrc = vi.hoisted(() => vi.fn((path: string) => `asset:${path}`));
const mockJoin = vi.hoisted(() => vi.fn(async (...parts: string[]) => parts.join('|')));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: (...parts: string[]) => mockJoin(...parts),
}));

import { rewriteMarkdownAssetUrls } from '@/utils/readme-relative-urls';

describe('readme-relative-urls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rewrites relative image src against remote document base', async () => {
    const html = '<p><img src="preview-1.png" alt="p"></p>';
    const result = await rewriteMarkdownAssetUrls(html, {
      kind: 'remoteGitHub',
      documentBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
    });
    expect(result).toContain('https://raw.githubusercontent.com/owner/repo/main/preview-1.png');
  });

  it('resolves nested paths relative to the markdown file', async () => {
    const html = '<p><img src="docs/screenshot.png" alt="s"></p>';
    const result = await rewriteMarkdownAssetUrls(html, {
      kind: 'remoteGitHub',
      documentBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
    });
    expect(result).toContain('https://raw.githubusercontent.com/owner/repo/main/docs/screenshot.png');
  });

  it('does not rewrite absolute https image urls', async () => {
    const html = '<p><img src="https://example.com/x.png" alt="x"></p>';
    const result = await rewriteMarkdownAssetUrls(html, {
      kind: 'remoteGitHub',
      documentBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
    });
    expect(result).toContain('https://example.com/x.png');
  });

  it('does not rewrite data urls', async () => {
    const html = '<p><img src="data:image/png;base64,abc" alt="x"></p>';
    const result = await rewriteMarkdownAssetUrls(html, {
      kind: 'remoteGitHub',
      documentBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/README.md',
    });
    expect(result).toContain('data:image/png;base64,abc');
  });

  it('rewrites relative image src against local markdown file directory', async () => {
    const html = '<p><img src="./screenshot.png" alt="s"></p>';
    const result = await rewriteMarkdownAssetUrls(html, {
      kind: 'localMarkdownFile',
      markdownFilePath: 'C:/project/docs/readme.md',
    });
    expect(mockJoin).toHaveBeenCalled();
    expect(result).toContain('asset:C:/project/docs|./screenshot.png');
  });
});
