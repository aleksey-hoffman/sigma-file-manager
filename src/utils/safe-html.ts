// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { marked } from 'marked';

const supportedTextAlignValues = new Set(['left', 'center', 'right', 'justify']);
const textAlignClassPrefix = 'markdown-align-';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeTextAlign(value: string | null): string | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue || !supportedTextAlignValues.has(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

function getInlineTextAlign(style: string | null): string | null {
  if (!style) {
    return null;
  }

  for (const declaration of style.split(';')) {
    const [property, ...valueParts] = declaration.split(':');

    if (property?.trim().toLowerCase() !== 'text-align') {
      continue;
    }

    return normalizeTextAlign(valueParts.join(':'));
  }

  return null;
}

function addClassName(element: Element, className: string) {
  const existingClassName = element.getAttribute('class');
  element.setAttribute('class', existingClassName ? `${existingClassName} ${className}` : className);
}

function addMarkdownAlignmentClasses(html: string): string {
  const lowerCasedHtml = html.toLowerCase();

  if (!lowerCasedHtml.includes('align') && !lowerCasedHtml.includes('text-align')) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const element of doc.body.querySelectorAll('[align], [style]')) {
    const textAlign = normalizeTextAlign(element.getAttribute('align'))
      ?? getInlineTextAlign(element.getAttribute('style'));

    if (textAlign) {
      addClassName(element, `${textAlignClassPrefix}${textAlign}`);
    }
  }

  return doc.body.innerHTML;
}

export function sanitizeHtml(html: string, config?: Config): string {
  const { FORBID_ATTR: forbiddenAttributes = [], ...restConfig } = config ?? {};

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ...restConfig,
    FORBID_ATTR: Array.from(new Set(['style', ...forbiddenAttributes])),
  });
}

export function renderMarkdownToSafeHtml(markdown: string, config?: Config): string {
  const parsedMarkdown = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;

  return sanitizeHtml(addMarkdownAlignmentClasses(parsedMarkdown), config);
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
