// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  createModal,
  getActiveModals,
  getModalInstance,
  closeModal,
  submitModal,
  updateModalValue,
  updateModalSelection,
  clearExtensionModals,
  registerPaletteFormHandler,
  unregisterPaletteFormHandler,
  setPendingModalCommandTitle,
} from '@/modules/extensions/api/modal-state';

function createOptions() {
  return {
    title: 'Test Modal',
    content: [
      {
        type: 'input' as const,
        id: 'name',
        value: 'initial',
      },
      {
        type: 'checkbox' as const,
        id: 'active',
        value: true,
      },
      {
        type: 'select' as const,
        id: 'choice',
        options: [{
          value: 'a',
          label: 'A',
        }, {
          value: 'b',
          label: 'B',
        }],
        value: 'a',
      },
      { type: 'separator' as const },
      {
        type: 'text' as const,
        value: 'Label only',
      },
    ],
    buttons: [{
      id: 'submit',
      label: 'Submit',
    }],
  };
}

describe('modal-state', () => {
  async function waitForStandaloneModal(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  beforeEach(() => {
    unregisterPaletteFormHandler();
    registerPaletteFormHandler(() => {});
    clearExtensionModals('test.ext');
  });

  afterEach(() => {
    const modals = getActiveModals().value;
    modals.forEach(modal => closeModal(modal.id));
  });

  it('creates modal with correct initial values', () => {
    const handle = createModal('test.ext', createOptions());

    const values = handle.getValues();
    expect(values.name).toBe('initial');
    expect(values.active).toBe(true);
    expect(values.choice).toBe('a');
    expect(values).not.toHaveProperty('separator');
  });

  it('updateModalValue updates values and triggers onValueChange', () => {
    const handle = createModal('test.ext', createOptions());
    const instance = getModalInstance(getActiveModals().value[0].id)!;

    const onValueChange = vi.fn();
    handle.onValueChange(onValueChange);

    updateModalValue(instance.id, 'name', 'updated');

    expect(instance.values.name).toBe('updated');
    expect(onValueChange).toHaveBeenCalledWith('name', 'updated', expect.objectContaining({ name: 'updated' }));
  });

  it('submitModal calls onSubmit and closes when callback returns non-false', async () => {
    const handle = createModal('test.ext', createOptions());
    const instance = getActiveModals().value[0];

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    handle.onSubmit(onSubmit);

    const closed = await submitModal(instance.id, 'submit');

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'initial' }), 'submit');
    expect(closed).toBe(true);
    expect(getActiveModals().value).toHaveLength(0);
  });

  it('submitModal does not close when callback returns false', async () => {
    const handle = createModal('test.ext', createOptions());
    const instance = getActiveModals().value[0];

    handle.onSubmit(() => false);

    const closed = await submitModal(instance.id, 'submit');

    expect(closed).toBe(false);
    expect(getActiveModals().value).toHaveLength(1);
    closeModal(instance.id);
  });

  it('closeModal triggers onClose and removes modal', () => {
    const handle = createModal('test.ext', createOptions());
    const instance = getActiveModals().value[0];

    const onClose = vi.fn();
    handle.onClose(onClose);

    closeModal(instance.id);

    expect(onClose).toHaveBeenCalled();
    expect(getActiveModals().value).toHaveLength(0);
  });

  it('handle.close() closes the modal', () => {
    const handle = createModal('test.ext', createOptions());
    const instance = getActiveModals().value[0];

    handle.close();

    expect(getModalInstance(instance.id)).toBeUndefined();
  });

  it('clearExtensionModals closes all modals for extension', () => {
    createModal('test.ext', createOptions());
    createModal('test.ext', {
      ...createOptions(),
      title: 'Second',
    });
    createModal('other.ext', createOptions());

    clearExtensionModals('test.ext');

    const active = getActiveModals().value;
    expect(active).toHaveLength(1);
    expect(active[0].extensionId).toBe('other.ext');
    closeModal(active[0].id);
  });

  it('updateElement updates content and values', () => {
    const handle = createModal('test.ext', createOptions());

    handle.updateElement('name', { value: 'patched' });

    const values = handle.getValues();
    expect(values.name).toBe('patched');
  });

  it('setContent preserves existing values for matching ids by default', () => {
    const handle = createModal('test.ext', createOptions());
    handle.updateElement('name', { value: 'changed' });

    handle.setContent([
      {
        type: 'input' as const,
        id: 'name',
        value: 'ignored',
      },
      {
        type: 'input' as const,
        id: 'newField',
        value: 'new',
      },
    ]);

    const values = handle.getValues();
    expect(values.name).toBe('changed');
    expect(values.newField).toBe('new');
  });

  it('setContent replaces existing values when preserveValues is false', () => {
    const handle = createModal('test.ext', createOptions());
    handle.updateElement('name', { value: 'changed' });

    handle.setContent([
      {
        type: 'input' as const,
        id: 'name',
        value: 'replaced',
      },
    ], { preserveValues: false });

    const values = handle.getValues();
    expect(values.name).toBe('replaced');
  });

  it('routes to palette when handler is registered', () => {
    unregisterPaletteFormHandler();
    const handler = vi.fn();
    registerPaletteFormHandler(handler);

    createModal('test.ext', createOptions());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: 'test.ext',
        renderedInPalette: true,
      }),
    );

    unregisterPaletteFormHandler();
  });

  it('awaits async list-detail selection callbacks', async () => {
    unregisterPaletteFormHandler();
    const handle = createModal('test.ext', {
      title: 'History',
      layout: 'listDetail',
      listDetail: {
        items: [{
          id: 'a',
          title: 'Entry A',
        }],
        selectedItemId: 'a',
        searchQuery: '',
        filterValue: 'all',
        filterOptions: [],
        detail: null,
        detailFields: [],
      },
    });
    await waitForStandaloneModal();
    const instance = getActiveModals().value[0];
    let detailLoaded = false;

    handle.onSelectionChange(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      handle.setListDetail({
        selectedItemId: 'a',
        detail: {
          type: 'text',
          text: 'Entry A body',
        },
        detailFields: [{
          label: 'Type',
          value: 'Text',
        }],
      });
      detailLoaded = true;
    });

    await updateModalSelection(instance.id, 'a');

    expect(detailLoaded).toBe(true);
    expect(instance.listDetail?.detail).toEqual({
      type: 'text',
      text: 'Entry A body',
    });
    closeModal(instance.id);
    registerPaletteFormHandler(() => {});
  });

  it('consumes pending command title when modal omits commandTitle', async () => {
    unregisterPaletteFormHandler();
    setPendingModalCommandTitle('test.ext', 'Open History');

    createModal('test.ext', {
      title: 'Clipboard History',
      layout: 'listDetail',
      listDetail: {
        items: [],
        selectedItemId: null,
        searchQuery: '',
        filterValue: 'all',
        filterOptions: [],
        detail: null,
        detailFields: [],
      },
    });
    await waitForStandaloneModal();

    const instance = getActiveModals().value[0];
    expect(instance.options.commandTitle).toBe('Open History');
    closeModal(instance.id);
    registerPaletteFormHandler(() => {});
  });
});
