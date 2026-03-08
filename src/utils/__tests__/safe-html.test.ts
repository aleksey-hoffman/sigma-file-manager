// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { renderMarkdownToSafeHtml, renderTextWithLinksToSafeHtml, sanitizeHtml } from '@/utils/safe-html';

describe('safe-html', () => {
  it('sanitizes rendered markdown', () => {
    const html = renderMarkdownToSafeHtml(`
# Title
<img src="x" onerror="alert('boom')">
<script>alert('boom')</script>
<a href="javascript:alert('boom')">bad</a>
`);

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<img src="x">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:alert(\'boom\')"');
  });

  it('escapes text before turning urls into links', () => {
    const html = renderTextWithLinksToSafeHtml(
      '<img src=x onerror=alert(1)> https://example.com',
      'safe-link',
    );

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('class="safe-link"');
    expect(html).not.toContain('<img');
  });

  it('supports sanitized custom media html', () => {
    const html = sanitizeHtml(
      '<video class="demo-video" controls><source src="/demo.webm" type="video/webm"></video>',
      {
        ADD_TAGS: ['video', 'source'],
        ADD_ATTR: ['class', 'controls', 'src', 'type'],
      },
    );

    expect(html).toContain('<video');
    expect(html).toContain('class="demo-video"');
    expect(html).toContain('src="/demo.webm"');
    expect(html).toContain('type="video/webm"');
  });
});
