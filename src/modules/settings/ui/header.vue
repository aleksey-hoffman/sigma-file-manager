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
          FORK-MODIFICATION: 2026-10-13 换用用户给定的简介文案。

          原文案在 17 个语言包里都以 `"Alpha File Manager" ...` 开头,模板又在前面
          输出一次 app.name,于是渲染出两个连续的 `"Alpha File Manager"`,
          当初用 `.replace(/^"[^"]*"\s*/, '')` 把开头引语剥掉绕过。

          新文案本身已经是「加粗的品牌名 + 空格 + 正文」的结构:
            **Alpha File Manager** 基于 Sigma File Manager 二次开发,……
          所以 app.description 不再重复品牌名,引语也不需要了——
          正则与它对应的 FORK-MODIFICATION 注释一并删除,避免留下永不生效的兼容代码。
        -->
        <strong>{{ t('app.name') }}</strong>
        {{ t('app.description') }}
        <!--
          FORK-MODIFICATION: 验收反馈 2026-10-13 — 末尾增加官网链接。
          链接用 tauri-plugin-opener 的 open_external(若有),这里先用普通 <a target="_blank">。
        -->
        <br>
        {{ t('app.copyright') }} {{ t('app.developer') }} ——
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
