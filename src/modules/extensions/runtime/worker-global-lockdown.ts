// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Globals removed from the extension worker global and from every object in its
// prototype chain, so they can't be recovered with delete or prototype lookups.
export const WORKER_REALM_BLOCKED_GLOBALS = [
  'fetch',
  'fetchLater',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'EventSource',
  'WebTransport',
  'RTCPeerConnection',
  'webkitRTCPeerConnection',
  'importScripts',
  'Worker',
  'SharedWorker',
  'caches',
  'CacheStorage',
  'Cache',
  'FontFace',
  'fonts',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'navigator',
  'document',
  'window',
  'parent',
  'top',
  'frames',
  'opener',
  'close',
  'postMessage',
  'eval',
  'Function',
] as const;

// Globals shadowed only on the worker global. They live on EventTarget.prototype,
// which other event targets in the worker still need.
export const WORKER_SCOPE_SHADOWED_GLOBALS = [
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
] as const;

type PropertyBag = Record<PropertyKey, unknown>;

function getPrototypeChain(scope: object): object[] {
  const chain: object[] = [];
  let current: object | null = Object.getPrototypeOf(scope);

  while (current) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }

  return chain;
}

function hasOwn(target: object, name: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, name);
}

function isLockedUndefined(target: object, name: PropertyKey): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);

  return descriptor !== undefined
    && descriptor.configurable === false
    && 'value' in descriptor
    && descriptor.value === undefined
    && descriptor.writable === false;
}

function removeFromPrototype(target: object, name: PropertyKey): void {
  if (!hasOwn(target, name)) {
    return;
  }

  try {
    Reflect.deleteProperty(target, name);
  }
  catch {}

  if (!hasOwn(target, name)) {
    return;
  }

  try {
    Object.defineProperty(target, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  }
  catch {
    try {
      (target as PropertyBag)[name] = undefined;
    }
    catch {}
  }
}

function lockOnScope(scope: object, name: PropertyKey): void {
  if (isLockedUndefined(scope, name)) {
    return;
  }

  try {
    Reflect.deleteProperty(scope, name);
  }
  catch {}

  try {
    Object.defineProperty(scope, name, {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  catch {}
}

function isNeutralized(scope: object, chain: object[], name: PropertyKey, checkChain: boolean): boolean {
  if (!isLockedUndefined(scope, name)) {
    return false;
  }

  if (!checkChain) {
    return true;
  }

  return chain.every((target) => {
    if (!hasOwn(target, name)) {
      return true;
    }

    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    return descriptor !== undefined && 'value' in descriptor && descriptor.value === undefined;
  });
}

// Throws if any name could not be neutralized, so the caller can refuse to
// run extension code in a partially restricted realm.
export function lockDownWorkerGlobals(
  scope: object,
  options: {
    blocked?: readonly PropertyKey[];
    shadowed?: readonly PropertyKey[];
  } = {},
): void {
  const blocked = options.blocked ?? WORKER_REALM_BLOCKED_GLOBALS;
  const shadowed = options.shadowed ?? WORKER_SCOPE_SHADOWED_GLOBALS;
  const chain = getPrototypeChain(scope);
  const failed: string[] = [];

  for (const name of blocked) {
    for (const target of chain) {
      removeFromPrototype(target, name);
    }

    lockOnScope(scope, name);

    if (!isNeutralized(scope, chain, name, true)) {
      failed.push(String(name));
    }
  }

  for (const name of shadowed) {
    lockOnScope(scope, name);

    if (!isNeutralized(scope, chain, name, false)) {
      failed.push(String(name));
    }
  }

  if (failed.length > 0) {
    throw new Error(`Failed to restrict worker globals: ${failed.join(', ')}`);
  }
}
