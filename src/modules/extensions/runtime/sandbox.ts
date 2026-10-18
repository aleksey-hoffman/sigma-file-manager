// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Extension isolation note:
//
// `api`-mode extensions execute inside a dedicated module Web Worker
// (`extension-worker.ts`), and `iframe`-mode extensions execute inside a
// cross-origin sandboxed iframe. Those are the real isolation boundaries:
// extension code runs in a separate realm that does not expose the host
// `window`, the Tauri IPC bridge (`__TAURI_INTERNALS__`), or the host DOM.
//
// This module intentionally does NOT provide an in-process "sandbox" that
// shares the host realm's intrinsics. A denylist/proxy over the real globals is
// not a security boundary: computed member access (for example
// `Object['con' + 'structor']('return globalThis')()`) trivially walks back to
// the host realm, so such a helper would give a false sense of containment.
//
// What remains here is a best-effort static screen (`validateExtensionCode`),
// used only as defence in depth before a module is handed to the worker, and
// `freezeObject`, used to deep-freeze the API surface exposed to extensions.

export type ExtensionSandbox = {
  extensionId: string;
  destroy: () => void;
};

export function validateExtensionCode(code: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const dangerousPatterns = [
    {
      pattern: /\beval\s*\(/g,
      message: 'eval() is not allowed',
    },
    {
      pattern: /\bnew\s+Function\s*\(/g,
      message: 'new Function() is not allowed',
    },
    {
      pattern: /\.constructor\s*\(\s*['"`]/g,
      message: 'Dynamic code construction via .constructor() is not allowed',
    },
    {
      // Computed access to constructor/prototype internals, e.g.
      // obj['constructor'] or obj["__proto__"]. This does not catch runtime
      // string concatenation by design (a static denylist cannot); the Web
      // Worker / iframe realm is the actual boundary.
      pattern: /\[\s*(['"`])(?:constructor|__proto__|prototype)\1\s*\]/g,
      message: 'Computed access to constructor/prototype internals is not allowed',
    },
    {
      pattern: /\bdocument\s*\./g,
      message: 'Direct document access is not allowed',
    },
    {
      pattern: /\bwindow\s*\./g,
      message: 'Direct window access is not allowed',
    },
    {
      pattern: /\blocalStorage\s*\./g,
      message: 'localStorage is not allowed',
    },
    {
      pattern: /\bsessionStorage\s*\./g,
      message: 'sessionStorage is not allowed',
    },
    {
      pattern: /\bindexedDB\s*\./g,
      message: 'indexedDB is not allowed',
    },
    {
      pattern: /\bfetch\s*\(/g,
      message: 'fetch() is not allowed - use sigma.fs instead',
    },
    {
      pattern: /\bXMLHttpRequest\b/g,
      message: 'XMLHttpRequest is not allowed',
    },
    {
      pattern: /\bWebSocket\b/g,
      message: 'WebSocket is not allowed',
    },
    {
      pattern: /(?<![\w$.])self\b/g,
      message: 'Direct self access is not allowed',
    },
    {
      pattern: /(?<![\w$.])globalThis\b/g,
      message: 'Direct globalThis access is not allowed',
    },
    {
      pattern: /(?<![\w$.])postMessage\s*\(/g,
      message: 'Direct postMessage() is not allowed',
    },
    {
      pattern: /(?<![\w$.])addEventListener\s*\(/g,
      message: 'Direct addEventListener() is not allowed',
    },
    {
      pattern: /(?<![\w$.])removeEventListener\s*\(/g,
      message: 'Direct removeEventListener() is not allowed',
    },
    {
      pattern: /(?<![\w$.])dispatchEvent\s*\(/g,
      message: 'Direct dispatchEvent() is not allowed',
    },
    {
      pattern: /\bimportScripts\b/g,
      message: 'importScripts is not allowed',
    },
    {
      pattern: /(?<![\w$.])navigator\b/g,
      message: 'Direct navigator access is not allowed',
    },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      errors.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function freezeObject<T extends object>(obj: T): T {
  Object.freeze(obj);

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      freezeObject(value as object);
    }
  }

  return obj;
}
