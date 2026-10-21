// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：**e2e 数据隔离的「接线层」契约门禁**。
//
// ## 这道门禁为什么存在
//
// 隔离的机制本身（`app_dirs.rs` + `app-dirs.ts`）有单测，
// 但「所有 app 数据路径都走这个解析点」这件事**测不出来** ——
// 它是一条跨越十几个文件的约定，中间漏掉一个文件不会报任何错，
// 只会让 e2e 在跑的时候悄悄读到用户真实的 app 数据。
//
// 漏掉的代价还不小：远程凭据、MCP 客户端配置、缩略图缓存、全局搜索索引、
// 扩展目录、窗口状态、图标探针目录 —— 任何一个漏网，隔离就等于没做。
// 本仓比上游多出 `remote/` 与 `mcp/` 两个模块（上游没有），
// 它们的 app 数据目录**本来就不在**上游的改动清单里，是最容易漏的一处。
//
// 所以这里**直接读源码**把约定抠出来断言：
//   1. Rust 侧：除 `app_dirs.rs` 自己以外，没有任何地方直接调
//      `app.path().app_data_dir()` 之类的解析器；
//   2. 前端侧：需要 app 目录的地方从 `@/utils/app-dirs` 取，
//      不再从 `@tauri-apps/api/path` 取；
//   3. 跨语言契约：前端 `invoke('get_app_dirs')` 与 Rust 命令名一致，
//      且命令在 `invoke_handler` 里注册了；
//   4. release 构建里这个覆盖是**编译不进去**的 ——
//      正式发布的包必须和改动前完全一样。
//
// 源码一变测试立刻红，不需要跑 Rust、不需要起应用。

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 本文件在 `src/utils/__tests__/` 下，往上三层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..');
const RUST_SRC = join(REPO_ROOT, 'src-tauri', 'src');

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function listRustFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry);

    if (statSync(entryPath).isDirectory()) {
      files.push(...listRustFiles(entryPath));
      continue;
    }

    if (entry.endsWith('.rs')) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('e2e 数据隔离的接线层', () => {
  it('Rust 侧除了 app_dirs.rs 之外没有直接解析 app 目录', () => {
    const appDirsPath = join(RUST_SRC, 'app_dirs.rs');
    // 这些是 Tauri 自己的解析器。绕过 app_dirs.rs 直接调它们，
    // 隔离的 e2e 实例就会读到用户真实的 app 数据目录。
    const forbidden = [
      '.app_data_dir()',
      '.app_config_dir()',
      '.app_local_data_dir()',
      '.app_cache_dir()',
      '.app_log_dir()',
    ];
    const offenders: string[] = [];

    for (const rustFile of listRustFiles(RUST_SRC)) {
      if (rustFile === appDirsPath) {
        continue;
      }

      const source = read(rustFile);

      for (const pattern of forbidden) {
        if (source.includes(pattern)) {
          offenders.push(`${relative(REPO_ROOT, rustFile)} -> ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('前端需要 app 目录的地方从 @/utils/app-dirs 取', () => {
    const frontendFiles = [
      join(REPO_ROOT, 'src', 'data', 'user-paths.ts'),
      join(REPO_ROOT, 'src', 'modules', 'settings', 'ui', 'actions.vue'),
      join(REPO_ROOT, 'src', 'stores', 'schemas', 'user-settings.ts'),
    ];

    for (const filePath of frontendFiles) {
      const source = read(filePath);

      expect(source, relative(REPO_ROOT, filePath)).toContain('from \'@/utils/app-dirs\'');
      // 不能还从 @tauri-apps/api/path 取 app* 目录。
      expect(source, relative(REPO_ROOT, filePath)).not.toMatch(
        /import\s*\{[^}]*\bapp(Data|Config|LocalData|Cache|Log)Dir\b[^}]*\}\s*from\s*'@tauri-apps\/api\/path'/s,
      );
    }
  });

  it('get_app_dirs 命令名跨语言一致且已注册', () => {
    const rust = read(join(RUST_SRC, 'app_dirs.rs'));
    const lib = read(join(RUST_SRC, 'lib.rs'));
    const ts = read(join(REPO_ROOT, 'src', 'utils', 'app-dirs.ts'));

    expect(rust).toContain('pub fn get_app_dirs');
    expect(lib).toContain('app_dirs::get_app_dirs');
    expect(ts).toContain('invoke<AppDirs>(\'get_app_dirs\')');
  });

  it('隔离覆盖在 release 构建里编译不进去', () => {
    const rust = read(join(RUST_SRC, 'app_dirs.rs'));

    // 覆盖只在 debug 构建生效。release 的包必须和改动前逐字一样，
    // 否则这就不是「e2e 基建」而是「改了正式包的行为」。
    expect(rust).toContain('#[cfg(not(debug_assertions))]');
    expect(rust).toMatch(
      /#\[cfg\(not\(debug_assertions\)\)\]\s*\{\s*None\s*\}/,
    );
  });
});
