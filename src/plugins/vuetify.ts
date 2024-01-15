// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import 'vuetify/styles';
import {createVuetify} from 'vuetify';
import {md3} from 'vuetify/blueprints';

export default createVuetify({
  blueprint: md3,
  theme: {defaultTheme: 'dark'}
});
