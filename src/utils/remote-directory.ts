// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 远程目录的 invoke 封装。
//
// **单独成文件而不是塞进 `virtual-locations.ts`**：那里是「路径 → 内容」的纯分发，
// 而这一层还带着两件与分发无关的事 ——
//   1. command 名的单一定义点（前端只有这里知道 Rust 侧叫什么）；
//   2. 远程错误载荷的解包（见下方 `describeRemoteError`）。
//
// ## 契约（与 Rust 侧一一对应）
//
// - `remote_read_dir` 的 `Err` 载荷是 `RemoteError`，序列化成 `{ kind, message }`
//   （`src-tauri/src/remote/error.rs`）。本地 `read_dir` 的 `Err` 是 `String`。
//   两者形状不同，所以远程的错误**必须**经过 `describeRemoteError` 才进界面。
// - `remote_stat_dir_entry` 失败时返回 `null`，与本地 `get_dir_entry_with_timeout`
//   在 `resolveDirEntry` 里的既有语义保持一致（地址栏自动补全靠它做存在性判断）。
//
// ## 关于「连接配置由谁提供」
//
// 这里**只传 `path`**，不含任何凭据。这是阶段 2 拍板前的最小契约：
// 无论最终是「前端把连接与密码一起传下来」还是「Rust 侧自己解析连接与 DPAPI 密文」，
// `path` 都是必需的，改动只会落在**这个文件**里，不会波及 `virtual-locations.ts`。

import { invoke } from '@tauri-apps/api/core';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import {
  HOST_KEY_CHANGED_KIND,
  HOST_KEY_UNKNOWN_KIND,
  isHostKeyError,
  type RemoteConnection,
  type RemoteErrorPayload,
} from '@/types/remote';
import { parseRemotePath } from '@/utils/remote-paths';

/** 列远程目录。失败时抛出的值是 `{ kind, message }`，不是 `String`。 */
export const REMOTE_READ_DIR_COMMAND = 'remote_read_dir';

/** 取单个远程条目的元数据。失败时抛出的值同 `remote_read_dir`。 */
export const REMOTE_STAT_COMMAND = 'remote_stat_dir_entry';

/**
 * 认得出一个 `RemoteError` 载荷。
 *
 * 判定只要求 `kind` 与 `message` **都是 string** —— 主机密钥类错误额外带的
 * `fingerprint` / `keyType` 是可选字段，不参与判定，所以老的测试载荷依然命中。
 *
 * 这里刻意**不再本地声明一份 `RemoteErrorPayload`**：那份只有 `{ kind, message }`
 * 的简化镜像曾经把 `@/types/remote` 的正式类型遮住，导致 `buildHostKeyTrustPrompt`
 * 读 `keyType` / `expectedFingerprint` 时报「属性不存在」——
 * 一个「看起来对、实际少两个字段」的影子类型，比缺类型更危险。
 */
export function isRemoteErrorPayload(value: unknown): value is RemoteErrorPayload {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { message?: unknown }).message === 'string'
    && typeof (value as { kind?: unknown }).kind === 'string';
}

export async function readRemoteDirectory(path: string): Promise<DirContents> {
  return invoke<DirContents>(REMOTE_READ_DIR_COMMAND, {
    path,
  });
}

/**
 * 取单个远程条目的元数据。取不到就返回 `null`。
 *
 * **刻意吞掉错误**：`resolveDirEntry` 的既有契约就是「拿不到就给 `null`」，
 * 地址栏的自动补全用它判断路径是否存在。这里换成抛错会让每一次补全失败
 * 都变成一次未捕获异常。
 */
export async function statRemoteEntry(path: string): Promise<DirEntry | null> {
  try {
    return await invoke<DirEntry>(REMOTE_STAT_COMMAND, {
      path,
    });
  }
  catch {
    return null;
  }
}

/**
 * 把捕获到的东西变成一句能给人看的文案。
 *
 * ## 为什么必须有这个函数
 *
 * 导航器在 `use-file-browser-navigation.ts` 里原本写的是
 * `caughtError instanceof Error ? caughtError.message : String(caughtError)`。
 * 远程 `RemoteError` 是**普通对象**，走 `String()` 会得到字面量 `[object Object]`
 * —— 用户在认证失败时看到的是「[object Object]」，而这恰恰是规格 §6.3 明令禁止的
 * 「笼统错误」。所以远程路径的错误必须先解包成 `{ kind, message }` 再取 `message`。
 *
 * 非远程错误（本地的 `String`、真正的 `Error`）一律原样处理，
 * 这样这个函数对两条链路都成立，不会有「只有远程才走这里」的分叉。
 */
export function describeRemoteError(caught: unknown): string {
  if (isRemoteErrorPayload(caught)) {
    return caught.message;
  }

  if (caught instanceof Error) {
    return caught.message;
  }

  return String(caught);
}

// ---------------------------------------------------------------------------
// 主机密钥信任流（2026-10-18 决策 3：首见弹窗确认指纹）
// ---------------------------------------------------------------------------

/**
 * 这条信任记录钉住的是**哪一种**身份。
 *
 * 与后端 `known_hosts::TrustKind` 一一对应。
 *
 * 为什么键里必须有它：一台主机可以同时跑 SSH 与 FTPS，两者的信任是两件事。
 * 信任了 SSH 公钥**不构成**对 X.509 证书的任何信任，反过来也一样。
 */
export type TrustKind = 'ssh' | 'x509';

/**
 * 连接的协议 → 它会撞上哪一类主机密钥问题。
 *
 * **纯函数**，因为「SFTP 撞 SSH 密钥、FTPS 撞证书、明文 FTP 谁都不撞」
 * 这条对应关系是整套信任流的地基，而它必须在**后端弹错之前**就能算出来 ——
 * 错误载荷里不带 kind（带了的话 Rust 侧就要为每种协议各写一个 kind）。
 *
 * 明文 FTP 返回 `null`：它没有 TLS，证书那套完全用不上。
 */
export function trustKindForProtocol(protocol: string): TrustKind | null {
  if (protocol === 'sftp') {
    return 'ssh';
  }

  if (protocol === 'ftps_explicit' || protocol === 'ftps_implicit') {
    return 'x509';
  }

  return null;
}

/** 已信任主机的一行。设置页的「查看 / 删除」用它。 */
export interface KnownHostSummary {
  host: string;
  port: number;
  fingerprint: string;
  keyType: string;
  addedAt: number;
  kind: TrustKind;
}

/** 用户需要在弹窗里核对的内容。 */
export interface HostKeyTrustPrompt {
  /** 触发这次提示的远程路径，信任之后要重试的就是它。 */
  path: string;
  host: string;
  port: number;
  fingerprint: string;
  keyType: string;
  /** SSH 公钥还是 X.509 证书。决定写进记录的是哪一种信任。 */
  kind: TrustKind;
  /** `true` = 与已信任记录不一致（要显式警告），`false` = 首次见到。 */
  changed: boolean;
  /** 只有 `changed` 时有值：用户当初信任的那一份。 */
  expectedFingerprint?: string;
}

/**
 * 从一次失败里拼出「要问用户什么」。**纯函数**，可以脱离 UI 逐条钉住。
 *
 * 返回 `null` 表示「这不是主机密钥问题，别弹窗」。四种判空的情形：
 * 不是主机密钥错误、路径不是远程路径、连接在表里查不到、
 * **连接的协议压根不涉及主机密钥**（明文 FTP）——
 * 最后一种发生时**宁可不弹**：弹出一个写不进任何记录、或写进去也没有意义的
 * 确认框，只会让用户点完「信任」之后仍然失败。
 */
export function buildHostKeyTrustPrompt(
  caught: unknown,
  path: string,
  connection: RemoteConnection | undefined,
): HostKeyTrustPrompt | null {
  if (!isHostKeyError(caught) || !connection) {
    return null;
  }

  const parsed = parseRemotePath(path);

  if (parsed === null || parsed.connectionId !== connection.id) {
    return null;
  }

  // 协议决定「这是一把 SSH 公钥还是一张证书」。它必须由**连接**算出来，
  // 而不是从错误载荷里读 —— 那样后端就要为每种协议各发一个 kind，
  // 而错误载荷是协议实现自己产的，不该由它回答「你属于哪一类信任」。
  const kind = trustKindForProtocol(connection.protocol);

  if (kind === null) {
    return null;
  }

  // `isHostKeyError` 已经把 `caught` 收窄成 `RemoteErrorPayload & { fingerprint: string }`，
  // 这里**刻意不再 as 一次**：一旦上游的类型守卫被改松，`error.keyType` 会立刻报错，
  // 而不是被一个断言悄悄吞掉。
  const error = caught;
  const changed = error.kind === HOST_KEY_CHANGED_KIND;

  return {
    path,
    host: connection.host,
    port: connection.port,
    fingerprint: error.fingerprint,
    keyType: error.keyType ?? '',
    kind,
    changed,
    ...(changed && error.expectedFingerprint
      ? { expectedFingerprint: error.expectedFingerprint }
      : {}),
  };
}

/**
 * 执行用户的「我核对过了」——**先删旧记录，再写新记录**。
 *
 * 顺序不能反：`trust` 遇到同名主机是**覆盖**（`known_hosts::trust` 的既定语义），
 * 所以其实只调 trust 也够。这里仍然先 forget，是为了让「密钥变了」这条路
 * 在后端被改成追加式时也不会留下两条互相矛盾的记录。
 *
 * ⚠️ **两条命令都必须带 `kind`**：键是 `(host, port, kind)` 三元。
 * 漏掉它的话，「删掉旧的证书信任」会变成「删掉同一台主机的 **SSH** 信任」——
 * 而用户点的是证书那一条。结果是证书信任删不掉、SSH 信任反而没了。
 */
export async function applyHostKeyTrust(prompt: HostKeyTrustPrompt): Promise<void> {
  if (prompt.changed) {
    await invoke<boolean>('remote_forget_host', {
      host: prompt.host,
      port: prompt.port,
      kind: prompt.kind,
    });
  }

  await invoke('remote_trust_host', {
    host: prompt.host,
    port: prompt.port,
    fingerprint: prompt.fingerprint,
    keyType: prompt.keyType,
    kind: prompt.kind,
  });
}

export async function listKnownHosts(): Promise<KnownHostSummary[]> {
  return invoke<KnownHostSummary[]>('remote_list_known_hosts');
}

/**
 * 忘记一条信任。
 *
 * **带 `kind`** —— 设置页上同一台主机的 SSH 与证书是**两行**，
 * 点掉一行不该动另一行：用户想收紧一条信任，结果两条都松了。
 */
export async function forgetKnownHost(
  host: string,
  port: number,
  kind: TrustKind,
): Promise<boolean> {
  return invoke<boolean>('remote_forget_host', {
    host,
    port,
    kind,
  });
}

export { HOST_KEY_CHANGED_KIND, HOST_KEY_UNKNOWN_KIND };
