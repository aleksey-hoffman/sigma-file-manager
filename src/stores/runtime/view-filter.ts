// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import formatDateTime from '@/utils/format-date-time';
import toReadableBytes from '@/utils/to-readable-bytes';
import type { ViewFilter } from '@/types/view-filter';

export const useViewFilterStore = defineStore('viewFilter', () => {
  const showHiddenItems = ref(true);

  const viewFilter = ref<ViewFilter>({
    navigator: {
      options: {
        glob: false,
      },
      properties: [
        {
          name: 'name',
          title: 'filter.prefixes.itemName',
          prefix: 'name',
          itemPropertyPath: 'name',
        },
        {
          name: 'itemCount',
          title: 'filter.prefixes.directoryItemCount',
          prefix: 'items',
          itemPropertyPath: 'dirItemCount',
        },
        {
          name: 'fileSize',
          title: 'filter.prefixes.fileSize',
          prefix: 'size',
          itemPropertyPath: 'size',
          processing: itemPropertyValue => toReadableBytes(Number(itemPropertyValue)),
        },
        {
          name: 'dateMetaModified',
          title: 'filter.prefixes.dateMetaModified',
          prefix: 'date-c',
          itemPropertyPath: 'created_time',
          processing: itemPropertyValue => formatDateTime(new Date(itemPropertyValue), 'D MMM YYYY'),
        },
        {
          name: 'dateMetaModified',
          title: 'filter.prefixes.dateMetaModified',
          prefix: 'date-m',
          itemPropertyPath: 'modified_time',
          processing: itemPropertyValue => formatDateTime(new Date(itemPropertyValue), 'D MMM YYYY'),
        },
        {
          name: 'dateMetaModified',
          title: 'filter.prefixes.dateMetaModified',
          prefix: 'date-a',
          itemPropertyPath: 'accessed_time',
          processing: itemPropertyValue => formatDateTime(new Date(itemPropertyValue), 'D MMM YYYY'),
        },
      ],
    },
    notes: {
      options: {
        glob: false,
      },
      properties: [
        {
          name: 'title',
          title: 'filter.prefixes.noteTitle',
          prefix: 'title',
          itemPropertyPath: 'title',
        },
        {
          name: 'content',
          title: 'filter.prefixes.noteContent',
          prefix: 'content',
          itemPropertyPath: 'content',
        },
        {
          name: 'group',
          title: 'filter.prefixes.noteGroup',
          prefix: 'group',
          itemPropertyPath: 'group',
        },
      ],
    },
    dashboard: {
      options: {
        glob: false,
      },
      properties: [
        {
          name: 'path',
          title: 'filter.prefixes.itemPath',
          prefix: 'path',
          itemPropertyPath: 'path',
        },
      ],
    },
    settings: {
      options: {
        glob: false,
      },
      properties: [
        {
          name: 'tags',
          title: 'filter.prefixes.settingTags',
          prefix: 'tags',
          itemPropertyPath: 'tags',
        },
      ],
    },
    extensions: {
      options: {
        glob: false,
      },
      properties: [
        {
          name: 'name',
          title: 'extension name',
          prefix: 'name',
          itemPropertyPath: 'name',
        },
        {
          name: 'description',
          title: 'extension description',
          prefix: 'desc',
          itemPropertyPath: 'description',
        },
        {
          name: 'extensionPublisher',
          title: 'extension publisher',
          prefix: 'publisher',
          itemPropertyPath: 'publisher',
        },
      ],
    },
  });

  return {
    showHiddenItems,
    viewFilter,
  };
});
