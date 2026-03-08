// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, reactive, nextTick, toRaw, type Ref,
} from 'vue';
import type {
  ModalOptions,
  ModalHandle,
  ModalSubmitCallback,
  ModalCloseCallback,
  ModalValueChangeCallback,
  UIElement,
} from '@/types/extension';

export type ModalInstance = {
  id: string;
  extensionId: string;
  options: ModalOptions;
  values: Record<string, unknown>;
  submitCallbacks: ModalSubmitCallback[];
  closeCallbacks: ModalCloseCallback[];
  valueChangeCallbacks: ModalValueChangeCallback[];
  renderedInPalette: boolean;
};

type PaletteFormHandler = (modal: ModalInstance) => void;

const activeModals: Ref<ModalInstance[]> = ref([]);
let modalIdCounter = 0;
let paletteFormHandler: PaletteFormHandler | null = null;

function generateModalId(): string {
  return `ext-modal-${Date.now()}-${++modalIdCounter}`;
}

function initializeValues(content: UIElement[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const element of content) {
    if (element.id && element.type !== 'separator' && element.type !== 'text' && element.type !== 'button' && element.type !== 'image' && element.type !== 'skeleton' && element.type !== 'alert' && element.type !== 'previewCard' && element.type !== 'previewCardSkeleton') {
      if (element.type === 'checkbox') {
        values[element.id] = element.value ?? false;
      }
      else if (element.type === 'select') {
        values[element.id] = element.value ?? (element.options?.[0]?.value ?? '');
      }
      else {
        values[element.id] = element.value ?? '';
      }
    }
  }

  return values;
}

export function registerPaletteFormHandler(handler: PaletteFormHandler): void {
  paletteFormHandler = handler;
}

export function unregisterPaletteFormHandler(): void {
  paletteFormHandler = null;
}

export function createModal(extensionId: string, options: ModalOptions): ModalHandle {
  const modalId = generateModalId();
  const values = initializeValues(options.content);

  const shouldRouteToPalette = paletteFormHandler !== null;

  const instance = reactive<ModalInstance>({
    id: modalId,
    extensionId,
    options: { ...options },
    values,
    submitCallbacks: [],
    closeCallbacks: [],
    valueChangeCallbacks: [],
    renderedInPalette: shouldRouteToPalette,
  });

  if (shouldRouteToPalette) {
    activeModals.value.push(instance);
    paletteFormHandler!(instance);
  }
  else {
    nextTick(() => {
      requestAnimationFrame(() => {
        activeModals.value.push(instance);
      });
    });
  }

  const handle: ModalHandle = {
    onSubmit: (callback: ModalSubmitCallback) => {
      instance.submitCallbacks.push(callback);
    },
    onClose: (callback: ModalCloseCallback) => {
      instance.closeCallbacks.push(callback);
    },
    onValueChange: (callback: ModalValueChangeCallback) => {
      instance.valueChangeCallbacks.push(callback);
    },
    close: () => {
      closeModal(modalId);
    },
    updateElement: (elementId: string, updates: Partial<UIElement>) => {
      const mutableInstance = getModalInstance(modalId) ?? instance;
      const elementIndex = mutableInstance.options.content.findIndex(element => element.id === elementId);

      if (elementIndex !== -1) {
        const currentElement = mutableInstance.options.content[elementIndex];

        mutableInstance.options.content[elementIndex] = {
          ...currentElement,
          ...updates,
        };

        if (
          currentElement.id
          && currentElement.type !== 'separator'
          && currentElement.type !== 'text'
          && currentElement.type !== 'button'
          && currentElement.type !== 'image'
          && currentElement.type !== 'skeleton'
          && currentElement.type !== 'alert'
          && currentElement.type !== 'previewCard'
          && currentElement.type !== 'previewCardSkeleton'
          && updates.value !== undefined
        ) {
          mutableInstance.values[currentElement.id] = updates.value;
        }
      }
    },
    setContent: (content: UIElement[]) => {
      const mutableInstance = getModalInstance(modalId) ?? instance;
      const newValues = initializeValues(content);

      for (const key of Object.keys(newValues)) {
        if (key in mutableInstance.values) {
          newValues[key] = mutableInstance.values[key];
        }
      }

      mutableInstance.options.content = content;
      mutableInstance.values = newValues;
    },
    getValues: () => {
      const mutableInstance = getModalInstance(modalId) ?? instance;
      const rawValues = toRaw(mutableInstance.values);
      const plainValues: Record<string, unknown> = {};

      for (const key of Object.keys(rawValues)) {
        plainValues[key] = toRaw(rawValues[key]);
      }

      return plainValues;
    },
  };

  return handle;
}

export function getActiveModals(): Ref<ModalInstance[]> {
  return activeModals;
}

export function getModalInstance(modalId: string): ModalInstance | undefined {
  return activeModals.value.find(modal => modal.id === modalId);
}

export function updateModalValue(modalId: string, elementId: string, value: unknown): void {
  const instance = getModalInstance(modalId);

  if (instance) {
    instance.values[elementId] = value;

    if (instance.valueChangeCallbacks.length > 0) {
      const rawValues = toRaw(instance.values);
      const plainValues: Record<string, unknown> = {};

      for (const key of Object.keys(rawValues)) {
        plainValues[key] = toRaw(rawValues[key]);
      }

      for (const callback of instance.valueChangeCallbacks) {
        try {
          callback(elementId, value, plainValues);
        }
        catch (error) {
          console.error('[Extensions] Modal valueChange callback error:', error);
        }
      }
    }
  }
}

export async function submitModal(modalId: string, buttonId: string): Promise<boolean> {
  const instance = getModalInstance(modalId);

  if (instance) {
    const rawValues = toRaw(instance.values);
    const values: Record<string, unknown> = {};

    for (const key of Object.keys(rawValues)) {
      values[key] = toRaw(rawValues[key]);
    }

    let shouldCloseModal = true;

    for (const callback of instance.submitCallbacks) {
      try {
        const callbackResult = await callback(values, buttonId);

        if (callbackResult === false) {
          shouldCloseModal = false;
        }
      }
      catch (error) {
        console.error('[Extensions] Modal submit callback error:', error);
      }
    }

    if (shouldCloseModal) {
      closeModal(modalId);
      return true;
    }

    return false;
  }

  return false;
}

export function closeModal(modalId: string): void {
  const instanceIndex = activeModals.value.findIndex(modal => modal.id === modalId);

  if (instanceIndex !== -1) {
    const instance = activeModals.value[instanceIndex];

    for (const callback of instance.closeCallbacks) {
      try {
        callback();
      }
      catch (error) {
        console.error('[Extensions] Modal close callback error:', error);
      }
    }

    activeModals.value.splice(instanceIndex, 1);
  }
}

export function clearExtensionModals(extensionId: string): void {
  const modalsToClose = activeModals.value.filter(modal => modal.extensionId === extensionId);

  for (const modal of modalsToClose) {
    closeModal(modal.id);
  }
}
