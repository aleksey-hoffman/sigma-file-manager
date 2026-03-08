<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2Icon, AlertTriangleIcon, HardDriveIcon, AlertCircleIcon } from 'lucide-vue-next';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

type BadgeType = 'official' | 'community' | 'local' | 'broken';

const props = defineProps<{
  type: BadgeType;
  showLabel?: boolean;
}>();

const { t } = useI18n();

const badgeConfig = computed(() => {
  switch (props.type) {
    case 'broken':
      return {
        icon: AlertCircleIcon,
        label: t('extensions.badges.broken'),
        tooltip: t('extensions.badges.brokenTooltip'),
        class: 'extension-badge--broken',
      };
    case 'local':
      return {
        icon: HardDriveIcon,
        label: t('extensions.badges.local'),
        tooltip: t('extensions.badges.localTooltip'),
        class: 'extension-badge--local',
      };
    case 'official':
      return {
        icon: CheckCircle2Icon,
        label: t('extensions.badges.official'),
        tooltip: t('extensions.badges.officialTooltip'),
        class: 'extension-badge--official',
      };
    case 'community':
    default:
      return {
        icon: AlertTriangleIcon,
        label: t('extensions.badges.community'),
        tooltip: t('extensions.badges.communityTooltip'),
        class: 'extension-badge--community',
      };
  }
});
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="extension-badge"
          :class="badgeConfig.class"
        >
          <component
            :is="badgeConfig.icon"
            :size="14"
          />
          <span
            v-if="showLabel"
            class="extension-badge__label"
          >
            {{ badgeConfig.label }}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ badgeConfig.tooltip }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<style>
.extension-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
}

.extension-badge__label {
  white-space: nowrap;
}

.extension-badge--official {
  background-color: hsl(142deg 76% 36% / 15%);
  color: hsl(142deg 76% 36%);
}

.extension-badge--community {
  background-color: hsl(217deg 91% 60% / 15%);
  color: hsl(217deg 91% 60%);
}

.extension-badge--local {
  background-color: hsl(271deg 91% 65% / 15%);
  color: hsl(271deg 91% 65%);
}

.extension-badge--broken {
  background-color: hsl(0deg 0% 50% / 15%);
  color: hsl(0deg 0% 45%);
}
</style>
