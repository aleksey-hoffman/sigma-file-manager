// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export default function toReadableBytes(bytes: number, decimals?: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const base = 1024;
  const exp = Math.floor(Math.log(bytes) / Math.log(base));
  const value = bytes / Math.pow(base, exp);
  const precision = exp > 0 ? decimals ?? 1 : 0;
  return `${value.toFixed(precision)} ${units[exp]}`;
}
