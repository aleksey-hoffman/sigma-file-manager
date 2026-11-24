// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';

export type UndoAction = () => Promise<void>;

const UNDO_TOAST_DURATION_MS = 8000;

async function runUndo(undo: UndoAction) {
  try {
    await undo();
  }
  catch (error) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('notifications.undoFailed'),
          description: error instanceof Error ? error.message : String(error),
        },
      },
      duration: 5000,
    });
  }
}

export function showOperationToast(options: {
  title: string;
  description?: string;
  duration?: number;
  undo?: UndoAction | null;
}) {
  const { title, description = '', undo } = options;

  const toastId = toast.custom(markRaw(ToastStatic), {
    componentProps: {
      data: {
        title,
        description,
        ...(undo && {
          actionText: i18n.global.t('notifications.undo'),
          onAction: () => {
            toast.dismiss(toastId);
            void runUndo(undo);
          },
        }),
      },
    },
    duration: undo ? UNDO_TOAST_DURATION_MS : options.duration,
  });
}
