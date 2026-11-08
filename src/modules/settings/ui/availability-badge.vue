<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <span class="settings-availability-badge">
    <slot />
  </span>
</template>

<style scoped>
.settings-availability-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  background-color: hsl(var(--warning) / 12%);
  color: hsl(var(--warning));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}
</style>
