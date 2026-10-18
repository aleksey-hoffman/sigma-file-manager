<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { open } from '@tauri-apps/plugin-dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';
import { getRemoteProtocolDefaultPort } from '@/types/remote';
import normalizePath from '@/utils/normalize-path';
import type {
  RemoteConnection, RemoteConnectionForm, RemoteConnectionTestReport, RemoteProtocol, RemoteProxyConfig,
} from '@/types/remote';

type Props = {
  /** 传 `null` 表示新建。 */
  connection: RemoteConnection | null;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  saved: [connection: RemoteConnection];
  cancel: [];
}>();

const { t } = useI18n();
const store = useRemoteConnectionsStore();

const PROTOCOLS: RemoteProtocol[] = ['ftp', 'ftps_explicit', 'ftps_implicit', 'sftp'];
const PROXY_KINDS: RemoteProxyConfig['kind'][] = ['direct', 'socks5', 'http_connect'];

const name = ref('');
const protocol = ref<RemoteProtocol>('ftp');
const host = ref('');
const port = ref<number>(21);
const username = ref('');
const password = ref('');
const clearPassword = ref(false);
const initialPath = ref('/');
const localPath = ref('');
const proxyKind = ref<RemoteProxyConfig['kind']>('direct');
const proxyHost = ref('');
const proxyPort = ref<number>(1080);
const proxyUsername = ref('');
const proxyPassword = ref('');

const hasSavedPassword = computed(() => Boolean(props.connection?.credentialKey));

watch(
  () => props.connection,
  (connection) => {
    // 先收进局部常量，否则 `connection?.proxy.kind === 'direct' ? ... : connection.proxy.host`
    // 的 else 分支里 TS 不会把 `connection` 收窄成非空。
    const existingProxy = connection?.proxy;
    const isDirect = !existingProxy || existingProxy.kind === 'direct';
    const nextProtocol = connection?.protocol ?? 'ftp';

    name.value = connection?.name ?? '';
    protocol.value = nextProtocol;
    host.value = connection?.host ?? '';
    port.value = connection?.port ?? getRemoteProtocolDefaultPort(nextProtocol);
    username.value = connection?.username ?? '';
    initialPath.value = connection?.initialPath ?? '/';
    localPath.value = connection?.localPath ?? '';
    password.value = '';
    clearPassword.value = false;

    proxyKind.value = isDirect ? 'direct' : existingProxy.kind;
    proxyHost.value = isDirect ? '' : existingProxy.host;
    proxyPort.value = isDirect ? 1080 : existingProxy.port;
    proxyUsername.value = isDirect ? '' : (existingProxy.username ?? '');
    proxyPassword.value = '';
  },
  { immediate: true },
);

function buildProxy(): RemoteProxyConfig {
  if (proxyKind.value === 'direct') {
    return {
      kind: 'direct',
    };
  }

  return {
    kind: proxyKind.value,
    host: proxyHost.value,
    port: proxyPort.value,
    ...(proxyUsername.value
      ? { username: proxyUsername.value }
      : {}),
    ...(proxyPassword.value
      ? { password: proxyPassword.value }
      : {}),
  };
}

function reset() {
  name.value = '';
  host.value = '';
  port.value = getRemoteProtocolDefaultPort(protocol.value);
  username.value = '';
  password.value = '';
  clearPassword.value = false;
  initialPath.value = '/';
  localPath.value = '';
  proxyKind.value = 'direct';
  proxyHost.value = '';
  proxyPort.value = 1080;
  proxyUsername.value = '';
  proxyPassword.value = '';
}

/** 选一个本地目录。留空即可不摆双屏，所以这里不做任何默认填充。 */
async function handleBrowseLocalPath() {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: localPath.value || undefined,
  });

  if (selected) {
    localPath.value = normalizePath(selected);
  }
}

/** store 抛出的就是校验码，直接映射成文案，不去解析 message。 */
const errorCode = ref<string | null>(null);

/**
 * 「测试连接」的结果。
 *
 * 两个字段都要留着：
 * - `report.outcome` 决定配色与结论措辞；
 * - `report.passwordChecked === false` 必须显示出来，否则「通过」会被读成
 *   「密码没问题」，而免密 / 匿名连接同样会通过。
 */
const probeReport = ref<RemoteConnectionTestReport | null>(null);
const isProbing = ref(false);

function buildForm(): RemoteConnectionForm {
  return {
    id: props.connection?.id,
    name: name.value,
    protocol: protocol.value,
    host: host.value,
    port: port.value,
    username: username.value,
    initialPath: initialPath.value,
    localPath: localPath.value,
    proxy: buildProxy(),
    password: password.value,
    clearPassword: clearPassword.value,
  };
}

/**
 * 真去连一次。
 *
 * **不写任何盘上的状态** —— 所以「测完了不保存」不会留下痕迹，
 * 也不会因为没保存就把存的密码搞坏。
 */
async function handleTestConnection() {
  isProbing.value = true;
  probeReport.value = null;
  errorCode.value = null;

  try {
    probeReport.value = await store.testConnection(buildForm());
  }
  catch (error) {
    // 入参非法才会走到这里（空主机、端口 0），store 抛的是校验码。
    errorCode.value = error instanceof Error ? error.message : 'unknown';
  }
  finally {
    isProbing.value = false;
  }
}

function onProxyKindChange(value: unknown) {
  const next = String(value ?? '') as RemoteProxyConfig['kind'];

  if (!PROXY_KINDS.includes(next)) return;

  proxyKind.value = next;
}

async function handleSubmit() {
  const form = buildForm();

  errorCode.value = null;

  try {
    const saved = await store.saveConnection(form);
    reset();
    emit('saved', saved);
  }
  catch (error) {
    errorCode.value = error instanceof Error ? error.message : 'unknown';
  }
}

function onProtocolChange(value: unknown) {
  const next = String(value ?? '') as RemoteProtocol;

  if (!PROTOCOLS.includes(next)) return;

  const wasDefault = port.value === getRemoteProtocolDefaultPort(protocol.value);

  protocol.value = next;

  // 只在端口还是上一个协议的默认值时才跟着换 ——
  // 用户手填过 2121 就不该因为选了协议被改掉。
  if (wasDefault) {
    port.value = getRemoteProtocolDefaultPort(next);
  }
}
</script>

<template>
  <form
    class="remote-connection-form"
    @submit.prevent="handleSubmit"
  >
    <p
      v-if="errorCode"
      class="remote-connection-form__error"
      data-test="form-error"
    >
      {{ t(`settings.remote.error.${errorCode}`) }}
    </p>

    <div class="remote-connection-form__row">
      <Label for="remote-name">{{ t('settings.remote.field.name') }}</Label>
      <Input
        id="remote-name"
        v-model="name"
        data-test="field-name"
      />
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-protocol">{{ t('settings.remote.field.protocol') }}</Label>
      <Select
        :model-value="protocol"
        @update:model-value="onProtocolChange"
      >
        <SelectTrigger data-test="field-protocol">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="item in PROTOCOLS"
            :key="item"
            :value="item"
          >
            {{ t(`settings.remote.protocol.${item}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-host">{{ t('settings.remote.field.host') }}</Label>
      <Input
        id="remote-host"
        v-model="host"
        data-test="field-host"
      />
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-port">{{ t('settings.remote.field.port') }}</Label>
      <Input
        id="remote-port"
        v-model.number="port"
        type="number"
        data-test="field-port"
      />
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-username">{{ t('settings.remote.field.username') }}</Label>
      <Input
        id="remote-username"
        v-model="username"
        data-test="field-username"
      />
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-password">
        {{ t('settings.remote.field.password') }}
      </Label>
      <Input
        id="remote-password"
        v-model="password"
        type="password"
        autocomplete="off"
        data-test="field-password"
      />
      <p
        v-if="hasSavedPassword"
        class="remote-connection-form__hint"
      >
        {{ t('settings.remote.password.savedHint') }}
      </p>
    </div>

    <div
      v-if="hasSavedPassword"
      class="remote-connection-form__row remote-connection-form__row--inline"
    >
      <Checkbox
        id="remote-clear-password"
        v-model="clearPassword"
        data-test="field-clear-password"
      />
      <Label for="remote-clear-password">
        {{ t('settings.remote.password.clear') }}
      </Label>
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-initial-path">{{ t('settings.remote.field.initialPath') }}</Label>
      <Input
        id="remote-initial-path"
        v-model="initialPath"
        data-test="field-initial-path"
      />
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-local-path">{{ t('settings.remote.field.localPath') }}</Label>
      <div class="remote-connection-form__inline">
        <Input
          id="remote-local-path"
          v-model="localPath"
          data-test="field-local-path"
        />
        <Button
          type="button"
          variant="outline"
          data-test="browse-local-path"
          @click="handleBrowseLocalPath"
        >
          {{ t('settings.remote.action.browse') }}
        </Button>
      </div>
      <p class="remote-connection-form__hint">
        {{ t('settings.remote.localPath.hint') }}
      </p>
    </div>

    <div class="remote-connection-form__row">
      <Label for="remote-proxy-kind">{{ t('settings.remote.field.proxy') }}</Label>
      <Select
        :model-value="proxyKind"
        @update:model-value="onProxyKindChange"
      >
        <SelectTrigger data-test="field-proxy-kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="item in PROXY_KINDS"
            :key="item"
            :value="item"
          >
            {{ t(`settings.remote.proxy.${item}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <template v-if="proxyKind !== 'direct'">
      <div class="remote-connection-form__row">
        <Label for="remote-proxy-host">{{ t('settings.remote.field.proxyHost') }}</Label>
        <Input
          id="remote-proxy-host"
          v-model="proxyHost"
          data-test="field-proxy-host"
        />
      </div>

      <div class="remote-connection-form__row">
        <Label for="remote-proxy-port">{{ t('settings.remote.field.proxyPort') }}</Label>
        <Input
          id="remote-proxy-port"
          v-model.number="proxyPort"
          type="number"
          data-test="field-proxy-port"
        />
      </div>

      <div class="remote-connection-form__row">
        <Label for="remote-proxy-username">{{ t('settings.remote.field.proxyUsername') }}</Label>
        <Input
          id="remote-proxy-username"
          v-model="proxyUsername"
          data-test="field-proxy-username"
        />
      </div>

      <div class="remote-connection-form__row">
        <Label for="remote-proxy-password">{{ t('settings.remote.field.proxyPassword') }}</Label>
        <Input
          id="remote-proxy-password"
          v-model="proxyPassword"
          type="password"
          autocomplete="off"
          data-test="field-proxy-password"
        />
      </div>
    </template>

    <div class="remote-connection-form__actions">
      <Button
        type="button"
        variant="outline"
        data-test="test-connection"
        :disabled="isProbing"
        @click="handleTestConnection"
      >
        {{ isProbing ? t('settings.remote.test.testing') : t('settings.remote.action.test') }}
      </Button>
      <Button
        type="submit"
        data-test="submit"
      >
        {{ t('settings.remote.action.save') }}
      </Button>
      <Button
        type="button"
        variant="outline"
        data-test="cancel"
        @click="emit('cancel')"
      >
        {{ t('settings.remote.action.cancel') }}
      </Button>
    </div>

    <!-- 结果区放在按钮**下方**：按钮先出现，用户点完往下看结论，
         不用在按钮和结论之间来回找视线。 -->
    <p
      v-if="probeReport"
      class="remote-connection-form__probe"
      :class="`remote-connection-form__probe--${probeReport.outcome}`"
      data-test="test-result"
      :data-outcome="probeReport.outcome"
    >
      <span class="remote-connection-form__probe-message">
        {{ t(`settings.remote.test.outcome.${probeReport.outcome}`) }}
      </span>
      <!-- 没核验密码就不能让「通过」裸奔。 -->
      <span
        v-if="probeReport.outcome === 'verified' && !probeReport.passwordChecked"
        class="remote-connection-form__probe-note"
        data-test="test-note-password"
      >
        {{ t('settings.remote.test.passwordNotChecked') }}
      </span>
      <span
        v-if="probeReport.tlsVerified === false && probeReport.outcome === 'verified'
          && probeReport.message"
        class="remote-connection-form__probe-note"
      >
        {{ t('settings.remote.test.tlsNotVerified') }}
      </span>
    </p>
  </form>
</template>

<style scoped>
.remote-connection-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.remote-connection-form__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/*
  测试结论的配色：只有「通过」是绿的，其余一律中性偏警示。
  刻意不给「认证被拒」单独的红 —— 那不是程序故障，是用户要改密码，
  用报错色会让人以为应用出了问题。
*/
.remote-connection-form__probe {
  display: flex;
  flex-direction: column;
  margin: 0;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.remote-connection-form__probe--verified {
  border-color: hsl(var(--foreground) / 25%);
}

.remote-connection-form__probe-note {
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

.remote-connection-form__row--inline {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.remote-connection-form__inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.remote-connection-form__hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.remote-connection-form__error {
  margin: 0;
  color: hsl(var(--destructive));
  font-size: 0.875rem;
}

.remote-connection-form__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
