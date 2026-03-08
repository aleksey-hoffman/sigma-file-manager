// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';

export interface CardRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ExtensionAnimationState {
  isAnimating: Ref<boolean>;
  isClosing: Ref<boolean>;
  isMorphClose: Ref<boolean>;
  sourceRect: Ref<CardRect | null>;
  sourceElement: Ref<HTMLElement | null>;
  captureSourceRect: (element: HTMLElement) => void;
  hideSourceElement: () => void;
  showSourceElement: () => void;
  animateOpen: (
    sharedCard: HTMLElement,
    contentElements: HTMLElement[],
    overlay: HTMLElement,
  ) => Promise<void>;
  animateClose: (
    sharedCard: HTMLElement,
    contentElements: HTMLElement[],
    overlay: HTMLElement,
  ) => Promise<void>;
}

const ANIMATION_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const ANIMATION_DURATION = 400;
const OPEN_SCALE_OVERSHOOT = 0.92;
const CROSSFADE_START = 0.1;
const SOURCE_CONTENT_FADE_DURATION = 400;

function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
) {
  return element.animate(keyframes, {
    easing: ANIMATION_EASE,
    fill: 'both',
    ...options,
  });
}

const SOURCE_VISIBILITY_KEY = 'data-extension-animation-source';

export function useExtensionAnimation(): ExtensionAnimationState {
  const isAnimating = ref(false);
  const isClosing = ref(false);
  const isMorphClose = ref(false);
  const sourceRect = ref<CardRect | null>(null);
  const sourceElement = ref<HTMLElement | null>(null);

  function captureSourceRect(element: HTMLElement): void {
    sourceElement.value = element;
    const rect = element.getBoundingClientRect();
    sourceRect.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  function hideSourceElement(): void {
    const el = sourceElement.value;

    if (el && el.isConnected) {
      el.setAttribute(SOURCE_VISIBILITY_KEY, el.style.visibility || '');
      el.style.visibility = 'hidden';
    }
  }

  function showSourceElement(): void {
    const el = sourceElement.value;

    if (el && el.isConnected) {
      const saved = el.getAttribute(SOURCE_VISIBILITY_KEY);
      el.style.visibility = saved !== null ? saved : '';
      el.removeAttribute(SOURCE_VISIBILITY_KEY);
    }

    sourceElement.value = null;
  }

  async function animateOpen(
    sharedCard: HTMLElement,
    contentElements: HTMLElement[],
    overlay: HTMLElement,
  ): Promise<void> {
    if (isAnimating.value) return;

    isAnimating.value = true;

    animateElement(overlay, { opacity: [0, 1] }, { duration: ANIMATION_DURATION });

    for (const element of contentElements) {
      element.style.opacity = '0';
      animateElement(
        element,
        {
          opacity: [0, 1],
          transform: ['translateY(20px)', 'translateY(0)'],
        },
        {
          duration: ANIMATION_DURATION * 0.8,
          delay: ANIMATION_DURATION * 0.4,
        },
      );
    }

    if (sourceRect.value) {
      const sourceRectValue = sourceRect.value;
      const targetRect = sharedCard.getBoundingClientRect();

      const scaleX = sourceRectValue.width / targetRect.width;
      const scaleY = sourceRectValue.height / targetRect.height;

      const sourceCenter = {
        x: sourceRectValue.left + sourceRectValue.width / 2,
        y: sourceRectValue.top + sourceRectValue.height / 2,
      };
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };

      const translateX = sourceCenter.x - targetCenter.x;
      const translateY = sourceCenter.y - targetCenter.y;

      const scaleUp = `${scaleX * OPEN_SCALE_OVERSHOOT}, ${scaleY * OPEN_SCALE_OVERSHOOT}`;
      await animateElement(
        sharedCard,
        {
          transform: [
            `translate(${translateX}px, ${translateY}px) scale(${scaleUp})`,
            'translate(0, 0) scale(1, 1)',
          ],
          opacity: [1, 1],
        },
        { duration: ANIMATION_DURATION },
      ).finished;
    }
    else {
      await animateElement(
        sharedCard,
        {
          opacity: [0, 1],
          transform: ['scale(0.9)', 'scale(1)'],
        },
        { duration: ANIMATION_DURATION * 0.7 },
      ).finished;
    }

    isAnimating.value = false;
  }

  async function animateClose(
    sharedCard: HTMLElement,
    contentElements: HTMLElement[],
    overlay: HTMLElement,
  ): Promise<void> {
    if (isAnimating.value) return;

    isAnimating.value = true;
    isClosing.value = true;

    if (sourceRect.value) {
      isMorphClose.value = true;
    }

    animateElement(overlay, { opacity: [1, 0] }, { duration: ANIMATION_DURATION });

    for (const element of contentElements) {
      animateElement(
        element,
        {
          opacity: [1, 0],
          transform: ['translateY(0)', 'translateY(20px)'],
        },
        { duration: ANIMATION_DURATION * 0.4 },
      );
    }

    if (sourceRect.value) {
      const sourceRectValue = sourceRect.value;
      const currentRect = sharedCard.getBoundingClientRect();

      const scaleX = sourceRectValue.width / currentRect.width;
      const scaleY = sourceRectValue.height / currentRect.height;

      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2,
      };
      const targetCenter = {
        x: sourceRectValue.left + sourceRectValue.width / 2,
        y: sourceRectValue.top + sourceRectValue.height / 2,
      };

      const translateX = targetCenter.x - currentCenter.x;
      const translateY = targetCenter.y - currentCenter.y;

      const scaleDown = `${scaleX}, ${scaleY}`;
      const crossfadeDelay = ANIMATION_DURATION * CROSSFADE_START;
      const crossfadeDuration = (ANIMATION_DURATION * (1 - CROSSFADE_START));

      const sharedCardContent = sharedCard.querySelector<HTMLElement>('[data-animate="shared-card-content"]');

      if (sharedCardContent) {
        animateElement(
          sharedCardContent,
          {
            opacity: [1, 0],
            filter: ['blur(0)', 'blur(4px)'],
          },
          {
            duration: crossfadeDuration,
            delay: crossfadeDelay,
          },
        );
      }

      const transformAnimation = animateElement(
        sharedCard,
        {
          transform: [
            'translate(0, 0) scale(1, 1)',
            `translate(${translateX}px, ${translateY}px) scale(${scaleDown})`,
          ],
        },
        { duration: ANIMATION_DURATION },
      );
      await transformAnimation.finished;
      sharedCard.style.opacity = '0';

      const sourceEl = sourceElement.value;

      if (sourceEl && sourceEl.isConnected) {
        const saved = sourceEl.getAttribute(SOURCE_VISIBILITY_KEY);
        sourceEl.style.visibility = saved !== null ? saved : '';
        sourceEl.removeAttribute(SOURCE_VISIBILITY_KEY);

        const sourceChildren = Array.from(sourceEl.children) as HTMLElement[];

        for (const child of sourceChildren) {
          animateElement(
            child,
            { opacity: [0, 1] },
            { duration: SOURCE_CONTENT_FADE_DURATION },
          );
        }

        sourceElement.value = null;
      }
    }
    else {
      await animateElement(
        sharedCard,
        {
          opacity: [1, 0],
          transform: ['scale(1)', 'scale(0.9)'],
        },
        { duration: ANIMATION_DURATION * 0.7 },
      ).finished;
    }

    isAnimating.value = false;
    isClosing.value = false;
    isMorphClose.value = false;
    sourceRect.value = null;
    showSourceElement();
  }

  return {
    isAnimating,
    isClosing,
    isMorphClose,
    sourceRect,
    sourceElement,
    captureSourceRect,
    hideSourceElement,
    showSourceElement,
    animateOpen,
    animateClose,
  };
}
