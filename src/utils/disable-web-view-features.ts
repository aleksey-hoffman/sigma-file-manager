// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

function disableContextMenu() {
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

function disableNativeFind() {
  document.addEventListener('keydown', (event) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (isCtrlOrCmd && event.key === 'f') {
      event.preventDefault();
    }
  }, { capture: true });
}

function disableNativePrintShortcut() {
  document.addEventListener('keydown', (event) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (
      !isCtrlOrCmd
      || event.shiftKey
      || event.altKey
      || event.key.toLowerCase() !== 'p'
    ) {
      return;
    }

    event.preventDefault();
  }, { capture: true });
}

function disableNativeHistoryNavigation() {
  function isHistoryMouseButton(event: MouseEvent): boolean {
    return event.button === 3 || event.button === 4;
  }

  function preventMouseHistoryNavigation(event: MouseEvent) {
    if (isHistoryMouseButton(event)) {
      event.preventDefault();
    }
  }

  function blockMouseHistoryNavigation(event: MouseEvent) {
    if (event.button === 3 || event.button === 4) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (
      event.altKey
      && (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
    }
  }, { capture: true });
  window.addEventListener('mousedown', preventMouseHistoryNavigation, { capture: true });
  window.addEventListener('mouseup', blockMouseHistoryNavigation, { capture: true });
  window.addEventListener('auxclick', blockMouseHistoryNavigation, { capture: true });
  document.addEventListener('mousedown', preventMouseHistoryNavigation, { capture: true });
  document.addEventListener('mouseup', blockMouseHistoryNavigation, { capture: true });
  document.addEventListener('auxclick', blockMouseHistoryNavigation, { capture: true });
}

export function disableWebViewFeatures(suppressNativePrintShortcut = true) {
  disableContextMenu();
  disableNativeFind();
  disableNativeHistoryNavigation();

  if (suppressNativePrintShortcut) {
    disableNativePrintShortcut();
  }
}
