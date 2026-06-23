// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ModalButton } from '@/types/extension';

export interface ResolvedModalActionButtons {
  primaryButton: ModalButton | null;
  secondaryButtons: ModalButton[];
  hasActions: boolean;
}

export function resolveModalActionButtons(buttons: ModalButton[] = []): ResolvedModalActionButtons {
  if (buttons.length === 0) {
    return {
      primaryButton: null,
      secondaryButtons: [],
      hasActions: false,
    };
  }

  const primaryIndex = buttons.findIndex(
    button => button.variant === 'primary' || button.shortcut?.key === 'Enter',
  );
  const resolvedPrimaryIndex = primaryIndex === -1 ? 0 : primaryIndex;
  const primaryButton = buttons[resolvedPrimaryIndex] ?? null;
  const secondaryButtons = buttons.filter((_, index) => index !== resolvedPrimaryIndex);

  return {
    primaryButton,
    secondaryButtons,
    hasActions: primaryButton !== null,
  };
}

export function getPrimaryModalButton(buttons: ModalButton[] = []): ModalButton | undefined {
  return resolveModalActionButtons(buttons).primaryButton ?? undefined;
}
