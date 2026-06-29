// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import normalizePath, {
  getParentDirectory,
  isWindowsDriveRootPath,
} from '@/utils/normalize-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-locations';

export interface LaunchContext {
  args: string[];
  cwd: string | null;
  executableDir: string | null;
  hadAbsorbedShellPaths: boolean;
  hadDelegatedShellPaths: boolean;
}

export interface LaunchTarget {
  directoryPath: string;
  focusPath: string | null;
}

function getPathDedupeKey(path: string): string {
  return /^[A-Za-z]:/.test(path) ? path.toLowerCase() : path;
}

function trimLaunchPathQuotes(path: string): string {
  const trimmedPath = path.trim();

  if (
    trimmedPath.length >= 2
    && ((trimmedPath.startsWith('"') && trimmedPath.endsWith('"'))
      || (trimmedPath.startsWith('\'') && trimmedPath.endsWith('\'')))
  ) {
    return trimmedPath.slice(1, -1).trim();
  }

  if (trimmedPath.startsWith('"')) {
    return trimmedPath.slice(1);
  }

  if (trimmedPath.endsWith('"')) {
    return trimmedPath.slice(0, -1);
  }

  return trimmedPath;
}

function normalizeLaunchPathCandidate(path: string): string {
  const withoutQuotes = trimLaunchPathQuotes(path);
  const normalizedPath = normalizePath(withoutQuotes);

  if (isWindowsDriveRootPath(normalizedPath)) {
    return `${normalizedPath.replace(/\/+$/, '')}/`;
  }

  return normalizedPath;
}

export function getLaunchDirectoryCandidates(context: LaunchContext): string[] {
  const candidates: string[] = [];
  const seenPaths = new Set<string>();

  for (const arg of context.args.slice(1)) {
    const candidatePath = normalizeLaunchPathCandidate(arg);

    if (!candidatePath || candidatePath.startsWith('-')) {
      continue;
    }

    const dedupeKey = getPathDedupeKey(candidatePath);

    if (seenPaths.has(dedupeKey)) {
      continue;
    }

    seenPaths.add(dedupeKey);
    candidates.push(candidatePath);
  }

  if (candidates.length === 0 && context.hadAbsorbedShellPaths) {
    candidates.push(LOCATIONS_VIRTUAL_PATH);
  }

  return candidates;
}

export async function resolvePathLaunchTarget(
  rawPath: string,
  getDirEntry: (path: string) => Promise<DirEntry | null>,
): Promise<LaunchTarget | null> {
  const dirEntry = await getDirEntry(rawPath);

  if (!dirEntry) {
    return null;
  }

  const resolvedPath = normalizePath(dirEntry.path);

  if (dirEntry.is_dir) {
    return {
      directoryPath: resolvedPath,
      focusPath: null,
    };
  }

  if (dirEntry.is_file) {
    return {
      directoryPath: getParentDirectory(resolvedPath),
      focusPath: resolvedPath,
    };
  }

  return null;
}

export async function resolveLaunchTargetsFromArgs(
  context: LaunchContext,
  getDirEntry: (path: string) => Promise<DirEntry | null>,
): Promise<LaunchTarget[]> {
  const launchTargets: LaunchTarget[] = [];
  const candidatePaths = getLaunchDirectoryCandidates(context);

  for (const candidatePath of candidatePaths) {
    const launchTarget = await resolvePathLaunchTarget(candidatePath, getDirEntry);

    if (launchTarget) {
      launchTargets.push(launchTarget);
    }
  }

  return launchTargets;
}
