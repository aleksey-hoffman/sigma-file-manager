// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION: 前端 invoke 与 Rust command 的**参数名契约**。
//
// 为什么这道门禁必须存在
// ----------------------
// Tauri v2 按「Rust 参数名的 camelCase 形式」匹配 JS 传进来的键。
// 这个换算只有**下划线**这一处会咬人：
//
//   Rust `remote_path`  ->  JS `remotePath`   ✅
//   Rust `path`          ->  JS `path`         ✅
//   Rust `path`          ->  JS `remotePath`   ❌ 会被换算成 remote_path，对不上
//
// 本轮就踩了第二种：`remote_get_permissions` 的 Rust 参数叫 `path`，
// 前端传了 `remotePath`。两边各自单测都绿（前端 mock 掉了 invoke，
// Rust 单测根本不经过 Tauri 的参数绑定），只有真机上才会炸成
// 「unknown field remote_path」。
//
// 所以这里不 mock 掉后端：**直接读 Rust 源码**把参数名抠出来，
// 再和前端实际传出去的键逐条比对。源码变了、这边立刻红。
//

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  downloadFromRemote,
  getRemotePermissions,
  setRemotePermissions,
  uploadToRemote,
} from '../remote-transfer';

const { invokeMock } = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function findRepoRoot(): string {
  let dir = process.cwd();

  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, 'src-tauri', 'src', 'remote', 'commands.rs'))) {
      return dir;
    }

    const parent = path.dirname(dir);

    if (parent === dir) break;
    dir = parent;
  }

  throw new Error('从 cwd 向上找不到 src-tauri/src/remote/commands.rs');
}

const COMMANDS_RS = fs.readFileSync(
  path.join(findRepoRoot(), 'src-tauri', 'src', 'remote', 'commands.rs'),
  'utf8',
);

/**
 * 从 Rust 源码里抠出某个 command 的参数名。
 *
 * 形如：
 *   pub async fn remote_chmod(
 *       app: tauri::AppHandle,
 *       remote_path: String,
 *       mode: u32,
 *       recursive: bool,
 *   ) -> Result<RemoteChmodReport, RemoteError> {
 */
function rustParameterNames(command: string): string[] {
  const signature = new RegExp(
    `pub\\s+async\\s+fn\\s+${command}\\s*\\(([\\s\\S]*?)\\)\\s*->`,
  ).exec(COMMANDS_RS);

  expect(signature, `commands.rs 里找不到 ${command} 的签名`).not.toBeNull();

  const body = signature![1];

  return body
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0 && !part.startsWith('app:'))
    .map(part => part.split(':')[0].trim())
    .filter(name => name.length > 0);
}

/** Rust 的 snake_case 参数名 -> Tauri 期望的 camelCase 键。 */
function toTauriArgumentKey(rustName: string): string {
  return rustName.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

interface LastInvokeCall {
  command: string;
  payload: Record<string, unknown>;
}

function lastCall(): LastInvokeCall {
  expect(invokeMock).toHaveBeenCalled();

  const call = invokeMock.mock.calls.at(-1)!;

  return {
    command: call[0],
    payload: (call[1] ?? {}) as Record<string, unknown>,
  };
}

describe('远程传输的 invoke 参数名契约', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({});
  });

  it('remote_upload_path 传的键与 Rust 参数名逐条对上', async () => {
    await uploadToRemote('C:/Users/Duanyi/a.txt', 'sfm://remote/conn-1/dir');

    const { command, payload } = lastCall();
    const expected = rustParameterNames('remote_upload_path').map(toTauriArgumentKey);

    expect(command).toBe('remote_upload_path');
    expect(Object.keys(payload).sort()).toEqual([...expected].sort());
    expect(payload.localPath).toBe('C:/Users/Duanyi/a.txt');
    expect(payload.remoteDir).toBe('sfm://remote/conn-1/dir');
  });

  it('remote_download_path 传的键与 Rust 参数名逐条对上', async () => {
    await downloadFromRemote('sfm://remote/conn-1/a.txt', 'C:/Users/Duanyi');

    const { command, payload } = lastCall();
    const expected = rustParameterNames('remote_download_path').map(toTauriArgumentKey);

    expect(command).toBe('remote_download_path');
    expect(Object.keys(payload).sort()).toEqual([...expected].sort());
    expect(payload.remotePath).toBe('sfm://remote/conn-1/a.txt');
    expect(payload.localDir).toBe('C:/Users/Duanyi');
  });

  it('remote_chmod 传的键与 Rust 参数名逐条对上', async () => {
    await setRemotePermissions('sfm://remote/conn-1/a.txt', 0o754, true);

    const { command, payload } = lastCall();
    const expected = rustParameterNames('remote_chmod').map(toTauriArgumentKey);

    expect(command).toBe('remote_chmod');
    expect(Object.keys(payload).sort()).toEqual([...expected].sort());
    expect(payload.remotePath).toBe('sfm://remote/conn-1/a.txt');
    expect(payload.mode).toBe(0o754);
    expect(payload.recursive).toBe(true);
  });

  it('remote_get_permissions 传的键是 `path` —— Rust 参数名没有下划线，camelCase 之后仍然是 path', async () => {
    invokeMock.mockResolvedValue(0o644);

    await getRemotePermissions('sfm://remote/conn-1/a.txt');

    const { command, payload } = lastCall();
    const expected = rustParameterNames('remote_get_permissions').map(toTauriArgumentKey);

    expect(command).toBe('remote_get_permissions');
    expect(expected).toEqual(['path']);
    expect(Object.keys(payload)).toEqual(['path']);
    expect(payload.path).toBe('sfm://remote/conn-1/a.txt');
  });

  it('四个命令都真的注册进了 lib.rs 的 invoke handler', () => {
    const libRs = fs.readFileSync(
      path.join(findRepoRoot(), 'src-tauri', 'src', 'lib.rs'),
      'utf8',
    );

    for (const command of [
      'remote_upload_path',
      'remote_download_path',
      'remote_chmod',
      'remote_get_permissions',
    ]) {
      expect(
        libRs,
        `${command} 没有出现在 lib.rs 的 generate_handler! 里 —— 前端调它会报 "command not found"`,
      ).toContain(`remote::${command}`);
    }
  });
});
