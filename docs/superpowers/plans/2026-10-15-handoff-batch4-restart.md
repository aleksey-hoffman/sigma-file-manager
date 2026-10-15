# 接力文档：第四批反馈（反馈 2 / 3 / 4）

> 写于 2026-10-15。上一会话上下文已被压缩过一次，且反馈 2 的语义刚被用户纠正，
> 剩余三项都涉及结构性改动，建议**新开会话**接手。
>
> 面向用户的输出一律简体中文；代码标识符、路径、命令保持原样。

---

## 1. 项目与仓库

- 产品名 **Alpha File Manager**（Tauri 2 + Vue 3 + Rust 的文件管理器）
- 代码仓：`F:\soft\00selfmade\filemanager\sigma-file-manager`
  - origin = `kizemo/alpha-file-manager`
  - 版本固定 **3.1.1**，不要动
  - 受保护常量：mDNS 服务名、legacy 数据目录名、Tauri `identifier`
- 项目约定（**每次改代码前必读**）：`F:\soft\00selfmade\filemanager\AGENTS.md`
  - 该文件本轮新增了 5 条真机验收陷阱记录，**目前未提交**，收尾时决定是否提交
- 历史规划文档：
  - 第三批：`sigma-file-manager/docs/superpowers/plans/2026-10-15-next-stage-plan.md`
  - 第四批方案：`sigma-file-manager/docs/superpowers/plans/2026-10-15-feedback-batch4.md`
  - 本文件：`sigma-file-manager/docs/superpowers/plans/2026-10-15-handoff-batch4-restart.md`

---

## 2. 仓库状态

分支 `feat/batch3-tree-scroll-and-nav`，**全部未推送**。

| 提交 | 内容 | 状态 |
|---|---|---|
| `4770b2ca` | 修复反馈 2 行为：拆分窗口而不是新开标签 | 已验收（但语义仍不符，见 §4.1） |
| `9427324e` | 第四批 5 条反馈的方案文档 | — |
| `0ccd54e3` | 反馈 5：默认展开 + 缩进 28px + 面板 300px | ✅ 已验收 |
| `34dabe8a` | 反馈 2：文案改「打开所属目录」+ 行为改拆分 | ✅ 文案验收，行为被 §4.1 推翻 |
| `0c76db58` / `d6761a62` / `fc31b872` / `24d30282` | 第三批 N6 / N3 / N5 | ✅ 已验收 |
| `1f49ad09` | **WIP**：反馈 3 递归搜索 | ❌ 未跑全量门禁、未打包、未验收 |

回滚点：分支 `rollback/batch3-baseline` + tag `rollback/batch3-baseline-20261015-105445` → `0f73f159`

**工作区干净**（所有改动已提交）。

已安装的打包产物（上一会话产出，可作为对照基线）：
`18,114,806 B`，sha256 `619E5CF7568300FBBB8A41A2F8376B5266807AA4098CFDDEC93ACE969B0E91A6`

---

## 3. 已完成并通过真机验收的部分

### 3.1 反馈 5：侧栏菜单默认展开/收起 + 缩进 + 加宽 ✅

代码落点：
- `src/modules/nav-sidebar/components/quick-access-panel.vue:136-141`
  四个 `useSectionOpenState` 的默认值改为 `favorites/tagged => true`、`frequent/history => false`
- `src/modules/nav-sidebar/components/quick-access-section.vue:188-191`
  `.quick-access-panel__section-content` 的 `padding-inline-start: 20px → 28px`
- `src/styles/vars.css:23` `--quick-access-panel-width: 260px → 300px`

**量值证据**（像素扫描，非目测）：
- 面板左右边界 x=90..541，宽 **451 物理像素 = 300.7 CSS px**，与声明值 300px 吻合
- 子项图标左边 = 面板左边 + 73 物理像素 = **48.7 CSS px**
  - 理论值 = 8（面板 content padding）+ 28（section-content）+ 12（item padding）= 48
  - 旧值 20px 会给出 60 物理像素，**实测排除**
- 视觉：收藏夹展开显示 3 项、已标记展开显示 IMPORTANT 分组 + release、常用/历史只有标题行且折叠箭头朝右

### 3.2 反馈 1：侧栏四个分组标题右侧的「跳仪表盘页签」箭头 ✅

用户现场确认四个箭头（收藏夹/已标记/常用/历史）全部可用，不要再排查。

### 3.3 反馈 2 的**菜单文案** ✅

真机读到渲染后的菜单项文本就是「打开所属目录」（UIA `MenuItem` 的 Name，
来自 Chromium accessibility，是实际渲染值不是源码回显）。

---

## 4. 用户在 2026-10-15 反馈后指出仍未解决的三点

### 4.1 反馈 2 行为：**语义错了**，左侧搜索结果列表没有保留 ⚠️ 最高优先级

**用户原话**：在搜索结果中右键点「打开所属目录」时，右侧目录跳转了，
**但左侧的搜索结果列表应当保留不变**。

**当前实现做了什么**（`4770b2ca`）：
`openNavigatorRevealEntry` 调 `workspacesStore.toggleSplitView()`，把导航器自己
拆成两个并排 pane，右侧 pane 指向父目录。**全局搜索面板同时关闭了**。

**真机截图证实的行为**：搜索面板消失，导航器变成两个 pane
（左侧 `Users > Duanyi > loopx` 原位置，右侧 `es > platform > windows` 所属目录）。

**为什么这是错的**：用户要的是
```
┌──────────────────┬──────────────────┐
│  搜索结果列表      │  所属目录导航器    │
│（保持打开、内容不变）│ （选中该条目）      │
└──────────────────┴──────────────────┘
```
而现在得到的是
```
┌──────────────────┬──────────────────┐
│  导航器原位置      │  导航器所属目录    │
└──────────────────┴──────────────────┘
（搜索面板已关闭）
```

**上一会话的验收盲点（务必避免重犯）**：验收脚本 `fb2-verify.ps1` 在
`Restart-App` 后停在**导航器页**，从未验证「搜索面板是否仍在」。断言只查了
「导航下拉按钮数 == 2」和「选中状态栏 x > 850」，两者在错误实现下同样成立。
**下个会话的验收必须显式断言左侧搜索面板仍然存在。**

**根因定位（已完成，只需设计实现）**：
- `src/modules/navigator/pages/navigator.vue:1350-1362` 布局是
  `navigator-page__panes-container` 里先放搜索面板（`v-show="globalSearchStore.isOpen"`），
  再放 `ResizablePanelGroup`，里面 `v-for` 遍历 `currentTabGroup` 渲染并排 pane
- `navigator.vue:326-337` 有一段 watch：**全局搜索打开时如果正在拆分就
  `toggleSplitView()` 把它合上，关闭时再恢复**。这段逻辑本身是为了避免
  「搜索 + 拆分」并存，任何改动都要先想清楚和它的关系
- 导航器的「拆分」= `isSplitView === currentTabGroup.length > 1`（`:278-280`），
  标签组 `tabGroups` 只决定标签条上有几个标签

**待你决策的设计问题**：
1. 右侧那个 pane 是「导航器拆分出来的第 2 个 pane」，还是「搜索面板旁边固定
   挂一个导航器 pane」？后者要绕过上面那段 watch。
2. 用户再点一次别的搜索结果时，右侧 pane 是复用（换路径）还是新建？
3. 原本已经处于拆分状态时怎么处理（三个 pane？）

代码落点：`src/utils/open-navigator-directory.ts`（`openNavigatorRevealEntry`）
+ `src/modules/navigator/pages/navigator.vue`（模板 + `:326` 的 watch）
+ 可能需要 store 暴露「在搜索面板右侧挂 pane」的能力。

**`4770b2ca` 附带的另一处修复仍然是对的，不要回退**：
`navigator.vue` 新增的 watch 把 store 侧 `currentTab` 变化同步到本地 `activeTabId`。
拆分视图下这两个是两份状态，`activateTabPane` 之外的路径改了 store 侧本页不知情，
`getNavigatorPaneRef()` 会落到 `tabGroup[0]`（左侧），选中就出现在错误面板。
对应测试在 `src/utils/__tests__/open-navigator-directory.test.ts` 的
`describe('openNavigatorRevealEntry')`（4 个用例，已做判别性验证：
注入旧实现后 3 个转红）。

### 4.2 反馈 3：目录内递归搜索 ❌ 未完成（代码已写，未跑门禁/未打包）

用户反馈原文：「目录内搜索，没有实现递归搜索，还是只显示当前层级的搜索结果」。

**根因**（已复核）：在前端。目录内搜索是对 `read_dir` 拿到的那**一层**条目做
内存过滤（`use-file-browser-entries.ts` 原 52-70 行的 `matchesQuickSearch`）。
早前怀疑的 `src-tauri/src/global_search/query.rs:343-353` 只读一层是
**另一个函数** `global_search_query_paths`（全局搜索的「优先路径」通道），
不是目录内搜索的链路 —— 别再走那条错路。

**已完成的代码**（提交 `1f49ad09`，工作区干净）：
- `src-tauri/src/global_search/query.rs` 新增 `search_directory_recursive_blocking`
  + `search_directory_recursive`：WalkDir 递归（`min_depth(1)` + `max_depth`）、
  上限截断（`collection_cap = limit * 20`）、内建忽略目录、按**文件名子串粗筛**、
  同分按路径排序保证结果稳定
  - 过滤谓词**刻意不复用** `scan.rs` 的 `should_scan_walk_entry`：它会调
    `maybe_set_current_scan_path` 改写**全局索引的当前扫描状态**
- `src-tauri/src/global_search/commands.rs` + `src-tauri/src/lib.rs`：
  注册 command `search_directory_recursive`
- `src/modules/navigator/components/file-browser/composables/use-file-browser-recursive-search.ts`
  （新建）：250ms 防抖、单调递增序号丢弃过期响应、invoke 失败静默降级为「只搜当前层」
- `.../use-file-browser-entries.ts`：把递归命中并入同一列表，按 path 去重，
  **仍然过一遍既有 `matchesQuickSearch`** 做精筛
- `.../use-file-browser.ts`：传入 `navigation.currentPath`

**设计取舍（已写进代码注释，别推翻）**：
Rust 只做文件名粗筛，`size:` / `items:` / `modified:` 这类依赖前端 store 的谓词
仍只有前端一处定义。代价：`size:>1MB` 这种**不含文件名关键词**的查询
只能搜到当前层。这是「递归」与「全谓词」的取舍，需要在 UI 上如实说明。

**扫描深度决策**：复用 `userSettings.globalSearch.scanDepth`（默认 7），
没有另开设置项。理由：它已经是设置页里用户能调的「层深度」，另开一个数字只会
让用户对着两个含义相同的旋钮猜。

**状态**：
- ✅ `cargo check` 通过（刚跑过）
- ✅ `vue-tsc` 通过
- ❌ 全量单测未跑
- ❌ eslint 未跑全量（基线 186 errors / 121 warnings）
- ❌ 未打包、未真机验收
- ❌ UI 上没有任何「正在搜索子目录…」的反馈（刻意没做半成品）

**验收建议**：夹具 `%TEMP%\afm-b3-fixtures\search`（16 文件 / 3 子目录）适合做递归对照
—— 搜一个只存在于子目录里的文件名，看它是否出现在列表里。

### 4.3 反馈 4：收藏夹/已标记的分类与编辑 ❌ 未开工

用户反馈原文：「在收藏夹和已标记签页，还是没有添加分类或标记的入口，
希望添加入口，同时在签页可以对已经添加的收藏、标记进行排序、修改分类等编辑。」

**现状**：
- 数据层**完全没有「分类」概念**。全仓搜 `category|categories|categoryId` 只命中
  设置页目录/扩展分类/i18n。`FavoriteItem` 只有 `path` + `addedAt`，
  `TaggedItem` 有 `path`/`tagIds`/`addedAt`/`isFile`
- 仪表盘页「收藏夹」「已标记」两个页签的 `⋮` 菜单**只有「清空」**
  （`src/modules/dashboard/components/dashboard-action-bar.vue:50-57`）
- 已标记页的 `EntryCardTags` 里**已有**完整的标记编辑（新建/重命名/改色/排序）
- 收藏夹卡片只有 `X`（删除），且 `isFavoriteFile()` 靠「路径含 `.`」猜类型
  （`dashboard.vue:134-140`），含点目录会误判

**已知落点**：
- `src/types/user-stats.ts:5-21` — `ItemTag` / `TaggedItem` / `FavoriteItem`
- `src/stores/storage/user-stats.ts:45` — `USER_STATS_TOP_LEVEL_KEYS` 白名单
  （**新增字段必须同步加进 `DEFAULT_USER_STATS`，否则会被静默丢弃**，
  这是预批 0 的注释里专门警告过的）
- `src/modules/dashboard/pages/dashboard.vue:280-385` — 两个页签的模板
- `src/components/ui/sortable/sortable-geometry.ts:5-32` + `sortable-list.vue`
  —— **目前只比 Y 轴行中点**，仪表盘收藏是 grid，直接套用会算错索引。
  若要做拖拽排序，得改 `captureRowHeights` 存完整 `getBoundingClientRect()`
  并算 `columnCount`（`sortable-geometry.ts` 是全局共用组件，改动影响面大）
- `src/stores/schemas/schema-utils.ts` 有 `migrateStorageSchema`，但**没接到
  user-stats**（`stores/schemas/` 下无 `user-stats.ts`）

**上一会话给的方案与建议拆分（未获用户确认，需你复核后落地）**：
- 4a：三个新建对话框（新建收藏 / 新建分类 / 新建标记）+ `favoriteCategories`
  数据结构 + 页签内入口
- 4b：grid 拖拽排序 + 改归属分类 + 标记排序/改色上移到 `⋮`

**建议的低风险替代**（如果不想动全局 `sortable-geometry`）：
用「上移/下移」按钮 + 「移到分类」下拉实现编辑能力，把拖拽留到 4b。
零风险、改动小，能满足「排序 / 修改分类」的诉求。

**待你确认的产品边界**：
1. 「新建收藏」如何确定文件/目录类型 —— 用文件选择对话框选路径后运行时 `stat` 确定
   （推荐，顺带给 `FavoriteItem` 加 `isFile` 字段消除「含点猜」的误判），
   还是让用户手动切换类型？
2. 收藏夹是否按分类分组显示？无分类的放哪一组（建议「未分类」）？
3. 分类删除时，其下的收藏怎么办（移到未分类 / 连带删除）？

---

## 5. 真机验收工具链（git-ignored，在 `.superpowers/sdd/`）

`.gitignore` 内容是 `*`，所以这些脚本不进版本库，**丢了要重写**。上一会话
重建过一次，如果当前目录还在就直接用：

| 脚本 | 作用 |
|---|---|
| `afmcap.ps1` | 原生 Win32 封装、`SetProcessDPIAware`、屏幕 DC BitBlt、遮挡守卫（含 msedgewebview2 白名单） |
| `afm.ps1` | 主窗口定位（class=`Tauri Window`/可见/面积最大）、`Set-WindowBox`、`Focus-App`、`Restart-App` |
| `afmctx.ps1` | UIA 查询、`Get-RenderHost`、`Open-ContextMenu` |
| `afminput.ps1` | `SendInput` 封装 |
| `fb2-verify.ps1` | 反馈 2 端到端验收（**需按 §4.1 修改断言**） |
| `fb5-survey.ps1` / `fb5-measure.ps1` | 反馈 5 量值测量 |
| `uia-probe.ps1` | 枚举 UIA 树所有 Button/Edit（含空 Name 的） |
| `snap.ps1` | 截当前完整窗口 |

安装 / 启动：
```
安装目标：D:\Program Files\Alpha File Manager\alpha-file-manager.exe
安装包：sigma-file-manager\src-tauri\target\release\bundle\nsis\Alpha File Manager_3.1.1_x64-setup.exe
静默安装：Start-Process <安装包> -ArgumentList '/S'
```

---

## 6. 本轮踩到的验收陷阱（务必先读，比脚本本身更重要）

1. **`SendInput` 对 WebView2 完全无效**。鼠标 hover 有效（tooltip 会出），
   但 `mousedown/up` 和键盘按键都到不了应用。别再花时间调 `SendInput`。
   两条可用路径：
   - UIA `InvokePattern` —— 能触发 DOM click / 菜单项激活
   - `PostMessage(WM_RBUTTONDOWN=0x0204 / WM_RBUTTONUP=0x0205)` 直接发给
     **`Chrome_RenderWidgetHostHWND`**（不是 `Chrome_WidgetWin_0`，
     那个是一堆 1px 宽的辅助窗口），**lParam 用客户区坐标**
     （屏幕坐标减去该窗口原点）。这条能生成 DOM `contextmenu` 事件，
     右键菜单实测可读。
2. **`MoveWindow` 对最大化窗口无效**。必须先 `ShowWindow(hwnd, SW_RESTORE=9)`
   再 `MoveWindow`，否则尺寸设置静默不生效，之后所有坐标都是错的
   （表现为工具栏按钮跑到 x=2000+）。
3. **`MOUSEINPUT.dx/dy` 不带 `MOUSEEVENTF_ABSOLUTE` 时是相对位移**。
   想用 `SetCursorPos` 定位就必须在 `SendInput` 里传 `dx=0, dy=0`。
4. **PowerShell 里 `,` 的运算符优先级高于 `+`**。
   `@($a + 1, $b + 2)` 被解析成 `$a + (1,$b) + 2` → `op_Addition` 报错。
   每个项都要加括号。
5. **`.ps1` 必须纯 ASCII**。PS 5.1 按 ANSI 读无 BOM 文件，写中文会破坏引号
   导致解析错误。用 `-join @([char]0x6253, ...)` 构造。
6. **`[uint]` 不是 PowerShell 类型别名**，用 `[int]` / `[uint16]` / `[uint32]`。
7. **Chromium 的 accessibility 树需要真实指针活动才刷新**。
   枚举前先 `SetCursorPos` 挪一下（脚本里的 `Poke`），否则 `Get-All`
   拿到的是旧树，定位元素会「明明存在却找不到」。
8. **`Switch -Regex` 默认大小写不敏感**，要写 `-CaseSensitive`。
9. **函数只要有返回值就不能在内部混用 `Write-Output`**（诊断输出会污染管道）。
   函数内一律 `Write-Host`。
10. **验收配置被指向临时夹具**：`user-workspaces.json` 里激活 tab 的
    `type === 'directory'` 的 `path` 目前是 `%TEMP%\afm-b3-fixtures\wide`
    （原值 `E:/obsidian/evidence`）。**收尾必须复原**。
11. Edge 窗口可能被 `SW_HIDE` 隐藏过，用户可能需要自行恢复。

---

## 7. 环境与命令约束

- 本机 **DPI 144（150% 缩放）**：UIA/截图量的是物理像素，换算 CSS 逻辑像素 **÷1.5**
- Rust 工具链固定 **1.90.0**，每个 bash 调用都要重新注入完整 PATH：
  ```
  $env:PATH = "C:\Program Files\nodejs;" +
    "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin;" +
    "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC\14.51.36231\bin\Hostx64\x64;" +
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;" + $env:PATH
  ```
- npm 必须经 `cmd.exe /d /c` 调用（Node 20+ 下 `spawnSync *.cmd` 直接 EINVAL）
- 门禁命令：
  - `cmd.exe /d /c "npm run ts"` → 0 error
  - `cmd.exe /d /c "npm run test:unit:run"` → 基线 **177 文件 / 1324 用例全绿**
  - `cmd.exe /d /c "npx eslint ."` → 基线 **186 errors / 121 warnings，零新增才算过**
  - 17 个语言包叶子 key 集合必须与 `en.json` 完全相等（只有 `ch` 有真实译文）
- 提交信息**必须**用文件方式 `git commit -F <file>`（`git commit -m "中文"`
  会把汉字编码破坏成 `��`）
- JSON 一律用 Node `writeFileSync(..., 'utf8')` 写；`Set-Content -Encoding UTF8` 会写 BOM
- PowerShell `>` 重定向会写 UTF-16，改 `.ts` 文件用 `git checkout --` 或 `Copy-Item`
- 删除文件走 `rm --`；**禁止** `git clean` / `git reset --hard` / `git stash`；不擅自推 upstream
- 每轮 `tauri build` 约 15 分钟
- **真机验收必须用 `tauri build` 的打包产物，不能用 `tauri dev`**
  （dev 下所有路由页面内容区空白）

---

## 8. 建议的下一步顺序

1. **反馈 2 语义修正**（最高优先级，用户明确指出）
   - 先定 §4.1 的三个设计问题，再改 `navigator.vue` 模板 + `openNavigatorRevealEntry`
   - 验收脚本**必须新增「搜索面板仍在」断言**
2. **反馈 3 收尾**
   - 跑全量门禁（单测 + eslint 零新增）
   - 打包 + 真机验收（用 `search` 夹具做递归对照）
   - 考虑加一个「正在搜索子目录…」的轻量指示
3. **反馈 4**（工作量最大）
   - 先确认 §4.3 的三个产品边界
   - 建议先做 4a，排序用「上移/下移」而非拖拽，避开全局组件改动
4. 合并 main → 推送
5. 清理（见 §9）

---

## 9. 收尾清理待办

- [ ] 验收配置复原：`C:\Users\Duanyi\AppData\Roaming\com.sigma-file-manager.app\user-data\user-workspaces.json`
      里 `tabGroups` 中 `type === 'directory'` 的 `path` 改回 `E:/obsidian/evidence`
      （改完必须先杀进程）
- [ ] 临时 worktree `%TEMP%\afm-baseline-eslint`
- [ ] `.superpowers/sdd/` 下的一次性脚本（可保留复用，但要决定是否留）
- [ ] `F:\soft\00selfmade\filemanager\AGENTS.md` 本轮新增的 5 条验收陷阱是否提交
      到 `kizemo/focus-sync`（当前在 `focus-sync-ctrl-l-2026-10-13` 分支未提交；
      该仓另有未跟踪的 `docs/blog/`，非本轮产生，**不要动**）
- [ ] 确认 Edge 窗口状态已恢复
