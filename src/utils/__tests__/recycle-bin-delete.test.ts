// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { planDeleteJobs } from '@/utils/recycle-bin-delete';

function entry(path: string) {
  return { path };
}

describe('planDeleteJobs', () => {
  it('trashes local paths without a permanent-delete confirm', async () => {
    const requestPermanentConfirm = vi.fn(async () => true);
    const listRecycleBinUnavailablePaths = vi.fn(async () => []);

    const jobs = await planDeleteJobs({
      entries: [entry('C:/Users/file.txt'), entry('/home/user/file.txt')],
      useTrash: true,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths,
    });

    expect(requestPermanentConfirm).not.toHaveBeenCalled();
    expect(jobs).toEqual([{
      paths: ['C:/Users/file.txt', '/home/user/file.txt'],
      useTrash: true,
    }]);
  });

  it('asks before permanently deleting paths that cannot be recycled', async () => {
    const requestPermanentConfirm = vi.fn(async () => true);
    const uncPath = '\\\\server\\share\\file.txt';

    const jobs = await planDeleteJobs({
      entries: [entry(uncPath)],
      useTrash: true,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths: async () => [uncPath],
    });

    expect(requestPermanentConfirm).toHaveBeenCalledWith([entry(uncPath)]);
    expect(jobs).toEqual([{
      paths: [uncPath],
      useTrash: false,
    }]);
  });

  it('does not delete when permanent confirmation is cancelled', async () => {
    const requestPermanentConfirm = vi.fn(async () => false);
    const uncPath = '//server/share/file.txt';

    const jobs = await planDeleteJobs({
      entries: [entry(uncPath)],
      useTrash: true,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths: async () => ['//server/share/file.txt'],
    });

    expect(jobs).toBeNull();
  });

  it('trashes recyclable paths and permanently deletes only the confirmed remote paths', async () => {
    const localPath = 'C:/Users/file.txt';
    const uncPath = '//nas/docs/a.txt';
    const requestPermanentConfirm = vi.fn(async () => true);

    const jobs = await planDeleteJobs({
      entries: [entry(localPath), entry(uncPath)],
      useTrash: true,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths: async () => [uncPath],
    });

    expect(requestPermanentConfirm).toHaveBeenCalledWith([entry(uncPath)]);
    expect(jobs).toEqual([
      {
        paths: [localPath],
        useTrash: true,
      },
      {
        paths: [uncPath],
        useTrash: false,
      },
    ]);
  });

  it('keeps recyclable paths in trash when permanent confirmation is cancelled', async () => {
    const localPath = 'D:/notes.txt';
    const remotePath = 'Z:/nas/file.txt';

    const jobs = await planDeleteJobs({
      entries: [entry(localPath), entry(remotePath)],
      useTrash: true,
      requestPermanentConfirm: async () => false,
      listRecycleBinUnavailablePaths: async () => [remotePath],
    });

    expect(jobs).toEqual([{
      paths: [localPath],
      useTrash: true,
    }]);
  });

  it('matches unavailable paths that differ only by slash style', async () => {
    const jobs = await planDeleteJobs({
      entries: [entry('\\\\server\\share\\file.txt')],
      useTrash: true,
      requestPermanentConfirm: async () => true,
      listRecycleBinUnavailablePaths: async () => ['//server/share/file.txt'],
    });

    expect(jobs).toEqual([{
      paths: ['\\\\server\\share\\file.txt'],
      useTrash: false,
    }]);
  });

  it('keeps trash when recycle-bin detection fails', async () => {
    const requestPermanentConfirm = vi.fn(async () => true);
    const path = '//server/share/file.txt';

    const jobs = await planDeleteJobs({
      entries: [entry(path)],
      useTrash: true,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths: async () => {
        throw new Error('command unavailable');
      },
    });

    expect(requestPermanentConfirm).not.toHaveBeenCalled();
    expect(jobs).toEqual([{
      paths: [path],
      useTrash: true,
    }]);
  });

  it('still confirms an explicit permanent delete', async () => {
    const entries = [entry('C:/Users/file.txt')];
    const requestPermanentConfirm = vi.fn(async () => true);
    const listRecycleBinUnavailablePaths = vi.fn(async () => []);

    const jobs = await planDeleteJobs({
      entries,
      useTrash: false,
      requestPermanentConfirm,
      listRecycleBinUnavailablePaths,
    });

    expect(listRecycleBinUnavailablePaths).not.toHaveBeenCalled();
    expect(requestPermanentConfirm).toHaveBeenCalledWith(entries);
    expect(jobs).toEqual([{
      paths: ['C:/Users/file.txt'],
      useTrash: false,
    }]);
  });

  it('cancels an explicit permanent delete without a job', async () => {
    const jobs = await planDeleteJobs({
      entries: [entry('C:/Users/file.txt')],
      useTrash: false,
      requestPermanentConfirm: async () => false,
      listRecycleBinUnavailablePaths: async () => {
        throw new Error('should not be called');
      },
    });

    expect(jobs).toBeNull();
  });
});
