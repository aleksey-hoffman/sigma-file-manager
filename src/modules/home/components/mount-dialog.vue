<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { HardDriveIcon, Loader2Icon } from 'lucide-vue-next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import toReadableBytes from '@/utils/to-readable-bytes';
import type { MountableDevice } from '@/types/drive-info';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t } = useI18n();
const devices = ref<MountableDevice[]>([]);
const isScanning = ref(false);
const mountingDevicePath = ref<string | null>(null);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    scanDevices();
  }
});

async function scanDevices() {
  isScanning.value = true;

  try {
    devices.value = await invoke<MountableDevice[]>('get_mountable_devices');
  }
  catch (scanError) {
    console.error('Failed to scan devices:', scanError);
  }
  finally {
    isScanning.value = false;
  }
}

async function handleMount(device: MountableDevice) {
  mountingDevicePath.value = device.device_path;

  try {
    await invoke<string>('mount_drive', { devicePath: device.device_path });
    devices.value = devices.value.filter(
      candidate => candidate.device_path !== device.device_path,
    );
  }
  catch (mountError) {
    console.error('Failed to mount device:', mountError);
  }
  finally {
    mountingDevicePath.value = null;
  }
}

function handleOpenChange(isOpen: boolean) {
  emit('update:open', isOpen);
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleOpenChange"
  >
    <DialogContent class="mount-dialog">
      <DialogHeader>
        <DialogTitle>
          {{ t('mountableDevices') }}
        </DialogTitle>

        <DialogDescription>
          {{ t('mountableDevicesDescription') }}
        </DialogDescription>
      </DialogHeader>

      <div class="mount-dialog__body">
        <div
          v-if="isScanning"
          class="mount-dialog__scanning"
        >
          <Loader2Icon
            :size="16"
            class="mount-dialog__spinner"
          />

          <span>{{ t('scanning') }}...</span>
        </div>

        <div
          v-else-if="devices.length === 0"
          class="mount-dialog__empty"
        >
          {{ t('noMountableDevicesFound') }}
        </div>

        <div
          v-else
          class="mount-dialog__list"
        >
          <button
            v-for="device in devices"
            :key="device.device_path"
            type="button"
            class="mount-dialog__device"
            :disabled="mountingDevicePath === device.device_path"
            @click="handleMount(device)"
          >
            <HardDriveIcon
              :size="18"
              class="mount-dialog__device-icon"
            />

            <div class="mount-dialog__device-info">
              <div class="mount-dialog__device-name">
                {{ device.name }}
              </div>

              <div class="mount-dialog__device-details">
                {{ device.device_path }} · {{ device.file_system }} · {{ toReadableBytes(device.size, 1) }}
              </div>
            </div>

            <span class="mount-dialog__mount-label">
              <Loader2Icon
                v-if="mountingDevicePath === device.device_path"
                :size="14"
                class="mount-dialog__spinner"
              />

              <template v-else>
                {{ t('mount') }}
              </template>
            </span>
          </button>
        </div>

        <button
          type="button"
          class="mount-dialog__rescan"
          :disabled="isScanning"
          @click="scanDevices"
        >
          {{ t('rescan') }}
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style>
.mount-dialog {
  max-width: 420px;
}

.mount-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mount-dialog__scanning {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  gap: 8px;
}

.mount-dialog__spinner {
  animation: sigma-ui-spin 0.8s linear infinite;
}

.mount-dialog__empty {
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}

.mount-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mount-dialog__device {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  gap: 12px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.mount-dialog__device:hover {
  background-color: hsl(var(--muted));
}

.mount-dialog__device:disabled {
  cursor: wait;
  opacity: 0.6;
}

.mount-dialog__device-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.mount-dialog__device-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.mount-dialog__device-name {
  font-size: 13px;
  font-weight: 500;
}

.mount-dialog__device-details {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.mount-dialog__mount-label {
  flex-shrink: 0;
  color: hsl(var(--primary));
  font-size: 12px;
  font-weight: 500;
}

.mount-dialog__rescan {
  align-self: center;
  padding: 6px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mount-dialog__rescan:hover {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.mount-dialog__rescan:disabled {
  cursor: wait;
  opacity: 0.5;
}
</style>
