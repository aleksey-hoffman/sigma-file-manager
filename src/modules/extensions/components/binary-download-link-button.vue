<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ExternalLinkIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isHttpUrl, openBinaryDownloadUrl } from '@/modules/extensions/utils/binary-download-url';

const props = defineProps<{
  downloadUrl?: string;
}>();

const { t } = useI18n();

function handleClick(): void {
  if (props.downloadUrl) {
    openBinaryDownloadUrl(props.downloadUrl);
  }
}
</script>

<template>
  <Tooltip
    v-if="downloadUrl && isHttpUrl(downloadUrl)"
    :delay-duration="0"
  >
    <TooltipTrigger as-child>
      <Button
        variant="link"
        size="xs"
        class="binary-download-link-button"
        @click="handleClick"
      >
        <ExternalLinkIcon :size="14" />
        {{ t('extensions.dependencies.downloadSource') }}
      </Button>
    </TooltipTrigger>
    <TooltipContent class="binary-download-link-button__tooltip">
      {{ downloadUrl }}
    </TooltipContent>
  </Tooltip>
</template>

<style>
.binary-download-link-button {
  max-width: 100%;
  flex-shrink: 0;
  align-self: flex-start;
  padding: 0;
  margin-top: 2px;
  color: hsl(var(--primary));
  font-size: 0.8125rem;
  gap: 6px;
}

.binary-download-link-button__tooltip {
  max-width: min(480px, 80vw);
  word-break: break-all;
}
</style>
