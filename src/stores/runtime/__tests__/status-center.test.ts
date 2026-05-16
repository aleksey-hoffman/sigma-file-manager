// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { OperationType } from '@/stores/runtime/status-center';
import { useStatusCenterStore } from '@/stores/runtime/status-center';

describe('status center store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function addOperation(id: string, type: OperationType) {
    const statusCenterStore = useStatusCenterStore();

    return statusCenterStore.addOperation({
      id,
      type,
      status: 'in-progress',
      label: id,
      path: id,
    });
  }

  it('does not automatically open when an operation starts', () => {
    const statusCenterStore = useStatusCenterStore();

    addOperation('copy-job', 'copy');

    expect(statusCenterStore.isOpen).toBe(false);
  });

  it('exposes only active operations in the active list, sorted newest first', () => {
    const statusCenterStore = useStatusCenterStore();

    addOperation('first-active', 'copy');
    addOperation('completed-job', 'archive');
    statusCenterStore.completeOperation('completed-job');
    addOperation('second-active', 'deleteTrash');

    expect(statusCenterStore.activeOperations.map(operation => operation.id)).toEqual([
      'second-active',
      'first-active',
    ]);
    expect(statusCenterStore.completedOperations.map(operation => operation.id)).toEqual([
      'completed-job',
    ]);
  });

  it('exposes completed operations sorted by most recent completion first', () => {
    const statusCenterStore = useStatusCenterStore();

    addOperation('first-completed', 'copy');
    statusCenterStore.completeOperation('first-completed');
    addOperation('second-completed', 'archive');
    statusCenterStore.completeOperation('second-completed');

    expect(statusCenterStore.completedOperations.map(operation => operation.id)).toEqual([
      'second-completed',
      'first-completed',
    ]);
  });

  it('prunes the oldest completed operations when a type exceeds the cap', () => {
    const statusCenterStore = useStatusCenterStore();

    for (let index = 0; index < 12; index += 1) {
      addOperation(`copy-job-${index}`, 'copy');
      statusCenterStore.completeOperation(`copy-job-${index}`);
    }

    const completedCopyIds = statusCenterStore.completedOperations
      .filter(operation => operation.type === 'copy')
      .map(operation => operation.id);

    expect(completedCopyIds).toHaveLength(10);
    expect(completedCopyIds).not.toContain('copy-job-0');
    expect(completedCopyIds).not.toContain('copy-job-1');
    expect(completedCopyIds).toContain('copy-job-11');
  });

  it('does not prune active operations even when many completed exist', () => {
    const statusCenterStore = useStatusCenterStore();

    addOperation('copy-active', 'copy');

    for (let index = 0; index < 15; index += 1) {
      addOperation(`copy-completed-${index}`, 'copy');
      statusCenterStore.completeOperation(`copy-completed-${index}`);
    }

    expect(statusCenterStore.activeOperations.map(operation => operation.id)).toContain('copy-active');
    expect(statusCenterStore.completedOperations.filter(operation => operation.type === 'copy')).toHaveLength(10);
  });
});
