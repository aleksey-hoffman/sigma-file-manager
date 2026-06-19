// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { MODULE_LOAD_RECOVERY_MESSAGE } from '@/utils/module-load-recovery.constants';

const SPLASH_ELEMENT_ID = 'app-splash';
const SPLASH_HIDDEN_CLASS = 'app-splash--hidden';
const SPLASH_REMOVAL_FALLBACK_MS = 500;

export function showModuleLoadRecoveryMessage(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const splashElement = document.getElementById(SPLASH_ELEMENT_ID);

  if (!splashElement) {
    return;
  }

  splashElement.textContent = '';
  const messageElement = document.createElement('div');
  messageElement.textContent = MODULE_LOAD_RECOVERY_MESSAGE;
  messageElement.style.maxWidth = '320px';
  messageElement.style.padding = '0 24px';
  messageElement.style.color = 'rgba(255, 255, 255, 0.78)';
  messageElement.style.font = '14px system-ui, sans-serif';
  messageElement.style.lineHeight = '1.45';
  messageElement.style.textAlign = 'center';
  splashElement.appendChild(messageElement);
}

export function removeAppSplash(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const splashElement = document.getElementById(SPLASH_ELEMENT_ID);

  if (!splashElement) {
    return;
  }

  splashElement.classList.add(SPLASH_HIDDEN_CLASS);

  function removeElement() {
    splashElement?.remove?.();
  }

  splashElement.addEventListener('transitionend', removeElement, { once: true });
  setTimeout(removeElement, SPLASH_REMOVAL_FALLBACK_MS);
}
