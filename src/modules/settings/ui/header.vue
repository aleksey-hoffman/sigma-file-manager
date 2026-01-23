<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import logoImage from '@/assets/icons/logo-1024x1024.png';

const { t } = useI18n();
</script>

<template>
  <div class="settings-header">
    <img :src="logoImage">
    <div class="settings-header__title-section">
      <p class="settings-header__description">
        <strong>"{{ t('app.name') }}"</strong>
        {{ t('app.description') }}
        <br>{{ t('app.copyright') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  gap: 2rem;
}

.settings-header img {
  width: 64px;
  height: 64px;
}

.settings-header__title-section {
  flex: 1;
}

.settings-header__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

@media (width <= 768px) {
  .settings-header {
    font-size: 10px;
    gap: 1rem;
  }

  .settings-header img {
    width: 36px;
    height: 36px;
  }

   .settings-header__description {
     font-size: 0.75rem;
   }
}
</style>
