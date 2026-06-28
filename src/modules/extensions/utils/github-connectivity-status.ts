// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref } from 'vue';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isGitHubConnectivityError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('connection failed')
    || message.includes('dns, tls, or refused')
    || message.includes('network timeout')
    || message.includes('connection dropped')
    || message.includes('failed to create http client')
  );
}

const githubConnectivityIssue = ref(false);

export function markGitHubRepositoryReachable(): void {
  githubConnectivityIssue.value = false;
}

export function markGitHubRepositoryUnreachable(_repository: string, error: unknown): void {
  if (!isGitHubConnectivityError(error)) {
    return;
  }

  githubConnectivityIssue.value = true;
}

export function useGitHubConnectivityStatus() {
  return {
    hasGitHubConnectivityIssue: computed(() => githubConnectivityIssue.value),
  };
}
