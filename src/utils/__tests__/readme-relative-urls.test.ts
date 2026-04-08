// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { rewriteMarkdownAssetUrls } from '@/utils/readme-relative-urls';

describe('readme-relative-urls', () => {
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
});
