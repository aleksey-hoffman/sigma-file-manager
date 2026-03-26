// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type TextFileSourceEncoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be';

export function decodeTextFileBytesWithEncoding(bytes: Uint8Array): {
  text: string;
  encoding: TextFileSourceEncoding;
  saveRoundTripSafe: boolean;
} {
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf8-bom',
      saveRoundTripSafe: true,
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      encoding: 'utf16le',
      saveRoundTripSafe: true,
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      encoding: 'utf16be',
      saveRoundTripSafe: true,
    };
  }

  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      encoding: 'utf8',
      saveRoundTripSafe: true,
    };
  }
  catch {
    return {
      text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
      encoding: 'utf8',
      saveRoundTripSafe: false,
    };
  }
}

export function decodeTextFileBytes(bytes: Uint8Array): string {
  return decodeTextFileBytesWithEncoding(bytes).text;
}

function encodeUtf16WithEndianness(text: string, bigEndian: boolean): Uint8Array {
  const buffer = new ArrayBuffer(text.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < text.length; index++) {
    view.setUint16(index * 2, text.charCodeAt(index), !bigEndian);
  }

  return new Uint8Array(buffer);
}

export function encodeTextFileBytes(text: string, encoding: TextFileSourceEncoding): Uint8Array {
  const utf8Encoder = new TextEncoder();

  switch (encoding) {
    case 'utf8': {
      return utf8Encoder.encode(text);
    }

    case 'utf8-bom': {
      const body = utf8Encoder.encode(text);
      const out = new Uint8Array(3 + body.length);
      out[0] = 0xEF;
      out[1] = 0xBB;
      out[2] = 0xBF;
      out.set(body, 3);
      return out;
    }

    case 'utf16le': {
      const body = encodeUtf16WithEndianness(text, false);
      const out = new Uint8Array(2 + body.length);
      out[0] = 0xFF;
      out[1] = 0xFE;
      out.set(body, 2);
      return out;
    }

    case 'utf16be': {
      const body = encodeUtf16WithEndianness(text, true);
      const out = new Uint8Array(2 + body.length);
      out[0] = 0xFE;
      out[1] = 0xFF;
      out.set(body, 2);
      return out;
    }
  }
}
