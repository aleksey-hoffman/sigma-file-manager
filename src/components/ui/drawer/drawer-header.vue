<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
</script>

<template>
  <div
    class="sigma-ui-drawer-header"
    :class="[$attrs.class]"
  >
    <slot />
  </div>
</template>

<style>
.sigma-ui-drawer-header {
  display: grid;
  padding: 1rem;
  gap: 0.375rem;
  text-align: center;
}

@media (width >= 640px) {
  .sigma-ui-drawer-header {
    text-align: left;
  }
}
</style>
