// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const EXTENSION_PAGE_CSP = [
  'default-src \'none\'',
  'script-src \'unsafe-inline\' blob:',
  'style-src \'unsafe-inline\' data: blob:',
  'img-src data: blob:',
  'font-src data: blob:',
  'media-src data: blob:',
  'connect-src \'none\'',
  'base-uri \'none\'',
  'form-action \'none\'',
].join('; ');

// Remote images, fonts and styles stay allowed so bundled libraries (such as Excalidraw's
// CDN fonts) keep working. Scripts and fetch/XHR/WebSocket are local only, so extension
// network access goes through sigma.http and its declared host allowlist.
export const EXTENSION_EMBED_CSP = [
  'default-src \'self\' data: blob: filesystem:',
  'style-src \'self\' \'unsafe-inline\' data: blob: https: http:',
  'img-src \'self\' data: blob: filesystem: https: http:',
  'font-src \'self\' data: blob: https: http:',
  'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' blob: filesystem:',
  'connect-src \'self\' data: blob: filesystem:',
].join('; ');

export const EXTENSION_PAGE_SANDBOX = 'allow-scripts';
export const REMOTE_PAGE_SANDBOX = 'allow-scripts allow-same-origin allow-forms';

const LEADING_DOCTYPE_PATTERN = /^\s*<!doctype[^>]*>/i;

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

export function buildContentSecurityPolicyMeta(csp: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`;
}

export function withContentSecurityPolicy(html: string, csp: string): string {
  const policyMeta = buildContentSecurityPolicyMeta(csp);
  const doctypeMatch = html.match(LEADING_DOCTYPE_PATTERN);

  if (!doctypeMatch) {
    return `${policyMeta}${html}`;
  }

  const doctype = doctypeMatch[0];
  return `${doctype}${policyMeta}${html.slice(doctype.length)}`;
}

// A remote page keeps its own origin (allow-same-origin), so it must never be the app's
// origin or a Tauri custom protocol host such as asset.localhost or ipc.localhost.
export function isAllowedRemotePageUrl(url: string, appOrigin: string): boolean {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  }
  catch {
    return false;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return false;
  }

  if (parsedUrl.hostname.endsWith('.localhost')) {
    return false;
  }

  return parsedUrl.origin !== appOrigin;
}
