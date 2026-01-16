// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type OperationType = 'dir-size' | 'copy' | 'move' | 'delete';
export type OperationStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'error';

export interface Operation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  label: string;
  path: string;
  progress?: number;
  message?: string;
  startedAt: number;
  completedAt?: number;
}

export interface OperationGroup {
  type: OperationType;
  label: string;
  operations: Operation[];
}

export const useStatusCenterStore = defineStore('status-center', () => {
  const operations = ref<Map<string, Operation>>(new Map());
  const isOpen = ref(false);

  const operationsList = computed(() => Array.from(operations.value.values()));

  const activeOperations = computed(() =>
    operationsList.value.filter(op => op.status === 'in-progress' || op.status === 'pending'),
  );

  const completedOperations = computed(() =>
    operationsList.value.filter(op => op.status === 'completed' || op.status === 'cancelled' || op.status === 'error'),
  );

  const activeCount = computed(() => activeOperations.value.length);
  const hasActiveOperations = computed(() => activeCount.value > 0);

  const groupedOperations = computed<OperationGroup[]>(() => {
    const groups = new Map<OperationType, Operation[]>();

    for (const op of operationsList.value) {
      const existing = groups.get(op.type) || [];
      existing.push(op);
      groups.set(op.type, existing);
    }

    const typeLabels: Record<OperationType, string> = {
      'dir-size': 'Directory Size Calculations',
      'copy': 'Copy Operations',
      'move': 'Move Operations',
      'delete': 'Delete Operations',
    };

    return Array.from(groups.entries()).map(([type, ops]) => ({
      type,
      label: typeLabels[type],
      operations: ops.sort((a, b) => b.startedAt - a.startedAt),
    }));
  });

  function addOperation(operation: Omit<Operation, 'startedAt'>): Operation {
    const op: Operation = {
      ...operation,
      startedAt: Date.now(),
    };
    operations.value.set(op.id, op);
    return op;
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
      completedAt: Date.now(),
      message,
    });
  }

  function removeOperation(id: string) {
    operations.value.delete(id);
  }

  function clearCompleted() {
    for (const [id, op] of operations.value) {
      if (op.status === 'completed' || op.status === 'cancelled' || op.status === 'error') {
        operations.value.delete(id);
      }
    }
  }

  function clearAll() {
    operations.value.clear();
  }

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  return {
    operations,
    operationsList,
    activeOperations,
    completedOperations,
    activeCount,
    hasActiveOperations,
    groupedOperations,
    isOpen,
    addOperation,
    updateOperation,
    completeOperation,
    removeOperation,
    clearCompleted,
    clearAll,
    open,
    close,
    toggle,
  };
});
