# 交接文档：AFM 仪表盘改版 · 阶段 2 收官 / 阶段 3 开工（2026-10-24）

> **本文件的定位**：给**新会话**用。一份文档讲清「这是什么项目、做到哪了、下一步是什么、
> 哪些文档必读、哪些坑不要再踩」。
> 细节实现过程在历史文档里，本文件只给**结论 + 路径 + 指针**。
>
> **一句话**：Alpha File Manager（AFM）的仪表盘正在按「**按能力逐项移植、不换页面骨架**」的方针
> 吸收 upstream `aleksey-hoffman/sigma-file-manager` 的新版仪表盘。
> 阶段 1（四项低风险能力）与阶段 2（Hero 沉浸封面 + 板块改名）**已完成、真机验收通过、已推送**。
> 阶段 3 待启动，候选是「按类型筛选 / 排序方式 / 列表-网格切换 / 标签侧栏」四项，
> 其中标签侧栏的前置件（三个纯模块）在阶段 0 已经备好。

---

## 0. 三十秒版

| 问 | 答 |
|---|---|
| 代码在哪？ | `F:\soft\00selfmade\filemanager\sigma-file-manager`（**内层**，AFM 真代码，remote `kizemo/alpha-file-manager`） |
| 工作约定在哪？ | `F:\soft\00selfmade\filemanager\AGENTS.md`（**外层**，Focus Sync 仓，但里面写的是 AFM 的约定） |
| 当前 HEAD？ | 内层 `53dce15b`、外层 `1c48b9a`，**两仓 ahead/behind 均为 0/0**，工作区干净 |
| 门禁基线？ | `vitest` 241 文件 / 2114 用例；`eslint src` **175**；`eslint .` **188**（都是 HEAD 基线，不是 0） |
| 最近产物？ | `src-tauri/target/release/alpha-file-manager.exe`（2026-10-24 00:25:18，55,970,816 字节） |
| 下一步做什么？ | 见 [第 5 节](#5-下阶段计划)，**有两件事必须先等用户拍板** |
| 最重要的一条约定？ | 真机验收只能用 `tauri build` 的产物，`tauri dev` 的路由页内容区**全是空白**，在它上面做的界面结论一律作废 |
| 第二重要的一条？ | release 构建里 `SFM_E2E_DATA_DIR` 被**编译掉**，验收必须「备份真实文件 → 灌夹具 → 验收 → 恢复」，且**先杀进程再 restore** |

---

## 1. 项目背景

### 1.1 AFM 是什么

Alpha File Manager 是 `aleksey-hoffman/sigma-file-manager`（上游，代号 SFM）的二次开发分支，
品牌名已锁定为 **Alpha File Manager**，相关命名决策不再讨论。

- 上游仓库：`aleksey-hoffman/sigma-file-manager`（本机远端名 `upstream`），最新 release **v2.2.0（2026-07-17）**
- 本仓：`kizemo/alpha-file-manager`，当前版本 **3.5.0**
- 受保护常量（**不得改动**）：mDNS 服务名、legacy 数据目录名、Tauri `identifier`（`com.sigma-file-manager.app`）

**关键历史**：AFM 是 upstream 的**重写式移植**，不是 cherry-pick。
两仓 merge base 是 `fed49cee`（2026-08-27）；截至 2026-10-23 实测，
**AFM 领先 251 个 commit，upstream 领先 23 个**。

### 1.2 两个仓库的关系（**别找错地方**）

```
F:\soft\00selfmade\filemanager\            ← 外层：remote = kizemo/focus-sync.git
├─ AGENTS.md                                ← 【AFM 的工作约定就放这里】
├─ docs/                                    ← 历史 handoff / prompt 档
├─ release/                                 ← 整合包（.gitignore 忽略具体 exe）
├─ _acceptance/                             ← 验收现场（只入库 *.md）
└─ sigma-file-manager/                      ← 内层：remote = kizemo/alpha-file-manager.git
    ├─ src/            ← AFM 前端（Vue 3 + TypeScript）
    ├─ src-tauri/      ← Rust 后端（Tauri v2）
    ├─ docs/           ← 正式交接文档 + 截图
    └─ .superpowers/sdd/  ← 一次性脚本（.gitignore = *，不入库）
```

- 外层仓的 `.gitignore` 明确忽略 `sigma-file-manager/` ⇒ **外层不跟踪内层代码**。
- 外层仓在 AFM 语境下的实际作用 = **存放 `AGENTS.md`（工作约定）与历史交接档**。
- **改 AFM 代码一律在内层仓**；**改工作约定在外层仓**。

### 1.3 upstream 同步判据（**不要用 `git cherry`**）

AFM 历史上有过两轮上游移植（`86cf58ee` A 类「扩展安全加固」、`9e880451` B 类「连选/回收站确认/窗口状态/e2e 隔离」），
都是**重写移植** ⇒ `git cherry` 会把 upstream 的 23 个 commit **全判成「未移植」**，**这是错的**。

正确判据是**逐行命中率**：

```powershell
git -c http.proxy= fetch upstream main
node scripts/audit-upstream-port.mjs      # 取每个 upstream commit 补丁的新增行，在 AFM HEAD 逐行命中
```

- 命中率 **≥ 90%** ≈ 已落地（差的是注释 / license 头 / 格式化）
- 命中率 **< 60%** ≈ 真落后

截至 2026-10-23 的裁定：upstream 23 个 commit 里 **10 个已无合并价值**（命中率 92%–100%）；
真正还没落地的是 **CI 的 `e2e-windows` job + e2e 残留数据检查**（已在阶段 0 补齐）
和 **locale JSON 末尾换行**（已补）。⇒ upstream 侧目前**基本追平**。

> `git -c http.proxy=` 必须带：本机代理 `127.0.0.1:7897` 的 TLS 握手间歇性坏，
> 直连 github.com 正常。所有 git 远程操作都这样写。推送失败时两条路轮着试。

---

## 2. 总目标与已锁定的原则

### 2.1 总目标

把 upstream 新版仪表盘的**能力**吸收进 AFM，**保留 AFM 的页面骨架**（收藏分类分组、胶囊页签、卡片行为）。

### 2.2 已锁定的移植判据（三条）

1. **纯函数优先** —— 能独立成模块的先成模块（大小格式化、相对时间等）
2. **有真实调用方才搬** —— 搬进来的代码必须在本轮就接上线，不能是「等以后用」的死代码
3. **不动骨架** —— 不引入 upstream 的 list/grid 双布局、不引入侧栏、不换页签结构（**例外：已明确拍板的两项见 2.3**）

### 2.3 用户已拍板的事项

| 事项 | 决定 |
|---|---|
| Hero 顶部区 | 用 upstream 的新 Hero 版式，但**把「四张计数卡」换回本仓的胶囊页签**；左侧 42px 悬停边栏保持不动 |
| Hero 排版方向 | 最终选 **C · 沉浸封面**（初选 B，后改口），并额外要求**封面图向下不淡出** |
| 板块标题 | 「仪表板」→「**快速访问**」（更适合中文环境），全量替代用户可见文案 |
| 确认框口径 | 批量 / 不可逆操作要确认；可逆操作不确认 |

### 2.4 刻意**没有**做的

| 没做 | 原因 |
|---|---|
| 收藏页签的分类侧栏 | upstream **无对应实现可搬**，得自己设计（难度：高） |
| 标记页签整体骨架替换 | 骨架级替换，AFM 的「分组编辑 / 标签上移下移」都要重新安放（难度：高） |
| `entry-card-tags.vue` / `dashboard-tag-section-header.vue` 的删除 | upstream 删了它们，但 AFM 自己还在用，**删留要单独决定** |
| 代码里的 `dashboard-*` 标识符改名 | 那是路由名 / CSS 类 / 存储 key，不是文案，改了牵连代码与上游对齐 |
| 代码注释里的「仪表盘」内部术语 | 内部术语不是用户可见文案（`src/` 下 52 处 / 30 文件） |
| `public/changelog/**` 里的「仪表盘」 | 那是**已发布版本的历史更新日志**，改它等于篡改历史 |
| 其余 16 个语言包 `quickAccess.open*Tab` 的翻译 | upstream 遗留的**未翻译英文原文**，改名只换了其中的旧板块名，翻译是另一件事 |

---

## 3. 已完成的工作

### 3.1 阶段 0：工程基线（2026-10-23，提交 `2c1ab20e` / `fd8e7b31` / `2c9e097e` / `40525c05` / `d3d3e86b`）

| 交付 | 提交 | 内容 |
|---|---|---|
| upstream 移植完成度审计脚本 | `2c1ab20e` 前序 | `scripts/audit-upstream-port.mjs`（逐行命中率判据） |
| CI `e2e-windows` job | — | 含「e2e 跑完不留残留数据」检查 |
| locale 格式门禁 | `fd8e7b31` | `.editorconfig` + `sync-i18n.js` 只在变化时写盘 + 格式测试 |
| 三个纯模块 + 13 条单测 | `2c9e097e` | `src/utils/tagged-sections.ts`、`page-drop-targets.ts`、`tag-colors.ts`（**阶段 3 标签侧栏的前置件**） |
| upstream 仪表盘评估文档 | `40525c05` | `docs/handoff-2026-10-23-upstream-sync-and-dashboard-review.md` |
| 4 张 upstream 真机截图 | `d3d3e86b` | `docs/screenshots/upstream-dashboard-*.png` |

### 3.2 阶段 1：四项低风险能力（提交 `4b94a2de`，已真机验收）

| 能力 | 实现 |
|---|---|
| 条目大小 | `src/utils/dashboard-item-size.ts` + `composables/use-dashboard-item-sizes.ts`（文件逐个 stat、目录走 `useDirSizesStore` 批量） |
| 相对时间 | `src/utils/dashboard-relative-time.ts` + `components/dashboard-tagged-item-meta.vue` |
| 缩略图预览 | `composables/use-dashboard-entry-previews.ts` + `use-dashboard-entry-preview.ts` |
| 确认框体系 | `components/dashboard-confirm-dialog.vue` + 17 个语言包新增 9 条文案 |

> 移植 upstream 代码时做的三处**本仓适配**：
> ① 缩略图 composable 只保留缩略图部分（不换 AFM 自有图标体系）；
> ② 相对时间抽成纯模块**共用**（原来 `dashboard.vue` 里内联了一份）；
> ③ `formatDashboardFileSize` 加 `Number.isFinite`（upstream 只判 `typeof`，NaN 会显示成「NaN B」）。

### 3.3 阶段 2：Hero 沉浸封面 + 板块改名（提交 `fc6ecf66` / `98d3feba` / `32384774`）

**Hero**（`src/modules/dashboard/components/dashboard-hero.vue`，移植自 upstream `3eca4c17`）：
与 upstream 的四处理意差异 —— ① 封面图**向下不淡出**（去掉底部渐隐，底边收在圆角+描边里）；
② 浅色主题适配（`hsl(var(--background))` 横向纱 + 背景图 `opacity 0.5`，深色主题 opacity 1）；
③ 插槽放本仓胶囊页签而非四张计数卡；④ 出血量左右分开写（本仓容器 padding 左 40 / 右 46，不相等）。
背景图 `src/assets/media/dashboard/dashboard-top-bg.jpg`（69,249 字节，从 upstream 取出）。

**改名**：13 个 key × 17 语言。改动清单、多语言对照表见
`docs/handoff-2026-10-23-dashboard-card-enrichment.md` 第 7 节。

⚠️ **改名第一轮漏了 5 个 key**（`quickAccess.open*Tab` × 4 + `settingsTags.quickAccess`），
它们同样用户可见。漏改**不会让任何功能测试变红** ⇒ 已把校验改成**扫全部字符串值**，
新增门禁 `src/localization/__tests__/quick-access-rename.test.ts`（4 例）。

---

## 4. 当前状态快照

### 4.1 提交与推送

| 仓库 | HEAD | 状态 |
|---|---|---|
| 内层 `sigma-file-manager` | `53dce15b` `docs(handoff): 回填外层提交号 1c48b9a` | `origin/main` = HEAD，ahead/behind **0/0**，工作区干净 |
| 外层 `focus-sync` | `1c48b9a` `docs(agents): 补两条注入相关的硬约束` | `origin/main` = HEAD，ahead/behind **0/0** |

外层有 3 个与 AFM 无关的未跟踪目录（`docs/blog/`、`docs/marketing/`、`docs/SFM-EXTENSION-DEVELOPMENT-GUIDE.md`），
是历史遗留，**不要删也不要提交**。

### 4.2 门禁（2026-10-24 实测，量的是 HEAD）

| 门禁 | 数字 | 判读 |
|---|---|---|
| `npx vitest run` | **241 文件 / 2114 用例全通过** | 阶段 2 新增 1 文件 4 例（改名门禁） |
| `npx eslint src` | **175 errors / 0 warnings** | **= HEAD 基线**（不是 0！） |
| `npx eslint .` | **188 errors / 0 warnings** | **= HEAD 基线**（不是 0！） |
| `npx vue-tsc --build` | exit 0 | |
| `node scripts/verify-changelog.mjs` | OK | 当前版本 3.5.0 有 CHANGELOG 条目 |

> **基线纪律**：基线数字**随提交变**，量的时候必须用 `git stash push -u` 量 HEAD，
> 且**同一条命令**（`eslint .` ≠ `eslint src`，两者差 13 个）。
> eslint **不读 `.gitignore`** ⇒ `.superpowers/` 里的 150 多个一次性脚本会被一起 lint，
> 已加进 `eslint.config.ts` 的 `globalIgnores`。

### 4.3 产物与用户数据

- release 产物：`src-tauri/target/release/alpha-file-manager.exe`（2026-10-24 00:25:18，55,970,816 字节）
- NSIS 安装包：`src-tauri/target/release/bundle/nsis/Alpha File Manager_3.5.0_x64-setup.exe`（19.62 MiB）
- 用户真实数据：**完好**。`C:\Users\Duanyi\AppData\Roaming\com.sigma-file-manager.app\user-data\user-stats.json`
  = 32,714 字节，9 收藏 / 4 分类 / 5 标签 / 2 标记 / 100 历史 / 100 常用，`theme=light`，
  与验收前逐项一致（验收后已 restore 并核对过）。

### 4.4 已归档的真机截图

| 截图 | 说明 |
|---|---|
| `docs/screenshots/afm-dashboard-hero-light.png` | 浅色主题 · 沉浸封面 · 「快速访问」标题 |
| `docs/screenshots/afm-dashboard-hero-dark.png` | 深色主题 · 沉浸封面 |
| `docs/screenshots/afm-settings-search-quick.png` | 改名门禁的**阳性对照**（搜 quick 命中「悬停时打开快速访问面板」） |
| `docs/screenshots/afm-settings-search-dashboard.png` | 改名门禁的**阴性对照**（搜 dashboard 零结果） |
| `docs/screenshots/dashboard-hero-directions.png` | Hero 三方向对比稿 |
| `docs/screenshots/dashboard-hero-themes.png` | Hero 双主题预览稿 |
| `docs/screenshots/upstream-dashboard-*.png` | upstream 真机（4 张） |
| `docs/screenshots/afm-dashboard-card-enrichment.png` / `-confirm-dialog.png` / `-current.png` | 阶段 1 验收 |

---

## 5. 下阶段计划

### 5.1 候选能力与难度（沿用评估文档的分级）

| 能力 | 难度 | 前置件 | 备注 |
|---|---|---|---|
| **按类型筛选**（全部/文件夹/文件/文档/图片/视频/压缩包） | **低** | 差一个 `FILE_EXTENSIONS.DOCUMENT`（`src/constants/index.ts` 确认确实没有） | upstream 实现：`dashboard-type-filter.vue` + `src/utils/tagged-item-type-filter.ts` |
| **排序方式**（自定义/名称/添加时间/路径） | **低** | 需补 `useRestoredChoice`（页签/排序/布局/筛选一起记） | upstream：`src/utils/tagged-item-sort.ts` + `dashboard-tagged-view.vue` |
| **列表/网格切换** | 中 | 依赖 `entry-card` 新增 `layout` prop + 网格样式 | upstream：`dashboard-tagged-view.vue` |
| **标签侧栏**（搜索过滤 / 拖拽排序 / 改名改色删 / 新建） | 中 | ✅ `src/utils/tagged-sections.ts` + `tag-colors.ts` 阶段 0 已抽好 | upstream：`dashboard-tag-sidebar.vue` + `dashboard-tag-list-item.vue` |
| 标记页签整体骨架 | 高 | — | 骨架级替换，**等用户拍板** |
| 收藏页签的分类侧栏 | 高 | upstream 无对应实现 | **等用户拍板** |

**建议顺序**：按类型筛选 → 排序方式 → 列表/网格切换 → 标签侧栏。
理由：前三项都是低/中难度且**不碰骨架**；标签侧栏虽然前置件已备好，
但它会把「分组编辑」从内容区搬到侧栏，**动到 AFM 自己的既有能力**（见 5.2 冲突 #4），需要更谨慎。

### 5.2 与 AFM 既有能力的冲突（照搬 upstream 会丢东西的地方）

| # | AFM 有什么 | 照搬 upstream 的后果 |
|---|---|---|
| 1 | **收藏分类**（`favoriteCategories` + 分类分组 + 「未分类」虚拟组） | upstream **完全无此概念**，分类分组 / 改名删除 / 空分类 / 「未分类」**整块丢失** |
| 2 | 分类内排序 + 改归属（卡片 ⋮ 的上移下移 / 移到分类） | **丢失** |
| 3 | 收藏卡片上的「取消收藏」入口 | upstream 删了且**没补入口** ⇒ 照搬后仪表盘上无法取消收藏 |
| 4 | 标记页签多分组平铺，每组一条可编辑标题条 | upstream 换成「侧栏选一个标签 + 右侧单组」⇒ **骨架级替换** |
| 5 | 操作条 ⋮ 里的「新建收藏 / 新建分类 / 新建标记」 | upstream 的新操作条没有 ⇒ **新建入口丢失** |
| 6 | `removeTagFromItem`（卡片 ⋮ 菜单） | upstream 另加 `removeTaggedItem`，需补 |
| 7 | `useRestoredActiveTab`（页签记忆） | upstream 新增 `useRestoredChoice`（页签/排序/布局/筛选一起记），需补 |
| 8 | 删标签时同步剥 tagId + 启动反推重建标签定义 | upstream 用「未分类」收容孤儿 ⇒ **在 AFM 会永远为空** |

完整 12 条见 `docs/handoff-2026-10-23-upstream-sync-and-dashboard-review.md` 第 4.2 节。

### 5.3 **必须等用户拍板**的两件事

1. **标记页签整体骨架** —— 是否换成 upstream 的「左侧标签栏 + 右侧单组」双栏工作台？
2. **收藏页签的分类侧栏** —— 是否给收藏页签也套一层侧栏（upstream 无物可搬，需自研）？

在此之前，5.1 里前三项（低/中难度、不碰骨架）**可以先做**，无需等拍板。

### 5.4 upstream 同步的例行工作

```powershell
git -c http.proxy= fetch upstream main
node scripts/audit-upstream-port.mjs      # 看命中率，判断 upstream 又带来了什么
```

新 commit 若命中率高（≥90%）⇒ 基本已落地，无需动作；<60% ⇒ 需要评估移植。

---

## 6. 必读文档清单（完整路径）

### 6.1 必读（按顺序读这 4 份就够开工）

| # | 路径 | 读它干什么 |
|---|---|---|
| 1 | `F:\soft\00selfmade\filemanager\AGENTS.md` | **所有硬约束**。改任何代码前先读这份 |
| 2 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-dashboard-phase3-handoff.md` | **本文件**（阶段 3 起点） |
| 3 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-23-dashboard-card-enrichment.md` | 阶段 1 + 阶段 2 的完整实现记录（含 Hero 四处差异、改名 13 个 key、正负对照验收、踩的坑） |
| 4 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-23-upstream-sync-and-dashboard-review.md` | upstream 改版评估 + **12 条冲突清单** + 难度分级 + upstream 真机截图解读 |

### 6.2 按需查阅

| 路径 | 内容 |
|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\FORK-NOTES.md` | 本仓与 upstream 的差异总览 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\operations\release-workflow.md` | 发版流程 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\operations\version-info.md` | 版本号规则 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-22-compare-fix-and-release-350.md` | 3.5.0 发版 + 「比较并同步」缺陷修复 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-22-delete-progress-and-installer-log.md` | 删除进度 + 安装器日志（本仓 UI 注入的踩坑史） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-21-compare-sync-and-network-drive.md` | 「比较并同步」需求与网络驱动器 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\superpowers\plans\2026-10-15-next-stage-plan.md` | 上一轮的中期计划（背景参考） |

### 6.3 一次性的验收脚本（**不入库**，在 `.superpowers/sdd/`）

| 脚本 | 用途 |
|---|---|
| `build-acceptance.cmd` / `build-acceptance2.cmd` | 打包 release 产物（`.cmd` 内部已重定向到 `build-hero.log`） |
| `dash-accept-data.cjs` | `backup` / `seed` / `theme <light\|dark>` / `restore` —— 真机验收的数据夹具 |
| `afm-dashboard-accept.ps1` | 启动产物 → 点左侧 rail → 截图（`PrintWindow`） |
| `afm-nav-accept.ps1` | 通用版：可点任意 rail 坐标后截图 |
| `afm-settings-search.ps1` | 设置页搜索的正/负对照验收（含 40 字节 `INPUT` 注入） |
| `shrink-shot.ps1` / `shrink-shots.ps1` | 截图压到半分辨率（1931px 宽）再入库 |
| `verify-locale-rename.cjs` / `scan-old-board-name.cjs` | 改名门禁的一次性脚本（正式门禁已入库为 vitest） |
| `inspect-user-data.cjs` | 看真实 user-data 目录里各文件的字节数与条目数 |

---

## 7. 环境与命令速查

```powershell
$repo = 'F:\soft\00selfmade\filemanager\sigma-file-manager'

# 门禁
npx vitest run                    # 241 文件 / 2114 用例
npx eslint src                    # 175 = 基线
npx eslint .                      # 188 = 基线
npx vue-tsc --build               # exit 0
node scripts/verify-changelog.mjs # OK

# 打包（release，约 15-20 分钟；后台跑，不要挂 stdout 管道）
& "$repo\.superpowers\sdd\build-acceptance2.cmd"

# upstream 同步审计
git -C $repo -c http.proxy= fetch upstream main
node "$repo\scripts\audit-upstream-port.mjs"

# 提交推送（直连常失败，带 -c http.proxy= 先试，失败再走代理）
git -C $repo -c http.proxy= push origin main
```

**Rust / MSVC 注入**（每次 shell 调用都要重来）：
`cargo` 不在 PATH，在 `C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`；
MSVC 环境靠 `call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"`
（`build-acceptance.cmd` 里已经做了）。

---

## 8. 硬约束索引（`AGENTS.md` 里最容易踩的几条）

> 完整清单在 `F:\soft\00selfmade\filemanager\AGENTS.md`。下面按「踩了会浪费多少时间」排序。

| 约束 | 后果 |
|---|---|
| **真机验收只能用 `tauri build` 产物**，`tauri dev` 的路由页内容区全空白 | 在 dev 构建上做的界面结论**一律作废** |
| **需要装机实测就直接打包 exe，不要等用户开口** | `tauri build` 很慢 ⇒ 一旦判定要真机验收就**早启动、丢后台跑** |
| **后台任务不要挂 stdout 管道**（`Tee-Object` / `\| Select-String`） | 管道一断进程树跟着死 ⇒ 编译到一半被中止、产物没落地。改用 `.cmd` 内部 `> logfile 2>&1` |
| **恢复真实数据必须「先杀进程 → 再 restore」** | 应用退出时会把内存里的统计状态写回真实 `user-stats.json` ⇒ 真实数据被夹具顶掉 |
| **`backup` 是「不存在才建」**，不覆盖旧备份 | 旧备份可能才是真正的真实数据 ⇒ 跑完一定看它打印的字节数 |
| **`.ps1` / `.cmd` 必须纯 ASCII** | 中文注释会变乱码并被当成命令执行 |
| **绝不用 `Get-Content -Raw` / `Set-Content` 改带中文注释的源文件** | PS 5.1 按 ANSI 读无 BOM UTF-8 ⇒ 中文全变 mojibake。改 `.vue`/`.ts`/`.json` 用编辑工具或 `node fs` |
| **门禁基线必须同一条命令 + `git stash push -u` 量 HEAD** | 混口径会凭空多出 13 个「回归」 |
| **`SendInput` 的 `INPUT` 结构必须显式 `Size = 40`** | 漏了 MOUSEINPUT union ⇒ `SendInput` **静默失败**，表现为「粘贴没反应」 |
| **注入探针把阳性对照排在前面** | 否则空结果有两种解释，白白多花一轮 |
| **改 `user-stats` 顶层字段要同时改「读白名单」和「写列表」** | 漏写侧 ⇒ 界面正常但**重启即丢**，全程不报错 |
| **`tauri::async_runtime` 不能被 `cargo test --lib` 链接到** | 测试二进制加载阶段崩（`STATUS_ENTRYPOINT_NOT_FOUND`），报错完全看不出跟你的模块有关 |

---

## 9. 交接状态

- 两仓均已推送，工作区干净，**无未完成的改动**
- 用户真实数据完好，已核对
- 阶段 3 **尚未启动**；5.3 的两项**等用户拍板**
- 下一步的默认动作建议：按 5.1 顺序做「按类型筛选」，它是低难度、不碰骨架、只差一个常量

---

*文档生成时间：2026-10-24 09:4x（Asia/Shanghai）*
*对应内层提交：`53dce15b` / 外层提交：`1c48b9a`*
