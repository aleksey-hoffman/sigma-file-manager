// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import * as sandboxModule from '@/modules/extensions/runtime/sandbox';
import * as runtimeIndex from '@/modules/extensions/runtime';
import { freezeObject, validateExtensionCode } from '@/modules/extensions/runtime/sandbox';

describe('extension code static screen', () => {
  it('accepts benign extension code', () => {
    const result = validateExtensionCode(`
      export function activate(ctx) {
        sigma.ui.showNotification({ message: 'hello ' + ctx.extensionId });
      }
    `);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags direct dynamic-code primitives', () => {
    expect(validateExtensionCode('eval("1")').valid).toBe(false);
    expect(validateExtensionCode('new Function("return 1")').valid).toBe(false);
    expect(validateExtensionCode('x.constructor("return 1")').valid).toBe(false);
  });

  it('flags computed access to constructor / prototype internals', () => {
    expect(validateExtensionCode('const C = ({})["constructor"];').valid).toBe(false);
    expect(validateExtensionCode('const p = obj[\'__proto__\'];').valid).toBe(false);
    expect(validateExtensionCode('const q = fn[`prototype`];').valid).toBe(false);
  });
});

describe('freezeObject', () => {
  it('deep-freezes nested objects', () => {
    const target = {
      a: 1,
      nested: { b: 2 },
    };
    const frozen = freezeObject(target);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
  });
});

describe('isolation boundary regression', () => {
  // The escapable in-process "sandbox" (a denylist/proxy over the host realm's
  // intrinsics) was removed: `api` extensions run in a dedicated Web Worker and
  // `iframe` extensions in a cross-origin sandboxed iframe. Re-introducing a
  // shared-realm sandbox would recreate the computed-constructor escape, so
  // guard against the symbols coming back.
  it('does not export a shared-realm in-process sandbox factory', () => {
    expect('createSandbox' in sandboxModule).toBe(false);
    expect('createSandboxedFunction' in sandboxModule).toBe(false);
    expect('createSandbox' in runtimeIndex).toBe(false);
    expect('createSandboxedFunction' in runtimeIndex).toBe(false);
  });
});
