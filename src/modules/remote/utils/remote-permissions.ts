// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 远程权限设置的纯函数层。
//
// 为什么单独成文件：八进制 ↔ rwx 三元组的换算是**最容易在界面里算错**的部分
// （交接文档 §15.4 明确点名了这一条）。它必须是纯函数、能单测，
// 界面只负责显示，不参与任何换算。

/** 权限位最多 4 位八进制（setuid / setgid / sticky + 三组 rwx）。 */
export const MAX_PERMISSION_OCTAL_DIGITS = 4;

/** `chmod` 关心的掩码：低 12 位。 */
export const PERMISSION_BIT_MASK = 0o7777;

/** 一组（所有者 / 组 / 其他）的 rwx。 */
export interface PermissionTriple {
  read: boolean;
  write: boolean;
  execute: boolean;
  /** `rwx` 形式的符号串，缺位用 `-` 占位。 */
  symbolic: string;
}

/** 三组权限的完整描述。 */
export interface PermissionDescription {
  owner: PermissionTriple;
  group: PermissionTriple;
  others: PermissionTriple;
  /** 全部九位拼起来的 `rwxr-xr-x`。 */
  symbolic: string;
}

/**
 * 把一个八进制模式串解析成数值。
 *
 * 只接受 **1–4 位**八进制数字。空串、带 `0o` 前缀、带空格或非八进制字符
 * 一律判为非法（返回 `null`）—— 权限位写错一位就是**放宽或收紧**了别人的
 * 文件权限，猜不得。
 */
export function parseOctalMode(text: string): number | null {
  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_PERMISSION_OCTAL_DIGITS) {
    return null;
  }

  if (!/^[0-7]+$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 8);
}

/** 模式串是否是合法的权限输入。 */
export function isValidOctalModeText(text: string): boolean {
  return parseOctalMode(text) !== null;
}

/**
 * 把权限数值格式化成 `0754` 这样的四位八进制串。
 *
 * 固定四位而不是「有多少位给多少位」：权限对话框里输入 `754` 与 `0754`
 * 指的是同一件事，但**显示成四位**才不会让人以为 `754` 是十进制。
 */
export function formatOctalMode(mode: number): string {
  const safe = Number.isFinite(mode) ? Math.trunc(mode) & PERMISSION_BIT_MASK : 0;

  return safe.toString(8).padStart(MAX_PERMISSION_OCTAL_DIGITS, '0');
}

/** 单组三元组的符号形式：`rwx` / `r-x` / `r--`。 */
export function formatPermissionTriple(value: number): string {
  const read = (value & 0o4) !== 0;
  const write = (value & 0o2) !== 0;
  const execute = (value & 0o1) !== 0;

  return `${read ? 'r' : '-'}${write ? 'w' : '-'}${execute ? 'x' : '-'}`;
}

/**
 * 拆出三组权限。
 *
 * 只取低 9 位（rwx）。setuid / setgid / sticky 这三位**不参与**三元组拆解 ——
 * 它们是「特殊位」，和「谁能读能写能执行」是两件事，混在一起显示会误导人。
 */
export function describePermissionTriples(mode: number): PermissionDescription {
  const safe = Number.isFinite(mode) ? Math.trunc(mode) & PERMISSION_BIT_MASK : 0;

  const ownerValue = (safe >> 6) & 0o7;
  const groupValue = (safe >> 3) & 0o7;
  const othersValue = safe & 0o7;

  function toTriple(value: number): PermissionTriple {
    return {
      read: (value & 0o4) !== 0,
      write: (value & 0o2) !== 0,
      execute: (value & 0o1) !== 0,
      symbolic: formatPermissionTriple(value),
    };
  }

  const owner = toTriple(ownerValue);
  const group = toTriple(groupValue);
  const others = toTriple(othersValue);

  return {
    owner,
    group,
    others,
    symbolic: `${owner.symbolic}${group.symbolic}${others.symbolic}`,
  };
}

/**
 * 「这组权限能不能被递归地拆开」—— 只有目录才有子条目。
 *
 * 递归复选框对文件没有意义，打开它会让用户以为自己会改到别的东西。
 */
export function supportsRecursivePermissions(isDirectory: boolean): boolean {
  return isDirectory;
}

/**
 * 校验一个待提交的权限模式。
 *
 * 返回 `null` 表示合法，否则返回一条**面向用户的原因**。
 */
export function validatePermissionMode(text: string): string | null {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return 'empty';
  }

  const trimmed = text.trim();

  if (trimmed.length > MAX_PERMISSION_OCTAL_DIGITS) {
    return 'tooLong';
  }

  if (!/^[0-7]+$/.test(trimmed)) {
    return 'notOctal';
  }

  return null;
}

/** 校验失败原因 → i18n 键。界面负责翻译，纯函数不碰文案。 */
export function permissionModeValidationKey(reason: string): string {
  switch (reason) {
    case 'empty':
      return 'remote.permissions.error.empty';
    case 'tooLong':
      return 'remote.permissions.error.tooLong';
    case 'notOctal':
      return 'remote.permissions.error.notOctal';
    default:
      return 'remote.permissions.error.unknown';
  }
}
