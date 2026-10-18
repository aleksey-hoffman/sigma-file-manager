// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 远程连接的前端类型。与 `src-tauri/src/remote/connection.rs` 和
// `src-tauri/src/remote/transport.rs` **逐条镜像** —— 序列化名必须逐字对得上：
// 后端写进 `user-remote-connections.json` 的形状，就是这里读出来的形状。
//
// 镜像关系：
// - `RemoteProtocol` ← `RemoteProtocol`（snake_case）
// - `RemoteProxyConfig` ← `ProxyConfig`（`#[serde(tag = "kind", rename_all = "snake_case")]`）
// - `RemoteConnection` ← `RemoteConnection`（camelCase）

/** 与后端 `RemoteProtocol` 的四个变体一一对应。 */
export type RemoteProtocol = 'ftp' | 'ftps_explicit' | 'ftps_implicit' | 'sftp';

/**
 * 代理出口。
 *
 * **这里有密码字段**（`password`），它存的是代理认证信息，走 Rust 的
 * `remote-credentials.json`（DPAPI 加密），**绝不**写进 storage 链。
 * 与连接自身的密码是两条独立的密文记录。
 */
export type RemoteProxyConfig
  = | { kind: 'direct' }
    | {
      kind: 'socks5';
      host: string;
      port: number;
      username?: string;
      password?: string;
    }
    | {
      kind: 'http_connect';
      host: string;
      port: number;
      username?: string;
      password?: string;
    };

/** 一条已保存的远程连接。**不含密码**，只有指向密文的 `credentialKey`。 */
export interface RemoteConnection {
  /** uuid v4 simple。不得含正反斜杠 —— 它要嵌进 `sfm://remote/<id>/...`。 */
  id: string;
  name: string;
  protocol: RemoteProtocol;
  host: string;
  port: number;
  /** 可为空（匿名 FTP / 某些 SFTP）。 */
  username: string;
  /** 打开该连接时进的目录。恒以 `/` 开头。 */
  initialPath: string;
  proxy: RemoteProxyConfig;
  /** DPAPI 密文的键。没有密码的连接没有这个字段。 */
  credentialKey?: string;
}

/**
 * 新建 / 编辑连接的表单。
 *
 * `password` 空串的语义是「不碰已存的密码」，不是「清空密码」——
 * 清空要走显式的 `clearPassword`，否则用户改个端口顺手清空了密码框
 * 就会把密码丢掉，而界面上看不出任何区别。
 */
export interface RemoteConnectionForm {
  id?: string;
  name: string;
  protocol: RemoteProtocol;
  host: string;
  port: number;
  username: string;
  initialPath: string;
  proxy: RemoteProxyConfig;
  password: string;
  clearPassword: boolean;
}

/** Rust `RemoteError` 的前端镜像：`{ kind, message }`。 */
export interface RemoteErrorPayload {
  kind:
    | 'auth'
    | 'unreachable'
    | 'permission'
    | 'not_found'
    | 'protocol'
    | 'encoding'
    | 'disconnected'
    | 'unsupported'
    | 'unknown';
  message: string;
}

/** IANA 登记的默认端口，与后端 `RemoteProtocol::default_port` 对齐。 */
export function getRemoteProtocolDefaultPort(protocol: RemoteProtocol): number {
  switch (protocol) {
    case 'ftp':
    case 'ftps_explicit':
      return 21;
    case 'ftps_implicit':
      return 990;
    case 'sftp':
      return 22;
    default:
      return 21;
  }
}

/**
 * 生成一个新的连接 id / 凭据键。
 *
 * **凭据键就等于连接 id** —— 一条连接一份凭据，不另起一套编号。
 * 用 uuid v4 simple 的 32 位十六进制：不含正反斜杠，长度固定，没有 `/` 就能安全嵌进
 * `sfm://remote/<id>/...`。
 */
export function createRemoteConnectionId(): string {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID().replace(/-/g, '');
  }

  // 极端降级路径。正式运行在 Tauri 的 WebView2 里，randomUUID 一定存在；
  // 这里只是为了让单测与老环境不至于直接抛错。
  const bytes = new Uint8Array(16);

  if (globalCrypto?.getRandomValues) {
    globalCrypto.getRandomValues(bytes);
  }

  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
