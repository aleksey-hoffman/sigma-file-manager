// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  ExtensionManifest,
  ExtensionInstance,
  ExtensionType,
  ExtensionActivationEvent,
  ExtensionActivateContext,
} from '@/types/extension';
import type { SigmaExtensionAPI } from '@/modules/extensions/api';
import {
  createExtensionAPI,
  registerExtensionConfiguration,
  registerExtensionKeybindings,
  clearExtensionRegistrations,
  clearExtensionActivationRegistrations,
} from '@/modules/extensions/api';
import { type ExtensionSandbox, validateExtensionCode } from './sandbox';
import { createExtensionApiMethodMap } from '@/modules/extensions/runtime/api-method-map';
import { createWorkerHost, type WorkerHost } from '@/modules/extensions/runtime/worker-runtime';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

export type LoadedExtensionRuntime = {
  id: string;
  manifest: ExtensionManifest;
  instance: ExtensionInstance | null;
  sandbox: ExtensionSandbox | null;
  workerHost: WorkerHost | null;
  iframeElement: HTMLIFrameElement | null;
  iframeOrigin: string | null;
  removeMessageListener: (() => void) | null;
  api?: SigmaExtensionAPI;
  activationContext?: ExtensionActivateContext;
};

const loadedRuntimes = new Map<string, LoadedExtensionRuntime>();

export async function loadExtensionRuntime(
  extensionId: string,
  manifest: ExtensionManifest,
  activationEvent: ExtensionActivationEvent = 'onStartup',
): Promise<LoadedExtensionRuntime> {
  if (loadedRuntimes.has(extensionId)) {
    return loadedRuntimes.get(extensionId)!;
  }

  const runtime: LoadedExtensionRuntime = {
    id: extensionId,
    manifest,
    instance: null,
    sandbox: null,
    workerHost: null,
    iframeElement: null,
    iframeOrigin: null,
    removeMessageListener: null,
  };

  loadedRuntimes.set(extensionId, runtime);

  try {
    switch (manifest.extensionType) {
      case 'api':
        await loadApiExtension(runtime, activationEvent);
        break;
      case 'iframe':
        await loadIframeExtension(runtime, activationEvent);
        break;
      case 'webview':
        await loadWebviewExtension(runtime, activationEvent);
        break;
    }
  }
  catch (error) {
    if (loadedRuntimes.get(extensionId) === runtime) {
      loadedRuntimes.delete(extensionId);
    }

    throw error;
  }

  return runtime;
}

export async function unloadExtensionRuntime(extensionId: string): Promise<void> {
  const runtime = loadedRuntimes.get(extensionId);

  if (!runtime) return;

  if (runtime.instance?.deactivate) {
    try {
      await runtime.instance.deactivate();
    }
    catch (error) {
      console.error(`Failed to deactivate extension ${extensionId}:`, error);
    }
  }

  if (runtime.sandbox) {
    runtime.sandbox.destroy();
  }

  if (runtime.workerHost) {
    runtime.workerHost.destroy();
  }

  if (runtime.iframeElement) {
    runtime.iframeElement.remove();
  }

  if (runtime.removeMessageListener) {
    runtime.removeMessageListener();
  }

  loadedRuntimes.delete(extensionId);
}

export function getLoadedRuntime(extensionId: string): LoadedExtensionRuntime | undefined {
  return loadedRuntimes.get(extensionId);
}

export function getExtensionAPI(extensionId: string): SigmaExtensionAPI | undefined {
  return loadedRuntimes.get(extensionId)?.api;
}

export function getAllLoadedRuntimes(): LoadedExtensionRuntime[] {
  return Array.from(loadedRuntimes.values());
}

export async function reactivateExtensionRuntime(extensionId: string): Promise<void> {
  const runtime = loadedRuntimes.get(extensionId);

  if (!runtime?.workerHost || !runtime.activationContext) return;

  clearExtensionActivationRegistrations(extensionId);
  await runtime.workerHost.deactivate();
  runtime.workerHost.disposeActivationResources();

  const reactivationContext: ExtensionActivateContext = {
    ...runtime.activationContext,
    activationEvent: 'onStartup',
  };
  runtime.activationContext = reactivationContext;

  await runtime.workerHost.activate(reactivationContext);
}

async function loadApiExtension(
  runtime: LoadedExtensionRuntime,
  activationEvent: ExtensionActivationEvent,
): Promise<void> {
  const { id: extensionId, manifest } = runtime;

  const extensionPath = await invokeAsExtension<string>(extensionId, 'get_extension_path', { extensionId });
  const storagePath = await invokeAsExtension<string>(extensionId, 'get_extension_storage_path', { extensionId });
  const mainFile = manifest.main || 'index.js';
  const entryUrl = `${convertFileSrc(`${extensionPath}/${mainFile}`)}?runtime=${Date.now()}`;

  const fileExists = await invokeAsExtension<boolean>(extensionId, 'extension_path_exists', {
    extensionId,
    filePath: mainFile,
  });

  if (!fileExists) {
    throw new Error(`Extension ${extensionId} main file not found: ${mainFile}`);
  }

  if (manifest.contributes?.configuration) {
    registerExtensionConfiguration(extensionId, manifest.contributes.configuration);
  }

  if (manifest.contributes?.keybindings) {
    registerExtensionKeybindings(extensionId, manifest.contributes.keybindings);
  }

  const api = createExtensionAPI(extensionId, manifest.permissions);
  runtime.api = api;
  runtime.workerHost = createWorkerHost(api);

  try {
    const fileContent = await invokeAsExtension<number[]>(extensionId, 'read_extension_file', {
      extensionId,
      filePath: mainFile,
    });

    const decoder = new TextDecoder();
    const code = decoder.decode(new Uint8Array(fileContent));
    const validationResult = validateExtensionCode(code);

    if (!validationResult.valid) {
      throw new Error(`Extension code validation failed: ${validationResult.errors.join(', ')}`);
    }

    await runtime.workerHost.initialize(entryUrl);

    runtime.instance = {
      activate: async (ctx) => {
        if (ctx) {
          await runtime.workerHost?.activate(ctx);
        }
      },
      deactivate: async () => {
        await runtime.workerHost?.deactivate();
      },
    };

    if (runtime.instance) {
      const activationContext: ExtensionActivateContext = {
        extensionId,
        extensionPath,
        storagePath,
        activationEvent,
      };
      runtime.activationContext = activationContext;
      await runtime.instance.activate(activationContext);
    }
  }
  catch (error) {
    clearExtensionRegistrations(extensionId);

    if (runtime.workerHost) {
      runtime.workerHost.destroy();
      runtime.workerHost = null;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load extension ${extensionId}: ${message}`);
    throw error;
  }
}

async function loadIframeExtension(
  runtime: LoadedExtensionRuntime,
  activationEvent: ExtensionActivationEvent,
): Promise<void> {
  const { id: extensionId, manifest } = runtime;

  const iframe = document.createElement('iframe');
  iframe.id = `extension-iframe-${extensionId}`;
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.display = 'none';

  const extensionPath = await invokeAsExtension<string>(extensionId, 'get_extension_path', { extensionId });
  const storagePath = await invokeAsExtension<string>(extensionId, 'get_extension_storage_path', { extensionId });
  const mainFile = manifest.main || 'index.html';

  const iframeSource = convertFileSrc(`${extensionPath}/${mainFile}`);
  iframe.src = iframeSource;
  runtime.iframeOrigin = new URL(iframeSource).origin;

  if (manifest.contributes?.configuration) {
    registerExtensionConfiguration(extensionId, manifest.contributes.configuration);
  }

  if (manifest.contributes?.keybindings) {
    registerExtensionKeybindings(extensionId, manifest.contributes.keybindings);
  }

  const api = createExtensionAPI(extensionId, manifest.permissions);
  runtime.api = api;

  function messageListener(event: MessageEvent): void {
    if (event.source !== iframe.contentWindow) return;
    if (!runtime.iframeOrigin || event.origin !== runtime.iframeOrigin) return;
    handleIframeMessage(extensionId, event.data, api);
  }

  window.addEventListener('message', messageListener);
  runtime.removeMessageListener = () => window.removeEventListener('message', messageListener);

  document.body.appendChild(iframe);
  runtime.iframeElement = iframe;

  runtime.instance = {
    activate: async () => {
      iframe.contentWindow?.postMessage({
        type: 'activate',
        context: {
          extensionId,
          extensionPath,
          storagePath,
          activationEvent,
        },
      }, runtime.iframeOrigin ?? '*');
    },
    deactivate: async () => {
      iframe.contentWindow?.postMessage({
        type: 'deactivate',
      }, runtime.iframeOrigin ?? '*');
    },
  };
}

async function loadWebviewExtension(
  runtime: LoadedExtensionRuntime,
  activationEvent: ExtensionActivationEvent,
): Promise<void> {
  void activationEvent;
  runtime.instance = createPlaceholderInstance();
}

function handleIframeMessage(
  extensionId: string,
  data: unknown,
  api: ReturnType<typeof createExtensionAPI>,
): void {
  if (!data || typeof data !== 'object') return;

  const message = data as { type: string;
    method?: string;
    args?: unknown[];
    id?: string; };

  if (message.type === 'api-call' && message.method) {
    const methodMap = createExtensionApiMethodMap(api);
    const handler = methodMap[message.method];

    if (!handler) {
      postMessageToExtension(extensionId, {
        type: 'api-response',
        id: message.id,
        error: `Extension API method is not allowed: ${message.method}`,
      });
      return;
    }

    const result = handler(...(message.args || []));

    if (result instanceof Promise) {
      result.then((value) => {
        postMessageToExtension(extensionId, {
          type: 'api-response',
          id: message.id,
          result: value,
        });
      }).catch((error) => {
        postMessageToExtension(extensionId, {
          type: 'api-response',
          id: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    else {
      postMessageToExtension(extensionId, {
        type: 'api-response',
        id: message.id,
        result,
      });
    }
  }
}

function postMessageToExtension(extensionId: string, message: unknown): void {
  const runtime = loadedRuntimes.get(extensionId);

  if (runtime?.iframeElement?.contentWindow) {
    runtime.iframeElement.contentWindow.postMessage(
      message,
      runtime.iframeOrigin ?? '*',
    );
  }
}

function createPlaceholderInstance(): ExtensionInstance {
  return {
    activate: async () => {},
    deactivate: async () => {},
  };
}

export function isExtensionTypeSupported(type: ExtensionType): boolean {
  return ['api', 'iframe', 'webview'].includes(type);
}
