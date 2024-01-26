<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
</script>

<template>
  <div class="navigator-info-panel__preview">
    <div class="navigator-info-panel__media" />
  </div>
</template>

<style>
.navigator-info-panel__preview {
position: relative;
  width: var(--info-panel-width);
  height: var(--info-panel-preview-height);
  background-color: rgb(255 255 255 / 2%);
}

.navigator-info-panel__media * {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.navigator-info-panel__media-container *:focus {
  border: none;
  outline: none;
}

</style>