// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const ARCHIVE_ZIP_ENCODING_LABELS = [
  'shift_jis',
  'gb2312',
  'big5',
  'ks_c_5601-1987',
  'Windows-1258',
  'Windows-874',
  'Windows-1256',
  'Windows-1255',
  'Windows-1254',
  'IBM437',
  'Windows-1252',
  'Windows-1250',
  'Windows-1251',
  'Windows-1253',
  'Windows-1257',
  'macintosh',
] as const;

export type ArchiveZipEncodingLabel = typeof ARCHIVE_ZIP_ENCODING_LABELS[number];

export type ArchiveEncodingSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: 'eastAsian' | 'southeastAsian' | 'middleEast' | 'european';
};

export const ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE = '__system_default__';

export function createArchiveEncodingSelectOptions(
  translate: (key: string) => string,
): ArchiveEncodingSelectOption[] {
  return [
    {
      value: ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE,
      label: translate('fileBrowser.archive.optionsDialog.encodingSystemDefault'),
    },
    {
      value: 'UTF-8',
      label: 'UTF-8',
    },
    {
      value: '---east-asian',
      label: '',
      disabled: true,
      group: 'eastAsian',
    },
    {
      value: 'shift_jis',
      label: 'Shift JIS (Japanese)',
    },
    {
      value: 'gb2312',
      label: 'GB2312 (Simplified Chinese)',
    },
    {
      value: 'big5',
      label: 'Big5 (Traditional Chinese)',
    },
    {
      value: 'ks_c_5601-1987',
      label: 'Korean (ks_c_5601-1987)',
    },
    {
      value: '---southeast-asian',
      label: '',
      disabled: true,
      group: 'southeastAsian',
    },
    {
      value: 'Windows-1258',
      label: 'Windows-1258 (Vietnamese)',
    },
    {
      value: 'Windows-874',
      label: 'Windows-874 (Thai)',
    },
    {
      value: '---middle-east',
      label: '',
      disabled: true,
      group: 'middleEast',
    },
    {
      value: 'Windows-1256',
      label: 'Windows-1256 (Arabic)',
    },
    {
      value: 'Windows-1255',
      label: 'Windows-1255 (Hebrew)',
    },
    {
      value: 'Windows-1254',
      label: 'Windows-1254 (Turkish)',
    },
    {
      value: '---european',
      label: '',
      disabled: true,
      group: 'european',
    },
    {
      value: 'IBM437',
      label: 'IBM437 (ZIP default)',
    },
    {
      value: 'Windows-1252',
      label: 'Windows-1252 (Western European)',
    },
    {
      value: 'Windows-1250',
      label: 'Windows-1250 (Central European)',
    },
    {
      value: 'Windows-1251',
      label: 'Windows-1251 (Cyrillic)',
    },
    {
      value: 'Windows-1253',
      label: 'Windows-1253 (Greek)',
    },
    {
      value: 'Windows-1257',
      label: 'Windows-1257 (Baltic)',
    },
    {
      value: 'macintosh',
      label: 'Macintosh',
    },
  ];
}

export function getSelectableArchiveEncodingValues(
  options: ArchiveEncodingSelectOption[],
): Set<string> {
  return new Set(
    options
      .filter(option => !option.group && !option.disabled)
      .map(option => option.value),
  );
}
