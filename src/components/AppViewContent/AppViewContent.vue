<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="app-view-content custom-scrollbar">
    <div class="app-view-content__title-container">
      <div class="app-view-content__title">
        {{title}}
      </div>
      <div class="app-view-content__title-end">
        <slot name="title-end" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: '',
    },
  },
}
</script>

<style>
.app-view-content {
  padding: 8px 24px;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height)
  );
  overflow-x: hidden;
  overflow-y: overlay;
  user-select: none;
}

.app-view-content__title-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.app-view-content__title {
  font-size: 28px;
  color: var(--title-color-1);
}
</style>