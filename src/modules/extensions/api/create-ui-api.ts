// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toast } from 'vue-sonner';
import { createApp, markRaw } from 'vue';
import type {
  NotificationOptions,
  DialogOptions,
  DialogResult,
  ProgressOptions,
  ProgressReport,
  Progress,
  CancellationToken,
  ModalOptions,
  ModalHandle,
  UIElement,
  UISelectOption,
} from '@/types/extension';
import { CustomProgress } from '@/components/ui/toaster';
import { createModal } from '@/modules/extensions/api/modal-state';
import { showExtensionDialog } from '@/modules/extensions/api/dialog-state';
import ExtensionToolbarView from '@/modules/extensions/components/extension-toolbar-view.vue';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import type { Disposable } from '@/types/extension';

const DISMISS_DELAY = 2000;
const CANCELLED_DISMISS_DELAY = 1500;

export function createUiAPI(context: ExtensionContext) {
  return {
    showNotification: (options: NotificationOptions): void => {
      if (!context.hasPermission('notifications')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'notifications' }));
      }

      const toastId = `ext-notification-${context.extensionId}-${Date.now()}`;

      toast.custom(markRaw(CustomProgress), {
        id: toastId,
        duration: options.duration || 4000,
        componentProps: {
          data: {
            id: toastId,
            title: context.getExtensionToastTitle(),
            subtitle: options.subtitle || '',
            description: options.description || '',
            progress: 0,
            timer: 0,
            actionText: '',
            cleanup: () => {},
            extensionId: context.extensionId,
            extensionIconPath: context.getExtensionIconPath(),
          },
        },
      });
    },
    showDialog: async (options: DialogOptions): Promise<DialogResult> => {
      if (!context.hasPermission('dialogs')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      return showExtensionDialog(options);
    },
    withProgress: async <T>(
      options: ProgressOptions,
      task: (progress: Progress, token: CancellationToken) => Promise<T>,
    ): Promise<T> => {
      if (!context.hasPermission('notifications')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'notifications' }));
      }

      let currentProgress = 0;
      let currentSubtitle = options.subtitle;
      let currentDescription = '';
      let isCancelled = false;
      let isCompleted = false;
      const cancellationListeners: (() => void)[] = [];

      const toastId = `progress-${context.extensionId}-${Date.now()}`;

      function updateToast(): void {
        toast.custom(markRaw(CustomProgress), {
          id: toastId,
          duration: Infinity,
          componentProps: {
            data: {
              id: toastId,
              title: context.getExtensionToastTitle(),
              subtitle: currentSubtitle,
              description: currentDescription,
              progress: Math.round(currentProgress),
              timer: 0,
              actionText: isCompleted ? '' : (options.cancellable ? context.t('extensions.api.stop') : context.t('extensions.api.dismiss')),
              cleanup: () => {
                if (options.cancellable) {
                  isCancelled = true;
                  isCompleted = true;
                  updateToast();
                  cancellationListeners.forEach(listener => listener());
                }
                else {
                  toast.dismiss(toastId);
                }
              },
              extensionId: context.extensionId,
              extensionIconPath: context.getExtensionIconPath(),
            },
          },
        });
      }

      const progress: Progress = {
        report: (value: ProgressReport): void => {
          if (isCancelled && (value.increment !== undefined || value.value !== undefined)) {
            return;
          }

          if (value.subtitle !== undefined) {
            currentSubtitle = value.subtitle;
          }

          if (value.description !== undefined) {
            currentDescription = value.description;
          }

          if (value.value !== undefined && Number.isFinite(value.value)) {
            currentProgress = Math.max(0, Math.min(100, value.value));
          }
          else if (value.increment !== undefined) {
            currentProgress = Math.min(100, currentProgress + value.increment);
          }

          updateToast();
        },
      };

      const token: CancellationToken = {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: (listener: () => void): Disposable => {
          cancellationListeners.push(listener);
          return {
            dispose: () => {
              const listenerIndex = cancellationListeners.indexOf(listener);

              if (listenerIndex !== -1) {
                cancellationListeners.splice(listenerIndex, 1);
              }
            },
          };
        },
      };

      updateToast();

      try {
        const result = await task(progress, token);

        if (isCancelled) {
          await new Promise(resolve => setTimeout(resolve, CANCELLED_DISMISS_DELAY));
          toast.dismiss(toastId);
          return result;
        }

        isCompleted = true;
        updateToast();
        await new Promise(resolve => setTimeout(resolve, DISMISS_DELAY));
        toast.dismiss(toastId);
        return result;
      }
      catch (error) {
        toast.dismiss(toastId);
        throw error;
      }
    },
    createModal: (options: ModalOptions): ModalHandle => {
      return createModal(context.extensionId, options);
    },
    input: (options: {
      id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      disabled?: boolean;
    }): UIElement => ({
      type: 'input',
      ...options,
    }),
    select: (options: {
      id: string;
      label?: string;
      placeholder?: string;
      options: UISelectOption[];
      value?: string;
      disabled?: boolean;
    }): UIElement => ({
      type: 'select',
      ...options,
    }),
    checkbox: (options: {
      id: string;
      label?: string;
      checked?: boolean;
      disabled?: boolean;
    }): UIElement => ({
      type: 'checkbox',
      value: options.checked,
      ...options,
    }),
    textarea: (options: {
      id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      rows?: number;
      disabled?: boolean;
    }): UIElement => ({
      type: 'textarea',
      ...options,
    }),
    separator: (): UIElement => ({ type: 'separator' }),
    text: (content: string): UIElement => ({
      type: 'text',
      value: content,
    }),
    alert: (options: {
      title: string;
      description?: string;
      tone?: 'info' | 'success' | 'warning' | 'error';
    }): UIElement => ({
      type: 'alert',
      label: options.title,
      value: options.description ?? '',
      tone: options.tone ?? 'info',
    }),
    image: (options: { id?: string;
      src: string;
      alt?: string; }): UIElement => ({
      type: 'image',
      id: options.id,
      value: options.src,
      label: options.alt,
    }),
    previewCard: (options: { thumbnail: string;
      title: string;
      subtitle?: string; }): UIElement => ({
      type: 'previewCard',
      value: options.thumbnail,
      label: options.title,
      subtitle: options.subtitle ?? '',
    }),
    previewCardSkeleton: (): UIElement => ({ type: 'previewCardSkeleton' }),
    skeleton: (options?: { id?: string;
      width?: number;
      height?: number; }): UIElement => {
      const value = options?.width && options?.height
        ? `${options.width}x${options.height}`
        : undefined;
      return {
        type: 'skeleton',
        id: options?.id,
        value,
      };
    },
    button: (options: {
      id: string;
      label: string;
      variant?: 'primary' | 'secondary' | 'danger';
      size?: 'xs' | 'sm' | 'default' | 'lg';
      disabled?: boolean;
    }): UIElement => ({
      type: 'button',
      id: options.id,
      label: options.label,
      variant: options.variant,
      size: options.size ?? 'xs',
      disabled: options.disabled,
    }),
    renderToolbar: (
      container: HTMLElement,
      elements: UIElement[],
      onButtonClick?: (buttonId: string) => void,
    ): { unmount: () => void } => {
      const app = createApp(ExtensionToolbarView, {
        elements,
        onButtonClick,
      });
      app.mount(container);
      return {
        unmount: () => {
          app.unmount();
        },
      };
    },
  };
}
