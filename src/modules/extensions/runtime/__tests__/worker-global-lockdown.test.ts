// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  lockDownWorkerGlobals,
  WORKER_REALM_BLOCKED_GLOBALS,
} from '@/modules/extensions/runtime/worker-global-lockdown';

type WorkerRealm = {
  context: vm.Context;
  scope: Record<string, unknown>;
  networkCalls: string[];
  hostMessages: unknown[];
  run: (code: string) => unknown;
};

// Builds a separate realm whose global mimics a dedicated worker:
// self -> DedicatedWorkerGlobalScope.prototype -> WorkerGlobalScope.prototype
// -> EventTarget.prototype, with network APIs placed where browsers put them.
function createWorkerRealm(): WorkerRealm {
  const networkCalls: string[] = [];
  const hostMessages: unknown[] = [];
  const context = vm.createContext({
    recordNetworkCall: (name: string) => {
      networkCalls.push(name);
    },
    recordHostMessage: (message: unknown) => {
      hostMessages.push(message);
    },
  });

  vm.runInContext(`
    (() => {
      const g = globalThis;

      function EventTarget() {}
      EventTarget.prototype.addEventListener = function addEventListener(type, listener) {
        (this.__listeners ||= []).push({ type, listener });
      };
      EventTarget.prototype.removeEventListener = function removeEventListener() {};
      EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
        for (const entry of this.__listeners || []) {
          if (entry.type === event.type) entry.listener(event);
        }
        return true;
      };

      function WorkerGlobalScope() {}
      WorkerGlobalScope.prototype = Object.create(EventTarget.prototype);
      WorkerGlobalScope.prototype.constructor = WorkerGlobalScope;
      WorkerGlobalScope.prototype.fetch = function fetch() {
        recordNetworkCall('fetch');
        return Promise.resolve('network');
      };
      WorkerGlobalScope.prototype.importScripts = function importScripts() {
        recordNetworkCall('importScripts');
      };
      Object.defineProperty(WorkerGlobalScope.prototype, 'navigator', {
        configurable: true,
        enumerable: true,
        get() {
          return { sendBeacon: () => recordNetworkCall('sendBeacon') };
        },
      });
      Object.defineProperty(WorkerGlobalScope.prototype, 'fonts', {
        configurable: true,
        enumerable: true,
        get() {
          return {};
        },
      });

      function DedicatedWorkerGlobalScope() {}
      DedicatedWorkerGlobalScope.prototype = Object.create(WorkerGlobalScope.prototype);
      DedicatedWorkerGlobalScope.prototype.constructor = DedicatedWorkerGlobalScope;
      DedicatedWorkerGlobalScope.prototype.postMessage = function postMessage(message) {
        recordHostMessage(message);
      };
      DedicatedWorkerGlobalScope.prototype.close = function close() {};

      Object.setPrototypeOf(g, DedicatedWorkerGlobalScope.prototype);

      const defineInterface = (name, ctor) => {
        Object.defineProperty(g, name, { configurable: true, writable: true, value: ctor });
      };
      defineInterface('EventTarget', EventTarget);
      defineInterface('WorkerGlobalScope', WorkerGlobalScope);
      defineInterface('DedicatedWorkerGlobalScope', DedicatedWorkerGlobalScope);
      defineInterface('XMLHttpRequest', function XMLHttpRequest() {
        recordNetworkCall('XMLHttpRequest');
      });
      defineInterface('WebSocket', function WebSocket() {
        recordNetworkCall('WebSocket');
      });
      defineInterface('EventSource', function EventSource() {
        recordNetworkCall('EventSource');
      });
      defineInterface('Worker', function Worker() {
        recordNetworkCall('Worker');
      });
      defineInterface('FontFace', function FontFace() {
        recordNetworkCall('FontFace');
      });
      g.self = g;
    })();
  `, context);

  const scope = vm.runInContext('globalThis', context) as Record<string, unknown>;

  return {
    context,
    scope,
    networkCalls,
    hostMessages,
    run: (code: string) => vm.runInContext(code, context),
  };
}

function createLockedRealm(): WorkerRealm & { emitToHost: (message: unknown) => void } {
  const realm = createWorkerRealm();
  const nativePostMessage = realm.scope.postMessage as (message: unknown) => void;
  const emitToHost = nativePostMessage.bind(realm.scope);
  const nativeAddEventListener = realm.scope.addEventListener as (type: string, listener: (event: unknown) => void) => void;
  nativeAddEventListener.call(realm.scope, 'message', (event) => {
    emitToHost({
      echo: (event as { data: unknown }).data,
    });
  });
  lockDownWorkerGlobals(realm.scope);

  return {
    ...realm,
    emitToHost,
  };
}

const networkNames = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'FontFace', 'importScripts'];

const escapeAttempts: Array<[string, (name: string) => string]> = [
  ['plain access', name => `self.${name}`],
  ['delete then access', name => `(delete self.${name}, self.${name})`],
  ['delete via globalThis then access', name => `(delete globalThis.${name}, globalThis.${name})`],
  ['Reflect.deleteProperty then Reflect.get', name => `(Reflect.deleteProperty(self, '${name}'), Reflect.get(self, '${name}'))`],
  ['computed key', name => `self['${name.slice(0, 2)}' + '${name.slice(2)}']`],
  ['unicode-escaped global identifier', name => `global\\u0054his['${name}']`],
  ['Object.getPrototypeOf(self)', name => `Object.getPrototypeOf(self).${name}`],
  ['grandparent prototype', name => `Object.getPrototypeOf(Object.getPrototypeOf(self)).${name}`],
  ['self.constructor.prototype', name => `self.constructor.prototype.${name}`],
  ['WorkerGlobalScope.prototype via captured reference', name => `Object.getPrototypeOf(DedicatedWorkerGlobalScope.prototype).${name}`],
  ['__proto__ chain', name => `self.__proto__.__proto__.${name}`],
  ['own descriptor', name => `Object.getOwnPropertyDescriptor(self, '${name}').value`],
  ['prototype descriptors', name => `(() => {
    let found;
    for (let p = Object.getPrototypeOf(self); p; p = Object.getPrototypeOf(p)) {
      const d = Object.getOwnPropertyDescriptor(p, '${name}');
      if (d) found = d.value || d.get;
    }
    return found;
  })()`],
  ['redefine then read', name => `(() => {
    try { Object.defineProperty(self, '${name}', { value: 1, configurable: true }); } catch {}
    return Object.getOwnPropertyDescriptor(self, '${name}').value;
  })()`],
  ['assignment then read', name => `(() => {
    try { self.${name} = 1; } catch {}
    return self.${name};
  })()`],
  ['setPrototypeOf swap', name => `(() => {
    try { Object.setPrototypeOf(self, null); } catch {}
    return self.${name};
  })()`],
];

describe('lockDownWorkerGlobals', () => {
  it('blocks network and nested realm globals by default', () => {
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'WebTransport', 'importScripts', 'Worker', 'SharedWorker', 'caches', 'FontFace', 'eval', 'Function']) {
      expect(WORKER_REALM_BLOCKED_GLOBALS).toContain(name);
    }
  });

  it('exposes network APIs before the lockdown (sanity check)', () => {
    const realm = createWorkerRealm();
    realm.run('delete self.fetch; self.fetch("https://example.com")');
    expect(realm.networkCalls).toEqual(['fetch']);
  });

  for (const [label, buildExpression] of escapeAttempts) {
    it(`yields no network API via ${label}`, () => {
      const realm = createLockedRealm();

      for (const name of networkNames) {
        const result = realm.run(`(() => { try { return ${buildExpression(name)}; } catch { return undefined; } })()`);
        expect(result, `${name} via ${label}`).toBeUndefined();
      }

      expect(realm.networkCalls).toEqual([]);
    });
  }

  it('makes calling network APIs throw instead of reaching the network', () => {
    const realm = createLockedRealm();
    const notCallable = /is not a (function|constructor)/;
    expect(() => realm.run('delete self.fetch; fetch("https://example.com")')).toThrow(notCallable);
    expect(() => realm.run('new XMLHttpRequest()')).toThrow(notCallable);
    expect(() => realm.run('new WebSocket("wss://example.com")')).toThrow(notCallable);
    expect(() => realm.run('new self["Wor" + "ker"]("blob:x")')).toThrow(notCallable);
    expect(realm.networkCalls).toEqual([]);
  });

  it('defines blocked globals as non-configurable, non-writable undefined', () => {
    const realm = createLockedRealm();

    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'navigator', 'postMessage', 'eval', 'Function']) {
      expect(Object.getOwnPropertyDescriptor(realm.scope, name)).toEqual({
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    }
  });

  it('blocks navigator, postMessage and event methods on the global', () => {
    const realm = createLockedRealm();
    expect(realm.run('self.navigator')).toBeUndefined();
    expect(realm.run('Object.getPrototypeOf(self).postMessage')).toBeUndefined();
    expect(realm.run('(delete self.postMessage, self.postMessage)')).toBeUndefined();
    expect(realm.run('(delete self.addEventListener, self.addEventListener)')).toBeUndefined();
  });

  it('keeps EventTarget.prototype intact for other event targets', () => {
    const realm = createLockedRealm();
    expect(realm.run('typeof EventTarget.prototype.addEventListener')).toBe('function');
    expect(realm.run(`(() => {
      const target = new EventTarget();
      let fired = false;
      target.addEventListener('ping', () => { fired = true; });
      target.dispatchEvent({ type: 'ping' });
      return fired;
    })()`)).toBe(true);
  });

  it('keeps the host bridge working through references captured before the lockdown', () => {
    const realm = createLockedRealm();
    realm.emitToHost({
      type: 'bridge-call',
      method: 'http.request',
    });
    const dispatchEvent = realm.run('EventTarget.prototype.dispatchEvent') as (event: unknown) => boolean;
    dispatchEvent.call(realm.scope, {
      type: 'message',
      data: 'from-host',
    });
    expect(realm.hostMessages).toEqual([
      {
        type: 'bridge-call',
        method: 'http.request',
      },
      { echo: 'from-host' },
    ]);
    expect(realm.networkCalls).toEqual([]);
  });

  it('is idempotent', () => {
    const realm = createLockedRealm();
    expect(() => lockDownWorkerGlobals(realm.scope)).not.toThrow();
    expect(realm.run('self.fetch')).toBeUndefined();
  });

  it('throws when a blocked global cannot be removed from the prototype chain', () => {
    const realm = createWorkerRealm();
    realm.run(`Object.defineProperty(WorkerGlobalScope.prototype, 'fetch', {
      configurable: false,
      get() { return () => 'network'; },
    })`);
    expect(() => lockDownWorkerGlobals(realm.scope)).toThrow(/fetch/);
  });
});
