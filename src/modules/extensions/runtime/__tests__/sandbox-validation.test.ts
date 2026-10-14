// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateExtensionCode } from '@/modules/extensions/runtime/sandbox';
import { stripCommentsAndLiterals } from '@/modules/extensions/runtime/strip-non-code';

describe('stripCommentsAndLiterals', () => {
  it('preserves length so reported offsets stay meaningful', () => {
    const code = 'const a = 1; // comment\nconst b = 2;';

    expect(stripCommentsAndLiterals(code)).toHaveLength(code.length);
  });

  it('keeps newlines so line numbers stay meaningful', () => {
    const stripped = stripCommentsAndLiterals('a;\n// one\n// two\nb;');

    expect(stripped.split('\n')).toHaveLength(4);
  });

  it('blanks line and block comments', () => {
    const lineComment = 'a; // fetch(1)\nb;';
    const strippedLine = stripCommentsAndLiterals(lineComment);

    expect(strippedLine).toHaveLength(lineComment.length);
    expect(strippedLine).not.toContain('fetch(1)');
    expect(strippedLine.startsWith('a;')).toBe(true);
    expect(strippedLine.endsWith('\nb;')).toBe(true);

    const blockComment = 'a; /* fetch(1) */ b;';
    const strippedBlock = stripCommentsAndLiterals(blockComment);

    expect(strippedBlock).toHaveLength(blockComment.length);
    expect(strippedBlock).not.toContain('fetch(1)');
    expect(strippedBlock.startsWith('a;')).toBe(true);
    expect(strippedBlock.endsWith('b;')).toBe(true);
  });

  it('does not treat // inside a string as a comment', () => {
    const code = 'const u = "https://example.com/fetch(";';
    const stripped = stripCommentsAndLiterals(code);

    expect(stripped).toHaveLength(code.length);
    // The whole literal is blanked, so the embedded // cannot open a comment
    // and the text after it is still treated as part of the literal.
    expect(stripped).not.toContain('https');
    expect(stripped).not.toContain('example');
    expect(stripped).not.toContain('fetch(');
    expect(stripped.startsWith('const u = ')).toBe(true);
    expect(stripped.endsWith(';')).toBe(true);
  });

  it('blanks string literals including escaped quotes', () => {
    const stripped = stripCommentsAndLiterals('const s = "a\\"b"; const t = 1;');

    expect(stripped).toContain('const t = 1;');
    expect(stripped).not.toContain('a\\');
  });

  it('blanks template literal text but keeps ${ ... } substitutions scannable', () => {
    const stripped = stripCommentsAndLiterals('const x = `window.${a}`;');

    // The literal text is inert...
    expect(stripped).not.toContain('window.');
    // ...but the interpolation is real code and stays scannable.
    expect(stripped).toContain('${a}');
  });

  it('blanks regex literals without swallowing following code', () => {
    const stripped = stripCommentsAndLiterals('const r = /["\']/g; fetch(1);');

    expect(stripped).toContain('fetch(1);');
  });
});

describe('validateExtensionCode', () => {
  describe('regression: prose in comments must not be rejected', () => {
    it('accepts a comment containing the standalone word self', () => {
      // The real failure: focus-sync dist/index.js was rejected by
      // "Direct self access is not allowed" because of this exact phrase.
      const code = [
        '// your PC." — a self-inflicted false alarm caused by our own installer.',
        'export const activate = () => {};',
      ].join('\n');

      const result = validateExtensionCode(code);

      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it('accepts comments mentioning other banned words', () => {
      const code = [
        '// Never call fetch() here; window. and self. are unavailable.',
        '/* eval() and document. are both blocked */',
        'export const activate = () => {};',
      ].join('\n');

      expect(validateExtensionCode(code).errors).toEqual([]);
    });

    it('accepts a string literal that happens to contain a banned word', () => {
      const code = 'const hint = "use fetch() not window."; export const activate = () => {};';

      expect(validateExtensionCode(code).errors).toEqual([]);
    });
  });

  describe('real violations are still rejected', () => {
    it.each([
      ['eval(1)', 'eval() is not allowed'],
      ['new Function("x")', 'new Function() is not allowed'],
      ['document.querySelector("a")', 'Direct document access is not allowed'],
      ['window.alert(1)', 'Direct window access is not allowed'],
      ['fetch("/a")', 'fetch() is not allowed - use sigma.fs instead'],
      ['postMessage(1)', 'Direct postMessage() is not allowed'],
      ['addEventListener("x", 1)', 'Direct addEventListener() is not allowed'],
      ['navigator.userAgent', 'Direct navigator access is not allowed'],
      ['new XMLHttpRequest()', 'XMLHttpRequest is not allowed'],
      ['new WebSocket("wss://x")', 'WebSocket is not allowed'],
      ['localStorage.getItem("k")', 'localStorage is not allowed'],
      ['sessionStorage.getItem("k")', 'sessionStorage is not allowed'],
      ['indexedDB.open("k")', 'indexedDB is not allowed'],
      ['importScripts("x")', 'importScripts is not allowed'],
    ])('rejects %s', (code, expectedMessage) => {
      const result = validateExtensionCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expectedMessage);
    });

    it('rejects self access in real code', () => {
      expect(validateExtensionCode('self.postMessage(1)').errors)
        .toContain('Direct self access is not allowed');
    });

    it('rejects violations hidden inside a template substitution', () => {
      const code = 'const url = `https://x/${fetch("y")}`;';

      expect(validateExtensionCode(code).errors)
        .toContain('fetch() is not allowed - use sigma.fs instead');
    });

    it('still rejects violations after a long comment', () => {
      const code = `// ${'padding '.repeat(200)}self-inflicted\nfetch("/a");`;

      expect(validateExtensionCode(code).errors)
        .toContain('fetch() is not allowed - use sigma.fs instead');
    });

    it('accepts ordinary extension code', () => {
      const code = [
        'import { defineExtension } from "sigma:extension";',
        'const PATTERN = /[^\\w$.]self\\b/g;',
        'export default defineExtension({',
        '  name: "demo",',
        '  async activate(ctx) { ctx.log("ready"); },',
        '});',
      ].join('\n');

      expect(validateExtensionCode(code).errors).toEqual([]);
    });

    it('accepts the bundled focus-sync extension shipped in this repo', () => {
      // End-to-end guard for the real regression: the bundled extension was
      // rejected ("Direct self access is not allowed") because an English
      // comment mentioned "self-inflicted", so it never created its worker.
      const bundled = readFileSync(
        'extensions/kizemo.focus-sync/dist/index.js',
        'utf8',
      );

      const result = validateExtensionCode(bundled);

      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });
});
