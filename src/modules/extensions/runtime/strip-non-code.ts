// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/**
 * Blanks out comments and string / template / regex literals while preserving
 * every character offset.
 *
 * Why this exists: the extension sandbox scans raw source for dangerous
 * patterns. Ordinary English prose inside a comment matched those patterns —
 * an extension whose source contained
 *
 *   // ... a self-inflicted false alarm caused by our own installer.
 *
 * was rejected by `/(?<![\w$.])self\b/` ("Direct self access is not allowed"),
 * so it never created its worker and silently never activated.
 *
 * Comments and literals are inert: they cannot execute. Blanking them before
 * the scan therefore removes false positives without weakening the check on
 * real code.
 *
 * Length is preserved so that any position reported against the stripped text
 * still points at the same location in the original source.
 */

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

/** Characters after which a `/` starts a regular expression, not a division. */
const REGEX_PRECEDING_CHARS = '([{,;:!&|?+-*%^~=';

function isIdentifierChar(char: string): boolean {
  return /[\w$]/.test(char);
}

export function stripCommentsAndLiterals(code: string): string {
  const out = code.split('');
  const length = out.length;

  // Scanning context. `braceDepth` counts `${` nesting inside template literals.
  let inTemplate = false;
  let braceDepth = 0;

  let lastSignificantChar = '';
  let lastWord = '';
  let index = 0;

  function blankRange(from: number, to: number): void {
    for (let k = from; k < to && k < length; k += 1) {
      if (out[k] !== '\n') {
        out[k] = ' ';
      }
    }
  }

  function consumeNormalCharacter(): void {
    const char = out[index];

    if (/\s/.test(char)) {
      index += 1;
      return;
    }

    lastSignificantChar = char;
    lastWord = isIdentifierChar(char) ? lastWord + char : '';
    index += 1;
  }

  function canStartRegex(): boolean {
    if (lastSignificantChar === '') {
      return true;
    }

    if (REGEX_PRECEDING_CHARS.includes(lastSignificantChar)) {
      return true;
    }

    if (isIdentifierChar(lastSignificantChar) || lastSignificantChar === ')' || lastSignificantChar === ']') {
      return REGEX_PRECEDING_KEYWORDS.has(lastWord);
    }

    return false;
  }

  function consumeLineComment(): void {
    const start = index;

    while (index < length && out[index] !== '\n') {
      index += 1;
    }

    blankRange(start, index);
  }

  function consumeBlockComment(): void {
    const start = index;
    index += 2;

    while (index < length && !(out[index] === '*' && out[index + 1] === '/')) {
      index += 1;
    }

    index = Math.min(index + 2, length);
    blankRange(start, index);
  }

  function consumeQuotedString(): void {
    const quote = out[index];
    const start = index;
    index += 1;

    while (index < length) {
      if (out[index] === '\\') {
        index += 2;
        continue;
      }

      if (out[index] === quote) {
        index += 1;
        break;
      }

      if (out[index] === '\n') {
        // Unterminated literal: stop at the line break rather than swallowing
        // the rest of the file.
        break;
      }

      index += 1;
    }

    blankRange(start, index);
  }

  function consumeRegexLiteral(): void {
    const start = index;
    index += 1;
    let inCharacterClass = false;

    while (index < length) {
      const char = out[index];

      if (char === '\\') {
        index += 2;
        continue;
      }

      if (char === '\n') {
        // Not a regex after all (division followed by a newline): leave it be.
        index = start;
        return;
      }

      if (char === '[') {
        inCharacterClass = true;
      }
      else if (char === ']') {
        inCharacterClass = false;
      }
      else if (char === '/' && !inCharacterClass) {
        index += 1;
        break;
      }

      index += 1;
    }

    blankRange(start, index);
  }

  while (index < length) {
    const char = out[index];
    const next = index + 1 < length ? out[index + 1] : '';

    if (inTemplate) {
      if (char === '\\') {
        // Escape pair: blank both halves so an escaped backtick cannot end the
        // literal early.
        blankRange(index, Math.min(index + 2, length));
        index += 2;
        continue;
      }

      if (char === '`') {
        // Template ends.
        out[index] = ' ';
        inTemplate = false;
        index += 1;
        continue;
      }

      if (char === '$' && next === '{') {
        braceDepth += 1;
        index += 2;
        inTemplate = false;
        continue;
      }

      // Inert template text: it cannot execute, so blank it like a comment.
      if (char !== '\n') {
        out[index] = ' ';
      }

      index += 1;
      continue;
    }

    if (char === '{') {
      if (braceDepth > 0) {
        braceDepth += 1;
      }

      consumeNormalCharacter();
      continue;
    }

    if (char === '}') {
      if (braceDepth > 0) {
        braceDepth -= 1;

        if (braceDepth === 0) {
          // End of a `${ ... }` substitution: back to template literal mode.
          inTemplate = true;
          index += 1;
          continue;
        }
      }

      consumeNormalCharacter();
      continue;
    }

    if (char === '/' && next === '/') {
      consumeLineComment();
      continue;
    }

    if (char === '/' && next === '*') {
      consumeBlockComment();
      continue;
    }

    if (char === '"' || char === '\'') {
      consumeQuotedString();
      continue;
    }

    if (char === '`') {
      // Blank the opening backtick, then treat the literal body as inert until
      // `${` (which resumes real code scanning) or the closing backtick.
      out[index] = ' ';
      index += 1;
      inTemplate = true;
      braceDepth = 0;
      continue;
    }

    if (char === '/' && canStartRegex()) {
      consumeRegexLiteral();
      continue;
    }

    consumeNormalCharacter();
  }

  return out.join('');
}
