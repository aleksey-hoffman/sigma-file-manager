<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <VAppBar
    class="action-toolbar fade-in-500ms"
    app
    flat
    clipped-right
    height="42px"
    :transparent-toolbars="transparentToolbars"
  >
    <slot />
  </VAppBar>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      transparentToolbars: 'storageData.settings.theme.transparentToolbars',
    }),
  },
}
</script>

<style>
#app
  .v-toolbar__content
    > .v-btn.v-btn--icon:first-child {
      margin-left: 0;
    }

#app
  .action-toolbar {
    padding: 0px;
    margin-top: var(--window-toolbar-height) !important;
    background-color: var(--bg-color-1);
    outline: 1px solid var(--divider-color-1);
  }

#app
  .action-toolbar[transparent-toolbars] {
    background-color: transparent;
  }

#app
  .action-toolbar
    .v-toolbar__content {
      display: flex;
      align-items: center;
      gap: var(--toolbar-item-gap);
      padding:
        0px
        var(--window-toolbar-padding-right)
        0px
        var(--window-toolbar-padding-left) !important;
    }

#app
  .action-toolbar__icon {
    color: var(--icon-color-2) !important;
  }

#app
  .action-toolbar__icon--active {
    color: var(--icon-color-1) !important;
  }

#app
  .action-toolbar__icon[home-banner-value] {
    color: var(--color-4) !important;
  }

#app
  .action-toolbar__divider.v-divider--vertical {
    min-height: 75% !important;
    max-height: 75% !important;
    margin-top: auto;
    margin-bottom: auto;
    border-color: var(--divider-color-2) !important
  }

#app
  .v-btn-toggle.dir-item-layout-toggle {
    background: transparent !important;
  }

#app
  .action-toolbar__button-toggle {
    margin: 0px !important;
    opacity: 1 !important;
  }

#app
  .action-toolbar__button-toggle.v-btn--active {
    margin: 0px !important;
    opacity: 1 !important;
  }

#app
  .action-toolbar__button-toggle.v-btn--active
    .v-btn__content {
      position: relative;
    }

#app
  .action-toolbar__button-toggle.v-btn--active
    .v-btn__content::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1px;
      box-shadow: 0 0 6px #0e6f9688;
      background-color: var(--nav-panel-indicator-color);
    }

#app
  .action-toolbar__button-toggle
    * {
      border-radius: 0 !important;
    }

#app
  .action-toolbar__button-toggle
    .v-icon {
      color: var(--color-7) !important;
    }

#app
  .action-toolbar__button-toggle.v-btn--active
    .v-icon {
      color: var(--icon-color-1) !important;
    }

.v-btn:not(.v-btn--text):not(.v-btn--outlined).v-btn--active:before {
  opacity: 0 !important;
}

.v-btn--active:before,
.v-btn--active:hover:before,
.v-btn:focus:before {
  opacity: 0 !important;
}
</style>
