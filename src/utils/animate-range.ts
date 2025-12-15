// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export default function animateRange(params) {
  const defaultParams = {
    start: 0,
    end: 10,
    steps: 10,
    stepDuration: 10,
    timingFunction: 'linear',
    target: null,
  };
  params = {
    ...defaultParams,
    ...params,
  };
  const interpolatedList = interpolateChange(params);
  let step = 0;
  const interval = setInterval(() => {
    if (step < interpolatedList.length) {
      params.target.value = interpolatedList[step];
      step += 1;
    }
    else {
      clearInterval(interval);
    }
  }, params.stepDuration);
}

function interpolateChange(params) {
  const defaultParams = {
    start: 0,
    end: 10,
    steps: 10,
    stepDuration: 10,
    timingFunction: 'linear',
  };
  params = {
    ...defaultParams,
    ...params,
  };
  return splitIntoEqualParts(params);
}

function splitIntoEqualParts(params) {
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
