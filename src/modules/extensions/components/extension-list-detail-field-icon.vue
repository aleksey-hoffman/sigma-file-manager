<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useSystemIcon } from '@/composables/use-system-icon';

const props = defineProps<{
  iconUrl?: string;
  systemIconPath?: string;
}>();

const shouldResolveSystemIcon = computed(() => !props.iconUrl && Boolean(props.systemIconPath));

const { systemIconSrc } = useSystemIcon({
  path: () => props.systemIconPath ?? '',
  isDir: () => false,
  extension: () => 'exe',
  size: () => 16,
  enabled: () => shouldResolveSystemIcon.value,
});

const resolvedIconUrl = computed(() => props.iconUrl ?? systemIconSrc.value ?? undefined);
</script>

<template>
  <img
    v-if="resolvedIconUrl"
    :src="resolvedIconUrl"
    alt=""
    class="ext-list-detail-field-icon"
  >
</template>

<style scoped>
.ext-list-detail-field-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  object-fit: contain;
}
</style>
