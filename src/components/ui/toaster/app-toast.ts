// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw, toRaw } from 'vue';
import type { Component } from 'vue';
import { toast as sonnerToast } from 'vue-sonner';
import type { ExternalToast } from 'vue-sonner';
import ToastStatic from './toast-static.vue';
import ToastProgress from './toast-progress.vue';

const allowedCustomComponents = new Set<Component>([ToastStatic, ToastProgress]);

function isAllowedCustomComponent(component: Component): boolean {
  const resolved = toRaw(component);
  return allowedCustomComponents.has(resolved);
}

function staticDescription(data?: ExternalToast): string {
  if (!data?.description) {
    return '';
  }

  return typeof data.description === 'string' ? data.description : '';
}

function showStaticToast(title: string, data?: ExternalToast) {
  const rest: Record<string, unknown> = data ? { ...data } : {};
  delete rest.description;
  delete rest.componentProps;

  return sonnerToast.custom(markRaw(ToastStatic), {
    ...(rest as ExternalToast),
    componentProps: {
      data: {
        title,
        description: staticDescription(data),
      },
    },
  });
}

export const toast = Object.assign(
  (message: string, data?: ExternalToast) => showStaticToast(message, data),
  {
    custom: (component: Component, options?: ExternalToast) => {
      if (!isAllowedCustomComponent(component)) {
        throw new Error(
          'toast.custom only accepts ToastStatic or ToastProgress from @/components/ui/toaster.',
        );
      }

      return sonnerToast.custom(markRaw(component), options);
    },
    dismiss: sonnerToast.dismiss.bind(sonnerToast),
    promise: sonnerToast.promise.bind(sonnerToast),
    getHistory: sonnerToast.getHistory.bind(sonnerToast),
    getToasts: sonnerToast.getToasts.bind(sonnerToast),
    error: (title: string, data?: ExternalToast) => showStaticToast(title, data),
    success: (title: string, data?: ExternalToast) => showStaticToast(title, data),
    warning: (title: string, data?: ExternalToast) => showStaticToast(title, data),
    info: (title: string, data?: ExternalToast) => showStaticToast(title, data),
    loading: (title: string, data?: ExternalToast) => showStaticToast(title, data),
    message: (title: string, data?: ExternalToast) => showStaticToast(title, data),
  },
) as typeof sonnerToast;
