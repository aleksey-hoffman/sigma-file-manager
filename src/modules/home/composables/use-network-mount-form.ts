// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, watch } from 'vue';

/**
 * 「挂载为」这个名字默认取远程路径的最后一段，用户也可以自己改。
 *
 * 两种分隔符都认：SMB 的远程路径是 Windows 风格（`share\dir`），
 * SSHFS / NFS 是 POSIX 风格（`/home/user`）。
 *
 * 路径为空时退回主机名（把点换成下划线），这样「只填了主机」也有个能用的名字。
 */
export function deriveMountName(remotePath: string, host: string): string {
  const path = remotePath.trim();
  const trimmedHost = host.trim();

  if (path) {
    const lastSegment = path.split(/[/\\]/).filter(Boolean).pop();

    if (lastSegment) {
      return lastSegment;
    }
  }

  return trimmedHost.replace(/\./g, '_') || '';
}

/**
 * 「添加网络驱动器」表单的状态。
 *
 * 单独抽出来是为了能单测 —— 里面最关键的是**自动推导的挂载名什么时候该跟着变**，
 * 而这条规则在组件里被埋在一堆 `v-model` 和模板细节中间，组件级测试太重。
 */
export function useNetworkMountForm() {
  const networkHost = ref('');
  const networkPort = ref('');
  const networkUsername = ref('');
  const networkPassword = ref('');
  const networkRemotePath = ref('');
  const networkMountName = ref('');
  const networkDriveLetter = ref('');

  /** 用户手动改过「挂载为」的名字 —— 改过之后就不再自动覆盖。 */
  const mountNameTouched = ref(false);

  /**
   * 自动推导的名字只在**用户没动过**的时候才跟着输入更新。
   *
   * 原来的判据是「当前值等于当前推导值就更新」，可推导值本身会变：
   * 先填主机（路径还空着）→ 推导出 `localhost`；再填远程路径 → 推导值变成 `AFMDrv`，
   * 而当前值 `localhost` 既不是空串也不等于新推导值，于是**永远更新不上**。
   * 2026-10-21 真机验收看到的就是「挂载为 = localhost」而不是 `AFMDrv`。
   */
  watch([networkHost, networkRemotePath], () => {
    if (!mountNameTouched.value) {
      networkMountName.value = deriveMountName(networkRemotePath.value, networkHost.value);
    }
  });

  function markMountNameTouched() {
    mountNameTouched.value = true;
  }

  function resetNetworkForm() {
    networkHost.value = '';
    networkPort.value = '';
    networkUsername.value = '';
    networkPassword.value = '';
    networkRemotePath.value = '';
    networkMountName.value = '';
    networkDriveLetter.value = '';
    mountNameTouched.value = false;
  }

  return {
    networkHost,
    networkPort,
    networkUsername,
    networkPassword,
    networkRemotePath,
    networkMountName,
    networkDriveLetter,
    mountNameTouched,
    markMountNameTouched,
    resetNetworkForm,
  };
}
