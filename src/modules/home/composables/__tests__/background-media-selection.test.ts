// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  resolveMediaSelectionIndex,
  resolveOffsetMediaSelectionIndex,
} from '../background-media-selection';

const mediaOptions = [
  { value: 'custom-a' },
  { value: 'custom-b' },
  { value: 'Exile by Aleksey Hoffman.jpg' },
  { value: 'Exile by Aleksey Hoffman video.mp4' },
  { value: 'Exile by Aleksey Hoffman alt.jpg' },
];

describe('background media selection helpers', () => {
  it('prefers mediaId over a stale combined-list index', () => {
    const selectionIndex = resolveMediaSelectionIndex(
      {
        mediaId: 'Exile by Aleksey Hoffman video.mp4',
        index: 0,
      },
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
      },
      mediaOptions,
    );

    expect(selectionIndex).toBe(3);
  });

  it('maps legacy builtin-only indexes through resolveMediaIdFromIndex', () => {
    const selectionIndex = resolveMediaSelectionIndex(
      {
        index: 1,
      },
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
        resolveMediaIdFromIndex(index) {
          return [
            'Exile by Aleksey Hoffman.jpg',
            'Exile by Aleksey Hoffman video.mp4',
            'Exile by Aleksey Hoffman alt.jpg',
          ][index] ?? null;
        },
      },
      mediaOptions,
    );

    expect(selectionIndex).toBe(3);
  });

  it('wraps offsets in both directions across the full media list', () => {
    const wrappedForwardIndex = resolveOffsetMediaSelectionIndex(
      {
        mediaId: 'Exile by Aleksey Hoffman alt.jpg',
      },
      1,
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
      },
      mediaOptions,
    );

    const wrappedBackwardIndex = resolveOffsetMediaSelectionIndex(
      {
        mediaId: 'custom-a',
      },
      -1,
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
      },
      mediaOptions,
    );

    expect(wrappedForwardIndex).toBe(0);
    expect(wrappedBackwardIndex).toBe(4);
  });
});
