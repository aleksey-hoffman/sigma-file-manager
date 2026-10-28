// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  buildExtensionWorkerCsp,
  buildSandboxFrameDocument,
  buildWorkerBootstrapSource,
  createSandboxedWorker,
  getUrlOrigin,
} from '@/modules/extensions/runtime/sandboxed-worker';

function createFakeWorker() {
  return {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    terminate: vi.fn(),
  };
}

describe('extension worker CSP', () => {
  it('does not allow remote scripts or network connections', () => {
    const csp = buildExtensionWorkerCsp('http://tauri.localhost');
    const directives = Object.fromEntries(csp.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources];
    }));

    expect(directives['default-src']).toEqual(['\'none\'']);
    expect(directives['connect-src']).toEqual(['\'none\'']);
    expect(directives['script-src']).toEqual(['http://tauri.localhost', 'blob:']);
    expect(csp).not.toContain('unsafe');
    expect(csp).not.toContain('*');
  });

  it('builds the origin by hand for custom protocols', () => {
    expect(getUrlOrigin('tauri://localhost/assets/extension-worker.js')).toBe('tauri://localhost');
    expect(getUrlOrigin('http://tauri.localhost/assets/extension-worker.js')).toBe('http://tauri.localhost');
    expect(getUrlOrigin('http://localhost:1420/src/extension-worker.ts?worker_file&type=module')).toBe('http://localhost:1420');
  });

  it('puts the CSP in a meta tag of the sandbox frame document', () => {
    const document = buildSandboxFrameDocument('default-src \'none\'; script-src blob:');

    expect(document).toContain('http-equiv="Content-Security-Policy"');
    expect(document).toContain('content="default-src \'none\'; script-src blob:"');
  });

  it('escapes the CSP so it can not break out of the attribute', () => {
    const document = buildSandboxFrameDocument('a" onload="x');

    expect(document).not.toContain('content="a" onload');
  });

  it('bootstraps the worker by importing its script', () => {
    expect(buildWorkerBootstrapSource('http://localhost:1420/a.js?x=1&y="2"'))
      .toBe('import "http://localhost:1420/a.js?x=1&y=\\"2\\"";\n');
  });
});

describe('createSandboxedWorker', () => {
  it('queues messages until the sandbox is ready and then flushes them in order', async () => {
    const fakeWorker = createFakeWorker();

    let resolveWorker: (value: {
      worker: typeof fakeWorker;
      dispose: () => void;
    }) => void = () => {};

    const factory = vi.fn(() => new Promise<{
      worker: typeof fakeWorker;
      dispose: () => void;
    }>((resolve) => {
      resolveWorker = resolve;
    }));
    const sandboxedWorker = createSandboxedWorker('http://localhost/worker.js', factory);

    sandboxedWorker.postMessage({ id: 1 });
    sandboxedWorker.postMessage({ id: 2 });
    expect(fakeWorker.postMessage).not.toHaveBeenCalled();

    resolveWorker({
      worker: fakeWorker,
      dispose: vi.fn(),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(factory).toHaveBeenCalledWith('http://localhost/worker.js');
    expect(fakeWorker.postMessage.mock.calls.map(call => call[0])).toEqual([{ id: 1 }, { id: 2 }]);

    sandboxedWorker.postMessage({ id: 3 });
    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(3);
  });

  it('forwards worker messages to the current onmessage handler', async () => {
    const fakeWorker = createFakeWorker();
    const sandboxedWorker = createSandboxedWorker('http://localhost/worker.js', async () => ({
      worker: fakeWorker,
      dispose: vi.fn(),
    }));
    const handler = vi.fn();
    sandboxedWorker.onmessage = handler;
    await Promise.resolve();
    await Promise.resolve();

    const event = { data: { type: 'bridge-response' } } as MessageEvent;
    fakeWorker.onmessage?.(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('disposes a worker that finishes starting after terminate', async () => {
    const fakeWorker = createFakeWorker();
    const dispose = vi.fn();
    const sandboxedWorker = createSandboxedWorker('http://localhost/worker.js', async () => ({
      worker: fakeWorker,
      dispose,
    }));

    sandboxedWorker.postMessage({ id: 1 });
    sandboxedWorker.terminate();
    await Promise.resolve();
    await Promise.resolve();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(fakeWorker.postMessage).not.toHaveBeenCalled();
  });

  it('disposes the worker on terminate and ignores later messages', async () => {
    const fakeWorker = createFakeWorker();
    const dispose = vi.fn();
    const sandboxedWorker = createSandboxedWorker('http://localhost/worker.js', async () => ({
      worker: fakeWorker,
      dispose,
    }));
    await Promise.resolve();
    await Promise.resolve();

    sandboxedWorker.terminate();
    sandboxedWorker.postMessage({ id: 1 });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(fakeWorker.postMessage).not.toHaveBeenCalled();
  });

  it('reports a failed sandbox setup', async () => {
    const setupError = new Error('no sandbox');
    const sandboxedWorker = createSandboxedWorker('http://localhost/worker.js', async () => {
      throw setupError;
    });
    const onSetupError = vi.fn();
    sandboxedWorker.onsetuperror = onSetupError;
    await Promise.resolve();
    await Promise.resolve();

    expect(onSetupError).toHaveBeenCalledWith(setupError);
  });
});
