<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="settings-header">
    <h1 class="settings-header__title">
      {{ t('pages.settings') }}
    </h1>
    <div class="settings-header__content">
      <img
        :src="'/src/assets/icons/logo-1024x1024.png'"
        width="64px"
      >
      <div class="settings-header__title-section">
        <p class="settings-header__description">
          <strong>"{{ t('app.name') }}"</strong>
          {{ t('app.description') }}
          <br>{{ t('app.copyright') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-header {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;
  padding-bottom: 0;
}

.settings-header__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border-bottom: 1px solid hsl(var(--border));
  gap: 2rem;
}

.settings-header__title-section {
  flex: 1;
}

.settings-header__title {
  color: hsl(var(--foreground));
  font-size: 1.875rem;
  font-weight: 700;
}

.settings-header__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

@media (width <= 768px) {
  .settings-header__content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
}
</style>
