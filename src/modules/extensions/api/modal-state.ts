// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, reactive, nextTick, toRaw, type Ref,
} from 'vue';
import type {
  ModalOptions,
  ModalHandle,
  ModalButton,
  ModalSubmitCallback,
  ModalCloseCallback,
  ModalValueChangeCallback,
  ListDetailState,
  ListDetailSelectionChangeCallback,
  ListDetailSearchChangeCallback,
  ListDetailFilterChangeCallback,
  UIElement,
} from '@/types/extension';
import {
  mergeModalFormValues,
  shouldPreserveModalValues,
} from '@/modules/extensions/utils/merge-modal-form-values';
import {
  hasValue,
  toPlainValues,
  initializeFormValues,
} from '@/modules/extensions/utils/ui-element-values';
import {
  createDefaultListDetailState,
  getListDetailValues,
  mergeListDetailState,
} from '@/modules/extensions/utils/list-detail-state';

const ERROR_PREFIX = '[Extensions]';

const CALLBACK_ERROR_LABELS = {
  close: 'Modal close callback error',
  valueChange: 'Modal valueChange callback error',
  submit: 'Modal submit callback error',
  selectionChange: 'Modal selectionChange callback error',
  searchChange: 'Modal searchChange callback error',
  filterChange: 'Modal filterChange callback error',
} as const;

export type ModalInstance = {
  id: string;
  extensionId: string;
  options: ModalOptions;
  values: Record<string, unknown>;
  listDetail: ListDetailState | null;
  submitCallbacks: ModalSubmitCallback[];
  closeCallbacks: ModalCloseCallback[];
  valueChangeCallbacks: ModalValueChangeCallback[];
  selectionChangeCallbacks: ListDetailSelectionChangeCallback[];
  searchChangeCallbacks: ListDetailSearchChangeCallback[];
  filterChangeCallbacks: ListDetailFilterChangeCallback[];
  renderedInPalette: boolean;
};

type PaletteFormHandler = (modal: ModalInstance) => void;

const activeModals: Ref<ModalInstance[]> = ref([]);
const modalState = {
  idCounter: 0,
  paletteFormHandler: null as PaletteFormHandler | null,
  pendingCommandTitleByExtension: new Map<string, string[]>(),
};

export function setPendingModalCommandTitle(extensionId: string, commandTitle: string): void {
  const pendingTitles = modalState.pendingCommandTitleByExtension.get(extensionId) ?? [];
  pendingTitles.push(commandTitle);
  modalState.pendingCommandTitleByExtension.set(extensionId, pendingTitles);
}

function consumePendingModalCommandTitle(extensionId: string): string | undefined {
  const pendingTitles = modalState.pendingCommandTitleByExtension.get(extensionId);

  if (!pendingTitles?.length) {
    return undefined;
  }

  const commandTitle = pendingTitles.shift();

  if (!pendingTitles.length) {
    modalState.pendingCommandTitleByExtension.delete(extensionId);
  }
  else {
    modalState.pendingCommandTitleByExtension.set(extensionId, pendingTitles);
  }

  return commandTitle;
}

function resolveModalOptions(extensionId: string, options: ModalOptions): ModalOptions {
  const commandTitle = options.commandTitle ?? consumePendingModalCommandTitle(extensionId);

  if (!commandTitle) {
    return options;
  }

  return {
    ...options,
    commandTitle,
  };
}

function closeDuplicateStandaloneModals(extensionId: string, options: ModalOptions): void {
  const layout = options.layout ?? 'form';
  const duplicates = activeModals.value.filter(
    modal => !modal.renderedInPalette
      && modal.extensionId === extensionId
      && modal.options.layout === layout
      && modal.options.title === options.title,
  );

  for (const modal of duplicates) {
    closeModal(modal.id);
  }
}

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

async function invokeAsyncCallbacks<T extends unknown[]>(
  callbacks: ((...args: T) => void | Promise<void>)[],
  errorLabel: string,
  ...args: T
): Promise<void> {
  for (const callback of callbacks) {
    try {
      await callback(...args);
    }
    catch (error) {
      console.error(`${ERROR_PREFIX} ${errorLabel}:`, error);
    }
  }
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

function isListDetailModal(options: ModalOptions): boolean {
  return options.layout === 'listDetail';
}

function createModalInstance(
  extensionId: string,
  options: ModalOptions,
  values: Record<string, unknown>,
  listDetail: ListDetailState | null,
  renderedInPalette: boolean,
  modalId: string,
): ModalInstance {
  return reactive<ModalInstance>({
    id: modalId,
    extensionId,
    options: { ...options },
    values,
    listDetail,
    submitCallbacks: [],
    closeCallbacks: [],
    valueChangeCallbacks: [],
    selectionChangeCallbacks: [],
    searchChangeCallbacks: [],
    filterChangeCallbacks: [],
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
      const content = mutableInstance.options.content ?? [];
      const elementIndex = content.findIndex(element => element.id === elementId);

      if (elementIndex !== -1) {
        const currentElement = content[elementIndex];
        const nextContent = [...content];

        nextContent[elementIndex] = {
          ...currentElement,
          ...updates,
        };

        mutableInstance.options.content = nextContent;

        if (hasValue(currentElement) && updates.value !== undefined) {
          mutableInstance.values[currentElement.id!] = updates.value;
        }
      }
    },
    setContent: (content: UIElement[], options?: { preserveValues?: boolean }) => {
      const mutableInstance = resolveInstance(modalId, instance);
      const newValues = mergeModalFormValues(
        initializeFormValues(content),
        mutableInstance.values,
        shouldPreserveModalValues(options),
      );

      mutableInstance.options.content = content;
      mutableInstance.values = newValues;
    },
    setButtons: (buttons: ModalButton[]) => {
      const mutableInstance = resolveInstance(modalId, instance);
      mutableInstance.options = {
        ...mutableInstance.options,
        buttons,
      };
    },
    setListDetail: (updates: Partial<ListDetailState>) => {
      const mutableInstance = resolveInstance(modalId, instance);

      if (!mutableInstance.listDetail) {
        throw new Error(`${ERROR_PREFIX} setListDetail is only available for list-detail modals`);
      }

      const currentListDetail = toRaw(mutableInstance.listDetail) as ListDetailState;
      mutableInstance.listDetail = structuredClone(
        mergeListDetailState(currentListDetail, updates),
      ) as ListDetailState;
      const listDetailValues = getListDetailValues(mutableInstance.listDetail);
      mutableInstance.values = {
        ...mutableInstance.values,
        ...listDetailValues,
      };
    },
    getListDetail: () => {
      const mutableInstance = resolveInstance(modalId, instance);

      if (!mutableInstance.listDetail) {
        return createDefaultListDetailState();
      }

      return structuredClone(mutableInstance.listDetail);
    },
    onSelectionChange: (callback: ListDetailSelectionChangeCallback) => {
      instance.selectionChangeCallbacks.push(callback);
    },
    onSearchChange: (callback: ListDetailSearchChangeCallback) => {
      instance.searchChangeCallbacks.push(callback);
    },
    onFilterChange: (callback: ListDetailFilterChangeCallback) => {
      instance.filterChangeCallbacks.push(callback);
    },
    getValues: () => {
      const mutableInstance = resolveInstance(modalId, instance);

      if (mutableInstance.listDetail) {
        return {
          ...toPlainValues(mutableInstance.values),
          ...getListDetailValues(mutableInstance.listDetail),
        };
      }

      return toPlainValues(mutableInstance.values);
    },
  };
}

export function createModal(extensionId: string, options: ModalOptions): ModalHandle {
  const modalId = generateModalId();
  const resolvedOptions = resolveModalOptions(extensionId, options);
  const listDetailLayout = isListDetailModal(resolvedOptions);
  const listDetail = listDetailLayout
    ? createDefaultListDetailState(resolvedOptions.listDetail)
    : null;
  const values = listDetailLayout
    ? getListDetailValues(listDetail!)
    : initializeFormValues(resolvedOptions.content ?? []);
  const shouldRouteToPalette = modalState.paletteFormHandler !== null;

  if (!shouldRouteToPalette) {
    closeDuplicateStandaloneModals(extensionId, resolvedOptions);
  }

  const instance = createModalInstance(
    extensionId,
    {
      ...resolvedOptions,
      content: resolvedOptions.content ?? [],
      layout: listDetailLayout ? 'listDetail' : (resolvedOptions.layout ?? 'form'),
    },
    values,
    listDetail,
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

  const values = instance.listDetail
    ? {
        ...toPlainValues(instance.values),
        ...getListDetailValues(instance.listDetail),
      }
    : toPlainValues(instance.values);
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

export async function updateModalSelection(modalId: string, itemId: string | null): Promise<void> {
  const instance = getModalInstance(modalId);

  if (!instance?.listDetail) {
    return;
  }

  await invokeAsyncCallbacks(
    instance.selectionChangeCallbacks,
    CALLBACK_ERROR_LABELS.selectionChange,
    itemId,
  );
}

export async function updateModalSearch(modalId: string, searchQuery: string): Promise<void> {
  const instance = getModalInstance(modalId);

  if (!instance?.listDetail) {
    return;
  }

  instance.listDetail.searchQuery = searchQuery;
  instance.values.searchQuery = searchQuery;

  await invokeAsyncCallbacks(
    instance.searchChangeCallbacks,
    CALLBACK_ERROR_LABELS.searchChange,
    searchQuery,
  );
}

export async function updateModalFilter(modalId: string, filterValue: string): Promise<void> {
  const instance = getModalInstance(modalId);

  if (!instance?.listDetail) {
    return;
  }

  instance.listDetail.filterValue = filterValue;
  instance.values.filterValue = filterValue;

  await invokeAsyncCallbacks(
    instance.filterChangeCallbacks,
    CALLBACK_ERROR_LABELS.filterChange,
    filterValue,
  );
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
