<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
</script>

<template>
  <div
    class="sigma-ui-drawer-footer"
    :class="[$attrs.class]"
  >
    <slot />
  </div>
</template>

<style>
.sigma-ui-drawer-footer {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  margin-top: auto;
  gap: 0.5rem;
}
</style>
