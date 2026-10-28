// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// The app has no app-wide CSP, so the extension worker is started from a blob
// created inside a hidden iframe whose document carries a restrictive CSP.
// Workers started from a blob URL inherit the CSP of the document that created
// them, which blocks remote `import()` and any other network access from
// extension code without affecting the rest of the app.

type WorkerMessageHandler = ((event: MessageEvent) => void) | null;

export type SandboxedWorker = {
  postMessage: (message: unknown) => void;
  onmessage: WorkerMessageHandler;
  onsetuperror: ((error: unknown) => void) | null;
  terminate: () => void;
};

type WorkerLike = {
  postMessage: (message: unknown) => void;
  onmessage: WorkerMessageHandler;
  terminate: () => void;
};

type SandboxedWorkerFactoryResult = {
  worker: WorkerLike;
  dispose: () => void;
};

export function getUrlOrigin(url: string): string {
  const parsedUrl = new URL(url);
  return `${parsedUrl.protocol}//${parsedUrl.host}`;
}

// `new URL('tauri://localhost').origin` is "null", so the origin is built by hand.
export function buildExtensionWorkerCsp(scriptOrigin: string): string {
  return [
    'default-src \'none\'',
    `script-src ${scriptOrigin} blob:`,
    'connect-src \'none\'',
  ].join('; ');
}

export function buildWorkerBootstrapSource(workerScriptUrl: string): string {
  return `import ${JSON.stringify(workerScriptUrl)};\n`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

export function buildSandboxFrameDocument(csp: string): string {
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`;
}

async function createSandboxFrame(csp: string): Promise<HTMLIFrameElement> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.display = 'none';
  frame.srcdoc = buildSandboxFrameDocument(csp);

  await new Promise<void>((resolve, reject) => {
    frame.addEventListener('load', () => resolve(), { once: true });
    frame.addEventListener('error', () => reject(new Error('Failed to create the extension worker sandbox')), { once: true });
    document.body.append(frame);
  });

  return frame;
}

async function createWorkerInSandboxFrame(workerScriptUrl: string): Promise<SandboxedWorkerFactoryResult> {
  const csp = buildExtensionWorkerCsp(getUrlOrigin(workerScriptUrl));
  const frame = await createSandboxFrame(csp);
  const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;

  if (!frameWindow) {
    frame.remove();
    throw new Error('Failed to access the extension worker sandbox');
  }

  const bootstrapUrl = URL.createObjectURL(new Blob(
    [buildWorkerBootstrapSource(workerScriptUrl)],
    { type: 'text/javascript' },
  ));

  try {
    const worker = new frameWindow.Worker(bootstrapUrl, {
      type: 'module',
      name: 'sigma-extension-worker',
    });

    return {
      worker,
      dispose: () => {
        worker.terminate();
        frame.remove();
        URL.revokeObjectURL(bootstrapUrl);
      },
    };
  }
  catch (error) {
    frame.remove();
    URL.revokeObjectURL(bootstrapUrl);
    throw error;
  }
}

// Returns synchronously. Messages posted before the sandbox is ready are queued.
export function createSandboxedWorker(
  workerScriptUrl: string,
  createWorker: (workerScriptUrl: string) => Promise<SandboxedWorkerFactoryResult> = createWorkerInSandboxFrame,
): SandboxedWorker {
  let activeWorker: WorkerLike | null = null;
  let disposeWorker: (() => void) | null = null;
  let terminated = false;
  const queuedMessages: unknown[] = [];

  const sandboxedWorker: SandboxedWorker = {
    postMessage(message) {
      if (terminated) {
        return;
      }

      if (!activeWorker) {
        queuedMessages.push(message);
        return;
      }

      activeWorker.postMessage(message);
    },
    onmessage: null,
    onsetuperror: null,
    terminate() {
      terminated = true;
      queuedMessages.length = 0;
      disposeWorker?.();
      disposeWorker = null;
      activeWorker = null;
    },
  };

  createWorker(workerScriptUrl).then((result) => {
    if (terminated) {
      result.dispose();
      return;
    }

    activeWorker = result.worker;
    disposeWorker = result.dispose;
    result.worker.onmessage = event => sandboxedWorker.onmessage?.(event);

    for (const queuedMessage of queuedMessages.splice(0)) {
      result.worker.postMessage(queuedMessage);
    }
  }).catch((error) => {
    if (!terminated) {
      sandboxedWorker.onsetuperror?.(error);
    }
  });

  return sandboxedWorker;
}
