// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const SPLASH_ELEMENT_ID = 'app-splash';
const SPLASH_HIDDEN_CLASS = 'app-splash--hidden';
const SPLASH_REMOVAL_FALLBACK_MS = 500;

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
