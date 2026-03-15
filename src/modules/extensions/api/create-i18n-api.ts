// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { i18n } from '@/localization';
import { messages as appMessages } from '@/localization/data';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

export type ExtensionLocaleMessages = Record<string, Record<string, string>>;

export function createI18nAPI(context: ExtensionContext) {
  const extensionNamespace = `extensions.${context.extensionId}`;

  function mergeExtensionMessages(messages: Record<string, Record<string, string>>) {
    const parts = context.extensionId.split('.');

    for (const [locale, localeMessages] of Object.entries(messages)) {
      if (!localeMessages || typeof localeMessages !== 'object') continue;
      let nested: Record<string, unknown> = localeMessages;

      for (let idx = parts.length - 1; idx >= 0; idx--) {
        nested = { [parts[idx]]: nested };
      }

      const toMerge = { extensions: nested };
      i18n.global.mergeLocaleMessage(locale, toMerge);
    }
  }

  async function loadExtensionMessages(basePath: string): Promise<ExtensionLocaleMessages> {
    const appLocales = Object.keys(appMessages) as string[];
    const normalizedBase = basePath.replace(/\/+$/, '');
    let enMessages: Record<string, string> | null = null;
    const enPath = normalizedBase ? `${normalizedBase}/en.json` : 'en.json';
    const enExists = await invokeAsExtension<boolean>(context.extensionId, 'extension_path_exists', {
      extensionId: context.extensionId,
      filePath: enPath,
    });

    if (enExists) {
      try {
        const bytes = await invokeAsExtension<number[]>(context.extensionId, 'read_extension_file', {
          extensionId: context.extensionId,
          filePath: enPath,
        });
        const content = new TextDecoder().decode(new Uint8Array(bytes));
        const parsed = JSON.parse(content) as Record<string, string>;
        if (parsed && typeof parsed === 'object') enMessages = parsed;
      }
      catch {
      }
    }

    const messages: ExtensionLocaleMessages = {};

    for (const locale of appLocales) {
      const filePath = normalizedBase ? `${normalizedBase}/${locale}.json` : `${locale}.json`;
      const exists = await invokeAsExtension<boolean>(context.extensionId, 'extension_path_exists', {
        extensionId: context.extensionId,
        filePath,
      });

      if (exists) {
        try {
          const bytes = await invokeAsExtension<number[]>(context.extensionId, 'read_extension_file', {
            extensionId: context.extensionId,
            filePath,
          });
          const content = new TextDecoder().decode(new Uint8Array(bytes));
          const parsed = JSON.parse(content) as Record<string, string>;
          if (parsed && typeof parsed === 'object') messages[locale] = parsed;
          else if (enMessages) messages[locale] = enMessages;
        }
        catch {
          if (enMessages) messages[locale] = enMessages;
        }
      }
      else if (enMessages) {
        messages[locale] = enMessages;
      }
    }

    return messages;
  }

  return {
    t: (key: string, params?: Record<string, string | number>) => context.t(key, params),
    mergeMessages: mergeExtensionMessages,
    mergeFromPath: async (basePath: string) => {
      const messages = await loadExtensionMessages(basePath);
      if (Object.keys(messages).length > 0) mergeExtensionMessages(messages);
    },
    extensionT: (key: string, params?: Record<string, string | number>, fallback?: string) => {
      const namespacedKey = `${extensionNamespace}.${key}`;
      const translated = context.t(namespacedKey, params);

      if (translated === namespacedKey && fallback !== undefined) {
        return fallback;
      }

      return translated;
    },
    getLocale: () => i18n.global.locale.value,
    loadFromPath: loadExtensionMessages,
  };
}
