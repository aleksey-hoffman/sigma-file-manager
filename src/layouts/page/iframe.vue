<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="page-iframe-layout">
    <div class="page-iframe-layout__container">
      <slot />
    </div>
  </div>
</template>

<style>
.page-iframe-layout {
  display: flex;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  height: 100%;
  flex-direction: column;
  padding-right: 6px;
  padding-bottom: 6px;
  border-radius: var(--radius-sm);
  user-select: none;
}

.page-iframe-layout__container {
  display: flex;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  box-sizing: border-box;
  flex: 1;
  flex-direction: column;
  padding: 0;
  border-radius: inherit;
  margin: 0;
}
</style>
