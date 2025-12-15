// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { messages } from 'src/localization/data';
import fs from 'node:fs';
import path from 'node:path';

const localeDirPath = path.resolve('src/localization/messages');

async function syncFiles() {
  for (const locale in messages) {
    if (locale !== 'en') {
      let otherLocaleData = messages[locale];
      otherLocaleData = addMissingKeys(messages.en, messages[locale]);
      otherLocaleData = removeUneededKeys(messages.en, messages[locale]);
      const otherLocalePath = path.join(localeDirPath, `${locale}.json`);

      let currentState = {};

      try {
        currentState = JSON.parse(fs.readFileSync(otherLocalePath, 'utf8'));
      }
      catch (error) {
        console.error(`Error reading file ${otherLocalePath}:`, error);
      }

      if (JSON.stringify(currentState) !== JSON.stringify(otherLocaleData)) {
        fs.writeFileSync(otherLocalePath, JSON.stringify(otherLocaleData, null, 2));
      }
    }
  }
}

function addMissingKeys(enLocale, otherLocale) {
  for (const key in enLocale) {
    if (!otherLocale[key]) {
      otherLocale[key] = enLocale[key];
    }
    else if (typeof enLocale[key] === 'object') {
      addMissingKeys(enLocale[key], otherLocale[key]);
    }
  }

  return otherLocale;
}

function removeUneededKeys(enLocale, otherLocale) {
  for (const key in otherLocale) {
    if (!enLocale[key]) {
      delete otherLocale[key];
    }
    else if (typeof otherLocale[key] === 'object') {
      removeUneededKeys(enLocale[key], otherLocale[key]);
    }
  }

  return otherLocale;
}

syncFiles();
