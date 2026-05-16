// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type OperationType
  = | 'dir-size'
    | 'copy'
    | 'move'
    | 'deleteTrash'
    | 'deletePermanent'
    | 'archive';
export type OperationStatus
  = | 'pending'
    | 'in-progress'
    | 'cancelling'
    | 'completed'
    | 'cancelled'
    | 'error';

export interface Operation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  label: string;
  path: string;
  progress?: number;
  message?: string;
  processedCount?: number;
  totalCount?: number;
  sourceDisplayName?: string;
  startedAt: number;
  completedAt?: number;
}

function isActiveOperationStatus(status: OperationStatus): boolean {
  return (
    status === 'in-progress'
    || status === 'pending'
    || status === 'cancelling'
  );
}

function isCompletedOperationStatus(status: OperationStatus): boolean {
  return (
    status === 'completed'
    || status === 'cancelled'
    || status === 'error'
  );
}

const MAX_COMPLETED_OPERATIONS_PER_TYPE = 10;

let lastOperationTimelineTick = 0;

function nextOperationTimelineTick(): number {
  const candidate = Date.now();

  if (candidate > lastOperationTimelineTick) {
    lastOperationTimelineTick = candidate;
  }
  else {
    lastOperationTimelineTick += 1;
  }

  return lastOperationTimelineTick;
}

export const useStatusCenterStore = defineStore('status-center', () => {
  const operations = ref<Map<string, Operation>>(new Map());
  const isOpen = ref(false);

  const operationsList = computed(() => Array.from(operations.value.values()));

  const activeOperations = computed(() =>
    operationsList.value
      .filter(operation => isActiveOperationStatus(operation.status))
      .sort((operationA, operationB) => operationB.startedAt - operationA.startedAt),
  );

  const completedOperations = computed(() =>
    operationsList.value
      .filter(operation => isCompletedOperationStatus(operation.status))
      .sort(
        (operationA, operationB) =>
          (operationB.completedAt ?? operationB.startedAt)
          - (operationA.completedAt ?? operationA.startedAt),
      ),
  );

  const activeCount = computed(() => activeOperations.value.length);
  const completedCount = computed(() => completedOperations.value.length);
  const hasActiveOperations = computed(() => activeCount.value > 0);

  function addOperation(operation: Omit<Operation, 'startedAt'>): Operation {
    const operationWithStartedAt: Operation = {
      ...operation,
      startedAt: nextOperationTimelineTick(),
    };
    operations.value.set(operationWithStartedAt.id, operationWithStartedAt);
    return operationWithStartedAt;
  }

  function getOperation(id: string): Operation | undefined {
    return operations.value.get(id);
  }

  function updateOperation(id: string, updates: Partial<Operation>) {
    const existing = operations.value.get(id);

    if (existing) {
      operations.value.set(id, {
        ...existing,
        ...updates,
      });
    }
  }

  function completeOperation(id: string, status: 'completed' | 'cancelled' | 'error' = 'completed', message?: string) {
    updateOperation(id, {
      status,
      completedAt: nextOperationTimelineTick(),
      message,
    });

    const completedOperation = operations.value.get(id);

    if (completedOperation) {
      pruneCompletedOperationsOfType(completedOperation.type);
    }
  }

  function pruneCompletedOperationsOfType(type: OperationType) {
    const completedOperationsOfType: Operation[] = [];

    for (const operation of operations.value.values()) {
      if (operation.type === type && isCompletedOperationStatus(operation.status)) {
        completedOperationsOfType.push(operation);
      }
    }

    if (completedOperationsOfType.length <= MAX_COMPLETED_OPERATIONS_PER_TYPE) {
      return;
    }

    completedOperationsOfType.sort(
      (operationA, operationB) =>
        (operationA.completedAt ?? operationA.startedAt)
        - (operationB.completedAt ?? operationB.startedAt),
    );

    const operationsToRemoveCount
      = completedOperationsOfType.length - MAX_COMPLETED_OPERATIONS_PER_TYPE;

    for (let index = 0; index < operationsToRemoveCount; index += 1) {
      operations.value.delete(completedOperationsOfType[index].id);
    }
  }

  function removeOperation(id: string) {
    operations.value.delete(id);
  }

  function clearCompleted() {
    for (const [id, operation] of operations.value) {
      if (isCompletedOperationStatus(operation.status)) {
        operations.value.delete(id);
      }
    }
  }

  function clearAll() {
    operations.value.clear();
  }

  function setOpen(open: boolean) {
    isOpen.value = open;
  }

  function open() {
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function toggle() {
    setOpen(!isOpen.value);
  }

  return {
    operations,
    operationsList,
    activeOperations,
    completedOperations,
    activeCount,
    completedCount,
    hasActiveOperations,
    isOpen,
    addOperation,
    getOperation,
    updateOperation,
    completeOperation,
    removeOperation,
    clearCompleted,
    clearAll,
    setOpen,
    open,
    close,
    toggle,
  };
});
