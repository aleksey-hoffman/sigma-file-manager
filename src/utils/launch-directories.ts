// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import normalizePath, {
  getParentDirectory,
  isWindowsDriveRootPath,
} from '@/utils/normalize-path';

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

function shouldIgnoreCwdFallback(path: string): boolean {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '').toLowerCase();
  return /\/windows(?:\/system32|\/syswow64)?$/.test(normalizedPath);
}

function shouldUseCwdFallback(context: LaunchContext, candidatePaths: string[]): boolean {
  if (candidatePaths.length > 0 || !context.cwd || !context.hadAbsorbedShellPaths) {
    return false;
  }

  if (shouldIgnoreCwdFallback(context.cwd)) {
    return false;
  }

  if (!context.executableDir) {
    return true;
  }

  return getPathDedupeKey(normalizePath(context.cwd)) !== getPathDedupeKey(normalizePath(context.executableDir));
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

  const shouldFallbackToCwd = shouldUseCwdFallback(context, candidates);

  if (shouldFallbackToCwd) {
    const normalizedCwd = normalizeLaunchPathCandidate(context.cwd!);
    const cwdDedupeKey = getPathDedupeKey(normalizedCwd);

    if (!seenPaths.has(cwdDedupeKey)) {
      candidates.push(normalizedCwd);
    }
  }

  return candidates;
}

export async function resolveLaunchTargetsFromArgs(
  context: LaunchContext,
  getDirEntry: (path: string) => Promise<DirEntry | null>,
): Promise<LaunchTarget[]> {
  const launchTargets: LaunchTarget[] = [];
  const candidatePaths = getLaunchDirectoryCandidates(context);

  for (const candidatePath of candidatePaths) {
    const dirEntry = await getDirEntry(candidatePath);

    if (dirEntry?.is_dir) {
      launchTargets.push({
        directoryPath: candidatePath,
        focusPath: null,
      });
    }
    else if (dirEntry?.is_file) {
      launchTargets.push({
        directoryPath: getParentDirectory(candidatePath),
        focusPath: candidatePath,
      });
    }
  }

  return launchTargets;
}
