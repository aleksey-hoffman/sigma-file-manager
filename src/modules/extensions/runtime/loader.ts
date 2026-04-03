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
import normalizePath from '@/utils/normalize-path';

export type LoadedExtensionRuntime = {
  id: string;
  manifest: ExtensionManifest;
  instance: ExtensionInstance | null;
  sandbox: ExtensionSandbox | null;
  workerHost: WorkerHost | null;
  iframeElement: HTMLIFrameElement | null;
  iframeOrigin: string | null;
  removeMessageListener: (() => void) | null;
  disposeModuleUrls: (() => void) | null;
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
    disposeModuleUrls: null,
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

  if (runtime.disposeModuleUrls) {
    runtime.disposeModuleUrls();
    runtime.disposeModuleUrls = null;
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

function isWindowsAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function getExtensionAssetUrl(extensionPath: string, mainFile: string): string {
  const normalizedExtensionPath = normalizePath(extensionPath).replace(/\/+$/, '');
  const normalizedMainFile = normalizePath(mainFile).replace(/^\/+/, '');
  return convertFileSrc(`${normalizedExtensionPath}/${normalizedMainFile}`);
}

function normalizeExtensionRelativePath(path: string): string {
  return normalizePath(path).replace(/^\/+/, '');
}

function getExtensionRelativeDirectory(path: string): string {
  const normalizedPath = normalizeExtensionRelativePath(path).replace(/\/+$/, '');
  const slashIndex = normalizedPath.lastIndexOf('/');
  return slashIndex === -1 ? '' : normalizedPath.slice(0, slashIndex);
}

function resolveExtensionModulePath(fromPath: string, specifier: string): string {
  const normalizedSpecifier = normalizePath(specifier);

  if (normalizedSpecifier.startsWith('/')) {
    return normalizeExtensionRelativePath(normalizedSpecifier);
  }

  const baseDirectory = getExtensionRelativeDirectory(fromPath);
  const combinedPath = baseDirectory
    ? `${baseDirectory}/${normalizedSpecifier}`
    : normalizedSpecifier;
  const resolvedSegments: string[] = [];

  for (const segment of combinedPath.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (resolvedSegments.length === 0) {
        throw new Error(`Extension module import escapes root: ${specifier}`);
      }

      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join('/');
}

function getRelativeModuleSpecifiers(code: string): Array<{
  start: number;
  end: number;
  specifier: string;
}> {
  const pattern = /\bimport\s*\(\s*(['"])([^'"`]+)\1\s*\)|\bimport\s+(['"])([^'"`]+)\3|\b(?:import|export)\b[^;]+?\bfrom\s+(['"])([^'"`]+)\5/gm;
  const matches: Array<{
    start: number;
    end: number;
    specifier: string;
  }> = [];

  for (const match of code.matchAll(pattern)) {
    const specifier = match[2] ?? match[4] ?? match[6];

    if (!specifier || match.index === undefined) {
      continue;
    }

    const relativeIndex = match[0].lastIndexOf(specifier);

    if (relativeIndex === -1) {
      continue;
    }

    const start = match.index + relativeIndex;
    matches.push({
      start,
      end: start + specifier.length,
      specifier,
    });
  }

  return matches;
}

async function createBlobModuleEntry(
  extensionId: string,
  mainFile: string,
): Promise<{
  entryUrl: string;
  dispose: () => void;
}> {
  const moduleUrlCache = new Map<string, string>();
  const createdModuleUrls: string[] = [];
  const textDecoder = new TextDecoder();

  async function loadModule(modulePath: string): Promise<string> {
    const normalizedModulePath = normalizeExtensionRelativePath(modulePath);
    const cachedModuleUrl = moduleUrlCache.get(normalizedModulePath);

    if (cachedModuleUrl) {
      return cachedModuleUrl;
    }

    const fileContent = await invokeAsExtension<number[]>(extensionId, 'read_extension_file', {
      extensionId,
      filePath: normalizedModulePath,
    });
    const sourceCode = textDecoder.decode(new Uint8Array(fileContent));
    const specifiers = getRelativeModuleSpecifiers(sourceCode);
    const replacements = await Promise.all(specifiers.map(async (match) => {
      if (!match.specifier.startsWith('./') && !match.specifier.startsWith('../') && !match.specifier.startsWith('/')) {
        return null;
      }

      const resolvedModulePath = resolveExtensionModulePath(normalizedModulePath, match.specifier);
      const resolvedModuleUrl = await loadModule(resolvedModulePath);

      return {
        start: match.start,
        end: match.end,
        replacement: resolvedModuleUrl,
      };
    }));

    let rewrittenSource = sourceCode;

    for (const replacement of replacements.filter((value): value is NonNullable<typeof value> => value !== null).reverse()) {
      rewrittenSource = `${rewrittenSource.slice(0, replacement.start)}${replacement.replacement}${rewrittenSource.slice(replacement.end)}`;
    }

    const moduleUrl = URL.createObjectURL(new Blob([rewrittenSource], { type: 'text/javascript' }));
    moduleUrlCache.set(normalizedModulePath, moduleUrl);
    createdModuleUrls.push(moduleUrl);
    return moduleUrl;
  }

  return {
    entryUrl: await loadModule(mainFile),
    dispose: () => {
      for (const moduleUrl of createdModuleUrls) {
        URL.revokeObjectURL(moduleUrl);
      }
    },
  };
}

export async function reactivateExtensionRuntime(extensionId: string): Promise<void> {
  const runtime = loadedRuntimes.get(extensionId);

  if (!runtime?.workerHost || !runtime.activationContext) return;

  clearExtensionActivationRegistrations(extensionId);
  await runtime.workerHost.deactivate();
  runtime.workerHost.disposeActivationResources();

  const reactivationContext: ExtensionActivateContext = {
    ...runtime.activationContext,
    activationEvent: 'onLocaleChange',
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
    const moduleEntry = isWindowsAbsolutePath(extensionPath)
      ? await createBlobModuleEntry(extensionId, mainFile)
      : {
          entryUrl: `${getExtensionAssetUrl(extensionPath, mainFile)}?runtime=${Date.now()}`,
          dispose: () => {},
        };

    if (!validationResult.valid) {
      throw new Error(`Extension code validation failed: ${validationResult.errors.join(', ')}`);
    }

    runtime.disposeModuleUrls = moduleEntry.dispose;

    await runtime.workerHost.initialize(moduleEntry.entryUrl);

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

    if (runtime.disposeModuleUrls) {
      runtime.disposeModuleUrls();
      runtime.disposeModuleUrls = null;
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

  const iframeSource = getExtensionAssetUrl(extensionPath, mainFile);
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

  const message = data as {
    type: string;
    method?: string;
    args?: unknown[];
    id?: string;
  };

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
