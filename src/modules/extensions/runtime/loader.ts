// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type {
  ExtensionManifest,
  ExtensionInstance,
  ExtensionType,
  ExtensionActivationEvent,
} from '@/types/extension';
import type { SigmaExtensionAPI } from '@/modules/extensions/api';
import { createExtensionAPI, registerExtensionConfiguration, registerExtensionKeybindings } from '@/modules/extensions/api';
import { createSandbox, type ExtensionSandbox, validateExtensionCode } from './sandbox';

export type LoadedExtensionRuntime = {
  id: string;
  manifest: ExtensionManifest;
  instance: ExtensionInstance | null;
  sandbox: ExtensionSandbox | null;
  iframeElement: HTMLIFrameElement | null;
  iframeOrigin: string | null;
  removeMessageListener: (() => void) | null;
  api?: SigmaExtensionAPI;
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
    iframeElement: null,
    iframeOrigin: null,
    removeMessageListener: null,
  };

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

  loadedRuntimes.set(extensionId, runtime);
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

async function loadApiExtension(
  runtime: LoadedExtensionRuntime,
  activationEvent: ExtensionActivationEvent,
): Promise<void> {
  const { id: extensionId, manifest } = runtime;

  const extensionPath = await invoke<string>('get_extension_path', { extensionId });
  const storagePath = await invoke<string>('get_extension_storage_path', { extensionId });
  const mainFile = manifest.main || 'index.js';

  const fileExists = await invoke<boolean>('extension_path_exists', {
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
  runtime.sandbox = createSandbox(extensionId, api);

  try {
    const fileContent = await invoke<number[]>('read_extension_file', {
      extensionId,
      filePath: mainFile,
    });

    const decoder = new TextDecoder();
    const code = decoder.decode(new Uint8Array(fileContent));
    const validationResult = validateExtensionCode(code);

    if (!validationResult.valid) {
      throw new Error(`Extension code validation failed: ${validationResult.errors.join(', ')}`);
    }

    const moduleExports = runtime.sandbox.evaluate(code);
    const activate = moduleExports.activate as ((context: unknown) => Promise<void> | void) | undefined;
    const deactivate = moduleExports.deactivate as (() => Promise<void> | void) | undefined;

    runtime.instance = {
      activate: activate ? ctx => activate(ctx) : async () => {},
      deactivate: deactivate || (async () => {}),
    };

    if (runtime.instance) {
      await runtime.instance.activate({
        extensionId,
        extensionPath,
        storagePath,
        activationEvent,
      });
    }
  }
  catch (error) {
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

  const extensionPath = await invoke<string>('get_extension_path', { extensionId });
  const storagePath = await invoke<string>('get_extension_storage_path', { extensionId });
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
    const methodPath = message.method.split('.');
    let target: unknown = api;

    for (const part of methodPath) {
      if (target && typeof target === 'object') {
        target = (target as Record<string, unknown>)[part];
      }
      else {
        target = undefined;
        break;
      }
    }

    if (typeof target === 'function') {
      const result = target(...(message.args || []));

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
