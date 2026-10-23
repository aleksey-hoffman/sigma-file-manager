# 交接文档：与 upstream 的同步（CI / i18n / 仪表盘纯函数）+ 仪表盘改版评估

> 日期：2026-10-23
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`（origin `kizemo/alpha-file-manager`）
> 外层仓：`F:\soft\00selfmade\filemanager`（origin `kizemo/focus-sync`）
> 上游：`aleksey-hoffman/sigma-file-manager`（本机远端名 `upstream`）
> **当前状态：P1–P3 已落地并推送，门禁全绿；P4 是产品决策，评估材料与真机截图已备齐，等你拍板。**

---

## 0. 一句话结论

AFM 落后 upstream 的 **23 个 commit 里，10 个早就移植过了、4 个用不上**；
真正该动的只有 **CI 跑 e2e**、**语言包格式门禁**、**仪表盘纯函数抽取** 三件 —— 本轮全部做完。
剩下的 **仪表盘 UI 改版**（2 个 commit、约 2600 行）是**产品决策不是合并决策**，
本文档给出评估材料 —— 包括**真机拍到的 upstream 新仪表盘实际画面**
（upstream 这次改版还没进任何 release，没有官方截图可用）。

---

## 1. AFM 与 upstream 的分叉现状

| 项 | 值 |
|---|---|
| merge base | `fed49cee`（2026-08-27） |
| AFM 领先 | **251** 个 commit |
| upstream 领先 | **23** 个 commit |
| upstream 侧改动文件 | 148 个（其中 **89 个 AFM 也改过** = 真冲突面，59 个 AFM 干净） |
| upstream 侧改动量 | +8644 / −1661 行 |

### 1.1 判据：`git cherry` 在本项目是错的

AFM 历史上做过**两轮上游移植**：

| 提交 | 内容 |
|---|---|
| `86cf58ee` | `fix(extensions): 上游扩展安全加固 —— SSRF 防护、权限主机侧判定、删掉假沙箱` |
| `9e880451` | `feat(navigator): 上游 B 类改动移植 —— 连选、回收站确认、窗口状态、e2e 隔离` |

这两笔是**重写移植**而非 cherry-pick，代码不同 → 补丁 ID 不同 → `git cherry HEAD upstream/main`
把 23 个**全部**判成「未移植」。**那个判据在本项目会得出完全错误的结论。**

正确判据是**逐行命中率**：取 upstream 每个 commit 补丁的新增行，到 AFM HEAD 对应文件里逐行找。
判据：≥ 90% ≈ 已落地（差的是注释 / license 头 / 格式化）；< 60% ≈ 真落后。

审计脚本已固化进仓库：

```powershell
git -c http.proxy= fetch upstream main
node scripts/audit-upstream-port.mjs            # 全部
node scripts/audit-upstream-port.mjs --max 60   # 只看低命中率的明细
```

### 1.2 23 个 commit 的逐条裁定

**A. 已落地，合并价值为零（10 个）**

| upstream commit | 命中率 | AFM 现状 |
|---|---|---|
| `45cedf89` **SSRF / DNS rebinding 修复** | **100%** | `86cf58ee` 已移植 |
| `4b0a2419` **扩展隔离加固** | **100%** | 同上 |
| `5b6cab44` 扩展主流程测试 | 100% | 同上 |
| `588165e6` Shift+方向键连选 | 100% | `9e880451` 已移植 |
| `5f678f8b` 双击标题栏切换最大化 | 100% | 同上 |
| `9560da51` 全屏后窗口状态恢复 | 99% | 差的 1% 是 SPDX 版权头注释 |
| `0ae258d6` **SMB 移入回收站前确认** | 92% | `recycle-bin-delete.ts` 与 upstream **逐字节一致**，差的 8% 在测试文件 |
| `979d6e2c` WebDriver 全新 Windows profile | 100% | 已移植 |
| `8908e214` e2e 临时数据目录隔离 | 96% | `app_dirs.rs` **逐字节一致** |
| `1305d81d` 隔离目录删除重试 | 100% | 已移植 |

> **两条安全修复（SSRF、扩展隔离）已经在 AFM 里了。** 这是最值得确认的一点 ——
> AFM 没有裸奔在已知漏洞上。

**B. 真正有缺口 → 本轮已做（P1、P2）**

| upstream commit | 内容 | 本轮处置 |
|---|---|---|
| `b42aa683` + `7f9ebf2b` + `2b8bed43` | CI 加 `e2e-windows` job + e2e 残留数据检查 | **P1，已合入** |
| `a4d4f4f1` | locale JSON 末尾换行 + 格式测试 | **P2，已补** |

**C. 价值取决于产品决策（P4）**

`3eca4c17` + `4a33b290` 仪表盘重设计 —— 详见第 4 节。

**D. 明确不需要（4 个）**

| commit | 判定依据 |
|---|---|
| `3df1570d` Flatpak/libayatana 修复 | AFM 只出 Windows 包 |
| `c2295cec` Cargo 版本同步 | upstream 是一次性手工改版本号；AFM 已有 `scripts/sync-version.js` 自动同步 package.json + 3 个 Cargo.toml，**功能更强** |
| `1a6400a2` + `4ea1afd5` SignPath 签名 CI | AFM 已有自己的 `sign-windows.yml`（**7,333 字节**，比 upstream 成熟）；且 AFM 发布链路走 `release-publish.mjs` + SFTP 自建站，**根本不走 GitHub Actions**。upstream 这两笔只加了 2 行超时参数 |
| `74ddf622` SECURITY.md、`61cdbb61` README 签名政策 | 纯文档；AFM 是单人 fork 无漏洞值班 |

---

## 2. P1：CI 跑 e2e + 残留数据检查（已落地）

**为什么值得做**：AFM 已经有**跑 e2e 的一切** —— `e2e-webdriver/` 完整套件（5 个 spec）、
`app_dirs.rs` 隔离机制（与 upstream 逐字节一致）、`wdio.conf.js`（差 1 行），
**但 `ci.yml` 里 grep `e2e/webdriver/tauri-driver` = 0 命中** —— 从来没在 CI 上跑过。

upstream 加的「残留检查」守的是一件真事：e2e 用 `SFM_E2E_DATA_DIR` 把数据隔到临时目录，
**一旦隔离漏了，e2e 会往用户真实的 `%APPDATA%\com.sigma-file-manager.app` 里写**。

移植时**只改了一处**：upstream 的 WebView2 策略键用的是它自己的二进制名
`sigma-file-manager.exe`，本仓是 `alpha-file-manager.exe`（已改，带 FORK-MODIFICATION 注释）。

提交：`2c1ab20e chore(ci): 补 Windows e2e 门禁与「e2e 跑完不留残留数据」检查`

### 2.1 一个必须先纠正的认知

**「AFM 语言包末尾换行已经不合规」是错的。** 实测 17 个语言包**全部合规**
（无 CR、以恰好一个 `\n` 结尾）。`a4d4f4f1` 的真实缺口是：

1. `scripts/sync-i18n.js` **没有「内容没变就不写盘」的判断** → 每次跑都重写 16 个语言包，
   改掉 mtime，触发前端热更新与无谓的 git 噪音；
2. **没有格式回归测试** → 谁改了格式没有任何测试会发现；
3. `.editorconfig` 缺 `[*.json]` 段。

三处都补了（`fd8e7b31`），并新增 `src/localization/__tests__/locale-json-format.test.ts`
（3 条用例：末尾换行、无 CR、两空格缩进）。

---

## 3. P3：仪表盘纯函数抽取（已落地）

### 3.1 选哪几个的判据

**关键判据：只搬「AFM 已经内联了同一套逻辑」的那几个。**
搬过去等于**去重 + 补测试**，立刻有真实调用方；其余的搬进来就是**死代码**（没有 UI 入口就没人调）。

| 模块 | AFM 原本的状态 | 处置 |
|---|---|---|
| `src/utils/tagged-sections.ts` | `dashboard.vue` 里**内联**了同一个分组循环 | 抽出 + 接线 + 单测 |
| `src/utils/page-drop-targets.ts` | `use-page-drop-zone.ts` 里**内联**了同一套目标查找 | 抽出 + 接线 + 单测 |
| `src/utils/tag-colors.ts` | `dashboard.vue` 里**同一个 8 色板抄了两遍**（常量一份、数组字面量一份） | 抽出 + 去重 + 单测 |
| 其余（排序 / 类型筛选 / 条目大小 / 相对时间 / 拖放目标） | AFM 没有 | **不搬** —— 没有 UI 入口就是死代码，属于 P4 的产品决策 |

### 3.2 顺带删掉的一段死代码

`use-page-drop-zone.ts` 原本的 `updateDropTargetAttributes(targetPath, targetElement)` 里有个兜底分支：
「有 path 但没有 element」时按 `[data-entry-path=...]` 反查元素。
但 `path` 与 `element` 永远来自同一个 `target` 对象、同一次赋值 —— **这个分支从来没执行过**。

### 3.3 刻意不搬的部分

upstream 的 `tagged-sections.ts` 还带一组「孤立标签」处理
（`getOrphanedTaggedItems` / `createOrphanedTagSection` / `isOrphanedTagId` / `getDashboardTagSections`），
用来把「标签已删、条目还在」的条目收进一个「未分类」分组。

**本仓不会出现这种条目**，所以那组函数搬进来就是死代码：

1. 本仓 `userStats.deleteTag()` 在删标签时**同步剥掉所有条目上的该 tagId**，
   并清掉因此变空的条目 —— 这正是 upstream `removeTagFromAllItems` 的语义；
2. 本仓还有 `reconcileMissingTagDefinitions()` 兜底：即使数据来自旧版本、外部写入或异常中断
   导致标签定义缺失，启动时也会**按条目反推重建**标签定义（文案用 `tags.recoveredTag`）。

upstream 的 `removeTagFromAllItems` / `removeTaggedItem` 本仓也没有 —— 但那是**它的 UI 需要**
（新界面里「删标签」和「删分组」是两个独立入口），本仓的删除入口只有一个，走 `deleteTag()` 已经够用。

提交：`2c9e097e refactor(dashboard): 标签分组、拖放目标、标签色板抽成纯模块并补单测`

---

## 4. P4：upstream 的仪表盘改版（**产品决策，等你拍板**）

### 4.1 upstream 改了什么（用大白话说）

> **本节的截图全部是本轮真机拍到的 upstream 实际运行画面。**
> upstream 这次改版**还没进任何 release**（upstream 最新 v2.2.0 是 2026-07-17），
> 没有官方截图可用，所以是自行构建 upstream `main` 的 debug 包拍的。
> 拍法：拉 worktree → debug 构建 → 用 `SFM_E2E_DATA_DIR` 指到**隔离数据目录**
> （两个应用共用 identifier `com.sigma-file-manager.app`，绝不能碰 AFM 与用户的真实数据）
> → 灌入带真实照片的种子数据 → 最大化窗口 → 逐页签点过去拍。
>
> 原始截图 3862×2110（150% DPI 物理像素），入库版本已压到 1931×1055。

| 画面 | 截图 |
|---|---|
| upstream 新仪表盘总览（收藏页签） | `docs/screenshots/upstream-dashboard-favorites.png` |
| upstream 标记页签 —— **列表视图**（左侧标签栏 + 右侧条目） | `docs/screenshots/upstream-dashboard-tagged-list.png` |
| upstream 标记页签 —— **网格视图**（卡片带缩略图 / 大小 / 相对时间） | `docs/screenshots/upstream-dashboard-tagged-grid.png` |
| upstream 常用页签（卡片带「Opened N times」） | `docs/screenshots/upstream-dashboard-frequent.png` |
| **AFM 现状**（同样的数据量，用于对照） | `docs/screenshots/afm-dashboard-current.png` |

upstream 把仪表盘从「标题 + 一行小胶囊页签 + 内容区平铺一堆分组」改成：

> **顶部一整块带背景图的 Hero 区，Hero 底部排四张带图标和大号计数的页签卡；
> 点进「标记」页签后，页面变成左侧标签栏 + 右侧单组内容的双栏工作台。**

四个页签（收藏 / 已标记 / 常用 / 历史）本身没变，收藏、常用、最近三页基本照旧；
**真正重做的是「标记」页签**，并顺带给所有卡片补上文件大小、相对时间、图片/视频缩略图、列表/网格两种排布。

**界面前后对比**

| 元素 | 改动前（= AFM 现在的骨架） | 改动后（upstream 新版） |
|---|---|---|
| 顶部 | 普通标题区，下面一行胶囊页签 | 一整块背景图 Hero 区，页签升级成 **1×4 横排的四张大卡片**（图标块 + 名字 + 大号计数 + 「N total」+ 箭头） |
| 导航 | **没有侧栏**，标签分组全平铺在内容区 | **300px 左侧标签栏**：搜索框过滤、可拖拽排序、每行 = 色点 + 名字 + 条目数 + ⋮ 菜单；灰色「未分类」固定在末尾；窄屏退化成横向滚动条 |
| 卡片 | 固定图标 + 名字 + 父路径 | 支持**列表/网格**两种排布；图标位可显示**真实缩略图**；文件名右侧显示**文件大小**；整张卡是 hitbox |
| 分组标题 | 内容区里的分组标题条（带改名/改色/删除） | **搬进侧栏**，内容区只显示当前选中标签那一组 |
| 筛选 | 无 | 类型筛选：全部/文件夹/文件 + 「更多」里的文档/图片/视频/压缩包 |
| 空状态 | 图标 + 文案 | 加了**带按钮**的空状态（去标记条目 / 显示全部） |
| 操作条 | 左侧空插槽 + 右侧一个 ⋮（只有「清空」） | 三段式：左侧大标题、中间筛选器、右侧「列表/网格 + 排序下拉 + ⋮」；清空/删标签/移除标签都先弹确认框 |

**新加的能力**（每条都标了实现文件）

| 能力 | 用户能做什么 | 实现 |
|---|---|---|
| 标签侧栏 | 点左侧某个标签 = 切到该组；搜索过滤；⋮ 重命名/改色/删除；拖拽改标签顺序 | `dashboard-tag-sidebar.vue` + `dashboard-tag-list-item.vue` + `src/utils/tagged-sections.ts` |
| 按类型筛选 | 胶囊按钮切换全部/文件夹/文件/文档/图片/视频/压缩包 | `dashboard-type-filter.vue` + `src/utils/tagged-item-type-filter.ts`（**AFM 缺 `FILE_EXTENSIONS.DOCUMENT`**） |
| 条目大小 | 文件名右侧显示大小；文件夹取批量统计，文件逐个 stat（500ms 超时），取不到显示「—」 | `use-dashboard-item-sizes.ts` + `src/utils/dashboard-item-size.ts` |
| 相对时间 | 网格卡片底部「添加于 X 分钟前」 | `src/utils/dashboard-relative-time.ts` + `dashboard-tagged-item-meta.vue` |
| 缩略图预览 | 图片/视频**进入视口后**才加载缩略图，离开视口取消请求 | `use-dashboard-entry-preview.ts` + `use-dashboard-entry-previews.ts`（复用 AFM 已有的缩略图 composable） |
| 排序方式 | 自定义 / 名称 / 添加时间 / 路径 | `src/utils/tagged-item-sort.ts` + `dashboard-tagged-view.vue` |
| 确认框 | 清空整个列表 / 删除标签 / 移除全部标签，都先确认 | `dashboard-confirm-dialog.vue` |
| 列表/网格切换 | 右上角两个图标按钮，网格是卡片墙 | `dashboard-tagged-view.vue` |
| 打开所在文件夹 | 每张卡右上角一个文件夹按钮 | `dashboard-open-folder-button.vue` |

### 4.1.1 实测拍出来的界面细节（源码读不出来的那些）

以下都是**看着真机截图逐条核对**出来的，源码和设计稿里不写明：

1. **Hero 的四张页签卡是 1×4 横排**（不是 2×2），卡面是「图标 + 名字 + 计数 + `N total` + 右箭头」，
   当前选中的那张用主色描边高亮（Favorites 是橙色的）。**点卡片主体和点右箭头都会切页签。**
2. **「文件大小」和「相对时间」不在同一个视图里**：
   - 列表视图：文件名**右侧**显示大小（`166.1 KB`），**没有**相对时间；
   - 网格视图：名称行右侧仍有大小，卡片**底部另起一行**显示「类型图标 + `JPG` + 日历图标 + `5 hours ago`」。
   ⇒ 想要「添加于 X 小时前」，**必须切到网格视图**。
3. **「打开所在文件夹」按钮的位置跟着视图变**：列表视图在卡片**右上角**，网格视图在卡片**右下角**。
4. **标记页签的工具条在标题行右侧**，从左到右是：类型筛选（`All` / `Folders` / `Files` / `⋯`）
   → 列表/网格切换（两个图标按钮）→ 排序下拉（`↑ Custom`）→ `⋮`。
5. **左侧标签栏固定 300px**，每行是「拖拽手柄 + 色点 + 标签名 + 条目数徽章 + `⋯`」，
   上面还有一个 `Search / create tag` 输入框（**能直接新建标签**）。选中行整行描边高亮。
6. **收藏页签确实完全没有分类分组**（实测：5 条收藏平铺，无任何分组标题）——
   这坐实了冲突清单第 1 条：AFM 的收藏分类体系在 upstream 那边**没有对应物可搬**。
7. **常用页签的卡片带「Opened N times」徽章**（`Opened 30 times` / `Opened 23 times` …），
   最近浏览页签则是时间戳。upstream 把「历史」改称 `Recently viewed`。
8. **AFM 现状对照**（`docs/screenshots/afm-dashboard-current.png`）：
   AFM 是「标题 + 四个胶囊页签（收藏 9 / 已标记 2 / 常用 100 / 历史 100）」
   + 内容区**按收藏分类分组**（数据 / 软件 / 办公 / 学习，每组标题带改名、删除按钮）。
   AFM 的数据量更大（收藏 9 / 常用 100 / 历史 100），upstream 种子数据只有 5 / 5 / 7，
   所以**对比时看的是布局，不是条目数**。

### 4.1.2 upstream 删掉/改掉的

- 删 `dashboard-tag-section-header.vue`（171 行）：分组标题条不再在内容区；
- 删 `entry-card-tags.vue`（288 行）：卡片上的标签 chip 改成新的共享组件 `item-tags-field.vue`；
- 删收藏卡片的「取消收藏」X 按钮（`4a33b290`），**没有补替代入口** ——
  单条收藏的移除只能回资源管理器右键菜单；
- `user-stats` store 新增 `removeTagFromAllItems` / `removeTaggedItem`（AFM 没有）；
- `SortableList` 新增 `disabled` prop；
- 文案：`history` 从「历史」改成「Recently viewed」。

### 4.2 与 AFM 现有能力的冲突清单

| # | AFM 有什么 | upstream 怎么处理 | 照搬的后果 |
|---|---|---|---|
| 1 | **收藏分类**（`favoriteCategories` + 分类分组 + 「未分类」虚拟组） | **完全无此概念**，收藏页签是平铺的 | 分类分组、分类改名/删除、空分类仍显示、「未分类」虚拟组**整块丢失** |
| 2 | 分类内排序 + 改归属（卡片 ⋮ 的上移/下移、「移到分类」） | upstream 卡片只有「打开所在文件夹」 | **丢失** |
| 3 | 收藏卡片上的「取消收藏」入口 | upstream 把按钮删了且**没补入口** | 照搬后用户在仪表盘上**无法取消收藏** —— 这是 AFM 反馈明确要的能力 |
| 4 | 标记页签是多分组平铺，每组一条可编辑标题条（带标签上移/下移） | upstream 换成「侧栏选一个标签 + 右侧单组 + 拖拽排序」 | **骨架级替换**，AFM 的「标签上移/下移」要重新安放 |
| 5 | `entry-card-tags.vue` / `dashboard-tag-section-header.vue` | upstream 把它们删了 | 只被 AFM 自己的 dashboard 引用（各 1 处），不牵连别处；但移植后变成死代码，删留要决定 |
| 6 | AFM 的 `entry-card.vue` 只有 `path`/`isFile` + 插槽 | upstream 新增 `sizeLabel`/`layout` prop 与 `meta`/`details`/`actions` 三插槽 | 卡片组件要重做 |
| 7 | 操作条 ⋮ 里的「新建收藏 / 新建分类 / 新建标记」三项 | upstream 的新操作条没有；侧栏只能用搜索框新建标签 | 收藏/分类的新建入口**丢失** |
| 8 | `removeTagFromItem`（卡片 ⋮ 菜单） | upstream 另加 `removeTaggedItem` | 需补 |
| 9 | `useRestoredActiveTab`（页签记忆） | upstream 新增 `useRestoredChoice`（页签/排序/布局/筛选一起记） | 需补一个小函数 |
| 10 | — | upstream 依赖 `FILE_EXTENSIONS.DOCUMENT` | AFM 没有，需补 |
| 11 | — | Hero 背景图 `src/assets/media/dashboard/dashboard-top-bg.jpg`（69KB） | AFM 没有，需带图 |
| 12 | 删标签时同步剥 tagId + 启动反推重建标签定义 | upstream 用「未分类」分组收容孤儿 | **在 AFM 会永远为空**，搬了侧栏多一个点不动的「未分类」 |

### 4.3 移植难度分级

| 能力 | 难度 | 理由 |
|---|---|---|
| Hero 顶部区 | **低** | 纯展示组件 + 一张图；AFM 的 `PageDefaultLayout` 与 upstream **完全一致**，直接可用 |
| 按类型筛选 | **低** | 一个纯函数 + 一个组件，只差补 `FILE_EXTENSIONS.DOCUMENT` |
| 条目大小显示 | **低** | AFM 已有 `useDirSizesStore` 与 `formatBytes`，只差那个 composable |
| 相对时间 | **低** | 28 行纯函数 |
| 缩略图预览 | **低** | AFM 已有图片/视频缩略图 composable，搬两个 composable + 给卡片加渲染位 |
| 排序方式 | **低** | 纯函数 + 一个下拉；需补 `useRestoredChoice` |
| 确认框体系 | **低** | 67 行通用壳子直接搬；但要单独决定「取消收藏」是恢复按钮还是换确认框 |
| 标签侧栏 | **中** | 组件可搬，但 AFM 标题条上有「上移/下移 + 重命名 + 改色 + 删除」四个动作，塞进侧栏行内 ⋮ 菜单需要重新设计交互 |
| 列表/网格切换 | **中** | 依赖 `entry-card` 新增 `layout` prop 与网格样式 |
| 标记页签整体骨架 | **高** | 要替换 AFM「多分组平铺 + 每组标题条」的骨架，AFM 的分组编辑能力都要重新安放 |
| 收藏页签的分类分组 | **高** | upstream 无对应实现可搬，得自己把「分类侧栏」套到收藏页签上 |

### 4.4 建议

**按能力逐项移植，不要整体替换页面骨架。** 理由：

1. upstream 这次的价值集中在**标记页签**（侧栏 + 筛选 + 排序 + 大小 + 缩略图），
   其中六成是低风险的纯函数/独立组件；
2. 真正的冲突在**收藏页签** —— AFM 独有的收藏分类体系在 upstream 没有对应物，
   直接搬会丢四类能力，而 upstream 自己又删掉了 AFM 保留的「取消收藏」入口；
3. 建议顺序：先做「低难度且 AFM 已有依赖」的四项（条目大小、相对时间、缩略图预览、确认框），
   它们都是**给现有卡片加信息**，不动骨架；再单独评估 Hero 顶部区；
   最后才决定要不要换标记页签的骨架。

---

## 5. 门禁

| 门禁 | 结果 |
|---|---|
| `cargo test --lib` | **793 passed / 0 failed** |
| `npx vitest run` | **238 文件 / 2097 用例全通过** |
| `npx eslint src` | **175 errors / 0 warnings**（= HEAD 基线，**新增 0**） |
| `npx eslint .` | **188 errors / 0 warnings**（= HEAD 基线，**新增 0**） |
| `npx vue-tsc --build` | exit 0 |
| `node scripts/verify-changelog.mjs` | OK |
| 17 个语言包 key 一致性 | 0 mismatch |

> ⚠️ **eslint 基线已更新**：上一轮记的「177 / 170」**已过期** ——
> 3.5.0 那轮新增的 `compare-sync-dialog.test.ts` 带进来 5 个存量违规，
> 现在是 `eslint .` = 188 / `eslint src` = 175。
> **基线数字会随提交变**，量的时候用 `git stash push -u` 量 HEAD，别拿旧数字对。

---

## 6. 提交

| 仓库 | 提交 | 内容 |
|---|---|---|
| 内层 | `1c53860b` | `chore(scripts): 加 upstream 移植完成度审计脚本（git cherry 在本项目判据失效）` |
| 内层 | `2c1ab20e` | `chore(ci): 补 Windows e2e 门禁与「e2e 跑完不留残留数据」检查` |
| 内层 | `fd8e7b31` | `chore(i18n): 语言包文件格式钉一道门禁（末尾换行 + 两空格缩进）` |
| 内层 | `2c9e097e` | `refactor(dashboard): 标签分组、拖放目标、标签色板抽成纯模块并补单测` |
| 内层 | `40525c05` | `docs(handoff): 补上游同步与仪表盘改版评估文档` |
| 内层 | `d3d3e86b` | `docs(dashboard): 补 upstream 新仪表盘真机截图与实测界面细节` |
| 外层 | `ec5492a` | `docs(agents): 更新 eslint 基线（175/188）并更正仪表盘重设计的体量数字` |

---

## 7. 本轮踩的坑

1. **`git cherry` 判「是否已合并 upstream」在本项目是错的** —— AFM 是重写移植，补丁 ID 天然不同。
   必须用逐行命中率（`scripts/audit-upstream-port.mjs`）。
2. **`git diff $mb..HEAD` 在 PowerShell 里会被 `..` 吃掉** —— `..` 是 PowerShell 的范围运算符，
   `$mb..HEAD` 被解析成范围表达式，git 直接报 usage 错误。用 `git diff $mb HEAD` 两参数形式。
3. **UIA 在本机这个宿主里读不出元素属性** —— `AutomationElement.Current` 全部抛 `RuntimeException`，
   元素树能走出来但属性读不到。可行的替代是 **键盘/坐标注入**：
   `app-key.ps1`（按键）、`click-webview-point.ps1`（对 `Chrome_RenderWidgetHostHWND` 发
   `WM_LBUTTONDOWN/UP`）、`afm-accept.ps1`（`Get-AfmMainWindow` / `Save-AfmShot`）。
4. **注入必须带阳性对照** —— 先点一个必然有可见后果的元素（主页）确认页面真的切了，
   再去点目标（仪表盘）。坐标是**物理像素**，窗口原点要用 `GetWindowRect` 取，不能猜。
5. **`npm ci` 在本机会卡在 `skia-canvas` 的预编译下载**（`image-js` 拉进来的**可选、仅开发用**依赖）。
   ⇒ 用 `npm ci --ignore-scripts`（保留平台原生绑定 `@tauri-apps/cli-win32-x64-msvc`，
   只跳过 postinstall）。**不要用 `--omit=optional`** —— 那会把 tauri CLI 的平台绑定一起省掉，
   报 `Cannot find native binding`。
6. **本机代理 `127.0.0.1:7897` 的 TLS 握手间歇性坏**，直连 github.com 正常。
   所有 git 远程操作带 `git -c http.proxy=`；推送失败时两条路轮着试。
7. **`Measure-Object -Character` 量字符数会虚高** —— 管道里按行累加，量出来比真实值大一倍多。
   量文件体量一律用 node 读 git show 的输出。
8. **给 upstream 拍截图有四个专门的坑**（这一整轮 P4 取图全靠它们）：
   - **`app-key.ps1` / `click-webview-point.ps1` 都写死了进程名 `alpha-file-manager`**，
     upstream 的二进制叫 `sigma-file-manager`，脚本直接报 `NO_PROCESS`。
     ⇒ 另写了 `app-key-proc.ps1` / `click-webview-point-proc.ps1`（`-ProcName` 参数化）。
   - **首启会弹「What's New」更新日志模态框**，把整个仪表盘挡住；ESC 发不进去
     （`SetForegroundWindow` 没拿到前台权，`GetForegroundWindow() -ne $hwnd`）。
     ⇒ 干净的解法不是关弹窗，而是**别让它弹**：
     隔离目录里的 `user-settings.json` 写上 `"changelog.lastSeenVersion": "2.2.0"`，
     `hasUnseenUpdate` 就是 false，重启后不再弹（`use-changelog.ts`）。
   - **upstream 进程会在两次 shell 调用之间自己消失** —— 后台在给真实目录建 tantivy 索引
     （日志里 `maxdoc=339601` 一路涨），把进程拖垮。
     ⇒ 「启动 → 最大化 → 点页签 → 连拍两张」必须**在同一个脚本进程里跑完**
     （`upstream-dashboard-shot.ps1`），别拆成多次调用。
   - **两个应用共用 identifier `com.sigma-file-manager.app`**，同一时刻只能开一个；
     取图全程用 `SFM_E2E_DATA_DIR` 指到隔离目录，**不碰** AFM 与用户的真实数据。
9. **upstream debug 构建 10 分 03 秒** —— 判定需要真机证据就**早启动、丢后台**，
   别等到写文档时才开始编译。
