// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useI18n } from 'vue-i18n';
import { useStatusCenterStore, type Operation } from '@/stores/runtime/status-center';
import { useArchiveJobsStore } from '@/stores/runtime/archive-jobs';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';

export function useCancelOperation() {
  const { t } = useI18n();
  const statusCenterStore = useStatusCenterStore();
  const archiveJobsStore = useArchiveJobsStore();
  const copyMoveJobsStore = useCopyMoveJobsStore();
  const deleteJobsStore = useDeleteJobsStore();
  const dirSizesStore = useDirSizesStore();

  async function cancelOperation(operation: Operation) {
    if (operation.type === 'dir-size') {
      await dirSizesStore.cancelSize(operation.path);
      return;
    }

    if (operation.status === 'cancelling') {
      return;
    }

    statusCenterStore.updateOperation(operation.id, {
      status: 'cancelling',
      message: t('statusCenter.cancelling'),
    });

    if (operation.type === 'archive') {
      await archiveJobsStore.cancelJob(operation.id);
    }
    else if (operation.type === 'deleteTrash' || operation.type === 'deletePermanent') {
      await deleteJobsStore.cancelJob(operation.id);
    }
    else if (operation.type === 'copy' || operation.type === 'move') {
      await copyMoveJobsStore.cancelJob(operation.id);
    }
  }

  async function cancelOperations(operations: Operation[]) {
    const cancellableOperations = operations.filter(
      operation => operation.status === 'in-progress' || operation.status === 'pending',
    );

    await Promise.all(cancellableOperations.map(operation => cancelOperation(operation)));
  }

  return {
    cancelOperation,
    cancelOperations,
  };
}
