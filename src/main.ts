// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {createPinia} from 'pinia';
import {createApp} from 'vue';
import App from './App.vue';
import router from './router';
import {i18n} from '@/localization';

const app = createApp(App);

app.use(createPinia());
app.use(i18n);
app.use(router);
app.mount('#app');
