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

export function useExtensionModalOtherActionsShortcut(options: {
  rootElement: Ref<HTMLElement | null>;
  actionFooterRef: Ref<ExtensionModalActionFooterHandle | null>;
  hasSecondaryActions: Ref<boolean>;
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
    if (shouldIgnoreDocumentShortcut(event)) {
      return;
    }

    tryOpenOtherActions(event);
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
