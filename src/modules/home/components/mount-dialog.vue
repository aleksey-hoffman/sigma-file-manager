<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { HardDriveIcon, Loader2Icon, NetworkIcon } from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import toReadableBytes from '@/utils/to-readable-bytes';
import type { MountableDevice } from '@/types/drive-info';

type TabId = 'devices' | 'network';
type Protocol = 'sshfs' | 'nfs' | 'smb';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { t } = useI18n();

const activeTab = ref<TabId>('devices');
const devices = ref<MountableDevice[]>([]);
const isScanning = ref(false);
const mountingDevicePath = ref<string | null>(null);

const selectedProtocol = ref<Protocol>('sshfs');
const networkHost = ref('');
const networkPort = ref('');
const networkUsername = ref('');
const networkPassword = ref('');
const networkRemotePath = ref('');
const networkMountName = ref('');
const isConnecting = ref(false);
const connectionError = ref<string | null>(null);

const protocols: {
  value: Protocol;
  label: string;
  defaultPort: string;
}[] = [
  {
    value: 'sshfs',
    label: 'SSHFS (SSH)',
    defaultPort: '22',
  },
  {
    value: 'nfs',
    label: 'NFS',
    defaultPort: '',
  },
  {
    value: 'smb',
    label: 'SMB / CIFS',
    defaultPort: '',
  },
];

const badgeText = computed(() => 'Alpha preview');

const showUsernameField = computed(() => selectedProtocol.value === 'sshfs' || selectedProtocol.value === 'smb');

const showPasswordField = computed(() => selectedProtocol.value === 'sshfs' || selectedProtocol.value === 'smb');

const showPortField = computed(() => selectedProtocol.value === 'sshfs');

const remotePathPlaceholder = computed(() => {
  if (selectedProtocol.value === 'sshfs') {
    return '/home/user';
  }

  if (selectedProtocol.value === 'nfs') {
    return '/export/share';
  }

  return 'share_name';
});

const canConnect = computed(() =>
  networkHost.value.trim() !== ''
  && networkRemotePath.value.trim() !== ''
  && networkMountName.value.trim() !== '',
);

watch(() => props.open, (isOpen) => {
  if (isOpen && activeTab.value === 'devices') {
    scanDevices();
  }
});

watch(activeTab, (tab) => {
  if (tab === 'devices') {
    scanDevices();
  }
});

watch([networkHost, networkRemotePath], () => {
  if (networkMountName.value === '' || networkMountName.value === deriveMountName()) {
    networkMountName.value = deriveMountName();
  }
});

function deriveMountName(): string {
  const path = networkRemotePath.value.trim();
  const host = networkHost.value.trim();

  if (path) {
    const lastSegment = path.split('/').filter(Boolean).pop();

    if (lastSegment) {
      return lastSegment;
    }
  }

  return host.replace(/\./g, '_') || '';
}

function resetNetworkForm() {
  networkHost.value = '';
  networkPort.value = '';
  networkUsername.value = '';
  networkPassword.value = '';
  networkRemotePath.value = '';
  networkMountName.value = '';
  connectionError.value = null;
}

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

async function handleMountDevice(device: MountableDevice) {
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

async function handleConnectNetwork() {
  isConnecting.value = true;
  connectionError.value = null;

  try {
    await invoke<string>('mount_network_share', {
      params: {
        protocol: selectedProtocol.value,
        host: networkHost.value.trim(),
        port: networkPort.value ? Number.parseInt(networkPort.value) : null,
        username: networkUsername.value.trim() || null,
        password: networkPassword.value || null,
        remote_path: networkRemotePath.value.trim(),
        mount_name: networkMountName.value.trim(),
      },
    });

    resetNetworkForm();
    emit('update:open', false);
  }
  catch (connectError) {
    connectionError.value = String(connectError);
  }
  finally {
    isConnecting.value = false;
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
      <DialogHeader class="mount-dialog-header">
        <DialogTitle>
          {{ t('mountableDevices') }}
        </DialogTitle>

        <DialogDescription>
          {{ t('mountableDevicesDescription') }}
        </DialogDescription>
      </DialogHeader>
      <div
        class="preview-badge"
      >
        {{ badgeText }}
      </div>

      <Tabs
        v-model="activeTab"
        default-value="devices"
      >
        <TabsList class="mount-dialog__tabs-list">
          <TabsTrigger
            value="devices"
            class="mount-dialog__tab-trigger"
          >
            <HardDriveIcon :size="14" />
            {{ t('devicesTab') }}
          </TabsTrigger>

          <TabsTrigger
            value="network"
            class="mount-dialog__tab-trigger"
          >
            <NetworkIcon :size="14" />
            {{ t('networkTab') }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="devices"
          class="mount-dialog__body"
        >
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
              @click="handleMountDevice(device)"
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
        </TabsContent>

        <TabsContent
          value="network"
          class="mount-dialog__body"
        >
          <div class="mount-dialog__protocol-selector">
            <button
              v-for="protocol in protocols"
              :key="protocol.value"
              type="button"
              class="mount-dialog__protocol"
              :class="{ 'mount-dialog__protocol--active': selectedProtocol === protocol.value }"
              @click="selectedProtocol = protocol.value"
            >
              {{ protocol.label }}
            </button>
          </div>

          <div class="mount-dialog__form">
            <div class="mount-dialog__field-row">
              <div class="mount-dialog__field mount-dialog__field--grow">
                <label class="mount-dialog__label">{{ t('networkHost') }}</label>

                <input
                  v-model="networkHost"
                  type="text"
                  class="mount-dialog__input"
                  placeholder="192.168.1.100"
                >
              </div>

              <div
                v-if="showPortField"
                class="mount-dialog__field mount-dialog__field--port"
              >
                <label class="mount-dialog__label">{{ t('networkPort') }}</label>

                <input
                  v-model="networkPort"
                  type="text"
                  class="mount-dialog__input"
                  placeholder="22"
                >
              </div>
            </div>

            <div
              v-if="showUsernameField"
              class="mount-dialog__field"
            >
              <label class="mount-dialog__label">{{ t('networkUsername') }}</label>

              <input
                v-model="networkUsername"
                type="text"
                class="mount-dialog__input"
                :placeholder="selectedProtocol === 'sshfs' ? 'user' : ''"
              >
            </div>

            <div
              v-if="showPasswordField"
              class="mount-dialog__field"
            >
              <label class="mount-dialog__label">{{ t('networkPassword') }}</label>

              <input
                v-model="networkPassword"
                type="password"
                class="mount-dialog__input"
              >
            </div>

            <div class="mount-dialog__field">
              <label class="mount-dialog__label">{{ t('networkRemotePath') }}</label>

              <input
                v-model="networkRemotePath"
                type="text"
                class="mount-dialog__input"
                :placeholder="remotePathPlaceholder"
              >
            </div>

            <div class="mount-dialog__field">
              <label class="mount-dialog__label">{{ t('networkMountName') }}</label>

              <input
                v-model="networkMountName"
                type="text"
                class="mount-dialog__input"
                :placeholder="t('networkMountNamePlaceholder')"
              >
            </div>

            <div
              v-if="connectionError"
              class="mount-dialog__error"
            >
              {{ connectionError }}
            </div>

            <button
              type="button"
              class="mount-dialog__connect"
              :disabled="!canConnect || isConnecting"
              @click="handleConnectNetwork"
            >
              <Loader2Icon
                v-if="isConnecting"
                :size="14"
                class="mount-dialog__spinner"
              />

              <template v-else>
                {{ t('connect') }}
              </template>
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<style>
.mount-dialog {
  max-width: 420px;
}

.mount-dialog__tabs-list {
  width: 100%;
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

.mount-dialog__protocol-selector {
  display: flex;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 0;
}

.mount-dialog__protocol {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mount-dialog__protocol:first-child {
  border-radius: var(--radius) 0 0 var(--radius);
}

.mount-dialog__protocol:last-child {
  border-radius: 0 var(--radius) var(--radius) 0;
}

.mount-dialog__protocol--active {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.mount-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mount-dialog__field-row {
  display: flex;
  gap: 8px;
}

.mount-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mount-dialog__field--grow {
  flex: 1;
}

.mount-dialog__field--port {
  width: 72px;
  flex-shrink: 0;
}

.mount-dialog__label {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.mount-dialog__input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: transparent;
  color: hsl(var(--foreground));
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.mount-dialog__input:focus {
  border-color: hsl(var(--ring));
}

.mount-dialog__input::placeholder {
  color: hsl(var(--muted-foreground) / 50%);
}

.mount-dialog__error {
  padding: 8px 10px;
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: var(--radius);
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
  font-size: 12px;
  overflow-wrap: break-word;
}

.mount-dialog__connect {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius);
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  gap: 8px;
  transition: opacity 0.15s ease;
}

.mount-dialog__connect:hover {
  opacity: 0.9;
}

.mount-dialog__connect:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.mount-dialog-header {
  position: relative;
}

.preview-badge {
  position: absolute;
  top: 0;
  left: 0;
  align-self: flex-start;
  padding: 0 0.375rem;
  border-radius: var(--radius-sm) 0 var(--radius-sm) 0;
  margin-bottom: 0.25rem;
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}
</style>
