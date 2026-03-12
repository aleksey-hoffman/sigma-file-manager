<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="sigma-ui-toast-card">
    <slot />
  </div>
</template>

<style>
.sigma-ui-toast-card {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background) / 50%);
  box-shadow: var(--shadow-md);
  gap: 0.25rem;
  transition: backdrop-filter 160ms ease, background-color 160ms ease;
}
</style>
