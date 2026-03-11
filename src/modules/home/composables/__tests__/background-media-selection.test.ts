// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  resolveMediaSelectionIndex,
  resolveOffsetMediaSelectionIndex,
} from '../background-media-selection';

const mediaOptions = [
  { value: 'custom:custom-a' },
  { value: 'custom:custom-b' },
  { value: 'builtin:Exile by Aleksey Hoffman.jpg' },
  { value: 'builtin:Exile by Aleksey Hoffman video.mp4' },
  { value: 'builtin:Exile by Aleksey Hoffman alt.jpg' },
];

describe('background media selection helpers', () => {
  it('prefers mediaId over a stale combined-list index', () => {
    const selectionIndex = resolveMediaSelectionIndex(
      {
        mediaId: 'builtin:Exile by Aleksey Hoffman video.mp4',
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

  it('uses the saved index to disambiguate legacy ids shared by custom and builtin media', () => {
    const duplicateMediaOptions = [
      { value: 'custom:Environment Explorations by Marcel van Vuuren.jpg' },
      { value: 'builtin:Exile by Aleksey Hoffman.jpg' },
      { value: 'builtin:Environment Explorations by Marcel van Vuuren.jpg' },
      { value: 'builtin:Canyon by Kevin Lanceplaine.jpg' },
    ];

    const customSelectionIndex = resolveMediaSelectionIndex(
      {
        mediaId: 'Environment Explorations by Marcel van Vuuren.jpg',
        index: 0,
      },
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
      },
      duplicateMediaOptions,
    );

    const builtinSelectionIndex = resolveMediaSelectionIndex(
      {
        mediaId: 'Environment Explorations by Marcel van Vuuren.jpg',
        index: 2,
      },
      {
        defaultMediaId: 'Exile by Aleksey Hoffman.jpg',
      },
      duplicateMediaOptions,
    );

    expect(customSelectionIndex).toBe(0);
    expect(builtinSelectionIndex).toBe(2);
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
