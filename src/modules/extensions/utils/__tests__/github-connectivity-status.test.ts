// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  isGitHubConnectivityError,
  markGitHubRepositoryReachable,
  markGitHubRepositoryUnreachable,
  useGitHubConnectivityStatus,
} from '@/modules/extensions/utils/github-connectivity-status';

describe('isGitHubConnectivityError', () => {
  it('detects connection failures from the Rust HTTP client', () => {
    expect(isGitHubConnectivityError(new Error(
      'fetch GitHub tags for yt-dlp/yt-dlp: connection failed (DNS, TLS, or refused): error sending request',
    ))).toBe(true);
  });

  it('detects network timeouts', () => {
    expect(isGitHubConnectivityError(new Error('fetch GitHub tags: network timeout: timed out'))).toBe(true);
  });

  it('detects registry fetch failures from the Rust HTTP client', () => {
    expect(isGitHubConnectivityError(
      'fetch URL (raw.githubusercontent.com): connection failed (DNS, TLS, or refused): error sending request for url (https://raw.githubusercontent.com/sigma-hub/sfm-marketplace/main/registry.json)',
    )).toBe(true);
  });

  it('detects plain string errors returned by Tauri invoke', () => {
    expect(isGitHubConnectivityError(
      'fetch URL via fallback (cdn.jsdelivr.net): connection failed (DNS, TLS, or refused): error sending request',
    )).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isGitHubConnectivityError(new Error('Invalid GitHub repository URL'))).toBe(false);
  });
});

describe('github connectivity status tracking', () => {
  it('shows the alert after a connectivity failure', () => {
    const repository = 'https://github.com/example/repo';
    const { hasGitHubConnectivityIssue } = useGitHubConnectivityStatus();

    markGitHubRepositoryUnreachable(repository, new Error('connection failed (DNS, TLS, or refused)'));
    expect(hasGitHubConnectivityIssue.value).toBe(true);
  });

  it('clears the alert on the first successful request', () => {
    const firstRepository = 'https://github.com/example/failed-repo';
    const secondRepository = 'https://github.com/example/other-repo';
    const { hasGitHubConnectivityIssue } = useGitHubConnectivityStatus();

    markGitHubRepositoryUnreachable(firstRepository, new Error('connection failed (DNS, TLS, or refused)'));
    markGitHubRepositoryUnreachable(secondRepository, new Error('connection failed (DNS, TLS, or refused)'));
    expect(hasGitHubConnectivityIssue.value).toBe(true);

    markGitHubRepositoryReachable();
    expect(hasGitHubConnectivityIssue.value).toBe(false);
  });
});
