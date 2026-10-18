<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
// FORK-MODIFICATION 2026-10-18：SSH 主机公钥的信任确认（阶段 2 决策 3）。
//
// **首见与变更走同一个弹窗，但文案与默认动作完全不同。** 变更那一条的默认动作
// 必须是「取消」：服务器重装密钥是常事，而中途人替换公钥是罕见但后果更重的事，
// 在用户没读过两串指纹之前就替他做决定，等于把安全判断交给默认值。
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { HostKeyTrustPrompt } from '@/utils/remote-directory';

const props = defineProps<{
  prompt: HostKeyTrustPrompt | null;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const { t } = useI18n();

const open = computed(() => props.prompt !== null);

const titleKey = computed(() => {
  return props.prompt?.changed
    ? 'dialogs.remoteHostKeyChanged.title'
    : 'dialogs.remoteHostKeyUnknown.title';
});

const descriptionKey = computed(() => {
  return props.prompt?.changed
    ? 'dialogs.remoteHostKeyChanged.description'
    : 'dialogs.remoteHostKeyUnknown.description';
});

/**
 * 「你自己怎么核对」这句话按信任类型分开。
 *
 * 让用户拿一张证书的指纹去跑 `ssh-keygen -lf` 只会得到一句「不是公钥」，
 * 而用户看到那句话会以为**自己的证书有问题** —— 实际上他只是用错了工具。
 */
const hintKey = computed(() => {
  return props.prompt?.kind === 'x509'
    ? 'dialogs.remoteHostKeyCommon.hintX509'
    : 'dialogs.remoteHostKeyCommon.hint';
});

function onConfirm() {
  emit('confirm');
}

function onCancel() {
  emit('cancel');
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="onCancel"
  >
    <DialogContent class="remote-host-key-dialog">
      <DialogHeader>
        <DialogTitle>{{ t(titleKey) }}</DialogTitle>
        <DialogDescription class="remote-host-key-dialog__body">
          <span class="remote-host-key-dialog__text">{{ t(descriptionKey) }}</span>

          <span class="remote-host-key-dialog__endpoint">
            {{ props.prompt?.host }}<template v-if="props.prompt">:{{ props.prompt.port }}</template>
          </span>

          <span
            v-if="props.prompt?.keyType"
            class="remote-host-key-dialog__algorithm"
          >
            {{ t('dialogs.remoteHostKeyCommon.algorithm', { algorithm: props.prompt.keyType }) }}
          </span>

          <code class="remote-host-key-dialog__fingerprint">{{ props.prompt?.fingerprint }}</code>

          <template v-if="props.prompt?.changed">
            <span class="remote-host-key-dialog__text">
              {{ t('dialogs.remoteHostKeyChanged.expected') }}
            </span>
            <code class="remote-host-key-dialog__fingerprint remote-host-key-dialog__fingerprint--old">
              {{ props.prompt?.expectedFingerprint }}
            </code>
          </template>

          <!--
            核对方式按信任类型分开说。
            让用户拿一个证书指纹去跑 `ssh-keygen -lf` 只会得到一句「不是公钥」，
            而用户会以为自己的证书有问题。
          -->
          <span class="remote-host-key-dialog__hint">
            {{ t(hintKey) }}
          </span>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="remote-host-key-dialog__footer">
        <Button
          variant="outline"
          @click="onCancel"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          :variant="props.prompt?.changed ? 'destructive' : 'default'"
          @click="onConfirm"
        >
          {{ props.prompt?.changed
            ? t('dialogs.remoteHostKeyChanged.trustAnyway')
            : t('dialogs.remoteHostKeyUnknown.trust') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.remote-host-key-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.remote-host-key-dialog__text {
  color: hsl(var(--foreground));
}

.remote-host-key-dialog__endpoint {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.remote-host-key-dialog__algorithm {
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.remote-host-key-dialog__fingerprint {
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
  user-select: all;
}

/* 旧记录用虚线框：一眼分清「这是你已经信任过的」与「这是刚收到的」。 */
.remote-host-key-dialog__fingerprint--old {
  border: 1px dashed hsl(var(--destructive));
  background-color: transparent;
  text-decoration: line-through;
}

.remote-host-key-dialog__hint {
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.remote-host-key-dialog :deep(.remote-host-key-dialog__footer) {
  width: 100%;
  align-items: flex-end;
  gap: 0.5rem;
}
</style>
