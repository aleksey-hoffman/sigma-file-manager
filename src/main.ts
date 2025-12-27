// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app.vue';
import router from './router';
import { i18n } from '@/localization';
import VWave from 'v-wave';

import './styles/index.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VWave, {
  cancellationPeriod: 0,
  color: 'hsl(var(--primary))',
});
app.mount('#app');
