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
//
// 本仓相对上游多保留了一层：`validateExtensionCode` 扫的是**剥掉注释与字符串
// 字面量之后**的代码（见 `strip-non-code.ts`）。注释和字面量里的 "self"、
// "window." 之类都是惰性的，按原文匹配会误杀正常扩展。

import { stripCommentsAndLiterals } from '@/modules/extensions/runtime/strip-non-code';

export type ExtensionSandbox = {
  extensionId: string;
  destroy: () => void;
};

export function validateExtensionCode(code: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const dangerousPatterns: Array<{
    pattern: RegExp;
    message: string;
    /** true = 必须扫原文（规则要抓的就是字符串字面量本身）；缺省 = 扫剥除后的代码。 */
    literal?: boolean;
  }> = [
    {
      pattern: /\beval\s*\(/g,
      message: 'eval() is not allowed',
    },
    {
      pattern: /\bnew\s+Function\s*\(/g,
      message: 'new Function() is not allowed',
    },
    {
      // 这两条要找的**就是**那个字符串字面量，所以必须扫原文（见下面的
      // `literal: true`）。剥掉字面量后它们会永远匹配不到 —— 本仓上一版
      // 就是这么把 `.constructor` 这条规则悄悄弄失效的。
      pattern: /\.constructor\s*\(\s*['"`]/g,
      message: 'Dynamic code construction via .constructor() is not allowed',
      literal: true,
    },
    {
      // Computed access to constructor/prototype internals, e.g.
      // obj['constructor'] or obj["__proto__"]. This does not catch runtime
      // string concatenation by design (a static denylist cannot); the Web
      // Worker / iframe realm is the actual boundary.
      pattern: /\[\s*(['"`])(?:constructor|__proto__|prototype)\1\s*\]/g,
      message: 'Computed access to constructor/prototype internals is not allowed',
      literal: true,
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

  // Scan executable code only. Comments and literals are inert, so matching
  // against them produced false rejections — notably the word "self" inside an
  // English comment tripping the `self` rule below.
  const scannable = stripCommentsAndLiterals(code);

  for (const { pattern, message, literal } of dangerousPatterns) {
    // `literal: true` 的规则要抓的正是字符串字面量本身（`.constructor("x")`、
    // `["__proto__"]`），所以只能扫原文；其余规则扫剥除后的代码，避免把
    // 注释和字面量里的字样当成真代码。
    const target = literal ? code : scannable;

    if (pattern.test(target)) {
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
