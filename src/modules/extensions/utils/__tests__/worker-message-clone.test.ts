// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import {
  cloneBridgeResult,
  cloneForWorkerMessage,
  stripNonCloneableValues,
} from '@/modules/extensions/utils/worker-message-clone';

describe('worker-message-clone', () => {
  it('strips functions from objects', () => {
    const input = {
      title: 'Modal',
      onSubmit: () => {},
      nested: {
        label: 'Paste',
        close: () => {},
      },
    };

    expect(stripNonCloneableValues(input)).toEqual({
      title: 'Modal',
      nested: {
        label: 'Paste',
      },
    });
  });

  it('clones modal options for worker postMessage', () => {
    const options = {
      title: 'Clipboard History',
      layout: 'listDetail',
      listDetail: {
        items: [{
          id: 'entry-1',
          title: 'Example',
          subtitle: 'Text',
        }],
        selectedItemId: 'entry-1',
        searchQuery: '',
        filterValue: 'all',
        filterOptions: [{
          value: 'all',
          label: 'All Types',
        }],
        detail: {
          type: 'files',
          filePaths: ['C:/Users/test/file.txt'],
        },
        detailFields: [{
          label: 'Type',
          value: 'Files',
        }],
      },
      buttons: [{
        id: 'paste',
        label: 'Paste',
        shortcut: { key: 'Enter' },
      }],
    };

    expect(() => cloneForWorkerMessage(options)).not.toThrow();
    expect(cloneForWorkerMessage(options)).toEqual(options);
  });

  it('converts reactive storage values into plain bridge results', () => {
    const history = reactive({
      version: 1,
      entries: [{
        id: 'entry-1',
        type: 'files',
        preview: '1 file',
        copiedAt: 1,
        pinned: false,
        fingerprint: 'abc',
        filePaths: ['C:/Users/test/file.txt'],
      }],
    });

    expect(() => cloneBridgeResult(history)).not.toThrow();
    expect(cloneBridgeResult(history)).toEqual({
      version: 1,
      entries: [{
        id: 'entry-1',
        type: 'files',
        preview: '1 file',
        copiedAt: 1,
        pinned: false,
        fingerprint: 'abc',
        filePaths: ['C:/Users/test/file.txt'],
      }],
    });
  });
});
