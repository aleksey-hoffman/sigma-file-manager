<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/runtime/settings';
import { computed } from 'vue';

type Props = {
  name: string;
  label: string;
};

const props = defineProps<Props>();
const settingsStore = useSettingsStore();

const isActive = computed(() => settingsStore.currentTab === props.name);
const variant = computed(() => isActive.value ? 'secondary' : 'ghost');

function handleClick() {
  settingsStore.setCurrentTab(props.name);
}
</script>

<template>
  <Button
    :variant="variant"
    size="sm"
    class="settings-nav-item"
    :class="{ 'settings-nav-item--active': isActive }"
    @click="handleClick"
  >
    {{ props.label }}
  </Button>
</template>

<style scoped>
.settings-nav-item {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}

.settings-nav-item--active {
  font-weight: 600;
}
</style>
