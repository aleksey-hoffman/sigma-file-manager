// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, reactive, nextTick, type Ref } from 'vue';
import type {
  ModalOptions,
  ModalHandle,
  ModalSubmitCallback,
  ModalCloseCallback,
  ModalValueChangeCallback,
  UIElement,
} from '@/types/extension';
import {
  hasValue,
  toPlainValues,
  initializeFormValues,
} from '@/modules/extensions/utils/ui-element-values';

const ERROR_PREFIX = '[Extensions]';

const CALLBACK_ERROR_LABELS = {
  close: 'Modal close callback error',
  valueChange: 'Modal valueChange callback error',
  submit: 'Modal submit callback error',
} as const;

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
const modalState = {
  idCounter: 0,
  paletteFormHandler: null as PaletteFormHandler | null,
};

function invokeSyncCallbacks(
  callbacks: (() => void)[],
  errorLabel: string,
): void {
  for (const callback of callbacks) {
    try {
      callback();
    }
    catch (error) {
      console.error(`${ERROR_PREFIX} ${errorLabel}:`, error);
    }
  }
}

async function invokeSubmitCallbacks(
  callbacks: ModalSubmitCallback[],
  values: Record<string, unknown>,
  buttonId: string,
): Promise<boolean> {
  let shouldClose = true;

  for (const callback of callbacks) {
    try {
      const result = await callback(values, buttonId);

      if (result === false) {
        shouldClose = false;
      }
    }
    catch (error) {
      console.error(`${ERROR_PREFIX} ${CALLBACK_ERROR_LABELS.submit}:`, error);
    }
  }

  return shouldClose;
}

function invokeValueChangeCallbacks(
  callbacks: ModalValueChangeCallback[],
  elementId: string,
  value: unknown,
  plainValues: Record<string, unknown>,
  errorLabel: string,
): void {
  for (const callback of callbacks) {
    try {
      callback(elementId, value, plainValues);
    }
    catch (error) {
      console.error(`${ERROR_PREFIX} ${errorLabel}:`, error);
    }
  }
}

function generateModalId(): string {
  return `ext-modal-${Date.now()}-${++modalState.idCounter}`;
}

function resolveInstance(modalId: string, fallback: ModalInstance): ModalInstance {
  return getModalInstance(modalId) ?? fallback;
}

export function registerPaletteFormHandler(handler: PaletteFormHandler): void {
  modalState.paletteFormHandler = handler;
}

export function unregisterPaletteFormHandler(): void {
  modalState.paletteFormHandler = null;
}

function createModalInstance(
  extensionId: string,
  options: ModalOptions,
  values: Record<string, unknown>,
  renderedInPalette: boolean,
  modalId: string,
): ModalInstance {
  return reactive<ModalInstance>({
    id: modalId,
    extensionId,
    options: { ...options },
    values,
    submitCallbacks: [],
    closeCallbacks: [],
    valueChangeCallbacks: [],
    renderedInPalette,
  });
}

/**
 * Palette modals are rendered inline and must be in activeModals immediately for the form to bind.
 * Standalone modals render in a portal that mounts after layout; defer push so the modal appears when its container exists.
 */
function registerModalInstance(instance: ModalInstance): void {
  if (instance.renderedInPalette && modalState.paletteFormHandler) {
    activeModals.value.push(instance);
    modalState.paletteFormHandler(instance);
  }
  else {
    nextTick(() => {
      requestAnimationFrame(() => {
        activeModals.value.push(instance);
      });
    });
  }
}

function createModalHandle(modalId: string, instance: ModalInstance): ModalHandle {
  return {
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
      const mutableInstance = resolveInstance(modalId, instance);
      const elementIndex = mutableInstance.options.content.findIndex(element => element.id === elementId);

      if (elementIndex !== -1) {
        const currentElement = mutableInstance.options.content[elementIndex];

        mutableInstance.options.content[elementIndex] = {
          ...currentElement,
          ...updates,
        };

        if (hasValue(currentElement) && updates.value !== undefined) {
          mutableInstance.values[currentElement.id!] = updates.value;
        }
      }
    },
    setContent: (content: UIElement[]) => {
      const mutableInstance = resolveInstance(modalId, instance);
      const newValues = initializeFormValues(content);

      for (const key of Object.keys(newValues)) {
        if (key in mutableInstance.values) {
          newValues[key] = mutableInstance.values[key];
        }
      }

      mutableInstance.options.content = content;
      mutableInstance.values = newValues;
    },
    getValues: () => {
      const mutableInstance = resolveInstance(modalId, instance);
      return toPlainValues(mutableInstance.values);
    },
  };
}

export function createModal(extensionId: string, options: ModalOptions): ModalHandle {
  const modalId = generateModalId();
  const values = initializeFormValues(options.content);
  const shouldRouteToPalette = modalState.paletteFormHandler !== null;

  const instance = createModalInstance(
    extensionId,
    options,
    values,
    shouldRouteToPalette,
    modalId,
  );

  registerModalInstance(instance);

  return createModalHandle(modalId, instance);
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
      const plainValues = toPlainValues(instance.values);
      invokeValueChangeCallbacks(
        instance.valueChangeCallbacks,
        elementId,
        value,
        plainValues,
        CALLBACK_ERROR_LABELS.valueChange,
      );
    }
  }
}

export async function submitModal(modalId: string, buttonId: string): Promise<boolean> {
  const instance = getModalInstance(modalId);

  if (!instance) {
    return false;
  }

  const values = toPlainValues(instance.values);
  const shouldCloseModal = await invokeSubmitCallbacks(
    instance.submitCallbacks,
    values,
    buttonId,
  );

  if (shouldCloseModal) {
    closeModal(modalId);
    return true;
  }

  return false;
}

export function closeModal(modalId: string): void {
  const instanceIndex = activeModals.value.findIndex(modal => modal.id === modalId);

  if (instanceIndex !== -1) {
    const instance = activeModals.value[instanceIndex];
    invokeSyncCallbacks(instance.closeCallbacks, CALLBACK_ERROR_LABELS.close);
    activeModals.value.splice(instanceIndex, 1);
  }
}

export function clearExtensionModals(extensionId: string): void {
  const modalsToClose = activeModals.value.filter(modal => modal.extensionId === extensionId);

  for (const modal of modalsToClose) {
    closeModal(modal.id);
  }
}
