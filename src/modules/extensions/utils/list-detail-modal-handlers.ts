// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  updateModalSelection,
  updateModalSearch,
  updateModalFilter,
} from '@/modules/extensions/api/modal-state';

export function createListDetailModalHandlers(getModalId: () => string | undefined) {
  function handleSelectionChange(itemId: string | null): void {
    const modalId = getModalId();

    if (modalId) {
      void updateModalSelection(modalId, itemId);
    }
  }

  function handleSearchChange(searchQuery: string): void {
    const modalId = getModalId();

    if (modalId) {
      void updateModalSearch(modalId, searchQuery);
    }
  }

  function handleFilterChange(filterValue: string): void {
    const modalId = getModalId();

    if (modalId) {
      void updateModalFilter(modalId, filterValue);
    }
  }

  return {
    handleSelectionChange,
    handleSearchChange,
    handleFilterChange,
  };
}
