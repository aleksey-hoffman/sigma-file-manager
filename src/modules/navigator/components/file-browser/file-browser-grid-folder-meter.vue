<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  fraction: number;
  sizing: boolean;
  large: boolean;
}>();

const SCALE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

const meterStyle = computed(() => ({
  '--folder-meter-fraction': String(props.sizing ? 1 : props.fraction),
}));
</script>

<template>
  <div
    class="file-browser-grid-folder-meter"
    :class="{
      'file-browser-grid-folder-meter--large': props.large,
      'file-browser-grid-folder-meter--sizing': props.sizing,
      'file-browser-grid-folder-meter--empty': !props.sizing && props.fraction <= 0,
    }"
    :style="meterStyle"
    aria-hidden="true"
  >
    <div class="file-browser-grid-folder-meter__body">
      <div class="file-browser-grid-folder-meter__dots">
        <div class="file-browser-grid-folder-meter__track">
          <div class="file-browser-grid-folder-meter__fill">
            <div
              v-if="props.sizing"
              class="file-browser-grid-folder-meter__pulse"
            />
          </div>
        </div>
        <div class="file-browser-grid-folder-meter__reveal" />
      </div>
      <div
        v-if="props.large"
        class="file-browser-grid-folder-meter__scale"
      >
        <span
          v-for="unit in SCALE_UNITS"
          :key="unit"
        >{{ unit }}</span>
      </div>
    </div>
    <div class="file-browser-grid-folder-meter__tab" />
  </div>
</template>

<style scoped>
.file-browser-grid-folder-meter {
  --folder-meter-tab-width: 40%;
  --folder-meter-tab-radius: 5px;
  --folder-meter-dot-pitch: 5px;
  --folder-meter-dot-radius: 0.9px;
  --folder-meter-surface: hsl(var(--background));
  --folder-meter-line: hsl(var(--border));
  --folder-meter-dot-on: hsl(var(--primary));
  --folder-meter-dot-off: hsl(var(--foreground) / 10%);
  --folder-meter-dot-pulse: color-mix(in oklab, var(--folder-meter-dot-on), white 62%);

  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dark .file-browser-grid-folder-meter {
  --folder-meter-surface: hsl(var(--background-2));
  --folder-meter-dot-on: color-mix(in oklch, hsl(var(--primary)), white 38%);
  --folder-meter-dot-off: hsl(var(--foreground) / 11%);
  --folder-meter-dot-pulse: color-mix(in oklab, var(--folder-meter-dot-on), white 60%);
}

.file-browser-grid-folder-meter--large {
  --folder-meter-tab-radius: 9px;
  --folder-meter-dot-pitch: 7px;
  --folder-meter-dot-radius: 1.15px;
}

.file-browser-grid-folder-meter__body {
  position: absolute;
  overflow: hidden;
  border: 1px solid var(--folder-meter-line);
  border-radius: 0 var(--folder-meter-radius) var(--folder-meter-radius) var(--folder-meter-radius);
  background: var(--folder-meter-surface);
  inset: var(--folder-meter-tab-height) 0 0;
}

.file-browser-grid-folder-meter__tab {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  width: var(--folder-meter-tab-width);
  height: calc(var(--folder-meter-tab-height) + 1px);
  border: 1px solid var(--folder-meter-line);
  border-radius: var(--folder-meter-tab-radius) var(--folder-meter-tab-radius) 0 0;
  border-bottom: 0;
  background: var(--folder-meter-surface);
}

.file-browser-grid-folder-meter__dots {
  position: absolute;
  inset: 0;
  -webkit-mask:
    radial-gradient(
      circle,
      #000000 var(--folder-meter-dot-radius),
      transparent calc(var(--folder-meter-dot-radius) + 0.7px)
    )
    right 0 top 0 / var(--folder-meter-dot-pitch) var(--folder-meter-dot-pitch);
  mask:
    radial-gradient(
      circle,
      #000000 var(--folder-meter-dot-radius),
      transparent calc(var(--folder-meter-dot-radius) + 0.7px)
    )
    right 0 top 0 / var(--folder-meter-dot-pitch) var(--folder-meter-dot-pitch);
}

.file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__dots {
  -webkit-mask-position: 0 0;
  mask-position: 0 0;
}

.file-browser-grid-folder-meter__track,
.file-browser-grid-folder-meter__fill,
.file-browser-grid-folder-meter__pulse,
.file-browser-grid-folder-meter__reveal {
  position: absolute;
}

.file-browser-grid-folder-meter__track {
  top: 5px;
  right: 10px;
  bottom: 5px;
  width: 5px;
  background: var(--folder-meter-dot-off);
}

.file-browser-grid-folder-meter__fill {
  overflow: hidden;
  height: calc(100% * var(--folder-meter-fraction));
  background: var(--folder-meter-dot-on);
  inset-block-end: 0;
  inset-inline: 0;
}

.file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__track {
  width: auto;
  height: 21px;
  inset: 63px 14px auto;
}

.file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__fill {
  width: calc(100% * var(--folder-meter-fraction));
  height: auto;
  inset-block: 0;
  inset-inline: 0 auto;
}

@supports (width: round(down, 10px, 7px)) {
  .file-browser-grid-folder-meter__track {
    bottom: auto;
    height: round(down, calc(100% - 8px), var(--folder-meter-dot-pitch));
  }

  .file-browser-grid-folder-meter__fill {
    height: round(up, calc(100% * var(--folder-meter-fraction)), var(--folder-meter-dot-pitch));
  }

  .file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__track {
    right: auto;
    width: round(down, calc(100% - 28px), var(--folder-meter-dot-pitch));
    height: 21px;
  }

  .file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__fill {
    width: round(up, calc(100% * var(--folder-meter-fraction)), var(--folder-meter-dot-pitch));
    height: auto;
  }
}

.file-browser-grid-folder-meter--empty .file-browser-grid-folder-meter__fill {
  display: none;
}

.file-browser-grid-folder-meter--sizing .file-browser-grid-folder-meter__fill {
  background: transparent;
}

.file-browser-grid-folder-meter__pulse {
  animation: folder-meter-pulse-rise 1.1s linear infinite;
  background: linear-gradient(0deg, transparent 25%, var(--folder-meter-dot-pulse) 50%, transparent 75%);
  inset: 0;
}

.file-browser-grid-folder-meter--large .file-browser-grid-folder-meter__pulse {
  animation-name: folder-meter-pulse-sweep;
  background: linear-gradient(90deg, transparent 25%, var(--folder-meter-dot-pulse) 50%, transparent 75%);
}

.file-browser-grid-folder-meter__reveal {
  background:
    radial-gradient(
      120px circle at var(--folder-meter-pointer-x, -999px)
      calc(var(--folder-meter-pointer-y, -999px) - var(--folder-meter-tab-height)),
      color-mix(in oklab, var(--folder-meter-dot-on) 75%, transparent),
      transparent 70%
    );
  inset: 0;
  opacity: 0;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.file-browser-grid-card:hover .file-browser-grid-folder-meter__reveal {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.file-browser-grid-folder-meter__scale {
  position: absolute;
  top: 89px;
  display: flex;
  justify-content: space-between;
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 500;
  inset-inline: 14px;
  letter-spacing: 0.08em;
  line-height: 1;
}

@keyframes folder-meter-pulse-sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}

@keyframes folder-meter-pulse-rise {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(-100%);
  }
}
</style>
