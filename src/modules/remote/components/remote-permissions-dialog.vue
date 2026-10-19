<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 远程权限设置对话框。 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import {
  describePermissionTriples,
  formatOctalMode,
  parseOctalMode,
  permissionModeValidationKey,
  validatePermissionMode,
  type PermissionTriple,
} from '@/modules/remote/utils/remote-permissions';
import { getRemotePermissions, setRemotePermissions } from '@/modules/remote/utils/remote-transfer';
import type { RemotePermissionsTarget } from '@/modules/remote/utils/remote-permissions-dialog-state';

const props = defineProps<{
  target: RemotePermissionsTarget | null;
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const modeText = ref('');
const recursive = ref(false);
const isLoading = ref(false);
const isSubmitting = ref(false);
/** 读不到当前权限时为 true —— 界面要说清楚，不能假装读到了。 */
const currentModeUnknown = ref(false);

const validationError = computed(() => {
  if (modeText.value.trim().length === 0) {
    return null;
  }

  const reason = validatePermissionMode(modeText.value);

  return reason ? t(permissionModeValidationKey(reason)) : null;
});

const parsedMode = computed(() => parseOctalMode(modeText.value));

const description = computed(() => {
  if (parsedMode.value === null) {
    return null;
  }

  return describePermissionTriples(parsedMode.value);
});

function describeTriple(triple: PermissionTriple): string {
  const parts: string[] = [];

  if (triple.read) parts.push(t('remote.permissions.read'));
  if (triple.write) parts.push(t('remote.permissions.write'));
  if (triple.execute) parts.push(t('remote.permissions.execute'));

  if (parts.length === 0) {
    return t('remote.permissions.none');
  }

  return parts.join(t('remote.permissions.separator'));
}

const canSubmit = computed(() => {
  return parsedMode.value !== null && !isSubmitting.value && !isLoading.value;
});

async function loadCurrentMode(path: string) {
  isLoading.value = true;
  currentModeUnknown.value = false;

  try {
    const mode = await getRemotePermissions(path);

    if (mode === null || mode === undefined) {
      currentModeUnknown.value = true;
      modeText.value = '';
      return;
    }

    modeText.value = formatOctalMode(mode);
  }
  catch (error) {
    currentModeUnknown.value = true;
    modeText.value = '';
    console.error('Failed to read remote permissions:', error);
  }
  finally {
    isLoading.value = false;
  }
}

watch(isOpen, (open) => {
  if (!open) {
    return;
  }

  recursive.value = false;

  if (props.target) {
    void loadCurrentMode(props.target.path);
  }
});

async function handleSubmit() {
  if (!canSubmit.value || !props.target || parsedMode.value === null) {
    return;
  }

  isSubmitting.value = true;

  try {
    const report = await setRemotePermissions(
      props.target.path,
      parsedMode.value,
      recursive.value,
    );

    if (report.failures.length > 0) {
      toast.error(
        t('remote.permissions.partialFailure', {
          changed: report.changed,
          failed: report.failures.length,
        }),
      );
    }
    else {
      toast.success(t('remote.permissions.success', { changed: report.changed }));
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(t('remote.permissions.failed', { message }));
  }
  finally {
    isSubmitting.value = false;
    isOpen.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="remote-permissions-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('remote.permissions.title') }}</DialogTitle>
        <DialogDescription>
          {{ props.target?.name }}
        </DialogDescription>
      </DialogHeader>

      <div class="remote-permissions-dialog__form">
        <div class="remote-permissions-dialog__field">
          <Label for="remote-permissions-mode">
            {{ t('remote.permissions.modeLabel') }}
          </Label>
          <Input
            id="remote-permissions-mode"
            v-model="modeText"
            :placeholder="'0754'"
            :class="{ 'remote-permissions-dialog__input--error': validationError }"
          />
          <p
            v-if="validationError"
            class="remote-permissions-dialog__error"
          >
            {{ validationError }}
          </p>
          <p
            v-else-if="currentModeUnknown"
            class="remote-permissions-dialog__hint"
          >
            {{ t('remote.permissions.unknownMode') }}
          </p>
          <p
            v-else
            class="remote-permissions-dialog__hint"
          >
            {{ t('remote.permissions.modeHint') }}
          </p>
        </div>

        <div
          v-if="description"
          class="remote-permissions-dialog__description"
        >
          <div class="remote-permissions-dialog__description-row">
            <span class="remote-permissions-dialog__description-label">
              {{ t('remote.permissions.owner') }}
            </span>
            <code>{{ description.owner.symbolic }}</code>
            <span>{{ describeTriple(description.owner) }}</span>
          </div>
          <div class="remote-permissions-dialog__description-row">
            <span class="remote-permissions-dialog__description-label">
              {{ t('remote.permissions.group') }}
            </span>
            <code>{{ description.group.symbolic }}</code>
            <span>{{ describeTriple(description.group) }}</span>
          </div>
          <div class="remote-permissions-dialog__description-row">
            <span class="remote-permissions-dialog__description-label">
              {{ t('remote.permissions.others') }}
            </span>
            <code>{{ description.others.symbolic }}</code>
            <span>{{ describeTriple(description.others) }}</span>
          </div>
        </div>

        <div
          v-if="props.target?.isDirectory"
          class="remote-permissions-dialog__recursive"
        >
          <Checkbox
            id="remote-permissions-recursive"
            v-model="recursive"
          />
          <Label for="remote-permissions-recursive">
            {{ t('remote.permissions.recursive') }}
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="isOpen = false"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ t('remote.permissions.apply') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.remote-permissions-dialog {
  width: 460px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.remote-permissions-dialog > * {
  min-width: 0;
}

.remote-permissions-dialog__form {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.remote-permissions-dialog__field {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.remote-permissions-dialog__field .sigma-ui-input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.remote-permissions-dialog__input--error {
  border-color: hsl(var(--destructive));
}

.remote-permissions-dialog__error {
  color: hsl(var(--destructive));
  font-size: 12px;
}

.remote-permissions-dialog__hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.remote-permissions-dialog__description {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
}

.remote-permissions-dialog__description-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.remote-permissions-dialog__description-label {
  min-width: 3em;
  color: hsl(var(--muted-foreground));
}

.remote-permissions-dialog__description-row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.remote-permissions-dialog__recursive {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
</style>
