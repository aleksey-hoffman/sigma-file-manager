<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）的
     `dashboard-hero.vue`，按本仓选定的方向 C「沉浸封面」排版。

     与 upstream 的四处刻意差异：
     1. **封面图向下不淡出**：upstream 的 hero 底部有一层
        `linear-gradient(180deg, #000 40%, transparent)`，背景图往下淡出接内容区 ——
        那更像「一层氛围」而不是「一张封面」。这里把它去掉，让背景图一直铺到
        Hero 底边，收在卡片的圆角与描边里，底边是一条干净的硬边。
     2. **浅色主题适配**：upstream 那张背景图是给**深色**主题做的，
        直接压在浅底上文字会糊，而且紫蓝曲面在浅底上太重。这里加了一层用
        `hsl(var(--background))` 做的横向白纱，并把背景图压到 0.5 不透明度 ——
        浅色主题下是白纱 + 淡色块，深色主题下自动变暗纱 + 原图，一套代码两个主题都对。
     3. **插槽放胶囊页签而不是四张计数卡**：页签是本仓的功能载体
        （收藏 / 已标记 / 常用 / 历史），不能换成 upstream 的计数卡。
     4. **出血到容器边缘**：本仓 page-layout 容器左右 padding 不相等
        （左 40px、右 46px），Hero 用负 margin 吃掉两边，左右分开写。

     左侧 42px 的悬停展开边栏不在本组件范围内，保持原有设计不动。 -->

<script setup lang="ts">
import dashboardHeroBackground from '@/assets/media/dashboard/dashboard-top-bg.jpg';

defineProps<{
  title: string;
  subtitle?: string;
}>();

const heroStyle = {
  '--dashboard-hero-image': `url("${dashboardHeroBackground}")`,
};
</script>

<template>
  <section
    class="dashboard-hero"
    :style="heroStyle"
  >
    <div
      class="dashboard-hero__backdrop"
      aria-hidden="true"
    />
    <header class="page-layout__header dashboard-hero__header">
      <h1 class="page-layout__title">
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        class="page-layout__subtitle"
      >
        {{ subtitle }}
      </p>
    </header>
    <div
      v-if="$slots.default"
      class="dashboard-hero__footer"
    >
      <slot />
    </div>
  </section>
</template>

<style>
.dashboard-hero {
  /* Hero 要「出血」到 page-layout 容器的边缘 —— 本仓容器左右 padding 不相等
     （左 40px、右 46px，右边多出来的是给滚动条留的位），所以要分开写。 */
  --dashboard-hero-bleed-left: 40px;
  --dashboard-hero-bleed-right: 46px;

  position: relative;
  display: flex;
  flex-direction: column;
  padding: 34px var(--dashboard-hero-bleed-right) 20px var(--dashboard-hero-bleed-left);
  gap: 22px;
  margin-inline: calc(-1 * var(--dashboard-hero-bleed-left)) calc(-1 * var(--dashboard-hero-bleed-right));
}

.dashboard-hero__backdrop {
  position: absolute;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  inset: 0;
  /* FORK-MODIFICATION：封面图**向下不淡出**。
     upstream 的 hero 底部有一层 `linear-gradient(180deg, #000 40%, transparent)`，
     背景图往下淡出接内容区 —— 那更像「一层氛围」而不是「一张封面」。
     这里要去掉它，让背景图一直铺到 Hero 底边，收在卡片的圆角与描边里，
     底边是一条干净的硬边。 */
  mask-image: none;
  pointer-events: none;
}

.dashboard-hero__backdrop::before {
  position: absolute;
  width: 100%;
  background-image: var(--dashboard-hero-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  content: "";
  inset: 0;
  /* 靠左淡出：左边留给标题和副标题，右边整片封面图铺满。 */
  mask-image: linear-gradient(90deg, transparent 4%, #000000 46%);
  /* FORK-MODIFICATION：浅色主题下把背景图压淡。
     upstream 那张紫蓝曲面在浅底上太重，右半边像「贴了半张图」。
     0.5 之后它变成一块柔和的色块，和浅色界面协调。 */
  opacity: 0.5;
  pointer-events: none;
}

/* 深色主题：背景图本来就是深色系（和 upstream 一致），压淡反而没东西了。
   `.dark` 由 `use-theme.ts` 加在 documentElement 上。 */
.dark .dashboard-hero__backdrop::before {
  opacity: 1;
}

/* FORK-MODIFICATION：浅色主题适配。
   upstream 的背景图是深色系（紫蓝曲面），直接压在浅底上，
   标题、副标题和落在图上的页签全部糊掉。
   这里用 `hsl(var(--background))` 叠一层横向渐变纱 ——
   浅色主题下是白纱，深色主题下自动变暗纱，两个主题都保证文字可读。 */
.dashboard-hero__backdrop::after {
  position: absolute;
  background: linear-gradient(
    90deg,
    hsl(var(--background) / 94%) 0%,
    hsl(var(--background) / 78%) 34%,
    hsl(var(--background) / 28%) 58%,
    hsl(var(--background) / 0%) 76%
  );
  content: "";
  inset: 0;
  pointer-events: none;
}

.dashboard-hero__header {
  position: relative;
  max-width: 66%;
  gap: 4px;
}

.dashboard-hero__header .page-layout__title {
  font-size: 1.95rem;
}

.dashboard-hero__header .page-layout__subtitle {
  font-size: 0.875rem;
}

.dashboard-hero__footer {
  position: relative;
}

@media (width <= 768px) {
  .dashboard-hero {
    --dashboard-hero-bleed-left: 16px;
    --dashboard-hero-bleed-right: 22px;

    padding-top: 24px;
    padding-bottom: 16px;
    gap: 16px;
  }

  .dashboard-hero__backdrop::before {
    mask-image: linear-gradient(90deg, transparent 20%, rgb(0 0 0 / 60%));
  }

  .dashboard-hero__header {
    max-width: 100%;
  }
}
</style>
