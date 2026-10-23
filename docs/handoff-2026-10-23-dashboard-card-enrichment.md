# 交接文档：仪表盘卡片增强（upstream 仪表盘改版 · 第一阶段）

> 日期：2026-10-23
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`（origin `kizemo/alpha-file-manager`）
> 上游：`aleksey-hoffman/sigma-file-manager`（本机远端名 `upstream`）
> **当前状态：四项低风险能力已落地并接线，门禁全绿，release 产物真机验收通过。**
>
> 上游背景见 `docs/handoff-2026-10-23-upstream-sync-and-dashboard-review.md`
> （分叉分析、12 条冲突清单、难度分级、upstream 真机截图）。

---

## 0. 一句话结论

按「**按能力逐项移植，不整体替换页面骨架**」的约定，本轮落地了四项**只加信息、不动骨架**的能力：

| 能力 | 结果 |
|---|---|
| 条目大小 | 卡片文件名右侧显示大小（文件逐个 stat、目录走批量统计），取不到显示「—」 |
| 相对时间 | 卡片路径下方显示「类型 + 添加于 X 前」 |
| 缩略图预览 | 图片/视频进入视口后显示真实缩略图，离开视口取消请求 |
| 确认框体系 | 清空列表 / 删标记 / 取消收藏 / 移除标记 先弹确认框 |

**页面骨架、标签页结构、收藏分类分组、卡片点击行为全部保持原样。**

---

## 1. 移植判据：这一轮搬了什么、没搬什么

上一轮定下的判据是「**只搬 AFM 已内联同一套逻辑的模块**」，本轮沿用并细化成三条：

1. **纯函数优先** —— 能独立成模块的先成模块（大小格式化、相对时间）；
2. **有真实调用方才搬** —— 搬进来的代码必须在这一轮就接上线，不能是「等以后用」的死代码；
3. **不动骨架** —— 不引入 upstream 的 list/grid 双布局、不引入侧栏、不换页签结构。

### 1.1 新增文件

| 文件 | 来源 | 说明 |
|---|---|---|
| `src/utils/dashboard-item-size.ts` | upstream `3eca4c17` | 两个纯函数：文件大小、目录大小格式化 |
| `src/utils/dashboard-relative-time.ts` | upstream `3eca4c17` | 相对时间格式化（翻译函数由调用方注入） |
| `src/modules/dashboard/composables/use-dashboard-item-sizes.ts` | upstream `3eca4c17` | 大小采集：文件逐个 stat、目录走 `useDirSizesStore` 批量 |
| `src/modules/dashboard/composables/use-dashboard-entry-previews.ts` | upstream `3eca4c17` | 缩略图助手的 provide/inject 层 |
| `src/modules/dashboard/composables/use-dashboard-entry-preview.ts` | upstream `3eca4c17`（**有改动**） | 单卡片缩略图：IntersectionObserver + 取消请求 |
| `src/modules/dashboard/components/dashboard-tagged-item-meta.vue` | upstream `3eca4c17`（**有改动**） | 卡片底部的「类型 + 相对时间」一行 |
| `src/modules/dashboard/components/dashboard-confirm-dialog.vue` | upstream `3eca4c17` | 通用确认框壳子（标题/描述由调用方给） |

### 1.2 改动文件

| 文件 | 改动 |
|---|---|
| `src/modules/dashboard/components/entry-card.vue` | 加 `sizeLabel` prop、缩略图渲染位、`#meta` 插槽 |
| `src/modules/dashboard/pages/dashboard.vue` | 接线四项能力 + 确认框状态机 |
| `src/localization/messages/*.json`（17 个） | 新增 9 个确认框文案 key |

### 1.3 刻意**没有**搬的部分（以及原因）

| upstream 的东西 | 为什么没搬 |
|---|---|
| `entry-card.vue` 的 list/grid 双布局 + 绝对定位 hitbox | 骨架级替换，本轮明确不做 |
| `useNavigatorItemIcon` 那套系统图标主题 | 本仓 `entry-card` 有自己的图标体系（虚拟位置=HardDriveIcon、目录=FolderIcon、文件=FileIcon）。换过去会改掉现有外观和图标主题行为 —— 超出「给现有卡片加信息」的范围。**所以本仓的 `use-dashboard-entry-preview.ts` 只保留缩略图部分。** |
| `dashboard-tag-sidebar.vue` / `dashboard-tagged-view.vue` / `dashboard-type-filter.vue` | 标记页签骨架级替换，留到最后单独拍板 |
| `dashboard-hero.vue` + 背景图 | Hero 是独立一块，下一步单独评估 |
| `FILE_EXTENSIONS.DOCUMENT` | 本轮的类型筛选没做，暂不需要（upstream 的「更多」筛选里有它） |
| `removeTagFromAllItems` / `removeTaggedItem` | 属于标记页签骨架改造的一部分 |
| upstream 的「孤立条目 / 未分类分组」 | AFM 的 `deleteTag()` 已内联 `removeTagFromAllItems` 语义，`reconcileMissingTagDefinitions()` 还有反推重建兜底，AFM 不产生孤儿 |

---

## 2. 关键设计决策

### 2.1 只统计**当前页签**的条目大小

四个页签的条目合起来可能几百条，一次性全部 stat 会把界面卡住。
所以 `activeSizedItems` 是跟着 `activeTab` 走的 computed，`useDashboardItemSizes` 的 watch
在切页签时自动重新取；目录大小还有 `useDirSizesStore` 的全局缓存兜底，来回切不重复算。

### 2.2 大小取不到显示「—」，不是「0 B」

`formatDashboardFileSize(null)` 返回 `—`（em dash）。
「0」会被读成「这是个空文件/空目录」，那是**错的信息**。

**FORK-MODIFICATION**：upstream 只判了 `typeof size !== 'number'`，于是 `NaN` 会一路走到
`formatBytes` 里变成字符串 `NaN B`。本仓多加一道 `Number.isFinite` 判断。

### 2.3 相对时间：本仓本来就有一份，抽出去共用

`dashboard.vue` 里原本就内联了一份 `formatRelativeTime`（给「历史」页签用），
和 upstream 的 `formatDashboardRelativeTime` **逻辑完全一样**。
本轮把它抽成 `src/utils/dashboard-relative-time.ts`，「历史」页签和新的「添加于 X 前」共用同一份。

### 2.4 缩略图：页面级 provide，几十张卡共用一套缓存

每张卡片各建一个缩略图 composable，会让同一个文件被重复解码、重复占内存。
所以 `provideDashboardEntryPreviews()` 放在页面级（`dashboard.vue`），
卡片侧 `inject`；`inject` 拿不到时安全降级（`thumbnailSrc` 恒为 `undefined`，落回原图标）。

缩略图只在卡片**进入视口**后才加载，离开视口立刻取消请求 —— 仪表盘一次可能渲染几百张卡，
全部立刻解码会把内存打满。

### 2.5 确认框的收拢口径

`ConfirmAction` 状态机：一次只挂一个待确认动作，标题与描述由调用方给。

| 操作 | 要确认吗 | 原因 |
|---|---|---|
| 清空收藏 / 标记 / 常用 / 历史 | ✅ | 批量、不可逆 |
| 删除标记 | ✅ | 会同时把所有条目上的 tagId 剥掉，不可逆 |
| 取消收藏 | ✅ | AFM 特意保留的入口（upstream 删了且没补替代），误点后只能靠「记得路径」重新收藏 |
| 移除单个标记 | ✅ | 条目会从该分组消失 |
| 删除收藏分类 | ❌ | 收藏会回到「未分类」，**可逆**（代码里原本就有这条说明） |
| 移除历史记录 | ❌ | 重新访问就回来了，**可逆** |

口径总结：**批量**与**不可逆**要确认，可逆的不确认 —— 与 upstream 的做法一致。

### 2.6 `#meta` 插槽挂在哪

放在卡片的「路径」下面一行，四个页签共用一个插槽位。
- 收藏页签、标记页签 → 填「类型 + 添加于 X 前」（`DashboardTaggedItemMeta`）
- 常用页签 → 已有「Opened N times」徽章，不重复
- 历史页签 → 已有相对时间，不重复

`DashboardTaggedItemMeta` 的 `item` prop 在本仓收窄成了**最小结构**
（`path` / `isFile` / `addedAt`），这样 `FavoriteItem` 和 `TaggedItem` 都能传
（upstream 绑的是 `TaggedItem`，多一个 `tagIds` 字段）。

---

## 3. 门禁

| 门禁 | 结果 |
|---|---|
| `npx vitest run` | **240 文件 / 2110 用例全通过**（上一轮 238 / 2097，新增 2 文件 13 用例） |
| `npx eslint src` | **175 errors / 0 warnings**（= HEAD 基线，**新增 0**） |
| `npx eslint .` | **188 errors / 0 warnings**（= HEAD 基线，**新增 0**） |
| `npx vue-tsc --build` | exit 0 |
| `cargo test --lib` | 793 passed / 0 failed（Rust 侧本轮未改） |
| 17 个语言包 key 一致性 | 0 mismatch |
| 语言包格式（无 CR / 恰好一个末尾换行 / 两空格缩进） | 全部通过 |

新增单测：
- `src/utils/__tests__/dashboard-item-size.test.ts`（8 例）
- `src/utils/__tests__/dashboard-relative-time.test.ts`（6 例）

---

## 4. 真机验收（`tauri build` 的 release 产物）

产物：`src-tauri/target/release/alpha-file-manager.exe`（55,905,280 字节，17:05:02），
安装包 `release/Alpha File Manager_3.5.0_x64-setup.exe`（20,507,003 字节）。

> ⚠️ **release 构建不能用 `SFM_E2E_DATA_DIR`** ——
> `src-tauri/src/app_dirs.rs` 的隔离覆盖是 `#[cfg(debug_assertions)]`，
> release 把 override **编译掉**了。
> ⇒ 验收流程是「备份真实 `user-stats.json` → 灌夹具 → 验收 → 恢复」，
> 夹具用仓库自带的 18 张真实照片（`src/assets/media/source-backgrounds`），
> 这样缩略图 / 大小 / 相对时间才有东西可显示。
> **验收后已恢复**：真实文件 32,714 字节、9 收藏 / 4 分类 / 5 标签 / 2 标记 / 100 历史 / 100 常用，与验收前逐项一致。

### 4.1 仪表盘总览

<figure>
  <img src="screenshots/afm-dashboard-card-enrichment.png" alt="AFM 仪表盘（卡片增强后）" />
</figure>

`docs/screenshots/afm-dashboard-card-enrichment.png`

对着这张图逐条核对：

| 能力 | 画面上的证据 |
|---|---|
| 条目大小 | 照片卡片名称右侧 `166.1 KB` / `499.9 KB` / `594.5 KB` / `359.3 KB`；目录卡片显示 `—`（目录大小还在后台批量统计） |
| 相对时间 | 路径下方 `5小时前` / `10小时前` / `14小时前` / `21小时前` / `1天前` / `9小时前` |
| 缩略图 | 四张照片卡片显示真实缩略图（`Abstract by Johannes Plenio` / `Abstract painting` / `Canyon` / `Cyber Neon City`） |
| 类型 | meta 行左侧是类型图标 + `文件夹` / `JPG` |
| **骨架没动** | 胶囊页签（收藏 6 / 已标记 6 / 常用 5 / 历史 5）、收藏按分类分组（数据 2 / 素材 3 / 未分类 0 / 未分类 1）、分组标题的改名与删除按钮、卡片 ⋮ 菜单（上移 / 下移 / 移到分类 / 取消收藏）全部原样 |

### 4.2 确认框

<figure>
  <img src="screenshots/afm-dashboard-confirm-dialog.png" alt="取消收藏的确认框" />
</figure>

`docs/screenshots/afm-dashboard-confirm-dialog.png`

点卡片 ⋮ → 「取消收藏」→ 弹出确认框：
标题「要取消收藏吗？」、描述「该条目将从此处移除。重新收藏即可让它回到这里。」、
按钮「取消」（outline）与「移除」（destructive 红色）。
**在确认之前，收藏一条都没少** —— 这正是加确认框的意义。

---

## 5. 提交与推送

| 仓库 | 提交 | 内容 |
|---|---|---|
| 内层 | `（见下）` | `feat(dashboard): 卡片补条目大小、相对时间、缩略图与破坏性操作确认框` |


---

## 6. 下一步

1. **单独评估 Hero 顶部区**（upstream 的背景图 + 四张计数卡）—— AFM 的 `PageDefaultLayout` 与 upstream 一致，可以低成本搬，但要确认 Hero 会不会挤掉 AFM 自己的「胶囊页签 + 分类分组」信息。
2. **标记页签骨架**、**收藏页签的分类侧栏** —— 这两项留到用户单独拍板（见上游评估文档的 12 条冲突清单）。

---

## 7. 本轮踩的坑

1. **`formatBytes` 的输出是 `1.0 KB` 不是 `1 KB`** —— 本仓的 `formatBytes` 对 KB 以上保留
   **一位小数**（`value.toFixed(unitIndex > 0 ? 1 : 0)`）。写断言时按实际格式来，别照着
   「1 KB / 2 KB」的直觉写。
2. **`SFM_E2E_DATA_DIR` 只在 debug 构建生效** —— `src-tauri/src/app_dirs.rs` 里的覆盖是
   `#[cfg(debug_assertions)]`，release 构建把 override **编译掉**，永远走 Tauri 路径解析。
   ⇒ 想在 release 产物上验收且不碰用户真实数据，只能「备份真实文件 → 灌夹具 → 验收 → 恢复」。
3. **安全层会拦「先 `Set-Location` 再写文件」的 bash 调用** —— 报
   `write/delete targets cannot be verified safely after a command working directory change`。
   解法：用 `git -C <repo>` / `node` 的绝对路径调用，**不在同一条命令里切目录再写文件**。
4. **PowerShell 的 `>` 重定向是 UTF-16LE** —— 导出 git 内容到文件别用 `>`，
   用 node 的 `execFileSync` + `fs.writeFileSync(..., 'utf8')`。
