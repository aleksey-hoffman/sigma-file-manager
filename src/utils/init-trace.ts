// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const INIT_TRACE_LOG_PREFIX = '[init-trace]';

function formatElapsed(elapsedMs: number): string {
  if (elapsedMs >= 1000) {
    return `${(elapsedMs / 1000).toFixed(2)}s`;
  }

  return `${Math.round(elapsedMs)}ms`;
}

export function logInitTrace(message: string): void {
  console.log(`${INIT_TRACE_LOG_PREFIX} ${message}`);
}

export async function traceInitStep<TResult>(
  stepLabel: string,
  step: () => Promise<TResult>,
): Promise<TResult> {
  const startTime = performance.now();
  logInitTrace(`-> ${stepLabel}`);

  try {
    const stepResult = await step();
    const elapsedMs = performance.now() - startTime;
    logInitTrace(`   done ${stepLabel} (${formatElapsed(elapsedMs)})`);
    return stepResult;
  }
  catch (stepError) {
    const elapsedMs = performance.now() - startTime;
    console.error(
      `${INIT_TRACE_LOG_PREFIX}    FAIL ${stepLabel} (${formatElapsed(elapsedMs)}):`,
      stepError,
    );
    throw stepError;
  }
}
