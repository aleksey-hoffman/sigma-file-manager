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
  clearExtensionModals,
  registerPaletteFormHandler,
  unregisterPaletteFormHandler,
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

  it('setContent preserves existing values for matching ids', () => {
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
});
