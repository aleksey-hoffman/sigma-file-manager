# 导航器行为一致性 实施计划（子项目 A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Alpha File Manager 的文件列表在混合排序、框选可用性、缩略图缓存可控三方面对齐用户从 Windows Explorer 迁入的预期。

**Architecture:** 三项改动彼此独立，各自可独立发版。混合排序是纯前端设置驱动的排序行为变更；框选是一次性设置 schema 迁移；缓存清理是把已存在但未暴露的 Rust 能力接到 Tauri command 与设置页。全程零新依赖。

**Tech Stack:** Vue 3 + TypeScript（Pinia 设置存储、vue-i18n 17 语言包）、Rust + Tauri 2.x（`#[tauri::command]`）、Vitest、Rust 内置测试框架。

## Global Constraints

以下约束在**每个 Task 中都生效**，逐条来自设计文档：

- **零新依赖**：不得新增任何 npm 或 Cargo 依赖。
- **受保护常量不得改动**：mDNS 服务名、legacy 数据目录名、Tauri `identifier`（`com.sigma-file-manager.app`）。
- **品牌名统一为 Alpha File Manager**，不重新讨论命名或图标。
- **FORK-MODIFICATION 约定**：受影响的文件若已有该注释标记（见 `src/types/user-settings.ts:380`），新增改动沿用同样的注释风格。
- **i18n**：新增 key 必须走全部 **17 个语言包**，`src/localization/messages/ch.json` 写中文，其余 15 个写英文占位（已定方案 A）。有现成门禁 `src/localization/__tests__/messages-key-alignment.test.ts` 校验对齐。
- **判别性验证（硬要求）**：每个新测试必须先注入缺陷确认**转红**，再恢复确认转绿。转红时**失败输出必须精确展示预期的那种损坏**——只看到 `assertion failed` 不足以证明探针打对了地方。注入前必须先确认「这一行在我构造的场景里真的会被执行到」。
- **真机验收（硬要求）**：见 Task 4 Step 7。桌面未解锁时记为「不可验证」，**禁止用单测结果冒充**。
- **门禁命令**（须先做 1.90.0 进程级 PATH 注入，见 Task 1 Step 1）：
  - `& "$tc\cargo.exe" test --lib` —— 基线以实测为准，不要用文档旧数字
  - `npm run ts` —— 真门禁是 `vue-tsc --build`
  - `npx vitest run` —— `use-navigator-item-icon` 为已知 flaky，需单跑排除

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `src/types/user-settings.ts` | `UserSettingsNavigator` 增加 `foldersFirst` 字段 | 1 |
| `src/stores/storage/user-settings.ts` | 设置默认值 | 1, 2 |
| `src/modules/navigator/components/file-browser/utils/file-browser-sort.ts` | 排序核心，新增 `foldersFirst` 参数 | 1 |
| `src/modules/navigator/components/file-browser/composables/use-file-browser-entries.ts` | 透传 `foldersFirst: Ref<boolean>` | 1 |
| `src/modules/navigator/components/file-browser/composables/use-file-browser.ts` | 两个调用点传入设置值 | 1 |
| `src/modules/settings/ui/categories/appearance/folder-ordering.vue` | 新建：混合排序开关 | 1 |
| `src/stores/runtime/settings.ts` | 设置项注册（三处） | 1, 4 |
| `src/stores/schemas/user-settings.ts` | schema 迁移 v27→v28 | 2 |
| `src/modules/settings/ui/categories/general/file-view.vue` | 框选说明文案 | 2 |
| `src-tauri/src/image_thumbnails.rs` | `ThumbnailCacheStats` 可序列化 + 两个新 command | 3 |
| `src-tauri/src/lib.rs` | command 注册 | 3 |
| `src/modules/settings/ui/categories/storage/thumbnail-cache.vue` | 新建：缓存占用显示与清理按钮 | 4 |

---

### Task 1: 混合排序开关

**Files:**
- Modify: `src/types/user-settings.ts`（`UserSettingsNavigator`）
- Modify: `src/stores/storage/user-settings.ts`（默认值）
- Modify: `src/modules/navigator/components/file-browser/utils/file-browser-sort.ts:48-63`
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-entries.ts:29-36,88-93`
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser.ts:150-156,221-227`
- Create: `src/modules/settings/ui/categories/appearance/folder-ordering.vue`
- Modify: `src/stores/runtime/settings.ts`（三处注册）
- Test: `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-sort.test.ts`

**Interfaces:**
- Consumes: 无（首个 Task）
- Produces:
  - `sortFileBrowserEntries(items: DirEntry[], column: ListSortColumn, direction: ListSortDirection, foldersFirst: boolean, tagContext?: FileBrowserEntrySortTagContext): DirEntry[]`
  - `useFileBrowserEntries(..., foldersFirst: Ref<boolean>, applySort: ComputedRef<boolean>)` —— 新参数插在 `sortDirection` 之后、`applySort` 之前

- [ ] **Step 1: 建立 1.90.0 进程级 PATH 注入并确认基线**

```powershell
$tc = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin"
[Environment]::SetEnvironmentVariable('PATH', "$tc;" + $env:PATH, 'Process')
Set-Location F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri
& "$tc\cargo.exe" test --lib
```

Expected: 全部通过。**记录实际数字**作为本轮基线。

⚠️ 不要设 `$ErrorActionPreference = 'Stop'`：cargo 会把 `warning: failed to save last-use data` 写到 stderr，PowerShell 会把它当错误终止脚本，导致「测试失败」的假象。

- [ ] **Step 2: 写失败的测试**

在 `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-sort.test.ts` 追加。现有条目全部使用 4 参数签名（`tagContext` 为第 4 位），本 Task 会把签名改为 5 参数，届时需一并更新现有调用。

```ts
describe('sortFileBrowserEntries foldersFirst', () => {
  const mkEntry = (name: string, isDir: boolean): DirEntry => ({
    name,
    is_dir: isDir,
    path: `C:/d/${name}`,
  } as DirEntry);

  it('places folders before files when foldersFirst is true', () => {
    const entries = [
      mkEntry('b.txt', false),
      mkEntry('a_folder', true),
      mkEntry('a.txt', false),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', true);
    expect(sorted.map(e => e.name)).toEqual(['a_folder', 'a.txt', 'b.txt']);
  });

  it('interleaves folders and files by the sort column when foldersFirst is false', () => {
    const entries = [
      mkEntry('b_folder', true),
      mkEntry('a.txt', false),
      mkEntry('a_folder', true),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', false);
    expect(sorted.map(e => e.name)).toEqual(['a.txt', 'a_folder', 'b_folder']);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/modules/navigator/components/file-browser/utils/__tests__/file-browser-sort.test.ts`
Expected: FAIL —— TS 报 `Expected 3-4 arguments, but got 5`，因为签名还没改。

- [ ] **Step 4: 改排序函数签名与实现**

`file-browser-sort.ts:48-63`，把 `foldersFirst: boolean` 插到第 4 位：

```ts
export function sortFileBrowserEntries(
  items: DirEntry[],
  column: ListSortColumn,
  direction: ListSortDirection,
  foldersFirst: boolean,
  tagContext?: FileBrowserEntrySortTagContext,
): DirEntry[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  const tagNamesByPath = tagContext ? createTagNamesByPath(tagContext) : new Map<string, string[]>();
  const getLinkSortFields = tagContext?.getLinkSortFields;

  return [...items].sort((entryA, entryB) => {
    if (foldersFirst && entryA.is_dir !== entryB.is_dir) {
      return entryA.is_dir ? -1 : 1;
    }

    // ...其余逻辑不变
```

关键点：`foldersFirst === true` 时与原第 59 行 `dirsFirst` 表达式**逐字节等价**（同类为 0、目录为 -1、文件为 1），保证默认路径零行为变化。

- [ ] **Step 5: 更新既有测试调用并确认新测试转绿**

`file-browser-sort.test.ts` 与 `file-browser-entry-groups.test.ts` 中所有既有的 3 参数调用改为 4 参数，**第 4 位传 `true`**（保持原语义：文件夹置顶）。

Run: `npx vitest run src/modules/navigator/components/file-browser`
Expected: PASS

- [ ] **Step 6: 判别性验证 —— 注入缺陷确认转红**

临时把 Step 4 的 `if (foldersFirst && ...)` 改成 `if (false && foldersFirst && ...)`，重跑。

Expected: FAIL，且失败输出必须**精确显示文件夹混入了文件序列**（如 `["a.txt","a_folder","b_folder"]` 而非 `["a_folder","a.txt","b.txt"]`）。若失败信息指向别的断言，说明探针没打到目标，先修探针再继续。验证后立即恢复。

- [ ] **Step 7: 加类型字段与默认值**

`src/types/user-settings.ts` 的 `UserSettingsNavigator` 增加：

```ts
  // FORK-MODIFICATION: 可关闭的文件夹优先排序（上游 #529/#481/#482）
  foldersFirst: boolean;
```

`src/stores/storage/user-settings.ts` 的 `navigator` 默认对象内，紧邻 `listSortDirection: 'asc'` 增加：

```ts
      foldersFirst: true,
```

- [ ] **Step 8: 透传到 composable 与两个调用点**

`use-file-browser-entries.ts` 的参数列表在 `sortDirection` 之后、`applySort` 之前插入 `foldersFirst: Ref<boolean>`，并在第 88 行的调用中传入：

```ts
      items = sortFileBrowserEntries(
        entriesForSort,
        column,
        sortDirection.value,
        foldersFirst.value,
        sortContext,
      );
```

`use-file-browser.ts` 需要两处改动。在两个 `useFileBrowserEntries(...)` 调用前各加一个 computed，并传入：

```ts
  const foldersFirst = computed(() => userSettingsStore.userSettings.navigator.foldersFirst);
```

若该文件尚未引入 `useUserSettingsStore` 与 `computed`，按现有 import 风格补上。

- [ ] **Step 9: 运行类型门禁**

Run: `npm run ts`
Expected: exit 0

- [ ] **Step 10: 新建设置项组件**

`src/modules/settings/ui/categories/appearance/folder-ordering.vue`，严格照抄 `show-hidden-items.vue` 的结构：

```vue
<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { FolderTreeIcon } from '@lucide/vue';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const foldersFirst = computed(() => userSettingsStore.userSettings.navigator.foldersFirst);

function setFoldersFirst(checked: boolean) {
  userSettingsStore.set('navigator.foldersFirst', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.foldersFirst')"
    :icon="FolderTreeIcon"
  >
    <Switch
      :model-value="foldersFirst"
      @update:model-value="setFoldersFirst"
    />
  </SettingsItem>
</template>
```

- [ ] **Step 11: 注册设置项（三处，缺一不可）**

`src/stores/runtime/settings.ts`：

1. 在 `ShowHiddenItemsSection` 声明之后增加 `FolderOrderingSection` 的具名 import
2. 在懒加载 `import(...)` 列表中 `show-hidden-items.vue` 之后增加：
   ```ts
   import('@/modules/settings/ui/categories/appearance/folder-ordering.vue'),
   ```
3. 在 section 定义数组中 `showHiddenItems` 条目之后增加：
   ```ts
       {
         key: 'foldersFirst',
         titleKey: 'settings.navigator.foldersFirst',
         tags: 'settingsTags.navigator',
         component: markRaw(FolderOrderingSection),
         category: 'appearance',
       },
   ```

⚠️ 三处都要改。只改前两处会在设置页渲染空白或直接崩。

- [ ] **Step 12: 补 17 个语言包**

在 `src/localization/messages/ch.json` 的 `settings.navigator` 下增加：

```json
"foldersFirst": "文件夹排在文件之前"
```

其余 15 个语言包（`de, es, fr, he, hi, hu, hy, it, ja, pl, pt, ru, sl, tr, ur, vi` 中实际存在的 15 个）同样位置增加：

```json
"foldersFirst": "Place folders before files"
```

⚠️ 语言包实际数量以 `src/localization/messages/` 目录为准，先 `ls` 确认，不要照抄上面的列表。

- [ ] **Step 13: 跑门禁并提交**

```powershell
npm run ts
npx vitest run src/modules/navigator src/modules/settings src/localization
Set-Location src-tauri; & "$tc\cargo.exe" test --lib
```

```bash
git add -A src src/localization
git commit -m "feat(navigator): 增加混合排序开关（上游 #529/#481/#482）

文件夹优先排序此前硬编码在 sortFileBrowserEntries 中，导致按修改时间排序时
文件夹遮挡最近文件。新增 navigator.foldersFirst 设置（默认 true，表达式与
改动前逐字节等价），默认行为不变。"
```

---

### Task 2: 框选迁移强制开启

**Files:**
- Modify: `src/stores/schemas/user-settings.ts`（版本常量 + 新迁移分支）
- Modify: `src/stores/storage/user-settings.ts`（默认值）
- Modify: `src/modules/settings/ui/categories/general/file-view.vue`（说明文案）
- Test: `src/stores/schemas/__tests__/user-settings.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 设置 key `navigator.enableBoxSelection` 语义确定为「始终为 true（除非用户再次关闭）」

- [ ] **Step 1: 确认当前 schema 版本号与现有迁移写法**

```bash
grep -n "USER_SETTINGS_SCHEMA_VERSION" src/stores/schemas/user-settings.ts
```

读 `src/stores/schemas/user-settings.ts` 的 v23→v24 分支（已知在 448-456 行），它展示了本项目迁移的既有模式。

- [ ] **Step 2: 写失败的测试**

在 `src/stores/schemas/__tests__/user-settings.test.ts` 追加：

```ts
it('forces box selection on when migrating to the latest schema even if the user had disabled it', async () => {
  const storage = createMockStorage({
    'navigator.enableBoxSelection': false,
  });
  storage.values.set(USER_SETTINGS_SCHEMA_VERSION_KEY, 24);

  await migrateUserSettingsStorage(storage);

  expect(storage.values.get('navigator.enableBoxSelection')).toBe(true);
  expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
});
```

同时把既有断言 `expect(storage.values.get('navigator.enableBoxSelection')).toBe(false)`（已知在第 196 行）改为 `toBe(true)`。

`createMockStorage` 与两个常量的确切导入名以该测试文件顶部已有 import 为准，**复用文件中已有的写法**，不要新造辅助函数。

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/stores/schemas/__tests__/user-settings.test.ts`
Expected: FAIL —— 版本号仍是 24，迁移未写入。

- [ ] **Step 4: 提升版本号并加迁移分支**

在 `src/stores/schemas/user-settings.ts`：

1. `USER_SETTINGS_SCHEMA_VERSION` 由 `27` 改为 `28`（实施时以实际值为准；Task 1 已把版本推到 27）
2. 在既有最后一个迁移分支之后追加：

```ts
  if (fromVersion === 24 && toVersion === 25) {
    // FORK-MODIFICATION: 框选迁移强制开启（上游 #465）。
    // 这是**覆盖写**而非 setDefaultBooleanIfMissing —— 已确认要覆盖用户此前的关闭选择。
    // 补偿措施：设置项下方有说明文案，告知可再次关闭。
    await storage.set('navigator.enableBoxSelection', true);
  }
```

⚠️ 确认该文件里写值用的是 `storage.set(...)` 还是 `userSettingsStore.set(...)` 之类的包装函数，**照抄文件内既有调用的形式**。

- [ ] **Step 5: 改默认值**

`src/stores/storage/user-settings.ts` 的 `navigator` 默认对象：`enableBoxSelection: false` → `enableBoxSelection: true`。

- [ ] **Step 6: 运行测试确认转绿**

Run: `npx vitest run src/stores/schemas/__tests__/user-settings.test.ts`
Expected: PASS

- [ ] **Step 7: 判别性验证 —— 注入缺陷确认转红**

把 Step 4 的 `storage.set('navigator.enableBoxSelection', true)` 改成 `setDefaultBooleanIfMissing(storage, 'navigator.enableBoxSelection', true)`（即用「仅缺失才写」替代覆盖写）。

Expected: FAIL，且失败输出必须是 `expected false to be true`（用户的 false 保留了）——这正是本迁移要修正的缺陷。若失败指向别的用例，说明探针打偏。

验证后恢复为覆盖写。

- [ ] **Step 8: 加设置项说明文案**

`src/modules/settings/ui/categories/general/file-view.vue` 中 `onEnableBoxSelectionChange` 对应的 `SettingsItem` 下方增加描述文案。照该文件里其他带描述项的写法（例如 `informationDensity` 一项）添加 `:description` 或在模板内加 `<template #description>`。

文案语义：「框选已默认启用。若拖拽选择影响你的操作习惯，可在此关闭。」

- [ ] **Step 9: 补 17 个语言包**

在 `ch.json` 增加中文原文，其余 15 个语言包增加英文占位。key 名建议 `settings.general.boxSelectionEnabledByDefault`。中文要写清楚「可在此关闭」，这是对被覆盖用户的唯一补救。

⚠️ 语言包实际数量以目录为准。

- [ ] **Step 10: 跑门禁并提交**

```powershell
npm run ts
npx vitest run src/stores src/modules/settings src/localization
```

```bash
git add -A src src/localization
git commit -m "feat(navigator): 框选迁移强制开启（上游 #465）

框选功能早已实现且含单测，但 navigator.enableBoxSelection 默认为 false，
用户无法在不进入设置的情况下使用（上游 #465）。schema 升 v27→v28，迁移中
覆盖写为 true。

已确认的代价：曾主动关闭框选的用户会被重新打开。补偿措施是设置项下方的
说明文案，告知可再次关闭。"
```

---

### Task 3: 缩略图缓存清理（后端 command）

**Files:**
- Modify: `src-tauri/src/image_thumbnails.rs`（`ThumbnailCacheStats` + 两个新 command）
- Modify: `src-tauri/src/lib.rs`（注册）

**Interfaces:**
- Consumes: 无
- Produces: 两个 Tauri command
  - `get_thumbnail_cache_stats(app: AppHandle) -> Result<ThumbnailCacheStats, String>`，返回 `{ itemCount: number, sizeBytes: number }`
  - `clear_thumbnail_cache(app: AppHandle) -> Result<(), String>`

  ⚠️ **命令名是 `get_thumbnail_cache_stats`，不是 `thumbnail_cache_stats`** —— 后者与内部私有函数同名会冲突。
  本段原先写的是旧名，与同文件 Step 4 的推荐自相矛盾，按旧名调用会 404。前端务必以本段订正后的名称为准。

  ⚠️ **清理范围含视频缩略图**：图片与视频缩略图共用同一 cache_dir，`clear_thumbnail_cache` 会一并清除。
  设置页的确认文案需体现这一点，否则用户会以为只清了图片缓存。

⚠️ **清理范围仅限 `thumbnail_cache_dir(&app)`**，该函数返回 `app_data_dir()/IMAGE_THUMBNAIL_CACHE_DIR`，位于应用数据目录下，**不接触用户文件**。实现时不得改为遍历其它路径。

- [ ] **Step 1: 写失败的 Rust 测试**

在 `image_thumbnails.rs` 的 `#[cfg(test)] mod tests` 内追加：

```rust
    #[test]
    fn thumbnail_cache_stats_counts_files_and_bytes() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.png"), b"12345").unwrap();
        std::fs::write(dir.path().join("b.png"), b"678").unwrap();

        let stats = thumbnail_cache_stats(dir.path()).unwrap();
        assert_eq!(stats.item_count, 2);
        assert_eq!(stats.size_bytes, 8);
    }

    #[test]
    fn clear_thumbnail_cache_dir_empties_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.png"), b"12345").unwrap();

        clear_thumbnail_cache_dir(dir.path()).unwrap();

        let remaining = std::fs::read_dir(dir.path()).unwrap().count();
        assert_eq!(remaining, 0, "清理后目录应为空");
    }
```

若该测试模块没有 `tempfile` dev-dependency 的引用方式，参照同文件已有测试的写法。

- [ ] **Step 2: 运行确认失败**

```powershell
Set-Location src-tauri
& "$tc\cargo.exe" test --lib image_thumbnails
```

Expected: 若 `thumbnail_cache_stats` / `clear_thumbnail_cache_dir` 已存在且签名匹配则可能直接 PASS——这属于「测试平凡」情形，必须做 Step 6 的判别性验证才能算数。

- [ ] **Step 3: 让 `ThumbnailCacheStats` 可序列化**

`image_thumbnails.rs:41-45`：

```rust
#[derive(Default, Serialize)]
struct ThumbnailCacheStats {
    item_count: usize,
    size_bytes: u64,
}
```

并在该文件顶部确认 `use serde::Serialize;` 已引入（若未引入则补上）。前端按 camelCase 消费，故序列化时用 `#[serde(rename_all = "camelCase")]`：

```rust
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThumbnailCacheStats {
    item_count: usize,
    size_bytes: u64,
}
```

- [ ] **Step 4: 新增两个 command**

放在 `image_thumbnails.rs` 中现有 `generate_image_thumbnail` 之后，照抄它的 `app: tauri::AppHandle` 取 cache_dir 模式：

```rust
#[tauri::command]
pub async fn thumbnail_cache_stats(
    app: tauri::AppHandle,
) -> Result<ThumbnailCacheStats, String> {
    let cache_dir = thumbnail_cache_dir(&app)?;
    if !cache_dir.exists() {
        return Ok(ThumbnailCacheStats::default());
    }
    thumbnail_cache_stats(&cache_dir)
}
```

⚠️ 函数名与内部私有函数 `thumbnail_cache_stats` **同名**会冲突。内部函数改名为 `collect_thumbnail_cache_stats`（同时更新其现有调用点），或把 command 命名为 `get_thumbnail_cache_stats`。**推荐后者**，改动面更小。

```rust
#[tauri::command]
pub async fn get_thumbnail_cache_stats(
    app: tauri::AppHandle,
) -> Result<ThumbnailCacheStats, String> {
    let cache_dir = thumbnail_cache_dir(&app)?;
    if !cache_dir.exists() {
        return Ok(ThumbnailCacheStats::default());
    }
    thumbnail_cache_stats(&cache_dir)
}

#[tauri::command]
pub async fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = thumbnail_cache_dir(&app)?;
    if !cache_dir.exists() {
        return Ok(());
    }
    clear_thumbnail_cache_dir(&cache_dir)
}
```

- [ ] **Step 5: 注册 command**

`src-tauri/src/lib.rs` 的 invoke handler 中，紧邻 `image_thumbnails::generate_image_thumbnail` 增加两行：

```rust
            image_thumbnails::get_thumbnail_cache_stats,
            image_thumbnails::clear_thumbnail_cache,
```

- [ ] **Step 6: 判别性验证 —— 注入缺陷确认转红**

临时把 `clear_thumbnail_cache` 的实现改为清空**父目录**而非 cache_dir（例如把 `clear_thumbnail_cache_dir(&cache_dir)` 换成对 `cache_dir.parent()` 的调用）。

Expected: FAIL，且失败输出显示清理跑到了缓存目录之外。若测试仍然 PASS，说明测试没有真正覆盖到「只清理缓存目录」这个性质——需要补一个断言，验证 cache_dir 的**父目录**内容未被触碰。

验证后立即恢复。

- [ ] **Step 7: 跑 Rust 全量门禁**

```powershell
& "$tc\cargo.exe" test --lib
```

Expected: 全部通过，数量 = Step 1 基线 + 2。

- [ ] **Step 8: 提交**

```bash
git add src-tauri/src/image_thumbnails.rs src-tauri/src/lib.rs
git commit -m "feat(thumbnails): 暴露缩略图缓存统计与清理 command（上游 #545）

clear_thumbnail_cache_dir 与 thumbnail_cache_stats 此前已实现但未注册为
Tauri command，前端无法触达（上游 #545）。本次仅包装既有逻辑，不改动任何
清理行为；清理范围严格限定 app_data_dir 下的缩略图子目录。"
```

---

### Task 4: 缩略图缓存清理（前端设置项）+ 真机验收

**Files:**
- Create: `src/modules/settings/ui/categories/storage/thumbnail-cache.vue`
- Modify: `src/stores/runtime/settings.ts`（三处注册）
- Test: 如前端无合适单测位置，本 Task 以真机验收为主

**Interfaces:**
- Consumes: Task 3 产出的 `get_thumbnail_cache_stats` 与 `clear_thumbnail_cache` 两个 command
- Produces: 无（末端任务）

- [ ] **Step 1: 新建设置项组件**

`src/modules/settings/ui/categories/storage/thumbnail-cache.vue`。与 Task 1 的开关项不同，这里需要一个「读数值 + 按钮 + 异步状态」，用 `SettingsItem` + 现有 Button 组件：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { SettingsItem } from '@/modules/settings';
import { ImagesIcon, LoaderCircleIcon } from '@lucide/vue';

const { t } = useI18n();

const sizeBytes = ref<number | null>(null);
const itemCount = ref<number | null>(null);
const busy = ref(false);
const errorMessage = ref<string | null>(null);

async function refresh() {
  try {
    const stats = await invoke<{ itemCount: number; sizeBytes: number }>('get_thumbnail_cache_stats');
    itemCount.value = stats.itemCount;
    sizeBytes.value = stats.sizeBytes;
    errorMessage.value = null;
  }
  catch (error) {
    errorMessage.value = String(error);
  }
}

async function clearCache() {
  busy.value = true;
  try {
    await invoke('clear_thumbnail_cache');
    await refresh();
  }
  catch (error) {
    errorMessage.value = String(error);
  }
  finally {
    busy.value = false;
  }
}

onMounted(refresh);
</script>
```

模板部分用 `SettingsItem` 承载标题与图标，正文展示：

- 占用大小：`sizeBytes === null` 显示 `t('settings.storage.thumbnailCache.sizeUnknown')`，否则显示格式化后的字节数
- 条目数：`itemCount`
- 清理按钮：`busy` 时禁用并显示旋转图标
- 错误：`errorMessage` 非空时以现有错误样式显示，**不得静默吞掉**

⚠️ 字节格式化复用项目已有的工具函数。先 `grep -rn "formatBytes\|formatFileSize\|format_size" src/utils/` 找到既有实现并复用，不要新写一个。

- [ ] **Step 2: 注册设置项（三处）**

同 Task 1 Step 11 的三处模式，`category` 改为 `'storage'`，组件路径改为 `storage/thumbnail-cache.vue`。

- [ ] **Step 3: 补 17 个语言包**

至少 4 个 key：`title`、`sizeUnknown`、`clear`、`clearSuccess`。`ch.json` 写中文，其余 15 个写英文占位。

- [ ] **Step 4: 跑前端门禁**

```powershell
npm run ts
npx vitest run src/modules/settings src/localization
```

- [ ] **Step 5: 提交**

```bash
git add -A src src/localization
git commit -m "feat(settings): 增加缩略图缓存占用显示与清理按钮（上游 #545）"
```

- [ ] **Step 6: 真机验收（三项，逐条记录证据来源）**

**前置条件：必须先解锁桌面。** 2026-10-11 曾因 `LogonUI` 在运行、`GetForegroundWindow` 返回 0 导致所有 `SendInput` 失败，UI 无法自动化。若桌面仍锁定，本 Step 记为「不可验证」并停止，**不要**用单测结果冒充。

逐项确认并记录实际观察到的现象：

1. **混合排序**：打开一个含多文件夹与文件的目录（可复用 `C:\Users\Duanyi\AppData\Local\Temp\afm-p2-2` 或自建），按「修改时间」降序；关闭开关后文件夹应不再遮挡最近修改的文件；开启后恢复置顶。**确认分屏模式下两个面板都生效**（`useFileBrowserEntries` 有两个调用点）。
2. **框选**：用一个**从旧版本升级过来**的设置文件启动（`navigator.enableBoxSelection` 为 `false`），确认升级后框选生效、设置项说明文案可见、且可以再次关闭。
3. **缓存清理**：设置页确认占用大小显示合理；点击清理后目录清空、大小归零；随后浏览图片目录，缩略图能重新生成。

- [ ] **Step 7: 全量门禁 + 真机通过后合入**

```powershell
npm run ts
npx vitest run
Set-Location src-tauri; & "$tc\cargo.exe" test --lib
```

三个 Task 的真机项全部通过后，再决定是否合回 `main` 并发版。**发版不在本计划范围内**。

---

## 计划自查记录

- **Spec 覆盖**：设计文档 §3.1 → Task 1；§3.2 → Task 2；§3.3 → Task 3+4；§4.1 单测 → 各 Task 的测试步骤；§4.2 判别性验证 → 各 Task 的判别性验证步骤；§4.3 真机验收 → Task 4 Step 6；§4.4 门禁 → 各 Task 末尾。§1.1 的伪需求清单与 §2 的排除项不产生 Task（已确认为「不做」）。无缺口。
- **类型一致性**：`sortFileBrowserEntries` 的 5 参数签名在 Task 1 Step 4 定义、Step 5/6 使用一致；`get_thumbnail_cache_stats` 的命名在 Task 3 Step 4 定义、Task 4 Step 1 消费一致；`ThumbnailCacheStats` 序列化后的 `{ itemCount, sizeBytes }` 在两侧字段名一致。
- **修正的设计文档事实**：`useFileBrowserEntries` 有 **2 个调用点**（`use-file-browser.ts:150` 与 `:221`），不是 1 个；`sortFileBrowserEntries` 才是 1 个生产调用点。计划已在 Task 1 Step 8 覆盖两处。
