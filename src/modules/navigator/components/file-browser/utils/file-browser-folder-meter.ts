// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const METER_MIN_EXPONENT = 3;
const METER_EXPONENT_SPAN = 9;
const METER_MIN_VISIBLE_FRACTION = 0.04;

/**
 * Maps a folder size to the lit part of the folder meter on a log scale:
 * 1 KB is the start of the meter, 1 MB, 1 GB and 1 TB sit at 1/3, 2/3 and the end.
 * Any non-empty folder lights at least a sliver so it never reads as empty.
 */
export function getFolderMeterFraction(sizeBytes: number | null | undefined): number {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return 0;
  }

  const fraction = (Math.log10(sizeBytes) - METER_MIN_EXPONENT) / METER_EXPONENT_SPAN;

  return Math.min(1, Math.max(METER_MIN_VISIBLE_FRACTION, fraction));
}
