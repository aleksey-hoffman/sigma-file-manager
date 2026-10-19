// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  MAX_PERMISSION_OCTAL_DIGITS,
  PERMISSION_BIT_MASK,
  describePermissionTriples,
  formatOctalMode,
  formatPermissionTriple,
  isValidOctalModeText,
  parseOctalMode,
  permissionModeValidationKey,
  supportsRecursivePermissions,
  validatePermissionMode,
} from '../remote-permissions';

// 这些换算是「权限对话框里最容易算错」的部分（交接文档 §15.4 点名过）。
// 每一组都钉住**具体数值**，不只钉住「不崩」。

describe('parseOctalMode', () => {
  it('把三位与四位八进制串解析成同一个数值', () => {
    expect(parseOctalMode('754')).toBe(0o754);
    expect(parseOctalMode('0754')).toBe(0o754);
  });

  it('解析特殊位（setuid / setgid / sticky）', () => {
    expect(parseOctalMode('4755')).toBe(0o4755);
    expect(parseOctalMode('2755')).toBe(0o2755);
    expect(parseOctalMode('1755')).toBe(0o1755);
    expect(parseOctalMode('7777')).toBe(0o7777);
  });

  it('忽略首尾空白', () => {
    expect(parseOctalMode('  0754  ')).toBe(0o754);
  });

  it('空串与纯空白一律判非法 —— 权限位猜不得', () => {
    expect(parseOctalMode('')).toBeNull();
    expect(parseOctalMode('   ')).toBeNull();
  });

  it('带 0o 前缀的判非法（用户会从命令行习惯带过来）', () => {
    expect(parseOctalMode('0o755')).toBeNull();
  });

  it('出现 8 或 9 一律判非法', () => {
    expect(parseOctalMode('8')).toBeNull();
    expect(parseOctalMode('0999')).toBeNull();
    expect(parseOctalMode('7a4')).toBeNull();
  });

  it('超过四位判非法', () => {
    expect(parseOctalMode('00754')).toBeNull();
    expect(parseOctalMode('12345')).toBeNull();
  });

  it('最大合法长度就是四位', () => {
    expect(MAX_PERMISSION_OCTAL_DIGITS).toBe(4);
    expect(parseOctalMode('4755')).not.toBeNull();
    expect(parseOctalMode('04755')).toBeNull();
  });

  it('非字符串输入不炸', () => {
    expect(parseOctalMode(undefined as unknown as string)).toBeNull();
    expect(parseOctalMode(null as unknown as string)).toBeNull();
    expect(parseOctalMode(755 as unknown as string)).toBeNull();
  });
});

describe('isValidOctalModeText', () => {
  it('与 parseOctalMode 的判定保持一致', () => {
    expect(isValidOctalModeText('0754')).toBe(true);
    expect(isValidOctalModeText('754')).toBe(true);
    expect(isValidOctalModeText('')).toBe(false);
    expect(isValidOctalModeText('0999')).toBe(false);
  });
});

describe('formatOctalMode', () => {
  it('固定补齐四位 —— 0754 与 754 是同一件事，但显示成三位会让人以为是十进制', () => {
    expect(formatOctalMode(0o754)).toBe('0754');
    expect(formatOctalMode(0o644)).toBe('0644');
    expect(formatOctalMode(0)).toBe('0000');
  });

  it('特殊位照样占一位', () => {
    expect(formatOctalMode(0o4755)).toBe('4755');
    expect(formatOctalMode(0o7777)).toBe('7777');
  });

  it('超出掩码的位被截断', () => {
    expect(formatOctalMode(0o10000)).toBe('0000');
    expect(formatOctalMode(0o17777 & PERMISSION_BIT_MASK)).toBe('7777');
  });

  it('非法数值不炸，退化成 0000', () => {
    expect(formatOctalMode(Number.NaN)).toBe('0000');
    expect(formatOctalMode(Number.POSITIVE_INFINITY)).toBe('0000');
  });

  it('与 parseOctalMode 互为逆运算（低 12 位全覆盖）', () => {
    for (let mode = 0; mode <= PERMISSION_BIT_MASK; mode += 1) {
      expect(parseOctalMode(formatOctalMode(mode))).toBe(mode);
    }
  });
});

describe('formatPermissionTriple', () => {
  it('拆出 rwx 三位', () => {
    expect(formatPermissionTriple(0o7)).toBe('rwx');
    expect(formatPermissionTriple(0o5)).toBe('r-x');
    expect(formatPermissionTriple(0o4)).toBe('r--');
    expect(formatPermissionTriple(0o2)).toBe('-w-');
    expect(formatPermissionTriple(0o1)).toBe('--x');
    expect(formatPermissionTriple(0)).toBe('---');
  });
});

describe('describePermissionTriples', () => {
  it('把九位拆成所有者 / 组 / 其他三组', () => {
    const description = describePermissionTriples(0o754);

    expect(description.owner.symbolic).toBe('rwx');
    expect(description.group.symbolic).toBe('r-x');
    expect(description.others.symbolic).toBe('r--');
    expect(description.symbolic).toBe('rwxr-xr--');
  });

  it('各位的布尔标志与符号串一致', () => {
    const description = describePermissionTriples(0o644);

    expect(description.owner.read).toBe(true);
    expect(description.owner.write).toBe(true);
    expect(description.owner.execute).toBe(false);
    expect(description.group.read).toBe(true);
    expect(description.group.write).toBe(false);
    expect(description.group.execute).toBe(false);
    expect(description.others.read).toBe(true);
    expect(description.others.write).toBe(false);
    expect(description.others.execute).toBe(false);
  });

  it('特殊位不参与三元组拆解 —— 「谁能读能写能执行」和 setuid 是两件事', () => {
    const withSpecialBits = describePermissionTriples(0o4755);
    const withoutSpecialBits = describePermissionTriples(0o755);

    expect(withSpecialBits.symbolic).toBe(withoutSpecialBits.symbolic);
    expect(withSpecialBits.symbolic).toBe('rwxr-xr-x');
  });

  it('全 0 拆出三组 ---', () => {
    const description = describePermissionTriples(0);

    expect(description.symbolic).toBe('---------');
  });
});

describe('supportsRecursivePermissions', () => {
  it('只有目录才有子条目可递归', () => {
    expect(supportsRecursivePermissions(true)).toBe(true);
    expect(supportsRecursivePermissions(false)).toBe(false);
  });
});

describe('validatePermissionMode', () => {
  it('合法输入返回 null', () => {
    expect(validatePermissionMode('0754')).toBeNull();
    expect(validatePermissionMode('754')).toBeNull();
    expect(validatePermissionMode('0000')).toBeNull();
    expect(validatePermissionMode(' 0754 ')).toBeNull();
  });

  it('空串是 empty', () => {
    expect(validatePermissionMode('')).toBe('empty');
    expect(validatePermissionMode('    ')).toBe('empty');
  });

  it('超过四位是 tooLong', () => {
    expect(validatePermissionMode('00754')).toBe('tooLong');
  });

  it('含非八进制数字是 notOctal', () => {
    expect(validatePermissionMode('0999')).toBe('notOctal');
    expect(validatePermissionMode('abc')).toBe('notOctal');
  });
});

describe('permissionModeValidationKey', () => {
  it('把校验原因映射到已存在的 i18n 键', () => {
    expect(permissionModeValidationKey('empty')).toBe('remote.permissions.error.empty');
    expect(permissionModeValidationKey('tooLong')).toBe('remote.permissions.error.tooLong');
    expect(permissionModeValidationKey('notOctal')).toBe('remote.permissions.error.notOctal');
  });

  it('未知原因兜底到 unknown，而不是返回 undefined', () => {
    expect(permissionModeValidationKey('???')).toBe('remote.permissions.error.unknown');
    expect(permissionModeValidationKey('')).toBe('remote.permissions.error.unknown');
  });
});
