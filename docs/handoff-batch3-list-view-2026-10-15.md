# Handoff —— Alpha File Manager 批次 3 续（反馈 4 / 5：列表视图）

> 接力用。**先读本文档，再读仓库根目录 `AGENTS.md`**（那是本项目的硬约束与验收脚本约定，优先级高于本文档里任何描述）。
> 本文档只记录「这一批做到哪、为什么这么做、下一步做什么」。

- 文档生成时间：2026-10-15 22:55（会话 `mvs_607b7d02d3514c8fbebb5d2c7ed40a73`）
- 最后更新：2026-10-16 00:05，补完 small 档真机取证 + 记录本轮新踩的坑
- 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
- 分支 / HEAD：`main` @ `6b85e2b7`，**已发版 3.1.2**（工作已由用户提交 `99bba3d2` + `6b85e2b7` 并推到 `origin/main`）

---

## 0. 一句话现状

批次 3 全部反馈（1 / 2 / 2 续 / 3 / 4 / 5）已实现、过门禁、拿到四档真机像素证据，并已发版 **3.1.2**。
本文档保留「为什么这么做」与硬提醒，供后续批次复用；**待办清单已清空**（见 §5）。

---

## 0b. 批次 3 真机像素证据（全部四档，同一个脚本量）

`measure-list-rows.ps1` 按「整行深色像素占比 ≥ 0.75」识别分隔线再量行距，DPI 144，**物理像素 ÷ 1.5 = CSS 逻辑像素**。
夹具 `C:\Users\Duanyi\afm-acceptance-fixtures\grid`（1 个目录 `sub` + 2 张 PNG + 5 个非媒体文件），列表视图，窗口 2200×1400 物理。

| 缩略图档位 | 目录行 + 非媒体文件行 | 图片行（对照） |
|---|---|---|
| small | **96px = 64 CSS** ×6 | 72px = **48 CSS** ×2 |
| medium | **96px = 64 CSS** ×8 | 96px = **64 CSS** ×2 |
| large | **96px = 64 CSS** ×6 | 120px = **80 CSS** ×2 |
| xlarge | **96px = 64 CSS** ×6 | 144px = **96 CSS** ×2 |

**这张表就是反馈 4/5 的验收结论，且是判别性的**：媒体行随档位变（48→64→80→96），
说明档位确实生效了；非媒体行恒定 64，说明不是「所有行都冻住了」这种平凡为真。
small 那一格是本轮补上的 —— 之前只测了 medium/large/xlarge，而 min-height 地板的 bug **只在 small 显形**。

列对齐：`项目 / 大小 / 修改时间 / 创建 / 标签` 与 `名称` 落在同一水平中线（截图 `afm-fb8-shots\medium.png`）。

---

## 1. 项目背景（够用即可，细节看 `AGENTS.md`）

Alpha File Manager 是 Electron 之外用 Tauri + Vue 3 + TypeScript + Naive UI 写的 Windows 文件管理器，产品名与版本已锁定（**Alpha File Manager**，批次 3 发版时为 **3.1.2**）。用户在真实使用中逐条提改进意见，每条都必须：

1. 改代码
2. 补**判别性单测**（注入缺陷后必须红）
3. 过门禁：`vue-tsc` 0 error / `eslint src` = **179 errors / 121 warnings**（与基线逐字相同）/ 全量单测全绿 / 17 个语言包叶子键与 `en.json` 一致
4. `tauri build` 打包 → 静默安装 → **用打包产物做真机像素验收**（`tauri dev` 的界面结论一律作废）

---

## 2. 本批（反馈 4 / 5）改了什么

两条反馈都针对**列表视图**，与网格视图是两套独立代码，网格那部分在上一轮已经做完。

### 反馈 4：列表单元格的垂直对齐 + 列表行高不随档位变

**用户原话**：
> 在列表视图，项目、修改时间、创建、类型、链接状态等几列的内容，在行中是顶部对齐，应该修改为垂直居中对齐，和名称、大小、标签、链接数等保持一致。同时，目录和非媒体文件行，在修改缩略图大小时，也不要更改高度，保持默认高度。

#### 4a 垂直对齐

根因：`.file-browser-list-view__entry` 是 grid 容器，子项默认被拉伸到整行高度。名称 / 大小 / 标签 / 链接数各自有 `display:flex; align-items:center` 所以是居中的；**项目 / 修改时间 / 创建 / 类型 这四个类只挂在一条共享规则上（只有颜色、字号、省略号），没有 flex 容器**，文字就贴在格子顶部。

顺带发现一个真 bug：列 id 是 `linkStatus`，组件拼出的类名是 `__entry-linkStatus`（驼峰），而 CSS 里写的是 `__entry-link-status`（连字符）——**选择器从来没命中过**，链接状态列因此一条样式都没吃到。已把该文件里 4 处旧写法统一改成 `__entry-linkStatus`。

改动文件：`src/modules/navigator/components/file-browser/file-browser-list-view.vue`
- 新增一条规则：`__entry-kind` / `__entry-items` / `__entry-modified` / `__entry-created` 加 `display:flex; align-items:center`
- 类名修正：`__entry-link-status` → `__entry-linkStatus`（共享规则、flex 规则、`.column-value` 规则、剪切板着色规则各一处）

日期列内部那个 `__date-hover` 是 `inline-grid` 且 `primary/absolute` 都是 `place-self:start`，但它的盒子高度只有一行文字，**把外层居中就够**，不需要动它。

#### 4b 列表行高

改动文件：
- `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts`（唯一度量来源）
  - 新增两个字段 `listFileEntryHeight` / `listFileEntryHeightWithDescription`
  - 新增常量 `LIST_FILE_ENTRY_HEIGHT = 64`、`LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION = 64 + 14`
  - 四档表里这两个字段全部填同一个常量
  - `resolveThumbnailCssVariables` 的 `--navigator-list-view-entry-height` 改为输出常量（原来是 `metrics.listRowHeight`）
- `src/modules/navigator/components/file-browser/composables/use-file-browser-virtual-layout.ts`
  - `getEntryDescriptionHeight` 改为按「有没有缩略图」分流：有缩略图用 `listRowHeight*`，没有的用 `listFileEntryHeight*`
  - 判据用 `isFileBrowserImageEntry(entry) || isFileBrowserVideoEntry(entry)`，**必须与渲染侧同源** —— `file-browser-list-entry-thumbnail.vue` 的 `isMedia` 就是这两个函数的或。换成「不是目录」之类的判据会把非媒体文件也算成有缩略图。

**关键决策与理由**：

- **CSS 变量不能钉成任何一个具体类别，必须取「本档最短的行」**。`--navigator-list-view-entry-height` 是 `.file-browser-list-view__entry` 的 `min-height`，而 `min-height` 会赢过虚拟布局给的显式 `height`。踩过的两个坑：
  - 喂 `LIST_FILE_ENTRY_HEIGHT`（64）→ small 档媒体行 `height:48` 被顶回 **64**，缩略图档位在小档静默失效。
  - 喂 `metrics.listRowHeight`（分档）→ xlarge 档无缩略图行 `height:64` 被顶回 **96**，反馈 4 直接回归。
  - 现在实现是 `Math.min(metrics.listRowHeight, metrics.listFileEntryHeight)`：地板永远不生效，退化成「布局算出来之前先有个高度」，正是它原本的作用。
  - **这类 bug 只在「某档的行比地板矮」时显形** —— large / xlarge 看着完全正常，只有 small 会暴露。像素验收的价值就在这里。
- **取 64 而不是 48**。用户这次说的是「保持**默认**高度」，不是上一轮网格那句「保持和**小**的时候一致」。`navigator.thumbnailSize` 的出厂默认值是 `medium`（`src/stores/storage/user-settings.ts`），medium 的 `listRowHeight` 正好是 64。**两句话锚的是不同的档，这个区别是有意的**，单测里专门有一条断言把常量和 medium 档钉死。
  - ⚠️ 如果用户实测后说「还是太松，要更紧凑」，改成 48（小档）即可，只需改 `LIST_FILE_ENTRY_HEIGHT` 一个数，测试会提示同步。

---

## 3. 上一批（反馈 1 / 2 / 2 续 / 3）已完成，勿重做

| 反馈 | 落点 | 状态 |
|---|---|---|
| 1 收藏区分 分类/目录/文件 三种图标 | `quick-access-panel.vue`、`dashboard-category-section-header.vue` | 已验收 |
| 2 网格非媒体卡固定高 86px、图标 24px | `file-browser-thumbnail-sizes.ts`、`file-browser-grid-card.vue`、`use-file-browser-virtual-layout.ts`、`vars.css` | 已验收 |
| 2 续 目录卡四档同高 52px | 同上（`GRID_DIR_ENTRY_HEIGHT`） | 已验收 |
| 3 工具栏过滤「打开所属目录」左=所属目录/右=搜索结果，两格列表 | `open-navigator-directory.ts`、`use-forced-list-layout.ts`(新)、`use-file-browser-filter.ts`、`use-file-browser.ts`、`use-file-browser-actions.ts`、`file-browser.vue`、`types/workspaces.ts` | 已验收 |

真机像素证据（DPI 144，物理像素 ÷1.5 = CSS）：

| 档位 | 目录卡 | 非媒体卡 | 非媒体卡宽 |
|---|---|---|---|
| small / medium / large / xlarge | 78px = **52 CSS** | 129px = **86 CSS** | 256 / 399 / 827 / 827 px |

---

## 4. 门禁状态（本批改动后已跑，全绿）

- `vue-tsc --build`：**0 error**
- `eslint src`：**179 errors / 121 warnings**，与基线逐字相同
  （中途一度 180 —— 测试文件里 `createEntry(name, { ext: 'png', ...options })` 触发了 `@stylistic/object-property-newline`，已拆成多行修掉）
- 全量单测：**179 文件 / 1373 用例**（上轮是 179 / 1364，本批 +9）
- 17 个语言包：本批无新增文案，不用重跑

**判别性验证已做过**：把 `use-file-browser-virtual-layout.ts` 里的 `hasThumbnail` 改成 `true`，两条新用例
`keeps directory rows at one height across all four sizes` /
`keeps non-media file rows at one height across all four sizes` 转红，其余 21 条仍绿 —— 判别力成立。

---

## 5. 下一步

**批次 3 没有遗留待办。** 用户已安装实测、发版 3.1.2、推到 `origin/main`。
下一批反馈开始时，正常流程是：改代码 → 补判别性单测 → 过门禁 → `tauri build` → 静默安装 → `tauri build` 产物真机取证 → 发版。

验收期间动过用户数据，本轮**已全部复原**（见 §7 第 9 条），复原脚本留在 `.superpowers\sdd\restore-user-data.cjs`。

---

## 6. 本批新建的辅助脚本（`.superpowers\sdd\`，git-ignored）

| 文件 | 用途 |
|---|---|
| `pin-shot.ps1` | **量行高/列对齐的首选抓屏脚本**：`MoveWindow` 把窗口钉到指定物理尺寸，再用 `PrintWindow(hwnd,hdc,2)` 直拍。不受遮挡影响，连拍两帧取后一帧 |
| `measure-list-rows.ps1` | 列表行距测量：`-Image -From -To -X0 -X1 -Threshold -DarkRatio`。靠「整行深色像素占比」认分隔线，文字和缩略图都伪装不出来 |
| `measure-grid.ps1` | 截图二值化 + 游程编码量网格卡片几何。`-Image -Axis Y\|X -Scan -From -To -Threshold` |
| `set-list-tier.cjs` | 改 `user-settings.json` 的缩略图档位 + 强制列表布局。**必须先硬杀进程**，否则优雅退出会写回覆盖 |
| `set-start-dir.cjs` | 把 `user-workspaces.json` 里所有 `type==='directory'` 的 tab 指到某个夹具目录 |
| `restore-user-data.cjs` | 一键复原工作区 / 设置 / 统计三个文件到验收前状态（见 §7 第 9 条） |
| `strip-fixture-stats.cjs` | 只删 `user-stats.json` 里指向验收夹具的收藏/历史/常用项 |
| `build-rust-only.cmd` | 只跑 `cargo build --release`。`build-fb4.cmd` 失败且 tauri 只吐 `failed to build app` 时，用它拿真实错误 |
| `patch-list-height.cjs` / `patch-list-height-test.cjs` / `break-list-predicate.cjs` | 本批一次性打补丁 / 注入缺陷用，跑完即弃，不必保留 |
| `type-into-webview.ps1` / `paste-into-webview.ps1` | **两条已证实走不通的路，别再试**（见下） |

---

## 7. 给新会话的硬提醒（都是本轮踩出来的，重复踩代价很大）

1. **`SendInput` 能进 WebView2** —— `AGENTS.md` 里原来那条「SendInput 对 WebView2 无效」已被实测推翻并更正。
   输入文字的**首选路径**：`Set-Clipboard` + `app-key.ps1 -Keys 'CTRL+V'`。
   `app-key.ps1` 的 `$named` 表已补齐 A–Z 的 VK。
   **已证实无效、别再试**：往 `Chrome_RenderWidgetHostHWND` 投 `WM_CHAR`（静默丢弃）；剪贴板 + 中键粘贴（不触发）。
2. **工具栏过滤框在 UIA 树里是空壳**：打开后只有一个 `[Window] name="" 510x56 @(664,82)`，下面挂 `-∞x-∞` 的 `[Group]`，**没有 `[Edit]`、没有 `ValuePattern`**。所以只能用键盘注入，不能用 UIA SetValue。
3. **禁止用 `Get-Content` / `Set-Content` 读写带中文注释的源文件**。PowerShell 5.1 按 ANSI 读无 BOM 的 UTF-8，中文会变乱码。改完一律用
   `node -e "...(s.match(/\uFFFD/g)||[]).length"` 验 0。
   （本轮也发现：**控制台里 `Get-Content` 显示的中文乱码是显示问题，不是文件问题**，别据此判断文件被毁了。）
4. `$ErrorActionPreference = 'Stop'` 会把 npm/npx 的 stderr 变成终止错误，跑它们前后要显式切 `Continue`。
5. **网格卡在 UIA 树里不可见**（无 accessible name），只能靠截图像素量几何。
6. **验收夹具不要建在 `%TEMP%` 下** —— `builtin_ignored_paths()` 含 `/AppData/Local/Temp`，会把整棵子树剪掉，目录内递归搜索命中恒为 0。
7. **别用 `Process.MainWindowHandle`** 取主窗口（会落到 15×15 的托盘窗）；必须 `EnumWindows` + class `Tauri Window` + 可见 + 面积最大。
8. **BitBlt 遮挡守卫白名单必须含应用自己的 `msedgewebview2.exe`**（父进程链能回到主进程的都要放行）。
9. **量行高/列对齐别用屏幕 BitBlt，用 `PrintWindow`**。本轮 small 档取证被用户的 IDE / Edge 反复卡在遮挡守卫上，
   `shift-occluders.ps1` 也压不住（窗口会自己弹回来）。`PrintWindow(hwnd, hdc, 2)` 画的是窗口自身内容，
   **根本不需要遮挡守卫**（`.superpowers\sdd\pin-shot.ps1`）。代价：它不渲染 hover / overlay 层，
   验快捷面板、右键菜单这类交互仍然只能用屏幕 DC BitBlt。
10. **`user-settings.json` 是扁平映射，键名带点，不是嵌套对象**。要写的是
    `"navigator.layout.type": {"name":"list"}`、`"navigator.thumbnailSize": "small"`，
    **写 `{ navigator: { layout: ... } }` 会被静默忽略**（应用只认扁平键），表现为「设置改了但界面没变」。
    同理还有 `globalSearch.exactMatch`、`changelog.lastSeenVersion`。
    顶层 `navigator.folderSettings` 是按目录的布局覆盖，**优先级高于全局**，验收前要清掉。
11. **动用户数据前先备份，且验收脚本不许「清空」用户的统计**。
    本轮 `set-list-tier.cjs` 的早期版本顺手把 `user-stats.json` 的 `history` 整段清空，
    把用户 26 条历史打成 2 条，靠 `user-stats.json.fb8-backup` 才救回来。
    **验收脚本只允许「按标记精确剔除夹具条目」，不允许整字段置空。**
    复原基线用的是 `.user-settings.before-acceptance.json`（设置）与 `user-workspaces.json.userstate`（工作区）；
    设置不要原样回滚 —— `__schemaVersion` 和 `changelog.lastSeenVersion` 是随 3.1.2 正常推进的，
    回滚会触发重复迁移并再次弹出更新日志。
