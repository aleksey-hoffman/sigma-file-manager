// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import 'vue-router';

export type LayoutType = 'app' | 'quick-view';

declare module 'vue-router' {
  interface RouteMeta {
    layout?: LayoutType;
  }
}
