// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ListDetailState } from '@sigma-file-manager/api';

export function createDefaultListDetailState(
  partial: Partial<ListDetailState> = {},
): ListDetailState {
  return {
    items: [],
    selectedItemId: null,
    searchQuery: '',
    filterValue: 'all',
    filterOptions: [],
    detail: null,
    detailFields: [],
    ...partial,
  };
}

export function mergeListDetailState(
  current: ListDetailState,
  updates: Partial<ListDetailState>,
): ListDetailState {
  return {
    ...current,
    ...updates,
    items: updates.items ?? current.items,
    filterOptions: updates.filterOptions ?? current.filterOptions,
    detail: updates.detail !== undefined ? updates.detail : current.detail,
    detailFields: updates.detailFields ?? current.detailFields,
  };
}

export function getListDetailValues(state: ListDetailState): Record<string, unknown> {
  return {
    selectedItemId: state.selectedItemId,
    searchQuery: state.searchQuery,
    filterValue: state.filterValue,
  };
}
