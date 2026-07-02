// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionHttpRequestOptions,
  ExtensionHttpResponse,
} from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

type ExtensionHttpResponsePayload = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: number[];
};

function buildRequestUrl(
  url: string,
  query?: Record<string, string | number | boolean>,
): string {
  const parsedUrl = new URL(url);

  if (query) {
    for (const [queryKey, queryValue] of Object.entries(query)) {
      parsedUrl.searchParams.set(queryKey, String(queryValue));
    }
  }

  return parsedUrl.toString();
}

function encodeRequestBody(body: ExtensionHttpRequestOptions['body']): number[] | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === 'string') {
    return Array.from(new TextEncoder().encode(body));
  }

  return Array.from(body);
}

export function createHttpAPI(context: ExtensionContext) {
  return {
    request: async (options: ExtensionHttpRequestOptions): Promise<ExtensionHttpResponse> => {
      if (!context.hasPermission('http')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'http' }));
      }

      if (!context.httpAllowedHosts || context.httpAllowedHosts.length === 0) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'http' }));
      }

      const responsePayload = await invokeAsExtension<ExtensionHttpResponsePayload>(
        context.extensionId,
        'extension_http_request',
        {
          extensionId: context.extensionId,
          url: buildRequestUrl(options.url, options.query),
          method: options.method ?? 'GET',
          headers: options.headers,
          body: encodeRequestBody(options.body),
          timeoutMs: options.timeoutMs,
        },
      );

      return {
        ok: responsePayload.ok,
        status: responsePayload.status,
        headers: responsePayload.headers,
        body: new Uint8Array(responsePayload.body),
      };
    },
  };
}
