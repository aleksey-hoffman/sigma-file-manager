// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export interface PlannedDeleteJob {
  paths: string[];
  useTrash: boolean;
}

interface DeletePlanEntry {
  path: string;
}

interface PlanDeleteJobsOptions<TEntry extends DeletePlanEntry> {
  entries: TEntry[];
  useTrash: boolean;
  requestPermanentConfirm: (entries: TEntry[]) => Promise<boolean>;
  listRecycleBinUnavailablePaths?: (paths: string[]) => Promise<string[]>;
}

function recyclePathKey(path: string): string {
  return path.replace(/\\/g, '/');
}

export async function listRecycleBinUnavailablePaths(paths: string[]): Promise<string[]> {
  return invoke<string[]>('recycle_bin_unavailable_paths', { paths });
}

export async function planDeleteJobs<TEntry extends DeletePlanEntry>(
  options: PlanDeleteJobsOptions<TEntry>,
): Promise<PlannedDeleteJob[] | null> {
  const { entries, useTrash, requestPermanentConfirm } = options;

  if (entries.length === 0) {
    return null;
  }

  const paths = entries.map(entry => entry.path);

  if (!useTrash) {
    const confirmed = await requestPermanentConfirm(entries);

    if (!confirmed) {
      return null;
    }

    return [{
      paths,
      useTrash: false,
    }];
  }

  const listUnavailable = options.listRecycleBinUnavailablePaths
    ?? listRecycleBinUnavailablePaths;
  let unavailablePaths: string[] = [];

  try {
    unavailablePaths = await listUnavailable(paths);
  }
  catch {
    return [{
      paths,
      useTrash: true,
    }];
  }

  if (unavailablePaths.length === 0) {
    return [{
      paths,
      useTrash: true,
    }];
  }

  const unavailableKeys = new Set(unavailablePaths.map(recyclePathKey));
  const unavailableEntries = entries.filter(entry => unavailableKeys.has(recyclePathKey(entry.path)));
  const availableEntries = entries.filter(entry => !unavailableKeys.has(recyclePathKey(entry.path)));

  if (unavailableEntries.length === 0) {
    const confirmed = await requestPermanentConfirm(entries);

    if (!confirmed) {
      return null;
    }

    return [{
      paths,
      useTrash: false,
    }];
  }

  const confirmed = await requestPermanentConfirm(unavailableEntries);

  if (!confirmed) {
    if (availableEntries.length === 0) {
      return null;
    }

    return [{
      paths: availableEntries.map(entry => entry.path),
      useTrash: true,
    }];
  }

  const jobs: PlannedDeleteJob[] = [];

  if (availableEntries.length > 0) {
    jobs.push({
      paths: availableEntries.map(entry => entry.path),
      useTrash: true,
    });
  }

  jobs.push({
    paths: unavailableEntries.map(entry => entry.path),
    useTrash: false,
  });

  return jobs;
}
