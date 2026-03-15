// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { SigmaExtensionAPI } from '@/modules/extensions/api';
import type { Disposable, ExtensionActivateContext, ModalHandle } from '@/types/extension';
import { createExtensionApiMethodMap } from '@/modules/extensions/runtime/api-method-map';
import { createRequestId } from '@/modules/extensions/runtime/worker-protocol';
import type {
  HostToWorkerMessage,
  WorkerRuntimeMessage,
} from '@/modules/extensions/runtime/worker-protocol';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

type HostProgressTask = {
  report: (value: unknown) => void;
  resolve: () => void;
  reject: (reason?: unknown) => void;
  disposeCancellation: () => void;
};

type HostShellTask = Awaited<ReturnType<SigmaExtensionAPI['shell']['runWithProgress']>>;

export type WorkerHost = {
  initialize: (entryUrl: string) => Promise<void>;
  activate: (context: ExtensionActivateContext) => Promise<void>;
  deactivate: () => Promise<void>;
  destroy: () => void;
};

function createWorker(): Worker {
  return new Worker(
    new URL('./extension-worker.ts', import.meta.url),
    { type: 'module' },
  );
}

function postWorkerRequest<T>(
  worker: Worker,
  pendingRequests: Map<string, PendingRequest>,
  message: Record<string, unknown>,
): Promise<T> {
  const id = createRequestId('worker');
  worker.postMessage({
    ...message,
    id,
  });

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: value => resolve(value as T),
      reject,
    });
  });
}

export function createWorkerHost(
  api: SigmaExtensionAPI,
): WorkerHost {
  const methodMap = createExtensionApiMethodMap(api);
  const worker = createWorker();
  const pendingRequests = new Map<string, PendingRequest>();
  const pendingHandlerCalls = new Map<string, PendingRequest>();
  const resourceDisposables = new Map<string, Disposable>();
  const modalHandles = new Map<string, ModalHandle>();
  const activeProgressTasks = new Map<string, HostProgressTask>();
  const activeShellTasks = new Map<string, HostShellTask>();

  worker.onmessage = async (event: MessageEvent<WorkerRuntimeMessage>) => {
    const message = event.data;

    if (!message || typeof message !== 'object') {
      return;
    }

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

    if (message.type === 'invoke-worker-handler-result') {
      const pending = pendingHandlerCalls.get(message.callId);

      if (!pending) {
        return;
      }

      pendingHandlerCalls.delete(message.callId);

      if (message.error) {
        pending.reject(new Error(message.error));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    function reply(result?: unknown, error?: string): void {
      const messageId = 'id' in message ? message.id : undefined;

      if (!messageId) {
        return;
      }

      worker.postMessage({
        type: 'bridge-response',
        id: messageId,
        result,
        error,
      } satisfies HostToWorkerMessage);
    }

    function invokeWorkerHandler(handlerId: string, args: unknown[]): Promise<unknown> {
      const callId = createRequestId('handler');

      worker.postMessage({
        type: 'invoke-worker-handler',
        callId,
        handlerId,
        args,
      } satisfies HostToWorkerMessage);

      return new Promise<unknown>((resolve, reject) => {
        pendingHandlerCalls.set(callId, {
          resolve,
          reject,
        });
      });
    }

    try {
      if (message.type === 'bridge-call') {
        const handler = methodMap[message.method];

        if (!handler) {
          throw new Error(`Extension API method is not available in the isolated runtime: ${message.method}`);
        }

        reply(await handler(...message.args));
        return;
      }

      if (message.type === 'register-command') {
        const disposable = api.commands.registerCommand(message.command as never, (...args) => {
          return invokeWorkerHandler(message.handlerId, args);
        });
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'register-context-menu-item') {
        const disposable = api.contextMenu.registerItem(message.item as never, (contextMenuContext) => {
          return invokeWorkerHandler(message.handlerId, [contextMenuContext]).then(() => undefined);
        });
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'register-toolbar-dropdown') {
        const proxyHandlers = Object.fromEntries(
          Object.entries(message.handlers).map(([key, handlerId]) => {
            return [key, () => invokeWorkerHandler(handlerId, []).then(() => undefined)];
          }),
        );
        const disposable = api.toolbar.registerDropdown(message.dropdown as never, proxyHandlers);
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'register-sidebar-page') {
        const disposable = api.sidebar.registerPage(message.page as never);
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'subscribe-context-path') {
        const disposable = api.context.onPathChange((path) => {
          worker.postMessage({
            type: 'emit-worker-listener',
            handlerId: message.handlerId,
            args: [path],
          } satisfies HostToWorkerMessage);
        });
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'subscribe-context-selection') {
        const disposable = api.context.onSelectionChange((entries) => {
          worker.postMessage({
            type: 'emit-worker-listener',
            handlerId: message.handlerId,
            args: [entries],
          } satisfies HostToWorkerMessage);
        });
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'subscribe-settings-change') {
        const disposable = api.settings.onChange(message.key, (newValue, oldValue) => {
          worker.postMessage({
            type: 'emit-worker-listener',
            handlerId: message.handlerId,
            args: [newValue, oldValue],
          } satisfies HostToWorkerMessage);
        });
        resourceDisposables.set(message.resourceId, disposable);
        reply(true);
        return;
      }

      if (message.type === 'create-modal') {
        const modalHandle = api.ui.createModal(message.options as never);
        modalHandle.onSubmit(async (values, buttonId) => {
          const result = await invokeWorkerHandler(message.submitHandlerId, [values, buttonId]);
          return result !== false;
        });
        modalHandle.onClose(() => {
          resourceDisposables.delete(message.resourceId);
          modalHandles.delete(message.resourceId);
          worker.postMessage({
            type: 'emit-modal-event',
            resourceId: message.resourceId,
            eventName: 'close',
          } satisfies HostToWorkerMessage);
        });
        modalHandle.onValueChange((elementId, value, allValues) => {
          void invokeWorkerHandler(message.valueChangeHandlerId, [elementId, value, allValues]).catch(() => {});
        });
        modalHandles.set(message.resourceId, modalHandle);
        resourceDisposables.set(message.resourceId, {
          dispose: () => {
            modalHandles.get(message.resourceId)?.close();
            modalHandles.delete(message.resourceId);
          },
        });
        reply(true);
        return;
      }

      if (message.type === 'modal-close') {
        modalHandles.get(message.resourceId)?.close();
        reply(true);
        return;
      }

      if (message.type === 'modal-update-element') {
        modalHandles.get(message.resourceId)?.updateElement(message.elementId, message.updates as never);
        reply(true);
        return;
      }

      if (message.type === 'modal-set-content') {
        modalHandles.get(message.resourceId)?.setContent(message.content as never);
        reply(true);
        return;
      }

      if (message.type === 'modal-set-buttons') {
        modalHandles.get(message.resourceId)?.setButtons(message.buttons as never);
        reply(true);
        return;
      }

      if (message.type === 'progress-start') {
        resourceDisposables.set(message.resourceId, {
          dispose: () => {
            const activeTask = activeProgressTasks.get(message.resourceId);

            if (!activeTask) {
              return;
            }

            activeProgressTasks.delete(message.resourceId);
            activeTask.disposeCancellation();
            activeTask.reject(new Error('Progress task disposed'));
          },
        });

        void api.ui.withProgress(message.options as never, async (progress, token) => {
          const cancellationSubscription = token.onCancellationRequested(() => {
            worker.postMessage({
              type: 'emit-progress-cancel',
              resourceId: message.resourceId,
            } satisfies HostToWorkerMessage);
          });

          return new Promise<void>((resolve, reject) => {
            activeProgressTasks.set(message.resourceId, {
              report: (value: unknown) => progress.report(value as never),
              resolve,
              reject,
              disposeCancellation: () => cancellationSubscription.dispose(),
            });
          });
        }).catch(() => {
        }).finally(() => {
          const activeTask = activeProgressTasks.get(message.resourceId);
          activeTask?.disposeCancellation();
          activeProgressTasks.delete(message.resourceId);
          resourceDisposables.delete(message.resourceId);
        });

        reply(true);
        return;
      }

      if (message.type === 'progress-report') {
        activeProgressTasks.get(message.resourceId)?.report(message.value);
        reply(true);
        return;
      }

      if (message.type === 'progress-finish') {
        activeProgressTasks.get(message.resourceId)?.resolve();
        reply(true);
        return;
      }

      if (message.type === 'progress-error') {
        activeProgressTasks.get(message.resourceId)?.reject(
          new Error(message.error ?? 'Progress task failed'),
        );
        reply(true);
        return;
      }

      if (message.type === 'shell-run-with-progress-start') {
        const shellTask = await api.shell.runWithProgress(
          message.commandPath,
          message.args,
          (payload) => {
            worker.postMessage({
              type: 'emit-shell-progress',
              resourceId: message.resourceId,
              payload,
            } satisfies HostToWorkerMessage);
          },
        );

        activeShellTasks.set(message.resourceId, shellTask);
        resourceDisposables.set(message.resourceId, {
          dispose: () => {
            void shellTask.cancel().catch(() => {});
          },
        });

        void shellTask.result.then((result) => {
          activeShellTasks.delete(message.resourceId);
          resourceDisposables.delete(message.resourceId);
          worker.postMessage({
            type: 'emit-shell-complete',
            resourceId: message.resourceId,
            result,
          } satisfies HostToWorkerMessage);
        }).catch((error) => {
          activeShellTasks.delete(message.resourceId);
          resourceDisposables.delete(message.resourceId);
          worker.postMessage({
            type: 'emit-shell-complete',
            resourceId: message.resourceId,
            error: error instanceof Error ? error.message : String(error),
          } satisfies HostToWorkerMessage);
        });

        reply(shellTask.taskId);
        return;
      }

      if (message.type === 'shell-run-with-progress-cancel') {
        await activeShellTasks.get(message.resourceId)?.cancel();
        reply(true);
        return;
      }

      if (message.type === 'dispose-resource') {
        resourceDisposables.get(message.resourceId)?.dispose();
        resourceDisposables.delete(message.resourceId);
        modalHandles.delete(message.resourceId);
        activeProgressTasks.delete(message.resourceId);
        activeShellTasks.delete(message.resourceId);
        reply(true);
      }
    }
    catch (error) {
      reply(undefined, error instanceof Error ? error.message : String(error));
    }
  };

  return {
    initialize(entryUrl) {
      return postWorkerRequest<void>(worker, pendingRequests, {
        type: 'initialize',
        entryUrl,
      });
    },
    activate(context) {
      return postWorkerRequest<void>(worker, pendingRequests, {
        type: 'activate',
        context,
      });
    },
    deactivate() {
      return postWorkerRequest<void>(worker, pendingRequests, {
        type: 'deactivate',
      });
    },
    destroy() {
      for (const disposable of resourceDisposables.values()) {
        disposable.dispose();
      }

      resourceDisposables.clear();

      const destroyError = new Error('Extension worker destroyed');

      for (const pending of pendingRequests.values()) {
        pending.reject(destroyError);
      }

      pendingRequests.clear();

      for (const pending of pendingHandlerCalls.values()) {
        pending.reject(destroyError);
      }

      pendingHandlerCalls.clear();

      worker.terminate();
    },
  };
}
