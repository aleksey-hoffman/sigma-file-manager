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

/**
 * 权限对话框下拉里的**常用预设**。
 *
 * FORK-MODIFICATION 2026-10-19（用户 2026-10-19 23:58 附图要求）：
 * 原来是一个自由输入框，要用户自己敲八进制。截图里那一栏写着 `0644`，
 * 但用户要的是「从常用值里挑」。自由输入框的问题是**输错一位就是放宽或收紧
 * 了别人的权限**，而九成场景根本不需要自定义。
 *
 * 顺序 = 数值升序（按「组」的位再按「其他」的位），扫一遍就能找到自己要的：
 * 先只有所有者能用的（0400/0600/0700），再到组可用的（0640/0660/0740/0750/0770），
 * 最后所有人都能用的（0644/0666/0755/0777）。
 *
 * 只收**四位**八进制（`0400` 而不是 `400`）：对话框里显示的宽度有限，
 * 而 `formatOctalMode` 本来也输出四位，混着写会出现「列表里是 644、当前值是 0644」。
 */
export const PERMISSION_MODE_PRESETS: readonly string[] = [
  '0400',
  '0444',
  '0600',
  '0640',
  '0644',
  '0660',
  '0664',
  '0666',
  '0700',
  '0750',
  '0755',
  '0770',
  '0775',
  '0777',
];

/**
 * 组装下拉的选项：常用预设 + **当前文件真实的那个值**。
 *
 * ⭐ 当前值必须补进去，不能只给预设：远程文件可能本来就是 `0751`、`2640`
 * 这种预设里没有的模式。补进去之后：
 *   - 打开对话框时 `v-model` 有值可对上，不会显示成「没选中任何一项」；
 *   - 用户没动它就点「应用」，改回去的还是原值（等于什么都没改）；
 *   - 用户想微调，也知道现在是从哪儿改的。
 * 静默地把一个预设外的值换掉，比显示不出来糟糕得多。
 *
 * 非法 / 空 / 与预设重复的当前值一律不加 —— 下拉里出现非法项是倒退。
 */
export function buildPermissionModeOptions(currentMode?: string | null): string[] {
  const options = [...PERMISSION_MODE_PRESETS];

  if (typeof currentMode !== 'string') {
    return options;
  }

  const normalized = formatOctalMode(parseOctalMode(currentMode) ?? -1);

  if (currentMode.trim().length === 0 || parseOctalMode(currentMode) === null) {
    return options;
  }

  if (!options.includes(normalized)) {
    options.push(normalized);
    // 预设都是升序的，补进来的那个未必在末尾。插回有序位置，扫读体验一致。
    options.sort((a, b) => Number.parseInt(a, 8) - Number.parseInt(b, 8));
  }

  return options;
}
