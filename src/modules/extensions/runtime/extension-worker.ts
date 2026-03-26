// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { createI18n } from 'vue-i18n';
import { messages as appMessages } from '@/localization/data';
import { pluralRules } from '@/localization/plural-rules';
import { createRequestId } from '@/modules/extensions/runtime/worker-protocol';
import type {
  HostToWorkerMessage,
  WorkerRuntimeMessage,
  WorkerToHostMessage,
} from '@/modules/extensions/runtime/worker-protocol';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type ProgressState = {
  cancelled: boolean;
  cancellationListeners: Array<() => void>;
};

type ShellTaskState = {
  onProgress?: (payload: unknown) => void | Promise<void>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type ExtensionModule = {
  activate?: (context: unknown) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
};

type MutableWorkerGlobalKey
  = | 'fetch'
    | 'XMLHttpRequest'
    | 'WebSocket'
    | 'importScripts'
    | 'localStorage'
    | 'sessionStorage'
    | 'indexedDB'
    | 'document'
    | 'window'
    | 'parent'
    | 'top'
    | 'frames'
    | 'opener'
    | 'navigator'
    | 'close'
    | 'postMessage'
    | 'addEventListener'
    | 'removeEventListener'
    | 'dispatchEvent'
    | 'eval'
    | 'Function'
    | 'sigma';

const workerScope = globalThis as typeof globalThis & {
  postMessage: (message: WorkerToHostMessage) => void;
  addEventListener: (type: string, listener: (event: MessageEvent<HostToWorkerMessage>) => void) => void;
  sigma?: unknown;
  fetch?: unknown;
  XMLHttpRequest?: unknown;
  WebSocket?: unknown;
  importScripts?: unknown;
  localStorage?: unknown;
  sessionStorage?: unknown;
  indexedDB?: unknown;
  document?: unknown;
  window?: unknown;
  parent?: unknown;
  top?: unknown;
  frames?: unknown;
  opener?: unknown;
  navigator?: unknown;
  close?: unknown;
  removeEventListener?: unknown;
  dispatchEvent?: unknown;
};

const emitToHost = workerScope.postMessage.bind(workerScope);
let extensionModule: ExtensionModule = {};
const handlerMap = new Map<string, (...args: unknown[]) => unknown>();
const pendingRequests = new Map<string, PendingRequest>();
let pendingActivationTasks: Promise<unknown>[] = [];
const progressState = new Map<string, ProgressState>();
const shellTaskState = new Map<string, ShellTaskState>();
const workerI18n = createI18n({
  locale: 'en',
  legacy: false,
  messages: structuredClone(appMessages),
  pluralRules,
});
let extensionNamespace = '';

function setWorkerGlobal(name: MutableWorkerGlobalKey, value: unknown): void {
  try {
    Object.defineProperty(workerScope, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  catch {
    try {
      workerScope[name] = value as never;
    }
    catch {
    }
  }
}

function blockFunctionConstructors(): void {
  function noop() {
    throw new Error('Dynamic code generation is not allowed');
  }

  try {
    Object.defineProperty(Function.prototype, 'constructor', {
      value: noop,
      writable: false,
      configurable: false,
    });
  }
  catch {}

  try {
    const AsyncFunctionProto = Object.getPrototypeOf(async function () {});
    Object.defineProperty(AsyncFunctionProto, 'constructor', {
      value: noop,
      writable: false,
      configurable: false,
    });
  }
  catch {}

  try {
    const GeneratorFunctionProto = Object.getPrototypeOf(function* () {});
    Object.defineProperty(GeneratorFunctionProto, 'constructor', {
      value: noop,
      writable: false,
      configurable: false,
    });
  }
  catch {}

  try {
    const AsyncGeneratorFunctionProto = Object.getPrototypeOf(async function* () {});
    Object.defineProperty(AsyncGeneratorFunctionProto, 'constructor', {
      value: noop,
      writable: false,
      configurable: false,
    });
  }
  catch {}
}

function restrictWorkerGlobals(): void {
  const blockedGlobals: MutableWorkerGlobalKey[] = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'importScripts',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document',
    'window',
    'parent',
    'top',
    'frames',
    'opener',
    'navigator',
    'close',
    'postMessage',
    'addEventListener',
    'removeEventListener',
    'dispatchEvent',
    'eval',
    'Function',
  ];

  for (const blockedGlobal of blockedGlobals) {
    setWorkerGlobal(blockedGlobal, undefined);
  }

  blockFunctionConstructors();
}

function postRequest(type: WorkerToHostMessage['type'], payload: Record<string, unknown>): Promise<unknown> {
  const id = typeof payload.id === 'string' ? payload.id : createRequestId('bridge');
  emitToHost({
    type,
    ...payload,
    id,
  } as WorkerToHostMessage);
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
    });
  });
}

function createDisposable(resourceId: string, setupPromise: Promise<unknown>) {
  function disposeResource() {
    return postRequest('dispose-resource', { resourceId }).catch(() => {});
  }

  return {
    dispose() {
      setupPromise.then(disposeResource).catch(() => {});
      handlerMap.delete(resourceId);
    },
  };
}

function mergeWorkerExtensionMessages(messages: Record<string, Record<string, string>>): void {
  if (!extensionNamespace) {
    return;
  }

  const parts = extensionNamespace.split('.').slice(1);

  for (const [locale, localeMessages] of Object.entries(messages)) {
    if (!localeMessages || typeof localeMessages !== 'object') {
      continue;
    }

    let nested: Record<string, unknown> = localeMessages;

    for (let idx = parts.length - 1; idx >= 0; idx--) {
      nested = { [parts[idx]]: nested };
    }

    workerI18n.global.mergeLocaleMessage(locale, { extensions: nested });
  }
}

function translateInWorker(key: string, params?: Record<string, string | number>): string {
  return workerI18n.global.t(key, params as never) as string;
}

function createBridge() {
  function makeCall(method: string) {
    return (...args: unknown[]) => postRequest('bridge-call', {
      method,
      args,
    });
  }

  return {
    commands: {
      registerCommand(command: unknown, handler: (...args: unknown[]) => unknown) {
        const resourceId = createRequestId('command');
        handlerMap.set(resourceId, handler);
        const setupPromise = postRequest('register-command', {
          resourceId,
          command,
          handlerId: resourceId,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
      executeCommand: makeCall('commands.executeCommand'),
      getBuiltinCommands: makeCall('commands.getBuiltinCommands'),
    },
    contextMenu: {
      registerItem(item: unknown, handler: (...args: unknown[]) => unknown) {
        const resourceId = createRequestId('context-menu');
        handlerMap.set(resourceId, handler);
        const setupPromise = postRequest('register-context-menu-item', {
          resourceId,
          item,
          handlerId: resourceId,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
    },
    sidebar: {
      registerPage(page: unknown) {
        const resourceId = createRequestId('sidebar');
        const setupPromise = postRequest('register-sidebar-page', {
          resourceId,
          page,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
    },
    toolbar: {
      registerDropdown(dropdown: unknown, handlers: Record<string, (...args: unknown[]) => unknown>) {
        const resourceId = createRequestId('toolbar');
        const handlerIds: Record<string, string> = {};

        for (const [key, value] of Object.entries(handlers || {})) {
          const handlerId = `${resourceId}:${key}`;
          handlerIds[key] = handlerId;
          handlerMap.set(handlerId, value);
        }

        const setupPromise = postRequest('register-toolbar-dropdown', {
          resourceId,
          dropdown,
          handlers: handlerIds,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
    },
    context: {
      getCurrentPath: makeCall('context.getCurrentPath'),
      getSelectedEntries: makeCall('context.getSelectedEntries'),
      getAppVersion: makeCall('context.getAppVersion'),
      getDownloadsDir: makeCall('context.getDownloadsDir'),
      getPicturesDir: makeCall('context.getPicturesDir'),
      openUrl: makeCall('context.openUrl'),
      onPathChange(callback: (...args: unknown[]) => unknown) {
        const resourceId = createRequestId('path-listener');
        handlerMap.set(resourceId, callback);
        const setupPromise = postRequest('subscribe-context-path', {
          resourceId,
          handlerId: resourceId,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
      onSelectionChange(callback: (...args: unknown[]) => unknown) {
        const resourceId = createRequestId('selection-listener');
        handlerMap.set(resourceId, callback);
        const setupPromise = postRequest('subscribe-context-selection', {
          resourceId,
          handlerId: resourceId,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
    },
    dialog: {
      openFile: makeCall('dialog.openFile'),
      saveFile: makeCall('dialog.saveFile'),
    },
    fs: {
      readFile: makeCall('fs.readFile'),
      writeFile: makeCall('fs.writeFile'),
      readDir: makeCall('fs.readDir'),
      exists: makeCall('fs.exists'),
      downloadFile: makeCall('fs.downloadFile'),
      private: {
        readFile: makeCall('fs.private.readFile'),
        writeFile: makeCall('fs.private.writeFile'),
        readDir: makeCall('fs.private.readDir'),
        exists: makeCall('fs.private.exists'),
        resolvePath: makeCall('fs.private.resolvePath'),
      },
      storage: {
        readFile: makeCall('fs.storage.readFile'),
        writeFile: makeCall('fs.storage.writeFile'),
        readDir: makeCall('fs.storage.readDir'),
        exists: makeCall('fs.storage.exists'),
        resolvePath: makeCall('fs.storage.resolvePath'),
        importFile: makeCall('fs.storage.importFile'),
        deleteFile: makeCall('fs.storage.deleteFile'),
      },
      scoped: {
        requestDirectoryAccess: makeCall('fs.scoped.requestDirectoryAccess'),
        getDirectories: makeCall('fs.scoped.getDirectories'),
        readFile: makeCall('fs.scoped.readFile'),
        writeFile: makeCall('fs.scoped.writeFile'),
        readDir: makeCall('fs.scoped.readDir'),
        exists: makeCall('fs.scoped.exists'),
      },
    },
    ui: {
      showNotification: makeCall('ui.showNotification'),
      showDialog: makeCall('ui.showDialog'),
      copyText: makeCall('ui.copyText'),
      clipboardWrite: makeCall('ui.clipboardWrite'),
      withProgress(options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) {
        const resourceId = createRequestId('progress');
        const cancellationListeners: Array<() => void> = [];
        const state: ProgressState = {
          cancelled: false,
          cancellationListeners,
        };
        progressState.set(resourceId, state);
        const setupPromise = postRequest('progress-start', {
          resourceId,
          options,
        });
        pendingActivationTasks.push(setupPromise);
        return (async () => {
          await setupPromise;

          try {
            const result = await task(
              {
                report(value: unknown) {
                  return postRequest('progress-report', {
                    resourceId,
                    value,
                  }).catch(() => {});
                },
              },
              {
                get isCancellationRequested() {
                  return state.cancelled;
                },
                onCancellationRequested(listener: () => void) {
                  cancellationListeners.push(listener);
                  return {
                    dispose() {
                      const listenerIndex = cancellationListeners.indexOf(listener);

                      if (listenerIndex !== -1) {
                        cancellationListeners.splice(listenerIndex, 1);
                      }
                    },
                  };
                },
              },
            );

            await postRequest('progress-finish', { resourceId }).catch(() => {});
            return result;
          }
          catch (error) {
            await postRequest('progress-error', {
              resourceId,
              error: error instanceof Error ? error.message : String(error),
            }).catch(() => {});
            throw error;
          }
          finally {
            progressState.delete(resourceId);
          }
        })();
      },
      createModal(options: { content?: unknown[] } & Record<string, unknown>) {
        const resourceId = createRequestId('modal');
        const submitHandlerId = `${resourceId}:submit`;
        const closeHandlerId = `${resourceId}:close`;
        const valueChangeHandlerId = `${resourceId}:valueChange`;
        const submitCallbacks: Array<(...args: unknown[]) => unknown> = [];
        const closeCallbacks: Array<(...args: unknown[]) => unknown> = [];
        const valueChangeCallbacks: Array<(...args: unknown[]) => unknown> = [];
        let currentValues: Record<string, unknown> = {};

        function initializeValues(content: unknown[]) {
          const nextValues: Record<string, unknown> = {};

          for (const element of Array.isArray(content) ? content : []) {
            if (!element || typeof element !== 'object' || !('id' in element) || !element.id) {
              continue;
            }

            if (Object.prototype.hasOwnProperty.call(element, 'value')) {
              nextValues[String(element.id)] = (element as { value?: unknown }).value;
            }
          }

          return nextValues;
        }

        if (Array.isArray(options?.content)) {
          currentValues = initializeValues(options.content);
        }

        handlerMap.set(submitHandlerId, async (...args) => {
          let shouldClose = true;

          for (const callback of submitCallbacks) {
            const result = await callback(...args);

            if (result === false) {
              shouldClose = false;
            }
          }

          return shouldClose;
        });

        handlerMap.set(closeHandlerId, async () => {
          for (const callback of closeCallbacks) {
            await callback();
          }
        });

        handlerMap.set(valueChangeHandlerId, async (...args) => {
          if (args[0]) {
            currentValues[String(args[0])] = args[1];
          }

          for (const callback of valueChangeCallbacks) {
            await callback(...args);
          }
        });

        const setupPromise = postRequest('create-modal', {
          resourceId,
          options,
          submitHandlerId,
          valueChangeHandlerId,
        });

        pendingActivationTasks.push(setupPromise);

        return {
          onSubmit(callback: (...args: unknown[]) => unknown) {
            submitCallbacks.push(callback);
          },
          onClose(callback: (...args: unknown[]) => unknown) {
            closeCallbacks.push(callback);
          },
          onValueChange(callback: (...args: unknown[]) => unknown) {
            valueChangeCallbacks.push(callback);
          },
          close() {
            setupPromise.then(() => {
              postRequest('modal-close', { resourceId }).catch(() => {});
            }).catch(() => {});
          },
          updateElement(elementId: string, updates: { value?: unknown } & Record<string, unknown>) {
            if (Object.prototype.hasOwnProperty.call(updates, 'value')) {
              currentValues[elementId] = updates.value;
            }

            setupPromise.then(() => {
              postRequest('modal-update-element', {
                resourceId,
                elementId,
                updates,
              }).catch(() => {});
            }).catch(() => {});
          },
          setContent(content: unknown[]) {
            const nextValues = initializeValues(content);

            for (const key of Object.keys(nextValues)) {
              if (Object.prototype.hasOwnProperty.call(currentValues, key)) {
                nextValues[key] = currentValues[key];
              }
            }

            currentValues = nextValues;

            setupPromise.then(() => {
              postRequest('modal-set-content', {
                resourceId,
                content,
              }).catch(() => {});
            }).catch(() => {});
          },
          setButtons(buttons: unknown[]) {
            setupPromise.then(() => {
              postRequest('modal-set-buttons', {
                resourceId,
                buttons,
              }).catch(() => {});
            }).catch(() => {});
          },
          getValues() {
            return { ...currentValues };
          },
        };
      },
      async showModal(options: { content?: unknown[] } & Record<string, unknown>): Promise<Record<string, unknown> | null> {
        const resourceId = createRequestId('modal');
        const submitHandlerId = `${resourceId}:submit`;
        const closeHandlerId = `${resourceId}:close`;
        const valueChangeHandlerId = `${resourceId}:valueChange`;

        return new Promise<Record<string, unknown> | null>((resolve) => {
          handlerMap.set(submitHandlerId, async (...args) => {
            resolve(args[0] as Record<string, unknown>);
            return true;
          });

          handlerMap.set(closeHandlerId, async () => {
            resolve(null);
          });

          handlerMap.set(valueChangeHandlerId, async () => {});

          postRequest('create-modal', {
            resourceId,
            options,
            submitHandlerId,
            valueChangeHandlerId,
          });
        });
      },
      input: (options: Record<string, unknown>) => ({
        type: 'input',
        ...options,
      }),
      select: (options: Record<string, unknown>) => ({
        type: 'select',
        ...options,
      }),
      checkbox: (options: Record<string, unknown> & { checked?: unknown }) => ({
        type: 'checkbox',
        value: options.checked,
        ...options,
      }),
      textarea: (options: Record<string, unknown>) => ({
        type: 'textarea',
        ...options,
      }),
      separator: () => ({ type: 'separator' }),
      text: (content: string) => ({
        type: 'text',
        value: content,
      }),
      alert: (options: {
        title: string;
        description?: string;
        tone?: string;
      }) => ({
        type: 'alert',
        label: options.title,
        value: options.description || '',
        tone: options.tone || 'info',
      }),
      image: (options: {
        id?: string;
        src: string;
        alt?: string;
      }) => ({
        type: 'image',
        id: options.id,
        value: options.src,
        label: options.alt,
      }),
      previewCard: (options: {
        thumbnail: string;
        title: string;
        subtitle?: string;
      }) => ({
        type: 'previewCard',
        value: options.thumbnail,
        label: options.title,
        subtitle: options.subtitle || '',
      }),
      previewCardSkeleton: () => ({ type: 'previewCardSkeleton' }),
      skeleton: (options?: {
        id?: string;
        width?: number;
        height?: number;
      }) => {
        const value = options?.width && options?.height
          ? `${options.width}x${options.height}`
          : undefined;

        return {
          type: 'skeleton',
          id: options?.id,
          value,
        };
      },
      button: (options: {
        id: string;
        label: string;
        variant?: string;
        size?: string;
        disabled?: boolean;
      }) => ({
        type: 'button',
        id: options.id,
        label: options.label,
        variant: options.variant,
        size: options.size || 'xs',
        disabled: options.disabled,
      }),
    },
    shell: {
      run: makeCall('shell.run'),
      runWithProgress(commandPath: string, args?: string[], onProgress?: (payload: unknown) => void | Promise<void>) {
        const resourceId = createRequestId('shell-task');
        const resultPromise = new Promise((resolve, reject) => {
          shellTaskState.set(resourceId, {
            onProgress,
            resolve,
            reject,
          });
        });

        return postRequest('shell-run-with-progress-start', {
          resourceId,
          commandPath,
          args,
        }).then(taskId => ({
          taskId,
          result: resultPromise,
          cancel() {
            return postRequest('shell-run-with-progress-cancel', { resourceId });
          },
        }));
      },
      renamePartFilesToTs: makeCall('shell.renamePartFilesToTs'),
    },
    settings: {
      get: makeCall('settings.get'),
      set: makeCall('settings.set'),
      getAll: makeCall('settings.getAll'),
      reset: makeCall('settings.reset'),
      onChange(key: string, callback: (...args: unknown[]) => unknown) {
        const resourceId = createRequestId('settings-listener');
        handlerMap.set(resourceId, callback);
        const setupPromise = postRequest('subscribe-settings-change', {
          resourceId,
          key,
          handlerId: resourceId,
        });
        pendingActivationTasks.push(setupPromise);
        return createDisposable(resourceId, setupPromise);
      },
    },
    storage: {
      get: makeCall('storage.get'),
      set: makeCall('storage.set'),
      remove: makeCall('storage.remove'),
    },
    platform: {
      joinPath: makeCall('platform.joinPath'),
      get os() {
        return undefined;
      },
      get arch() {
        return undefined;
      },
      get pathSeparator() {
        return undefined;
      },
      get isWindows() {
        return undefined;
      },
      get isMacos() {
        return undefined;
      },
      get isLinux() {
        return undefined;
      },
    },
    path: {
      dirname(filePath: string): string {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        if (lastSlashIndex === -1) return '.';
        if (lastSlashIndex === 0) return '/';
        return filePath.slice(0, lastSlashIndex);
      },
      basename(filePath: string, suffix?: string): string {
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const base = lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1);

        if (suffix && base.endsWith(suffix)) {
          return base.slice(0, base.length - suffix.length);
        }

        return base;
      },
      extname(filePath: string): string {
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const base = lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1);
        const dotIndex = base.lastIndexOf('.');
        if (dotIndex <= 0) return '';
        return base.slice(dotIndex);
      },
    },
    binary: {
      ensureInstalled: makeCall('binary.ensureInstalled'),
      getPath: makeCall('binary.getPath'),
      isInstalled: makeCall('binary.isInstalled'),
      remove: makeCall('binary.remove'),
      getInfo: makeCall('binary.getInfo'),
    },
    i18n: {
      t: (key: string, params?: Record<string, string | number>) => translateInWorker(key, params),
      mergeMessages(messages: Record<string, Record<string, string>>) {
        mergeWorkerExtensionMessages(messages);
        void postRequest('bridge-call', {
          method: 'i18n.mergeMessages',
          args: [messages],
        });
      },
      async mergeFromPath(basePath: string) {
        const messages = await postRequest('bridge-call', {
          method: 'i18n.loadFromPath',
          args: [basePath],
        }) as Record<string, Record<string, string>>;

        if (Object.keys(messages).length > 0) {
          mergeWorkerExtensionMessages(messages);
          await postRequest('bridge-call', {
            method: 'i18n.mergeMessages',
            args: [messages],
          });
        }
      },
      extensionT: (key: string, params?: Record<string, string | number>, fallback?: string) => {
        const namespacedKey = `${extensionNamespace}.${key}`;
        const translated = translateInWorker(namespacedKey, params);

        if (translated === namespacedKey && fallback !== undefined) {
          return fallback;
        }

        return translated;
      },
    },
  };
}

async function initializeExtensionModule(entryUrl: string): Promise<void> {
  const locale = await postRequest('bridge-call', {
    method: 'i18n.getLocale',
    args: [],
  }) as string;
  workerI18n.global.locale.value = locale as typeof workerI18n.global.locale.value;

  const sigma = createBridge() as Record<string, unknown>;

  const [
    os,
    arch,
    pathSeparator,
    isWindows,
    isMacos,
    isLinux,
  ] = await Promise.all([
    postRequest('bridge-call', {
      method: 'platform.getOs',
      args: [],
    }),
    postRequest('bridge-call', {
      method: 'platform.getArch',
      args: [],
    }),
    postRequest('bridge-call', {
      method: 'platform.getPathSeparator',
      args: [],
    }),
    postRequest('bridge-call', {
      method: 'platform.getIsWindows',
      args: [],
    }),
    postRequest('bridge-call', {
      method: 'platform.getIsMacos',
      args: [],
    }),
    postRequest('bridge-call', {
      method: 'platform.getIsLinux',
      args: [],
    }),
  ]);

  sigma.platform = {
    joinPath: (...segments: string[]) => postRequest('bridge-call', {
      method: 'platform.joinPath',
      args: segments,
    }),
    os,
    arch,
    pathSeparator,
    isWindows,
    isMacos,
    isLinux,
  };

  Object.defineProperty(workerScope, 'sigma', {
    configurable: true,
    writable: false,
    value: sigma,
  });

  restrictWorkerGlobals();

  const importedModule = await import(entryUrl);
  extensionModule = importedModule as ExtensionModule;
}

async function handleWorkerMessage(message: HostToWorkerMessage): Promise<void> {
  if (message.type === 'bridge-response') {
    const pending = pendingRequests.get(message.id);

    if (!pending) {
      return;
    }

    pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error));
      return;
    }

    pending.resolve(message.result);
    return;
  }

  if (message.type === 'invoke-worker-handler') {
    const handler = handlerMap.get(message.handlerId);

    if (!handler) {
      emitToHost({
        type: 'invoke-worker-handler-result',
        callId: message.callId,
        error: 'Worker handler not found',
      });
      return;
    }

    try {
      const result = await handler(...(message.args || []));
      emitToHost({
        type: 'invoke-worker-handler-result',
        callId: message.callId,
        result,
      });
    }
    catch (error) {
      emitToHost({
        type: 'invoke-worker-handler-result',
        callId: message.callId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return;
  }

  if (message.type === 'emit-worker-listener') {
    const handler = handlerMap.get(message.handlerId);

    if (!handler) {
      return;
    }

    try {
      await handler(...(message.args || []));
    }
    catch {
    }

    return;
  }

  if (message.type === 'emit-modal-event') {
    const handlerId = `${message.resourceId}:${message.eventName}`;
    const handler = handlerMap.get(handlerId);

    if (!handler) {
      return;
    }

    try {
      await handler();
    }
    catch {
    }

    return;
  }

  if (message.type === 'emit-progress-cancel') {
    const state = progressState.get(message.resourceId);

    if (!state || state.cancelled) {
      return;
    }

    state.cancelled = true;

    for (const listener of [...state.cancellationListeners]) {
      try {
        listener();
      }
      catch {
      }
    }

    return;
  }

  if (message.type === 'emit-shell-progress') {
    const state = shellTaskState.get(message.resourceId);

    if (!state || typeof state.onProgress !== 'function') {
      return;
    }

    try {
      await state.onProgress(message.payload);
    }
    catch {
    }

    return;
  }

  if (message.type === 'emit-shell-complete') {
    const state = shellTaskState.get(message.resourceId);

    if (!state) {
      return;
    }

    shellTaskState.delete(message.resourceId);

    if (message.error) {
      state.reject(new Error(message.error));
      return;
    }

    state.resolve(message.result);
    return;
  }

  if (message.type === 'initialize') {
    try {
      extensionModule = {};
      await initializeExtensionModule(message.entryUrl);
      emitToHost({
        type: 'bridge-response',
        id: message.id,
        result: true,
      });
    }
    catch (error) {
      emitToHost({
        type: 'bridge-response',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return;
  }

  if (message.type === 'activate') {
    try {
      handlerMap.clear();
      pendingActivationTasks = [];
      const activationContext = message.context as { extensionId: string };
      extensionNamespace = `extensions.${activationContext.extensionId}`;
      workerI18n.global.locale.value = await postRequest('bridge-call', {
        method: 'i18n.getLocale',
        args: [],
      }) as typeof workerI18n.global.locale.value;

      if (typeof extensionModule.activate === 'function') {
        await extensionModule.activate(activationContext);
      }

      await Promise.all(pendingActivationTasks);
      emitToHost({
        type: 'bridge-response',
        id: message.id,
        result: true,
      });
    }
    catch (error) {
      emitToHost({
        type: 'bridge-response',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return;
  }

  if (message.type === 'deactivate') {
    try {
      if (typeof extensionModule.deactivate === 'function') {
        await extensionModule.deactivate();
      }

      emitToHost({
        type: 'bridge-response',
        id: message.id,
        result: true,
      });
    }
    catch (error) {
      emitToHost({
        type: 'bridge-response',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

workerScope.addEventListener('message', (event: MessageEvent<WorkerRuntimeMessage>) => {
  void handleWorkerMessage(event.data as HostToWorkerMessage);
});
