// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  EXTENSION_EMBED_CSP,
  EXTENSION_PAGE_CSP,
  isAllowedRemotePageUrl,
  withContentSecurityPolicy,
} from '@/modules/extensions/runtime/extension-frame-policy';

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function getDirectiveSources(csp: string, directiveName: string): string[] {
  const directive = csp
    .split(';')
    .map(part => part.trim().split(/\s+/))
    .find(([name]) => name === directiveName);
  return directive ? directive.slice(1) : [];
}

describe('withContentSecurityPolicy', () => {
  it.each([
    ['a full document with a doctype', '<!DOCTYPE html><html><head><title>Page</title></head><body><script>run()</script></body></html>'],
    ['a document without a doctype', '<html><head><script src="https://example.com/x.js"></script></head><body></body></html>'],
    ['a body fragment', '<p>Hello</p><script>run()</script>'],
    ['a doctype after leading whitespace', '\n  <!doctype html>\n<head><meta charset="utf-8"></head><body></body>'],
  ])('puts the policy in the head before any extension element for %s', (_label, html) => {
    const parsedDocument = parseHtml(withContentSecurityPolicy(html, EXTENSION_PAGE_CSP));
    const firstHeadElement = parsedDocument.head.firstElementChild;

    expect(firstHeadElement?.tagName).toBe('META');
    expect(firstHeadElement?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(firstHeadElement?.getAttribute('content')).toBe(EXTENSION_PAGE_CSP);
  });

  it('keeps a leading doctype so the page does not switch to quirks mode', () => {
    const parsedDocument = parseHtml(withContentSecurityPolicy('<!DOCTYPE html><p>Hi</p>', EXTENSION_PAGE_CSP));

    expect(parsedDocument.compatMode).toBe('CSS1Compat');
  });

  it('escapes the policy so it cannot close the meta attribute', () => {
    const parsedDocument = parseHtml(withContentSecurityPolicy('<p>Hi</p>', 'default-src \'none\'"><script>x()</script>'));

    expect(parsedDocument.querySelectorAll('script')).toHaveLength(0);
  });
});

describe('extension frame policies', () => {
  it.each(['default-src', 'script-src', 'connect-src'])('keeps remote origins out of the embed %s', (directiveName) => {
    const sources = getDirectiveSources(EXTENSION_EMBED_CSP, directiveName);

    expect(sources.length).toBeGreaterThan(0);
    expect(sources).not.toContain('https:');
    expect(sources).not.toContain('http:');
  });

  it('gives extension pages no network access', () => {
    expect(getDirectiveSources(EXTENSION_PAGE_CSP, 'default-src')).toEqual(['\'none\'']);
    expect(getDirectiveSources(EXTENSION_PAGE_CSP, 'connect-src')).toEqual(['\'none\'']);
  });
});

describe('isAllowedRemotePageUrl', () => {
  const appOrigin = 'http://tauri.localhost';

  it.each([
    'https://example.com/page',
    'http://localhost:8080/',
    'http://127.0.0.1:3000/search',
  ])('allows %s', (url) => {
    expect(isAllowedRemotePageUrl(url, appOrigin)).toBe(true);
  });

  it.each([
    'http://tauri.localhost/',
    'http://asset.localhost/C:/Users/someone/secret.html',
    'http://ipc.localhost/plugin',
    'javascript:alert(1)',
    'file:///C:/Windows/win.ini',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedRemotePageUrl(url, appOrigin)).toBe(false);
  });

  it('rejects the app origin of a dev build', () => {
    expect(isAllowedRemotePageUrl('http://localhost:1420/settings', 'http://localhost:1420')).toBe(false);
  });
});
