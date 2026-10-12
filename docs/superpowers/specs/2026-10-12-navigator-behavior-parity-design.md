# 子项目 A · 导航器行为一致性（混合排序 / 框选默认启用 / 缩略图缓存清理）

- 日期：2026-10-12
- 状态：待用户审阅
- 上游依据：`aleksey-hoffman/sigma-file-manager` 未关闭 issue #529 / #481 / #482 / #465 / #545
- 姊妹项目：子项目 B（工具栏布局按钮 + 删除 popover 布局区 + 列表视图缩略图），**本项目不包含**

---

## 1. 为什么做这一组

研究上游 100 个未关闭 issue（45 enhancement / 32 bug / 5 自动崩溃报告）后，与本仓代码逐一比对，得到三个仍然成立且互相独立的诉求：

| 诉求 | 上游证据 | 本仓现状 |
|---|---|---|
| 混合排序 | #529 / #481 / #482（同一诉求被提三次） | `file-browser-sort.ts:57` 硬编码文件夹置顶 |
| 框选默认可用 | #465 | 功能完整含单测，但 `navigator.enableBoxSelection` 默认 `false` |
| 缩略图缓存可控 | #545 | 后端 `clear_thumbnail_cache_dir` / `thumbnail_cache_stats` 已实现，但**未注册为 Tauri command** |

### 1.1 已排除的伪需求（研究过程中确认，不要重复讨论）

- **「搜索索引开关」（#544）不成立。** 选盘索引在本仓**已完整实现**：`GlobalSearchSettings.drive_roots` 由调用方传入，`getDriveRoots()`（`global-search.ts:157-158`）先读 `selectedDriveRoots`，空数组才回退为全部驱动器；后端 `scan.rs:409-417` 已过滤不存在的盘（拔盘处理），并有 `drive_scan_errors` 收集部分失败；设置页 `global-search.vue:512` 已有驱动器多选列表。
- **「图片预览网格」（#478 第一条）不成立。** `file-browser-grid-card.vue` 已实现 `variant === 'image' | 'video'` 预览，并带 `IntersectionObserver` 懒加载（`rootMargin: '800px 0px'`）与卸载时取消加载。
- **「设为默认文件管理器」注册表风险（#448）已系统性解决。** `default_file_manager.rs:431-466` 具备快照、外部改动检测拒绝、`restore_with_rollback` 三重防护，强于上游的修复提交。
- **「重命名大小写被拒」（#543）已修。** 见 CHANGELOG 3.0.1。

---

## 2. 范围

### 做

1. 混合排序开关
2. 框选迁移强制开启 + 设置项说明文案
3. 缩略图缓存清理（暴露已有后端能力）

### 不做（明确排除）

- 列表视图缩略图、工具栏布局按钮、popover 布局区删除 → 属子项目 B，与本项目有依赖，不可拆
- 「搜索索引完全关闭开关」→ 现有选盘能力已覆盖；新增 enabled 标志会改动启动与空闲重扫的触发条件，属未验证的真实需求，不在本项目凭空引入
- Linux / Flatpak / AppImage 相关问题（#357 #479 #535 #480 #505 #495 #342 #330）→ 平台无关

---

## 3. 逐项设计

### 3.1 混合排序

**改动**：`sortFileBrowserEntries` 增加 `foldersFirst: boolean` 参数，原第 57 行

```js
const dirsFirst = (entryA.is_dir === entryB.is_dir) ? 0 : (entryA.is_dir ? -1 : 1);
```

改为受该参数控制。`foldersFirst === true` 时表达式与现状**逐字节等价**，确保默认路径零行为变化。

**设置**：`navigator.foldersFirst: boolean`，默认 `true`。

- 类型：`types/user-settings.ts` → `UserSettingsNavigator`
- 默认值：`stores/storage/user-settings.ts`
- 迁移：`stores/schemas/user-settings.ts` 用 `setDefaultBooleanIfMissing`（现有惯例，不覆盖既有值）

**存放位置**：全局设置，**不进** `NavigatorFolderSettings`。理由：该结构按目录各存一份，混合排序是用户级显示偏好，分目录会造成「为何此目录不置顶彼目录置顶」的困惑。`NavigatorFolderSettings` 现有的 `showHiddenFiles` 是显示文件类偏好，不作为先例援引。

**设置 UI**：设置页 → **`appearance` 分类**，与 `appearance/show-hidden-items.vue`（显示隐藏的项目）并列。理由：二者同属「文件如何呈现」这一语义域。设置页**没有** navigator 分类，不要凭空造一个。文案明确表述为「将文件夹排在文件之前」，避免用户误解为排序规则。

**调用方**：全仓 `sortFileBrowserEntries(` 只有 **1 个生产调用点** —— `use-file-browser-entries.ts:88`（其余命中全部在 `__tests__` 中）。改动面收敛，无需排查遗漏；新增参数必须同步更新该调用点及所有测试用例的调用签名。

### 3.2 框选迁移强制开启

**已确认的取舍**：采用「迁移强制开启」，即覆盖现有用户此前的关闭选择。代价已知并被接受。

**改动**：

1. `USER_SETTINGS_SCHEMA_VERSION` v24 → v25
2. 新增迁移分支：v24 → v25，将 `navigator.enableBoxSelection` 置为 `true`（**覆盖写，不是 setDefault**）
3. `stores/storage/user-settings.ts` 默认值 `false` → `true`
4. 迁移单测更新：原 `user-settings.test.ts:196` 断言 `toBe(false)` 需改为 `toBe(true)`

**补偿**：设置页该选项下方新增说明文案，明确告知「已默认启用，如影响操作可在此关闭」。这是覆盖用户选择的最轻量补救。

**已知风险**：用户曾主动关闭框选者，升级后会被重新打开。文案是可发现的补救，但不能恢复其原选择——这是本项的既定代价，不在实施阶段再议。

### 3.3 缩略图缓存清理

**后端**：新增两个 command，纯包装，**不改任何清理逻辑**：

```rust
#[tauri::command]
fn thumbnail_cache_stats(app: tauri::AppHandle) -> Result<ThumbnailCacheStats, String>  // 包装已有同名函数

#[tauri::command]
fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<(), String>                // 包装 clear_thumbnail_cache_dir
```

注册于 `lib.rs` 的 invoke handler（与现有 `image_thumbnails::generate_image_thumbnail` 同组）。

**清理范围**：仅 `thumbnail_cache_dir()` 指向的目录内容，**不得触碰**用户数据目录、缩略图之外的任何路径。

**错误处理**：清理失败必须把错误透出到 UI 并显示，**禁止静默失败**。沿用现有 `map_err(|e| ...)` 文案风格。

**设置 UI**：设置页 → **`storage` 分类的 `user-data`**（该页已承载用户数据占用统计），新增「缩略图缓存占用大小 + 清理按钮」。清理成功后刷新占用显示。

**i18n**：新增 key 走 17 语言包，`ch` 中文，其余 15 个按已定方案 A 用英文占位。

---

## 4. 测试策略

### 4.1 单元测试

- 排序：`foldersFirst` 为 true / false 两个方向各一例；`true` 时必须与改动前行为逐字节一致
- 迁移：v24 → v25 后 `enableBoxSelection` 为 `true`，含「原本为 false」与「键不存在」两种起点
- command 包装：stats 正常返回、clear 在空目录上不报错

### 4.2 判别性验证（硬要求）

每个新测试必须先注入缺陷确认**转红**，再恢复确认转绿。且转红时**失败输出必须精确展示预期的那种损坏**，仅看到 `assertion failed` 不足以证明探针打对了地方。

2026-10-11 的教训（本项目内已发生）：连续两轮探针无效——第一轮注入的缺陷在该场景下不会被执行到（等价变换），第二轮注入点算错。**注入前必须先确认「这一行在我构造的场景里真的会被执行到」**。

### 4.3 真机验收（硬要求）

单测全绿不等于功能成立。逐项在真机确认：

1. 混合排序：开启后按「修改时间」排序，文件夹不再遮挡最近下载的文件；关闭后恢复置顶
2. 框选：从**旧版本设置文件**升级后，确认框选生效且设置项文案可见、可再次关闭
3. 缓存清理：确认占用大小显示合理，点击后目录清空、大小归零、后续浏览重新生成

**前置条件**：需解锁桌面。2026-10-11 的 P2-2 验收因 `LogonUI` 在运行、`GetForegroundWindow` 返回 0 而无法进行任何键盘注入（`SendInput` 全部失败）。真机项在桌面解锁前记为「不可验证」，**不得**用单测结果冒充。

### 4.4 门禁

- `cargo test --lib`（1.90.0，进程级 PATH 注入）
- `npm run ts`（真门禁是 `vue-tsc --build`）
- `npx vitest run`（`use-navigator-item-icon` 为已知 flaky，需单跑排除）

**基线数字说明**：交接文档记录的是 **310 passed / 0 failed**；2026-10-11 的 P2-2 补了一个交换型归位回滚测试（`rollback_of_a_swap_batch_restores_through_a_second_staging_round`，已完成判别性验证但**尚未提交**），当前工作区实测为 **311 passed / 0 failed**。实施前先确认工作区状态，以实测值为准，不要拿文档里的旧数字当基线。

---

## 5. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 排序调用点漏传设置 | 部分视图忽略设置，行为不一致 | 已确认仅 1 个生产调用点（`use-file-browser-entries.ts:88`），改动面收敛；单测覆盖两个方向 |
| 框选迁移覆盖用户选择 | 曾主动关闭者被重新打开 | 已确认接受；设置项加说明文案 |
| 缓存清理误删 | 用户数据受损 | 仅清理 `thumbnail_cache_dir()`；实施时复核路径来源 |
| 排序默认值误改 | 现有用户排序结果变化 | 默认 `true`，表达式与现状等价 |

---

## 6. 贯穿硬约束

- 零新依赖
- 受保护常量不得改动：mDNS 服务名、legacy 数据目录名、Tauri `identifier`（`com.sigma-file-manager.app`）
- 品牌名统一为 Alpha File Manager
- 受影响文件若已有 `FORK-MODIFICATION` 注释约定（见 `user-settings.ts:380`），新增改动沿用
- 改现有文件以纯追加为主；3.1 的排序表达式与 3.2 的默认值是两处必须修改既有行为的例外，其余不破例
