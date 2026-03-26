// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  decodeTextFileBytes,
  decodeTextFileBytesWithEncoding,
  encodeTextFileBytes,
  type TextFileSourceEncoding,
} from '@/utils/decode-text-file-bytes';

describe('decodeTextFileBytes', () => {
  it('decodes UTF-8 Cyrillic', () => {
    const bytes = new Uint8Array([
      0xD0, 0x9F, 0xD1, 0x80, 0xD0, 0xB8, 0xD0, 0xB2, 0xD0, 0xB5, 0xD1, 0x82,
    ]);
    expect(decodeTextFileBytes(bytes)).toBe('Привет');
  });

  it('strips UTF-8 BOM before decoding', () => {
    const bytes = new Uint8Array([
      0xEF, 0xBB, 0xBF, 0x61, 0x62, 0x63,
    ]);
    expect(decodeTextFileBytes(bytes)).toBe('abc');
  });

  it('decodes UTF-16 LE with BOM', () => {
    const bytes = new Uint8Array([0xFF, 0xFE, 0x61, 0x00, 0x62, 0x00]);
    expect(decodeTextFileBytes(bytes)).toBe('ab');
  });

  it('marks invalid UTF-8 without BOM as not safe to save', () => {
    const bytes = new Uint8Array([0xC0, 0xC0]);
    const decoded = decodeTextFileBytesWithEncoding(bytes);
    expect(decoded.encoding).toBe('utf8');
    expect(decoded.saveRoundTripSafe).toBe(false);
  });
});

describe('encodeTextFileBytes round-trip', () => {
  function roundTrip(text: string, encoding: TextFileSourceEncoding): void {
    const bytes = encodeTextFileBytes(text, encoding);
    const decoded = decodeTextFileBytesWithEncoding(bytes);
    expect(decoded.encoding).toBe(encoding);
    expect(decoded.text).toBe(text);
    expect(decoded.saveRoundTripSafe).toBe(true);
  }

  it('round-trips utf8', () => {
    roundTrip('Line\nПривет', 'utf8');
  });

  it('round-trips utf8-bom', () => {
    roundTrip('abcюникод', 'utf8-bom');
  });

  it('round-trips utf16le', () => {
    roundTrip('x你好', 'utf16le');
  });

  it('round-trips utf16be', () => {
    roundTrip('yこんにちは', 'utf16be');
  });
});
