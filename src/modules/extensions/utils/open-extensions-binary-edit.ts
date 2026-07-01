// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import router from '@/router';

export async function openExtensionsBinaryEdit(extensionId: string): Promise<void> {
  await router.push({
    name: 'extensions',
    query: {
      tab: 'installed',
      editBinaries: extensionId,
    },
  });
}
