<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">

</script>

<template>
  <div
    class="sigma-ui-number-field-content"
    :class="$attrs.class"
  >
    <slot />
  </div>
</template>

<style>
.sigma-ui-number-field-content {
  position: relative;
}

.sigma-ui-number-field-content > [data-slot="input"]:has([data-slot="increment"]) {
  padding-right: 1.25rem;
}

.sigma-ui-number-field-content > [data-slot="input"]:has([data-slot="decrement"]) {
  padding-left: 1.25rem;
}
</style>
