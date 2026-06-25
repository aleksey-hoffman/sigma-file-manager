// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { SigmaExtensionAPI } from '@/modules/extensions/api';
import type { ModalHandle } from '@/types/extension';
import { ensureClipboardChangeBridge } from '@/modules/extensions/api/clipboard-change-bridge';

type EmbedPostMessage = (message: Record<string, unknown>) => void;

type EmbedBridgeMessage = {
  type?: string;
  handlerId?: string;
  modalId?: string;
  requestId?: string;
  eventName?: string;
  args?: unknown[];
  options?: Record<string, unknown>;
  submitHandlerId?: string;
  closeHandlerId?: string;
  valueChangeHandlerId?: string;
  selectionChangeHandlerId?: string;
  searchChangeHandlerId?: string;
  filterChangeHandlerId?: string;
  elementId?: string;
  updates?: Record<string, unknown>;
  content?: unknown[];
  buttons?: unknown[];
  result?: unknown;
  error?: string;
};

type EmbedHostState = {
  clipboardDisposables: Map<string, { dispose: () => void }>;
  modalHandles: Map<string, ModalHandle>;
};

const hostStateByExtension = new Map<string, EmbedHostState>();
const pendingEmbedHandlerResults = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();

function getHostState(extensionId: string): EmbedHostState {
  const existingState = hostStateByExtension.get(extensionId);

  if (existingState) {
    return existingState;
  }

  const nextState: EmbedHostState = {
    clipboardDisposables: new Map(),
    modalHandles: new Map(),
  };
  hostStateByExtension.set(extensionId, nextState);
  return nextState;
}

function waitForEmbedHandlerResult(requestId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    pendingEmbedHandlerResults.set(requestId, {
      resolve,
      reject,
    });
  });
}

export function resolveEmbedHandlerResult(
  requestId: string,
  result: unknown,
  error?: string,
): void {
  const pending = pendingEmbedHandlerResults.get(requestId);

  if (!pending) {
    return;
  }

  pendingEmbedHandlerResults.delete(requestId);

  if (error) {
    pending.reject(new Error(error));
    return;
  }

  pending.resolve(result);
}

export function clearEmbedHostState(extensionId: string): void {
  const hostState = hostStateByExtension.get(extensionId);

  if (!hostState) {
    return;
  }

  for (const disposable of hostState.clipboardDisposables.values()) {
    disposable.dispose();
  }

  for (const modalHandle of hostState.modalHandles.values()) {
    modalHandle.close();
  }

  hostStateByExtension.delete(extensionId);
}

async function dispatchEmbedModalEvent(
  postMessageToEmbed: EmbedPostMessage,
  modalId: string,
  eventName: string,
  handlerId: string,
  args: unknown[],
): Promise<unknown> {
  const requestId = `${modalId}:${eventName}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  postMessageToEmbed({
    type: 'embed-modal-event',
    modalId,
    requestId,
    eventName,
    handlerId,
    args,
  });

  return waitForEmbedHandlerResult(requestId);
}

export async function handleEmbedBridgeMessage(
  extensionId: string,
  api: SigmaExtensionAPI,
  message: EmbedBridgeMessage,
  postMessageToEmbed: EmbedPostMessage,
): Promise<void> {
  const hostState = getHostState(extensionId);

  if (message.type === 'embed-handler-result' && message.requestId) {
    resolveEmbedHandlerResult(message.requestId, message.result, message.error);
    return;
  }

  if (message.type === 'embed-subscribe-clipboard' && message.handlerId) {
    await ensureClipboardChangeBridge();
    const disposable = api.ui.onClipboardChange(() => {
      postMessageToEmbed({
        type: 'embed-clipboard-changed',
        handlerId: message.handlerId,
      });
    });
    hostState.clipboardDisposables.set(message.handlerId, disposable);
    return;
  }

  if (message.type === 'embed-unsubscribe-clipboard' && message.handlerId) {
    hostState.clipboardDisposables.get(message.handlerId)?.dispose();
    hostState.clipboardDisposables.delete(message.handlerId);
    return;
  }

  if (message.type === 'embed-create-modal' && message.modalId && message.options) {
    const modalHandle = api.ui.createModal(message.options as never);
    hostState.modalHandles.set(message.modalId, modalHandle);

    if (message.submitHandlerId) {
      modalHandle.onSubmit(async (values, buttonId) => {
        const result = await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'submit',
          message.submitHandlerId!,
          [values, buttonId],
        );

        return result !== false;
      });
    }

    if (message.closeHandlerId) {
      modalHandle.onClose(async () => {
        hostState.modalHandles.delete(message.modalId!);

        await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'close',
          message.closeHandlerId!,
          [],
        );
      });
    }

    if (message.valueChangeHandlerId) {
      modalHandle.onValueChange(async (elementId, value, allValues) => {
        await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'valueChange',
          message.valueChangeHandlerId!,
          [elementId, value, allValues],
        );
      });
    }

    if (message.selectionChangeHandlerId) {
      modalHandle.onSelectionChange(async (itemId) => {
        await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'selectionChange',
          message.selectionChangeHandlerId!,
          [itemId],
        );
      });
    }

    if (message.searchChangeHandlerId) {
      modalHandle.onSearchChange(async (searchQuery) => {
        await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'searchChange',
          message.searchChangeHandlerId!,
          [searchQuery],
        );
      });
    }

    if (message.filterChangeHandlerId) {
      modalHandle.onFilterChange(async (filterValue) => {
        await dispatchEmbedModalEvent(
          postMessageToEmbed,
          message.modalId!,
          'filterChange',
          message.filterChangeHandlerId!,
          [filterValue],
        );
      });
    }

    postMessageToEmbed({
      type: 'embed-modal-ready',
      modalId: message.modalId,
    });
    return;
  }

  if (message.type === 'embed-modal-close' && message.modalId) {
    hostState.modalHandles.get(message.modalId)?.close();
    hostState.modalHandles.delete(message.modalId);
    return;
  }

  if (message.type === 'embed-modal-update-element' && message.modalId && message.elementId) {
    hostState.modalHandles.get(message.modalId)?.updateElement(
      message.elementId,
      (message.updates ?? {}) as never,
    );
    return;
  }

  if (message.type === 'embed-modal-set-content' && message.modalId && message.content) {
    hostState.modalHandles.get(message.modalId)?.setContent(message.content as never);
    return;
  }

  if (message.type === 'embed-modal-set-buttons' && message.modalId && message.buttons) {
    hostState.modalHandles.get(message.modalId)?.setButtons(message.buttons as never);
    return;
  }

  if (message.type === 'embed-modal-set-list-detail' && message.modalId && message.updates) {
    hostState.modalHandles.get(message.modalId)?.setListDetail(message.updates as never);
  }
}
