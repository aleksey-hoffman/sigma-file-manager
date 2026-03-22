<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 24,
});
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    :width="size"
    :height="size"
  >
    <path
      d="M17.61 0.455a3.41 3.41 0 0 0 -3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41 -3.41 3.41 3.41 0 0 0 -3.41 -3.41zM12.92 0.8C8.923 0.777 5.137 2.941 3.148 6.451a4.5 4.5 0 0 1 0.26 -0.007 4.92 4.92 0 0 1 2.585 0.737A8.316 8.316 0 0 1 12.688 3.6 4.944 4.944 0 0 1 13.723 0.834 11.008 11.008 0 0 0 12.92 0.8zm9.226 4.994a4.915 4.915 0 0 1 -1.918 2.246 8.36 8.36 0 0 1 -0.273 8.303 4.89 4.89 0 0 1 1.632 2.54 11.156 11.156 0 0 0 0.559 -13.089zM3.41 7.932A3.41 3.41 0 0 0 0 11.342a3.41 3.41 0 0 0 3.41 3.409 3.41 3.41 0 0 0 3.41 -3.41 3.41 3.41 0 0 0 -3.41 -3.41zm2.027 7.866a4.908 4.908 0 0 1 -2.915 0.358 11.1 11.1 0 0 0 7.991 6.698 11.234 11.234 0 0 0 2.422 0.249 4.879 4.879 0 0 1 -0.999 -2.85 8.484 8.484 0 0 1 -0.836 -0.136 8.304 8.304 0 0 1 -5.663 -4.32zm11.405 0.928a3.41 3.41 0 0 0 -3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41 -3.41 3.41 3.41 0 0 0 -3.41 -3.41z"
      fill="currentColor"
    />
  </svg>
</template>
