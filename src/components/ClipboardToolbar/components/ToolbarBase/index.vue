<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-footer
    class="clipboard-toolbar"
    :height="$utils.getCSSVar('--clipboard-toolbar-height')"
    fixed
    inset
    app
  >
    <div class="clipboard-toolbar__content fade-in-1s">
      <slot name="content" />
    </div>
  </v-footer>
</template>

<script>
export default {}
</script>

<style>
#app
  .clipboard-toolbar {
    z-index: 3;
    width: 100%;
    padding: 0px 24px;
    margin-top: 0;
    background-color: rgba(var(--bg-color-1-value), 0.5);
    backdrop-filter: blur(8px);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.1);
  }

#app
  .clipboard-toolbar__content {
    display: flex;
    align-items: center;
    color: var(--icon-color-2);
  }

#app
  .clipboard-toolbar__icon {
    color: var(--icon-color-2);
  }

#app
  .clipboard-toolbar__button {
    margin: 0px 4px;
    color: var(--icon-color-2);
  }

#app
  .clipboard-toolbar__description {
    margin-right: 16px;
    font-size: 14px;
    user-select: none;
  }
</style>