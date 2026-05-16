// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();

  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable === true;
}

export function isInputFieldActive(): boolean {
  return isEditableElement(document.activeElement);
}

export function isDialogOpened(): boolean {
  const dialogs = document.querySelectorAll('[role="dialog"]');

  for (const dialog of dialogs) {
    if (!dialog.classList.contains('sigma-ui-popover-content')) {
      return true;
    }
  }

  return false;
}
