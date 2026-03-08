<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { getActiveModals } from '@/modules/extensions/api/modal-state';
import ExtensionModal from './extension-modal.vue';

const activeModals = getActiveModals();
const standaloneModals = computed(() => activeModals.value.filter(modal => !modal.renderedInPalette));
</script>

<template>
  <ExtensionModal
    v-for="modal in standaloneModals"
    :key="modal.id"
    :modal="modal"
  />
</template>
