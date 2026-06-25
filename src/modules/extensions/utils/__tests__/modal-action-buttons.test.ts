// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getPrimaryModalButton, resolveModalActionButtons } from '@/modules/extensions/utils/modal-action-buttons';

describe('resolveModalActionButtons', () => {
  it('returns empty state when no buttons are provided', () => {
    expect(resolveModalActionButtons()).toEqual({
      primaryButton: null,
      secondaryButtons: [],
      hasActions: false,
    });
  });

  it('uses the primary variant button as the main action', () => {
    const buttons = [
      {
        id: 'pin',
        label: 'Pin',
      },
      {
        id: 'paste',
        label: 'Paste',
        variant: 'primary' as const,
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'danger' as const,
      },
    ];

    expect(resolveModalActionButtons(buttons)).toEqual({
      primaryButton: buttons[1],
      secondaryButtons: [buttons[0], buttons[2]],
      hasActions: true,
    });
  });

  it('falls back to the first button when no primary action is marked', () => {
    const buttons = [
      {
        id: 'cancel',
        label: 'Cancel',
      },
      {
        id: 'save',
        label: 'Save',
      },
    ];

    expect(resolveModalActionButtons(buttons)).toEqual({
      primaryButton: buttons[0],
      secondaryButtons: [buttons[1]],
      hasActions: true,
    });
  });

  it('prefers enter shortcut over non-primary first button', () => {
    const buttons = [
      {
        id: 'cancel',
        label: 'Cancel',
      },
      {
        id: 'submit',
        label: 'Submit',
        shortcut: { key: 'Enter' },
      },
    ];

    expect(getPrimaryModalButton(buttons)?.id).toBe('submit');
  });
});
