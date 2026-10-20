// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 本地 ↔ 远程传输的前端调用层。
//
// 参数名是 **camelCase**：Tauri 会把它换算成 Rust 侧的 snake_case
// （`localPath` → `local_path`）。与既有的 `check_for_updates` 调用同一条规矩。
//
// 返回体字段是 **snake_case**：后端那几个结构体没有加
// `#[serde(rename_all = "camelCase")]`。

import { invoke } from '@tauri-apps/api/core';

/** 单个条目的失败原因。 */
export interface RemoteTransferFailure {
  path: string;
  message: string;
}

/** 一次传输的结果。 */
export interface RemoteTransferReport {
  /** 成功传输的文件数 */
  transferred_files: number;
  /** 成功创建的目录数 */
  transferred_dirs: number;
  /** 总字节数 */
  total_bytes: number;
  /** 因「目标已存在」而跳过的条目（完整路径） */
  skipped: string[];
  /** 失败的条目 */
  failures: RemoteTransferFailure[];
}

/** 一次权限设置的结果。 */
export interface RemoteChmodReport {
  /** 实际改动过的条目数 */
  changed: number;
  /** 失败的条目 */
  failures: RemoteTransferFailure[];
}

/**
 * 上传：本地文件**或目录** → 远程目录。
 *
 * 目录会**递归**上传。目标已存在同名文件时**不覆盖**，记进 `skipped`。
 */
export function uploadToRemote(
  localPath: string,
  remoteDir: string,
): Promise<RemoteTransferReport> {
  return invoke<RemoteTransferReport>('remote_upload_path', {
    localPath,
    remoteDir,
  });
}

/**
 * 下载：远程文件**或目录** → 本地目录。
 *
 * 目录会**递归**下载。目标已存在同名文件时**不覆盖**，记进 `skipped`。
 */
export function downloadFromRemote(
  remotePath: string,
  localDir: string,
): Promise<RemoteTransferReport> {
  return invoke<RemoteTransferReport>('remote_download_path', {
    remotePath,
    localDir,
  });
}

/**
 * 设置远程权限位。
 *
 * `mode` 是八进制数值（`0754` → `0o754` → `492`）。
 * **只有 SFTP 支持**；FTP / FTPS 会返回 `protocol` 类错误。
 */
export function setRemotePermissions(
  remotePath: string,
  mode: number,
  recursive: boolean,
): Promise<RemoteChmodReport> {
  return invoke<RemoteChmodReport>('remote_chmod', {
    remotePath,
    mode,
    recursive,
  });
}

/**
 * 读取远程条目的权限位（低 12 位）。
 *
 * **取不到时返回 `null`，不是抛错** —— 与既有 `remote_stat_dir_entry`
 * 「取不到就给 null」的契约一致：权限对话框用它来显示当前权限，
 * 抛错会让每次打开对话框都变成一次未捕获异常。
 * FTP / FTPS 没有可靠的权限位，一律返回 `null`。
 */
export function getRemotePermissions(remotePath: string): Promise<number | null> {
  // ⚠️ 参数名是 `path`，**不是** `remotePath`。
  // Tauri 按「Rust 参数名的 camelCase 形式」匹配 JS 传进来的键：
  // Rust 的 `path` 没有下划线，camelCase 之后仍然是 `path`；
  // 传 `remotePath` 会被换算成 `remote_path`，与 Rust 的 `path` 对不上，
  // 命令直接报「unknown field」。
  // 这条与既有的 `remote_stat_dir_entry` 同款 —— 它的 Rust 参数也叫 `path`。
  return invoke<number | null>('remote_get_permissions', {
    path: remotePath,
  });
}

/**
 * 删除一个远程文件或目录。
 *
 * ⚠️ 参数名是 `remotePath` / `isDir` —— Rust 侧是 `remote_path` / `is_dir`，
 * Tauri 按「Rust 参数名的 camelCase 形式」匹配 JS 传进来的键。
 * 传 `path` 会换算成 `path`，与 Rust 的 `remote_path` 对不上，命令直接报
 * 「unknown field」。
 *
 * **目录不做递归删除**：SFTP 的 `rmdir` 与 FTP 的 `RMD` 都不递归，
 * 非空目录会被服务器拒绝，后端把错误翻译成「目录不是空的」再带回来。
 *
 * **权限不足时 reject 的是 `{ kind: 'permission', message }`**
 * （SFTP 能分清；FTP 的 `550` 分不清「没权限」与「目录非空」，按 `not_found` 报）。
 */
export function removeRemotePath(remotePath: string, isDir: boolean): Promise<void> {
  return invoke<void>('remote_remove_path', {
    remotePath,
    isDir,
  });
}

/** 传输结果里有没有需要用户知道的问题。 */
export function hasTransferProblems(report: RemoteTransferReport): boolean {
  return report.skipped.length > 0 || report.failures.length > 0;
}
