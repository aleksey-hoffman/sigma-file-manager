// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toast } from '@/components/ui/toaster';

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface HandleErrorOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  severity?: ErrorSeverity;
}

const defaultOptions: HandleErrorOptions = {
  showToast: true,
  logToConsole: true,
  severity: 'error',
};

export function handleError(
  message: string,
  error?: unknown,
  options: HandleErrorOptions = {},
): void {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  const fullMessage = errorMessage ? `${message}: ${errorMessage}` : message;

  if (mergedOptions.logToConsole) {
    if (mergedOptions.severity === 'error') {
      console.error(fullMessage, error);
    }
    else if (mergedOptions.severity === 'warning') {
      console.warn(fullMessage, error);
    }
    else {
      console.info(fullMessage, error);
    }
  }

  if (mergedOptions.showToast) {
    toast.error(message, {
      description: errorMessage || undefined,
    });
  }
}

export function handleWarning(message: string, details?: unknown): void {
  handleError(message, details, { severity: 'warning' });
}

export function handleInfo(message: string, details?: unknown): void {
  handleError(message, details, {
    severity: 'info',
    showToast: false,
  });
}
