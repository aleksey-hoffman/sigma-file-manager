<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
interface Props {
  hoverEnabled?: boolean;
  renderContents?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hoverEnabled: true,
  renderContents: true
});
</script>

<template>
  <div
    class="dir-entry-card-base"
    design="basic"
    hover-effect="highlight"
    :hover-enabled="props.hoverEnabled"
  >
    <div
      v-if="renderContents"
      class="dir-entry-card-base__inner fade-in-200ms"
    >
      <slot />
    </div>

    <div class="dir-entry-card-base__overlay-container">
      <div
        class="dir-entry-card-base__overlay dir-entry-card-base__overlay--hover"
      />
    </div>
  </div>
</template>

<style>
.dir-entry-card-base {
  position: relative;
  width: 100%;
  height: 100%;
}

.dir-entry-card-base[hover-effect="scale"][hover-enabled="true"]:hover {
  z-index: 2;
  transform: scale(1.02);
  transition: none;
}

.dir-entry-card-base:not([item-hover-is-paused])[hover-effect="scale"][hover-enabled="true"]:hover {
  box-shadow: 0 4px 32px rgb(0 0 0 / 10%);
  transform: scale(1.02);
}


.dir-entry-card-base[hover-effect="highlight"][hover-enabled="true"]:hover
  .dir-entry-card-base__overlay--hover {
    opacity: 1;
  }

.dir-entry-card-base[design="basic"] {
  border-radius: 0;
  border-bottom: 1px solid var(--divider-color-lighter-1);
  background-color: transparent;
}

.dir-entry-grid-dir-card
  .dir-entry-card-base[design="basic"],
.dir-entry-grid-file-card
  .dir-entry-card-base[design="basic"] {
    border: 1px solid var(--divider-color-lighter-1);
  }

.dir-entry-card-base[design="infusive-extruded"] {
  border: 1px solid transparent;
  background-color: var(--infusive-extruded-bg-color);
  box-shadow: var(--infusive-extruded-shadow);
}

.dir-entry-card-base[design="infusive-extruded"][hover-enabled="true"]:hover {
  border: 1px solid var(--infusive-extruded-bg-color);
  background-color: rgb(0 0 0 / 0%);
  box-shadow: none;
}

.dir-entry-card-base[design="infusive-flat-glow"] {
  background-color: var(--infusive-flat-glow-bg-color);
}

.dir-entry-card-base[design="infusive-flat-glow"][hover-enabled="true"]:hover {
  box-shadow: var(--infusive-flat-glow-shadow-onhover);
}

.dir-entry-card-base__inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.dir-entry-card-base__overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.dir-entry-card-base__overlay {
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  outline-offset: -2px;
  pointer-events: none;
}

.dir-entry-card-base__overlay--hover {
  background-color: var(--highlight-color-opacity-5);
  opacity: 0;
}
</style>