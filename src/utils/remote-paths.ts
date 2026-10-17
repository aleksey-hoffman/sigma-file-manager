// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 远程空间的路径族：`sfm://remote/<连接id>/<远端路径>`。
//
// 本文件是 `src-tauri/src/remote/path.rs` 的**逐条镜像**。两边必须通过同一组断言，
// 任何一侧改了规范化规则而另一侧没跟上，阶段 2 之后才会以「点不进去」的形式暴露。
//
// 规范化规则（两端一致）：
// - 尾斜杠一律剥离，远端根固定为 `/`
// - 连续斜杠折叠（用户会手输，要宽容）
// - `.` 与 `..` 段**拒绝**，不做词法解析，防 VFS 命名空间逃逸
// - 空连接 id 拒绝
// - **不做百分号编码**，空格与 Unicode 原样存放 —— 与本项目已有的本地路径
//   （`C:/My Documents/`）处理一致，也避免编码/解码不对称。

export const REMOTE_SCHEME = 'sfm://remote';

export interface RemotePath {
  connectionId: string;
  /** 恒以 `/` 开头；根目录为 `/`；不含尾斜杠（根目录除外）。 */
  remotePath: string;
}

/**
 * 连接 id 是否可用：非空，且不含正反斜杠。
 *
 * 正斜杠由「按首个斜杠切分」天然排除；反斜杠是真需要挡的 ——
 * Windows 上误传一个 `a\b` 会让两端解析出不同结果。
 */
function isValidConnectionId(connectionId: string): boolean {
  return connectionId.length > 0 && !connectionId.includes('/') && !connectionId.includes('\\');
}

/** 远端路径段。任一段是 `.` / `..` 则整个路径非法。 */
function splitRemoteSegments(remotePath: string): string[] | null {
  const segments = remotePath.split('/').filter(segment => segment.length > 0);

  if (segments.some(segment => segment === '.' || segment === '..')) {
    return null;
  }

  return segments;
}

/**
 * 规范化一个**远端**路径（不含连接 id）：折叠连续斜杠、剥离尾斜杠，
 * 根目录固定为 `/`。任一段是 `.` / `..` 则返回 `null`。
 *
 * 阶段 2/5 的 FTP、SFTP 交回来的路径要过这里才能和后端对齐。
 */
export function normalizeRemotePath(remotePath: string): string | null {
  const segments = splitRemoteSegments(remotePath);

  if (segments === null) {
    return null;
  }

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/**
 * 是否落在 `sfm://remote` 前缀下。
 *
 * 注意：这**不**保证路径合法 —— `sfm://remote/c/../x` 前缀成立，
 * 但 `parseRemotePath` 对它返回 `null`。两者分工不同，不要混用。
 */
export function isRemotePath(path: string): boolean {
  return path === REMOTE_SCHEME || path.startsWith(`${REMOTE_SCHEME}/`);
}

/** 解析并规范化。任一段是 `.` / `..`，或连接 id 为空，返回 `null`。 */
export function parseRemotePath(path: string): RemotePath | null {
  if (!path.startsWith(`${REMOTE_SCHEME}/`)) {
    return null;
  }

  const remainder = path.slice(REMOTE_SCHEME.length + 1);

  // 连接 id 取「首个斜杠之前」的那一段，不折叠空段 ——
  // 否则 `sfm://remote//pub` 会被折叠成合法的 `pub` 连接。
  const separatorIndex = remainder.indexOf('/');
  const connectionId = separatorIndex === -1 ? remainder : remainder.slice(0, separatorIndex);
  const tail = separatorIndex === -1 ? '' : remainder.slice(separatorIndex + 1);

  if (!isValidConnectionId(connectionId)) {
    return null;
  }

  const remotePath = normalizeRemotePath(tail);

  if (remotePath === null) {
    return null;
  }

  return {
    connectionId,
    remotePath,
  };
}

/**
 * 反向构造。`remotePath` 为 `''` 或 `'/'` 时产出连接根。
 * 连接 id 为空或含正反斜杠时返回 `null`。
 */
export function buildRemotePath(connectionId: string, remotePath: string): string | null {
  if (!isValidConnectionId(connectionId)) {
    return null;
  }

  const segments = splitRemoteSegments(remotePath);

  if (segments === null) {
    return null;
  }

  return segments.length === 0
    ? `${REMOTE_SCHEME}/${connectionId}`
    : `${REMOTE_SCHEME}/${connectionId}/${segments.join('/')}`;
}

/** `sfm://remote/<连接id>`。连接 id 非法时返回 `null`。 */
export function buildRemoteConnectionPath(connectionId: string): string | null {
  if (!isValidConnectionId(connectionId)) {
    return null;
  }

  return `${REMOTE_SCHEME}/${connectionId}`;
}

/** 词法父级。已在连接根时返回 `REMOTE_SCHEME`；已在根或路径非法时返回 `null`。 */
export function getRemoteParentPath(path: string): string | null {
  const parsed = parseRemotePath(path);

  if (parsed === null) {
    return null;
  }

  if (parsed.remotePath === '/') {
    return isRemotePath(path) ? REMOTE_SCHEME : null;
  }

  // 必须在**最后一个**斜杠处切：`/pub/docs` 用 indexOf 会在首个斜杠处切开，
  // 父级变成空串、直接退回连接根。
  const lastSeparatorIndex = parsed.remotePath.lastIndexOf('/');
  const parent = parsed.remotePath.slice(0, lastSeparatorIndex);

  return buildRemotePath(parsed.connectionId, parent);
}

/** 是否恰好是某个连接的根（`sfm://remote/<连接id>`，可带尾斜杠）。 */
export function isRemoteConnectionRootPath(path: string): boolean {
  return parseRemotePath(path)?.remotePath === '/';
}
