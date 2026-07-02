// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  nextTick,
  onMounted,
  onUnmounted,
  type Ref,
} from 'vue';
import { isOtherActionsKeyboardShortcut } from '@/modules/extensions/utils/modal-keyboard-shortcut';

type ExtensionModalActionFooterHandle = {
  openOtherActions: () => Promise<void>;
};

export function focusExtensionModalRoot(rootElement: HTMLElement | null | undefined): void {
  void nextTick(() => {
    requestAnimationFrame(() => {
      rootElement?.focus({ preventScroll: true });
    });
  });
}

function getModalContainer(rootElement: HTMLElement): HTMLElement | null {
  return rootElement.closest('[role="dialog"]')
    ?? rootElement.closest('.sigma-ui-dialog-content')
    ?? rootElement.closest('.sigma-ui-command-dialog');
}

function isSelectDropdownOpen(): boolean {
  return Boolean(document.querySelector('.sigma-ui-select-content[data-state="open"]'));
}

function isDropdownMenuOpen(): boolean {
  return Boolean(document.querySelector('.sigma-ui-dropdown-menu-content[data-state="open"]'));
}

function isEventWithinModalScope(event: KeyboardEvent, rootElement: HTMLElement): boolean {
  const modalContainer = getModalContainer(rootElement);

  if (!modalContainer) {
    return false;
  }

  const eventTarget = event.target;

  if (eventTarget instanceof Node && modalContainer.contains(eventTarget)) {
    return true;
  }

  if (eventTarget instanceof Element) {
    const portaledSelectContent = eventTarget.closest('.sigma-ui-select-content');

    if (portaledSelectContent instanceof HTMLElement) {
      const selectTriggerId = portaledSelectContent.getAttribute('id');

      if (selectTriggerId && rootElement.querySelector(`[aria-controls="${selectTriggerId}"]`)) {
        return true;
      }
    }
  }

  const activeElement = document.activeElement;

  if (activeElement instanceof Node && modalContainer.contains(activeElement)) {
    return true;
  }

  return activeElement === document.body || activeElement === document.documentElement;
}

export function useExtensionModalOtherActionsShortcut(options: {
  rootElement: Ref<HTMLElement | null>;
  actionFooterRef: Ref<ExtensionModalActionFooterHandle | null>;
  hasSecondaryActions: Ref<boolean>;
  handleKeyboardShortcut?: (event: KeyboardEvent) => void;
}): {
  tryOpenOtherActions: (event: KeyboardEvent) => boolean;
  focusModalRoot: () => void;
} {
  function focusModalRoot(): void {
    focusExtensionModalRoot(options.rootElement.value);
  }

  function tryOpenOtherActions(event: KeyboardEvent): boolean {
    if (!isOtherActionsKeyboardShortcut(event) || !options.hasSecondaryActions.value) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    void options.actionFooterRef.value?.openOtherActions();
    return true;
  }

  function shouldIgnoreDocumentShortcut(event: KeyboardEvent): boolean {
    const rootElement = options.rootElement.value;

    if (!rootElement) {
      return true;
    }

    const eventTarget = event.target;

    if (!(eventTarget instanceof Node) || !rootElement.contains(eventTarget)) {
      return false;
    }

    if (eventTarget instanceof HTMLInputElement || eventTarget instanceof HTMLTextAreaElement) {
      return true;
    }

    return false;
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    const rootElement = options.rootElement.value;

    if (!rootElement?.isConnected) {
      return;
    }

    if (!isEventWithinModalScope(event, rootElement)) {
      return;
    }

    if (isOtherActionsKeyboardShortcut(event)) {
      if (shouldIgnoreDocumentShortcut(event)) {
        return;
      }

      tryOpenOtherActions(event);
      return;
    }

    if (!options.handleKeyboardShortcut || isSelectDropdownOpen() || isDropdownMenuOpen()) {
      return;
    }

    options.handleKeyboardShortcut(event);
  }

  onMounted(() => {
    document.addEventListener('keydown', handleDocumentKeydown, true);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleDocumentKeydown, true);
  });

  return {
    tryOpenOtherActions,
    focusModalRoot,
  };
}
