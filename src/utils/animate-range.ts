// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Ref } from 'vue';

interface AnimateRangeParams {
  start?: number;
  end?: number;
  steps?: number;
  stepDuration?: number;
  timingFunction?: string;
  target: Ref<number> | null;
}

interface InterpolateParams {
  start: number;
  end: number;
  steps: number;
  stepDuration: number;
  timingFunction: string;
}

export default function animateRange(params: AnimateRangeParams) {
  const defaultParams: InterpolateParams & { target: null } = {
    start: 0,
    end: 10,
    steps: 10,
    stepDuration: 10,
    timingFunction: 'linear',
    target: null,
  };
  const mergedParams = {
    ...defaultParams,
    ...params,
  };
  const interpolatedList = interpolateChange(mergedParams);
  let step = 0;
  const interval = setInterval(() => {
    if (step < interpolatedList.length) {
      if (mergedParams.target) {
        mergedParams.target.value = interpolatedList[step];
      }

      step += 1;
    }
    else {
      clearInterval(interval);
    }
  }, mergedParams.stepDuration);
}

function interpolateChange(params: Partial<InterpolateParams>): number[] {
  const defaultParams: InterpolateParams = {
    start: 0,
    end: 10,
    steps: 10,
    stepDuration: 10,
    timingFunction: 'linear',
  };
  const mergedParams = {
    ...defaultParams,
    ...params,
  };
  return splitIntoEqualParts(mergedParams);
}

function splitIntoEqualParts(params: InterpolateParams): number[] {
  let { start, end } = params;
  const { steps } = params;
  const result: number[] = [];

  if (start === end) {
    return [start];
  }

  if (start > end) {
    const delta = (start - end) / (steps - 1);

    while (Math.round(end) < start) {
      result.push(end);
      end += delta;
    }

    result.push(start);
    result.reverse();
  }
  else {
    const delta = (end - start) / (steps - 1);

    while (Math.round(start) < end) {
      result.push(start);
      start += delta;
    }

    result.push(end);
  }

  return result;
}
