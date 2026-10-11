// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getDriveShortLabel } from '../drive-short-label';

describe('getDriveShortLabel', () => {
  it('returns the drive letter without the colon', () => {
    // 去冒号是刻意设计：侧栏只有 24px 宽，字高已放大到 12px，
    // 冒号不增加辨识度却占掉描边留白，反而让字母更难认。
    expect(getDriveShortLabel('C:\\')).toBe('C');
    expect(getDriveShortLabel('D:\\')).toBe('D');
    expect(getDriveShortLabel('E:\\')).toBe('E');
    expect(getDriveShortLabel('F:\\')).toBe('F');
  });

  it('uppercases lowercase drive letters', () => {
    // sysinfo 在某些环境返回小写盘符，统一大写才能与目录树里的写法一致
    expect(getDriveShortLabel('c:\\')).toBe('C');
  });

  it('accepts a drive letter without a trailing separator', () => {
    expect(getDriveShortLabel('D:')).toBe('D');
  });

  it('does not mistake a drive-letter-like prefix for a drive letter', () => {
    // 反例：首字符是字母+冒号，但不是合法盘符（超过 1 个字母）
    expect(getDriveShortLabel('ab:/data')).not.toBe('AB');
    expect(getDriveShortLabel('ab:/data')).toBe('data');
  });

  it('keeps the volume name of a UNC path', () => {
    expect(getDriveShortLabel('\\\\server\\share')).toBe('share');
    expect(getDriveShortLabel('\\\\server\\share\\')).toBe('share');
  });

  it('truncates long UNC volume names instead of overflowing the sidebar', () => {
    const label = getDriveShortLabel('\\\\server\\a-very-long-volume-name');
    // 反例：若没有截断，这里会是 20 字符，会撑破 24px 侧栏
    expect(label.length).toBe(8);
    expect(label.endsWith('…')).toBe(true);
  });

  it('handles unix mount points', () => {
    expect(getDriveShortLabel('/')).toBe('/');
    expect(getDriveShortLabel('/data')).toBe('data');
    expect(getDriveShortLabel('/mnt/backup')).toBe('backup');
    expect(getDriveShortLabel('/data/')).toBe('data');
  });

  it('returns an empty string for missing input instead of throwing', () => {
    // 反例：mount_point 缺失时若抛异常，会把整个侧栏渲染炸掉
    expect(getDriveShortLabel('')).toBe('');
    expect(getDriveShortLabel(null)).toBe('');
    expect(getDriveShortLabel(undefined)).toBe('');
  });

  it('produces distinct single-char labels for distinct volumes', () => {
    // 这正是本次改动的目的：图标都长一样，靠标签区分分区
    const labels = ['C:\\', 'D:\\', 'E:\\', 'F:\\'].map(getDriveShortLabel);

    expect(labels).toEqual(['C', 'D', 'E', 'F']);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
