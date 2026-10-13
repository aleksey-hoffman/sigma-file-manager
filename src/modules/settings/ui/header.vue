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
        <!--
          FORK-MODIFICATION: 修设置页文案重复。
          `app.description` 在 17 个语言包里均以 `"Alpha File Manager" ...` 开头,
          而模板同时在前面输出 `app.name`,会渲染成两个连续的
          `"Alpha File Manager" "Alpha File Manager" 在 ...`。
          修法:模板里 `app.description` 用正则去掉开头的引语,
          保留 strong 版的 app.name 即可。
        -->
        <strong>"{{ t('app.name') }}"</strong>
        {{ t('app.description').replace(/^"[^"]*"\s*/, '') }}
        <br>{{ t('app.copyright') }}
        <!--
          FORK-MODIFICATION: 验收反馈 2026-10-13 — 末尾增加官网链接。
          链接用 tauri-plugin-opener 的 open_external(若有),这里先用普通 <a target="_blank">。
        -->
        <br>
        <a
          class="settings-header__link"
          href="https://www.aiec.fun"
          target="_blank"
          rel="noopener noreferrer"
        >https://www.aiec.fun</a>
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

.settings-header__link {
  color: hsl(var(--primary));
  text-decoration: none;
}

.settings-header__link:hover {
  text-decoration: underline;
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
