// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import { isFileBrowserEmptyAreaClickTarget } from '../file-browser-empty-area-click-target';

function createFileBrowserPane(): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'file-browser';
  pane.innerHTML = `
    <div class="file-browser-toolbar">
      <button type="button" data-target="toolbar">Back</button>
    </div>
    <div class="file-browser-list-view__header-container">
      <button type="button" data-target="header">Name</button>
    </div>
    <div class="file-browser__content">
      <div class="file-browser__scroll-area-viewport">
        <div data-target="viewport-stretch">
          <div class="file-browser__content-inner">
            <div class="file-browser__content-body">
              <div class="file-browser__entries-container">
                <div class="file-browser-list-view" data-target="list-empty-area">
                  <div class="file-browser-list-view__list">
                    <div class="file-browser-list-view__entry" data-entry-path="/docs/readme.md">
                      <span data-target="entry-name">readme.md</span>
                    </div>
                    <div class="file-browser-grid-section-bar" data-target="section">Folders</div>
                  </div>
                </div>
                <div class="file-browser-grid-view" data-target="grid-empty-area"></div>
              </div>
              <div class="file-browser__empty-state-container" data-target="empty-directory">Empty</div>
              <div class="file-browser-loading" data-target="loading">
                <div data-target="loading-row"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="file-browser-status-bar">
      <button type="button" data-target="footer">2 items</button>
    </div>
  `;
  document.body.appendChild(pane);

  return pane;
}

function targetIn(pane: HTMLElement, name: string): Element {
  const target = pane.querySelector(`[data-target="${name}"]`);

  if (!target) {
    throw new Error(`Missing click target: ${name}`);
  }

  return target;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isFileBrowserEmptyAreaClickTarget', () => {
  it('matches the space below the file list and the grid', () => {
    const pane = createFileBrowserPane();

    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'list-empty-area'))).toBe(true);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'grid-empty-area'))).toBe(true);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'viewport-stretch'))).toBe(true);
    expect(isFileBrowserEmptyAreaClickTarget(pane.querySelector('.file-browser__content-inner'))).toBe(true);
    expect(isFileBrowserEmptyAreaClickTarget(pane.querySelector('.file-browser__scroll-area-viewport'))).toBe(true);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'section'))).toBe(true);
  });

  it('does not match a file row, the header, the footer, or the toolbar', () => {
    const pane = createFileBrowserPane();
    const entryRow = pane.querySelector('[data-entry-path]');

    expect(isFileBrowserEmptyAreaClickTarget(entryRow)).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'entry-name'))).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'header'))).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'footer'))).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'toolbar'))).toBe(false);
  });

  it('does not match loading or an empty directory, which already activate on mousedown', () => {
    const pane = createFileBrowserPane();

    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'empty-directory'))).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'loading'))).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(targetIn(pane, 'loading-row'))).toBe(false);
  });

  it('ignores targets that are not elements', () => {
    const pane = createFileBrowserPane();
    const emptyArea = targetIn(pane, 'list-empty-area');
    const textNode = document.createTextNode(' ');
    emptyArea.appendChild(textNode);

    expect(isFileBrowserEmptyAreaClickTarget(null)).toBe(false);
    expect(isFileBrowserEmptyAreaClickTarget(textNode)).toBe(false);
  });
});
