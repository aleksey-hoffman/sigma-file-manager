// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import fs from 'node:fs';
import path from 'node:path';

const localeDirectoryPath = path.resolve('src/localization/messages');

function addMissingKeys(enLocale, otherLocale) {
  for (const key of Object.keys(enLocale)) {
    const enChild = enLocale[key];
    if (!Object.hasOwn(otherLocale, key)) {
      otherLocale[key] = structuredClone(enChild);
    }
    else if (
      enChild !== null
      && typeof enChild === 'object'
      && !Array.isArray(enChild)
      && otherLocale[key] !== null
      && typeof otherLocale[key] === 'object'
      && !Array.isArray(otherLocale[key])
    ) {
      addMissingKeys(enChild, otherLocale[key]);
    }
  }
  return otherLocale;
}

function removeUnneededKeys(enLocale, otherLocale) {
  for (const key of Object.keys({ ...otherLocale })) {
    if (!Object.hasOwn(enLocale, key)) {
      delete otherLocale[key];
      continue;
    }
    const enChild = enLocale[key];
    if (
      enChild !== null
      && typeof enChild === 'object'
      && !Array.isArray(enChild)
      && otherLocale[key] !== null
      && typeof otherLocale[key] === 'object'
      && !Array.isArray(otherLocale[key])
    ) {
      removeUnneededKeys(enChild, otherLocale[key]);
    }
  }
  return otherLocale;
}

function syncFiles() {
  const englishPayload = JSON.parse(fs.readFileSync(path.join(localeDirectoryPath, 'en.json'), 'utf8'));

  const localeFileNames = fs.readdirSync(localeDirectoryPath).filter(
    name => name.endsWith('.json') && name !== 'en.json',
  );

  for (const fileName of localeFileNames) {
    const filePath = path.join(localeDirectoryPath, fileName);
    const localePayload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    addMissingKeys(englishPayload, localePayload);
    removeUnneededKeys(englishPayload, localePayload);
    fs.writeFileSync(filePath, `${JSON.stringify(localePayload, null, 2)}\n`);
  }
}

syncFiles();
