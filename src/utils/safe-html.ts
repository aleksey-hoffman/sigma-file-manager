// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHtml(html: string, config?: Config): string {
  const { FORBID_ATTR: forbiddenAttributes = [], ...restConfig } = config ?? {};

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ...restConfig,
    FORBID_ATTR: Array.from(new Set(['style', ...forbiddenAttributes])),
  });
}

export function renderTextWithLinksToSafeHtml(text: string, linkClassName?: string): string {
  const escapedText = escapeHtml(text);
  const encodedLinkClassName = linkClassName ? escapeHtml(linkClassName) : '';
  const linkedText = escapedText.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => {
      const classAttribute = encodedLinkClassName.length > 0 ? ` class="${encodedLinkClassName}"` : '';
      return `<a href="${url}"${classAttribute}>${url}</a>`;
    },
  );

  return sanitizeHtml(linkedText);
}
