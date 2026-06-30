// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Window } from '@tauri-apps/api/window';
import { getAllWindows } from '@tauri-apps/api/window';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

export type AuxiliaryWindowLabel = 'quick-view' | 'print-view';

export const QUICK_VIEW_WINDOW_READY_EVENT = 'quick-view:window-ready';
export const PRINT_VIEW_WINDOW_READY_EVENT = 'print-view:window-ready';
export const AUXILIARY_WINDOW_RELEASE_EVENT = 'auxiliary-window:release';
export const PRINT_VIEW_NATIVE_CLOSE_REQUESTED_EVENT = 'print-view:native-close-requested';

const AUXILIARY_WINDOW_READY_EVENTS: Record<AuxiliaryWindowLabel, string> = {
  'quick-view': QUICK_VIEW_WINDOW_READY_EVENT,
  'print-view': PRINT_VIEW_WINDOW_READY_EVENT,
};

const AUXILIARY_WINDOW_OPTIONS: Record<AuxiliaryWindowLabel, ConstructorParameters<typeof WebviewWindow>[1]> = {
  'quick-view': {
    title: 'Sigma File Manager | Quick View',
    url: '/quick-view',
    width: 1280,
    height: 720,
    minWidth: 300,
    minHeight: 200,
    resizable: true,
    fullscreen: false,
    decorations: true,
    shadow: true,
    visible: false,
  },
  'print-view': {
    title: 'Sigma File Manager | Print',
    url: '/print-view',
    width: 1280,
    height: 720,
    minWidth: 300,
    minHeight: 200,
    resizable: true,
    fullscreen: false,
    decorations: true,
    shadow: true,
    visible: false,
  },
};

const AUXILIARY_WINDOW_ABSENT_POLL_MS = 50;
const AUXILIARY_WINDOW_ABSENT_TIMEOUT_MS = 5000;
const AUXILIARY_WINDOW_READY_TIMEOUT_MS = 15000;

const labelQueues = new Map<AuxiliaryWindowLabel, Promise<unknown>>();
const operationGeneration = new Map<AuxiliaryWindowLabel, number>();

export interface AuxiliaryWindowTaskContext {
  window: Window;
  isCurrent: () => boolean;
}

export function isAuxiliaryWindowPrelaunchEnabled(label: AuxiliaryWindowLabel): boolean {
  const userSettingsStore = useUserSettingsStore();

  if (label === 'quick-view') {
    return userSettingsStore.userSettings.performance.prelaunchQuickViewWindow;
  }

  return userSettingsStore.userSettings.performance.prelaunchPrintViewWindow;
}

function isMainWebviewWindow(): boolean {
  return getCurrentWebviewWindow().label === 'main';
}

function bumpOperationGeneration(label: AuxiliaryWindowLabel): number {
  const nextGeneration = (operationGeneration.get(label) ?? 0) + 1;
  operationGeneration.set(label, nextGeneration);
  return nextGeneration;
}

function getOperationGeneration(label: AuxiliaryWindowLabel): number {
  return operationGeneration.get(label) ?? 0;
}

function isOperationCurrent(label: AuxiliaryWindowLabel, generation: number): boolean {
  return getOperationGeneration(label) === generation;
}

function runQueuedAuxiliaryWindowTask<T>(
  label: AuxiliaryWindowLabel,
  task: () => Promise<T>,
): Promise<T> {
  const previousTask = labelQueues.get(label) ?? Promise.resolve();
  const nextTask = previousTask.catch(() => undefined).then(task);

  labelQueues.set(label, nextTask);

  return nextTask.finally(() => {
    if (labelQueues.get(label) === nextTask) {
      labelQueues.delete(label);
    }
  });
}

async function waitUntilAuxiliaryWindowAbsent(
  label: AuxiliaryWindowLabel,
  timeoutMs = AUXILIARY_WINDOW_ABSENT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const window = await findAuxiliaryWindow(label);

    if (!window) {
      return;
    }

    if (!(await probeAuxiliaryWindow(window))) {
      return;
    }

    await new Promise<void>(resolve => setTimeout(resolve, AUXILIARY_WINDOW_ABSENT_POLL_MS));
  }
}

async function ensureAuxiliaryWindowAbsent(label: AuxiliaryWindowLabel): Promise<void> {
  await waitUntilAuxiliaryWindowAbsent(label);

  const remainingWindow = await findAuxiliaryWindow(label);

  if (!remainingWindow) {
    return;
  }

  if (!(await probeAuxiliaryWindow(remainingWindow))) {
    await waitUntilAuxiliaryWindowAbsent(label);
    return;
  }

  await closeAuxiliaryWindow(remainingWindow, label);
  await waitUntilAuxiliaryWindowAbsent(label);
}

export async function findAuxiliaryWindow(label: AuxiliaryWindowLabel): Promise<Window | null> {
  const allWindows = await getAllWindows();
  return allWindows.find(windowItem => windowItem.label === label) ?? null;
}

export async function emitAuxiliaryWindowEvent<T>(
  label: AuxiliaryWindowLabel,
  event: string,
  payload: T,
): Promise<boolean> {
  const window = await findAuxiliaryWindow(label);

  if (!window || !(await probeAuxiliaryWindow(window))) {
    return false;
  }

  await emitTo({
    kind: 'WebviewWindow',
    label,
  }, event, payload);

  return true;
}

const AUXILIARY_WINDOW_DESTROY_GRACE_MS = 120;
const AUXILIARY_WINDOW_PRINT_DESTROY_GRACE_MS = 400;

export interface AuxiliaryWindowReadyPayload {
  generation: number | null;
}

export function getAuxiliaryWindowReadyGeneration(): number | null {
  const rawGeneration = new URLSearchParams(window.location.search).get('aux-generation');

  if (!rawGeneration) {
    return null;
  }

  const parsedGeneration = Number.parseInt(rawGeneration, 10);

  return Number.isNaN(parsedGeneration) ? null : parsedGeneration;
}

export function buildAuxiliaryWindowReadyPayload(): AuxiliaryWindowReadyPayload {
  return {
    generation: getAuxiliaryWindowReadyGeneration(),
  };
}

function getAuxiliaryWindowCreationOptions(
  label: AuxiliaryWindowLabel,
  generation: number,
): ConstructorParameters<typeof WebviewWindow>[1] {
  const baseOptions = AUXILIARY_WINDOW_OPTIONS[label];

  if (baseOptions === undefined) {
    throw new Error(`Unknown auxiliary window label: ${label}`);
  }

  const baseUrl = baseOptions.url ?? '';

  return {
    ...baseOptions,
    url: `${baseUrl}?aux-generation=${generation}`,
  };
}

async function probeAuxiliaryWindow(window: Window): Promise<boolean> {
  try {
    await window.isVisible();
    return true;
  }
  catch {
    return false;
  }
}

async function closeAuxiliaryWindow(
  window: Window,
  label: AuxiliaryWindowLabel,
): Promise<void> {
  if (!(await probeAuxiliaryWindow(window))) {
    await waitUntilAuxiliaryWindowAbsent(label);
    return;
  }

  try {
    await window.hide();
  }
  catch {
  }

  const destroyGraceMs = label === 'print-view'
    ? AUXILIARY_WINDOW_PRINT_DESTROY_GRACE_MS
    : AUXILIARY_WINDOW_DESTROY_GRACE_MS;

  await new Promise<void>(resolve => setTimeout(resolve, destroyGraceMs));

  try {
    await window.destroy();
  }
  catch {
  }

  await waitUntilAuxiliaryWindowAbsent(label);
}

async function releaseAuxiliaryWindowOnMain(label: AuxiliaryWindowLabel): Promise<void> {
  return runQueuedAuxiliaryWindowTask(label, async () => {
    const window = await findAuxiliaryWindow(label);

    if (!window) {
      return;
    }

    if (isAuxiliaryWindowPrelaunchEnabled(label)) {
      await window.hide();
      return;
    }

    await closeAuxiliaryWindow(window, label);
  });
}

async function requestAuxiliaryWindowReleaseOnMain(label: AuxiliaryWindowLabel): Promise<void> {
  bumpOperationGeneration(label);
  await releaseAuxiliaryWindowOnMain(label);
}

async function createAuxiliaryWindow(
  label: AuxiliaryWindowLabel,
  generation: number,
): Promise<Window | null> {
  await ensureAuxiliaryWindowAbsent(label);

  if (!isOperationCurrent(label, generation)) {
    return null;
  }

  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const readyTimeout = window.setTimeout(() => {
    rejectReady(new Error(`Timed out waiting for auxiliary window ready: ${label}`));
  }, AUXILIARY_WINDOW_READY_TIMEOUT_MS);

  const unlistenReady = await listen<AuxiliaryWindowReadyPayload>(
    AUXILIARY_WINDOW_READY_EVENTS[label],
    (event) => {
      if (event.payload.generation !== generation) {
        return;
      }

      window.clearTimeout(readyTimeout);
      resolveReady();
    },
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const webviewWindow = new WebviewWindow(
        label,
        getAuxiliaryWindowCreationOptions(label, generation),
      );

      webviewWindow.once('tauri://created', () => resolve());
      webviewWindow.once('tauri://error', event => reject(event.payload));
    });

    await readyPromise;
  }
  catch (error) {
    const failedWindow = await findAuxiliaryWindow(label);

    if (failedWindow) {
      await closeAuxiliaryWindow(failedWindow, label);
    }

    throw error;
  }
  finally {
    window.clearTimeout(readyTimeout);
    await unlistenReady();
  }

  if (!isOperationCurrent(label, generation)) {
    const createdWindow = await findAuxiliaryWindow(label);

    if (createdWindow) {
      await closeAuxiliaryWindow(createdWindow, label);
    }

    return null;
  }

  const createdWindow = await findAuxiliaryWindow(label);

  if (!createdWindow || !(await probeAuxiliaryWindow(createdWindow))) {
    return null;
  }

  return createdWindow;
}

async function getOrCreateAuxiliaryWindow(
  label: AuxiliaryWindowLabel,
  generation: number,
): Promise<Window | null> {
  let window = await findAuxiliaryWindow(label);

  if (window && !(await probeAuxiliaryWindow(window))) {
    window = null;
    await ensureAuxiliaryWindowAbsent(label);
  }

  if (!isOperationCurrent(label, generation)) {
    return null;
  }

  if (window) {
    return window;
  }

  return createAuxiliaryWindow(label, generation);
}

export async function runAuxiliaryWindowTask<T>(
  label: AuxiliaryWindowLabel,
  task: (context: AuxiliaryWindowTaskContext) => Promise<T>,
): Promise<T | null> {
  if (!isMainWebviewWindow()) {
    return null;
  }

  const generation = bumpOperationGeneration(label);

  return runQueuedAuxiliaryWindowTask(label, async () => {
    const window = await getOrCreateAuxiliaryWindow(label, generation);

    if (!window || !isOperationCurrent(label, generation)) {
      return null;
    }

    return task({
      window,
      isCurrent: () => isOperationCurrent(label, generation),
    });
  });
}

export async function acquireAuxiliaryWindow(label: AuxiliaryWindowLabel): Promise<Window | null> {
  return runAuxiliaryWindowTask(label, async ({ window }) => window);
}

export async function releaseAuxiliaryWindow(label: AuxiliaryWindowLabel): Promise<void> {
  if (isMainWebviewWindow()) {
    await requestAuxiliaryWindowReleaseOnMain(label);
    return;
  }

  await emitTo(
    {
      kind: 'WebviewWindow',
      label: 'main',
    },
    AUXILIARY_WINDOW_RELEASE_EVENT,
    { label },
  );
}

export async function setupAuxiliaryWindowLifecycle(): Promise<UnlistenFn> {
  return listen<{ label: AuxiliaryWindowLabel }>(
    AUXILIARY_WINDOW_RELEASE_EVENT,
    (event) => {
      requestAuxiliaryWindowReleaseOnMain(event.payload.label).catch(() => undefined);
    },
  );
}

export async function prelaunchConfiguredAuxiliaryWindows(): Promise<void> {
  const labels: AuxiliaryWindowLabel[] = ['quick-view', 'print-view'];

  for (const label of labels) {
    if (!isAuxiliaryWindowPrelaunchEnabled(label)) {
      continue;
    }

    await acquireAuxiliaryWindow(label);
  }
}

export async function applyAuxiliaryWindowPrelaunchSetting(
  label: AuxiliaryWindowLabel,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await acquireAuxiliaryWindow(label);
    return;
  }

  bumpOperationGeneration(label);

  await runQueuedAuxiliaryWindowTask(label, async () => {
    const window = await findAuxiliaryWindow(label);

    if (!window) {
      return;
    }

    const isVisible = await window.isVisible();

    if (isVisible) {
      return;
    }

    await closeAuxiliaryWindow(window, label);
  });
}
