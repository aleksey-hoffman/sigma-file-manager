<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

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
  --dashboard-hero-bleed: 32px;

  position: relative;
  display: flex;
  flex-direction: column;
  padding: 36px var(--dashboard-hero-bleed) 0;
  gap: 32px;
  margin-inline: calc(-1 * var(--dashboard-hero-bleed));
}

.dashboard-hero__backdrop {
  position: absolute;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  inset: 0;
  mask-image: linear-gradient(180deg, #000000 40%, transparent);
  pointer-events: none;
}

.dashboard-hero__backdrop::before {
  position: absolute;
  width: 70%;
  background-image: var(--dashboard-hero-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  content: "";
  inset: 0 0 0 auto;
  mask-image: linear-gradient(90deg, transparent, #000000 60%);
  pointer-events: none;
}

.dashboard-hero__header {
  position: relative;
  max-width: 60%;
}

.dashboard-hero__footer {
  position: relative;
}

@media (width <= 768px) {
  .dashboard-hero {
    --dashboard-hero-bleed: 16px;

    padding: 28px var(--dashboard-hero-bleed) 0;
    gap: 24px;
  }

  .dashboard-hero__backdrop::before {
    width: 100%;
    mask-image: linear-gradient(90deg, transparent 20%, rgb(0 0 0 / 60%));
  }

  .dashboard-hero__header {
    max-width: 100%;
  }
}
</style>
