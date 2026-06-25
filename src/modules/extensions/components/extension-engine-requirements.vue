<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { TriangleAlertIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { EXTENSION_API_VERSION } from '@/modules/extensions/constants/extension-api-version';
import type { EngineCompatibilityResult } from '@/modules/extensions/utils/engine-compatibility';

defineProps<{
  engineRequirements?: {
    sigmaFileManager: string;
    extensionApi?: string;
  };
  engineCompatibility?: EngineCompatibilityResult | null;
  currentAppVersion?: string | null;
  showCompatibilityWarning?: boolean;
  showRequirementsList?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="showCompatibilityWarning !== false && engineCompatibility && !engineCompatibility.isCompatible"
    class="extension-engine-requirements__warning"
  >
    <TriangleAlertIcon :size="14" />
    <div class="extension-engine-requirements__warnings">
      <span
        v-if="!engineCompatibility.isAppCompatible"
      >
        {{ t('extensions.engineAppWarning', {
          range: engineCompatibility.appRequirement,
          current: currentAppVersion,
        }) }}
      </span>
      <span
        v-if="!engineCompatibility.isExtensionApiCompatible && engineCompatibility.extensionApiRequirement"
      >
        {{ t('extensions.engineApiWarning', {
          range: engineCompatibility.extensionApiRequirement,
          current: EXTENSION_API_VERSION,
        }) }}
      </span>
    </div>
  </div>

  <div
    v-if="showRequirementsList !== false && engineRequirements"
    class="extension-engine-requirements__metadata"
  >
    <span class="extension-engine-requirements__label">
      {{ t('extensions.engineRequirements') }}
    </span>
    <div class="extension-engine-requirements__values">
      <span class="extension-engine-requirements__value">
        {{ t('extensions.requiresSigmaFileManager') }}: {{ engineRequirements.sigmaFileManager }}
      </span>
      <span
        v-if="engineRequirements.extensionApi"
        class="extension-engine-requirements__value"
      >
        {{ t('extensions.requiresExtensionApi') }}: {{ engineRequirements.extensionApi }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.extension-engine-requirements__warning {
  display: flex;
  align-items: flex-start;
  padding: 8px 12px;
  border-radius: 6px;
  background: hsl(var(--dangerous) / 10%);
  color: hsl(var(--dangerous));
  font-size: 0.8125rem;
  gap: 8px;
  line-height: 1.4;
}

.extension-engine-requirements__warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.extension-engine-requirements__metadata {
  display: flex;
  align-items: center;
  margin-top: 2px;
  gap: 8px;
}

.extension-engine-requirements__label {
  min-width: fit-content;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.extension-engine-requirements__values {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.extension-engine-requirements__value {
  font-size: 0.875rem;
}
</style>
