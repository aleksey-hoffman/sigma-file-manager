// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { InjectionKey, Ref } from 'vue';

export { default as DirEntryInteractive } from './dir-entry-interactive.vue';
export { default as DirEntryContextMenu } from './dir-entry-context-menu.vue';

export const CONTEXT_MENU_OPEN_COUNT_KEY: InjectionKey<Ref<number>> = Symbol('dir-entry-context-menu-open-count');
