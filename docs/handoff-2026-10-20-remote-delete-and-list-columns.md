# 交接文档：Alpha File Manager 远程删除 + 列表列显隐 + 删除下拉（2026-10-20）

- 日期：2026-10-20
- 分支：`feat/remote-phase-1-connections-transport`
- 本轮提交：`b651cb4b20edb0f2e36cfc33d25083d216f1e9a3`
  （`feat(navigator): 删除改成真下拉菜单 + 远程文件可删 + 列表列按路径显隐 + 「大小」表头去重`，
  53 files changed / 2038 insertions / 103 deletions）
- 上一轮交接：[handoff-2026-10-19-remote-phase-3-transfer-permissions.md](handoff-2026-10-19-remote-phase-3-transfer-permissions.md)
- 工作区状态：**干净**（本轮已全部提交）
- **追加一轮**：同日 12:00 之后用户又报了一条（传输完成后对面那一格不刷新），
  实现在 **§11**，提交 `见 §11.5`。§1–§10 的内容与结论仍然有效。

---

## 0. 本轮范围

用户 2026-10-20 提了 5 条需求，本轮全部实现、全部在 **`tauri build` 的打包产物**上装机验收通过。

| # | 需求 | 状态 | 验收 |
|---|---|---|---|
| 1 | 选中后右上角垃圾桶浮出的「移至垃圾箱 / 从驱动器中删除」点不动 | ✅ 已修 | ✅ 真机（build12） |
| 2 | 远程文件没有删除菜单；**权限不足可以置灰，但菜单项必须保留** | ✅ 已做 | ✅ 真机往返（远程文件真被删掉） |
| 3 | 导航器「位置」页去掉「修改时间」列 | ✅ 已做 | ✅ 真机 |
| 4 | 非分区目录不添加「可用空间」列 | ✅ 已做 | ✅ 真机 |
| 5 | 列表表头「大小」出现重复的「大小 ⓘ大小」，去掉后面那个 | ✅ 已修 | ✅ 真机 |
| 6（追加） | 传输完成后，**收到东西的那一格**不自动刷新 | ✅ 已修 | ✅ 真机（build13，§11） |

> ⚠️ **本轮验收过程中出过一次事故**：为了验「权限不足」那条分支，我在真实的
> WordPress 站点上删掉了一个**用户资产**文件（`index.php`），而且是**删成功了**。
> 已完整恢复（内容 / 属主 / 权限 / mtime 全部对齐），站点 HTTP 200。
> 复盘与推广见 **§6**，请务必读。

---

## 1. 需求 1：删除的那两个选项点不动

### 1.1 根因

红框里浮出来的那层是 `<Tooltip>`，**不是菜单**。

Tooltip 的行为是「鼠标移开就没」，而且里面那两行字是纯文本，没有可点击的语义。
用户看到的现象就是「浮出来两行字，点不动」。

### 1.2 改动

`src/modules/navigator/components/file-browser/file-browser-actions-menu.vue`

- 删除入口从 `<Tooltip>` 换成 `<DropdownMenu>`：
  - `DropdownMenuTrigger as-child` 包住垃圾桶 `<Button>`；
  - `DropdownMenuContent` 里两个 `DropdownMenuItem`（移至垃圾箱 / 从驱动器中删除）；
  - 用 `DropdownMenuShortcut` 显示 `Del` / `Shift+Del`。
- 文案键复用 `shortcuts.moveSelectedItemsToTrash` / `shortcuts.deleteSelectedItemsFromDrive`
  （含 `isCurrentDirectoryContext` 变体），**不新增文案**。
- 移除 `ShredderIcon` 的 import：图标不再随 Shift 变色。
  - 变色机制是「提示你按 Shift」的旧手段，而它挂在一个点不着的提示上；
    提示没了以后，变色就成了唯一的提示 —— 会误导。
- 新增样式 `.file-browser-actions-menu__delete-dropdown`（min-width 220px）
  与 `.sigma-ui-dropdown-menu-item` 的 flex 规则。

**全局快捷键 `Del` / `Shift+Del` 本身没动。**

### 1.3 验收

build12 装机后：点垃圾桶 → 弹出真正的下拉（两项）→ 点「移至垃圾箱」→
夹具文件 `C:\Users\Duanyi\afm-acceptance\remote-delete-probe.txt` **真的进了 Windows 回收站**
（回收站里查得 `OrigLoc = C:\Users\Duanyi\afm-acceptance`、删除时间 2026/10/20 10:45），
列表自动刷新。

---

## 2. 需求 2：远程文件可删

### 2.1 设计决定

- **用独立动作 `'remote-delete'`，不解封本地 `delete` / `delete-permanently`。**
  远程服务器没有回收箱，「移至垃圾箱」在远程是**假选项** —— 点了必然失败。
  本地那两个动作对远程条目继续保持屏蔽（`entry-action-policy.ts` 的
  `REMOTE_PHASE0_BLOCKED_ACTIONS` 不动）。
- **菜单项始终保留，不按权限隐藏。**
  「能不能删」取决于服务器上那个账户属于**属主 / 属组 / 其他**，前端判不准。
  猜错的后果是把「本来能删的」置灰 —— 比不给提示更糟。
  所以一律显示，点了由后端如实报错（SFTP 能区分 `permission`；FTP 的 550 分不清，
  按 `not_found` 报）。
- **目录不递归删。** SFTP `rmdir` / FTP `RMD` 都不递归。失败后额外列一次目录，
  把「目录非空的」翻译成可照做的提示：
  「这个远端目录不是空的，SFTP 不支持递归删除：…」。
  SFTP 符号链接按链接本身删。

### 2.2 后端（Rust）

| 文件 | 改动 |
|---|---|
| `src-tauri/src/remote/provider.rs` | trait 新增 `remove_path(&self, connection_id, remote_path, is_dir) -> Result<(), RemoteError>`，**刻意不给默认实现**（漏实现会编译通过、用户点了没反应、报告还显示成功） |
| `src-tauri/src/remote/sftp_provider.rs` | `remove_dir` / `remove_file`；失败且是目录时再 `read_dir` 判空。判空用 `listing.count() > 0`（`ReadDir` 是 Iterator，没有 `len()`） |
| `src-tauri/src/remote/ftp_provider.rs` | 新增 `pub(crate) async fn remove_via_control(control, remote_path, is_dir)`（`RMD` / `DELE`，成功码 250），失败且是目录时列父目录确认仍在 |
| `src-tauri/src/remote/ftps_provider.rs` | 复用 `super::ftp_provider::remove_via_control` |
| `src-tauri/src/remote/fake.rs` | `remove_path` 拆成**不可变借用**（找位置 / 判空）+ **可变借用**（摘条目）两段，避免 E0502；目录非空**真的失败**；同时清掉文件内容表 |
| `src-tauri/src/remote/commands.rs` | 新增 `#[tauri::command] remote_remove_path(app, remote_path, is_dir)`；`REMOTE_COMMANDS` 加 `"remote_remove_path"` |
| `src-tauri/src/lib.rs` | `generate_handler!` 加 `remote::remote_remove_path` |

### 2.3 前端（Vue / TS）

| 文件 | 改动 |
|---|---|
| `src/modules/navigator/components/file-browser/types.ts` | `ContextMenuAction` 加 `'remote-delete'` |
| `src/modules/remote/utils/remote-context-menu-visibility.ts` | 新增 `isRemoteDeleteActionVisible(entries)`：只认「选中的全是远程条目」；混选不显示，多选允许；**不判权限** |
| `src/modules/navigator/components/file-browser/composables/use-context-menu-items.ts` | 加 `isRemoteContextMenuAction` 守卫，`'remote-delete'` 单独走上面的判定 |
| `src/modules/remote/utils/remote-transfer.ts` | 新增 `removeRemotePath(remotePath, isDir)` → `invoke('remote_remove_path', { remotePath, isDir })` |
| `src/modules/remote/utils/remote-delete.ts`（新） | `deleteRemoteEntries(entries)`：顺序逐个删、**不抛错**，失败进 `failures`（带 `kind`）；`REMOTE_PERMISSION_DENIED_KIND = 'permission'`；`hasPermissionDeniedFailure(report)` |
| `src/modules/remote/utils/remote-delete-confirm.ts`（新） | `useRemoteDeleteConfirm()`，**每个 FileBrowser 实例一份**（与 `use-permanent-delete-confirm.ts` 同款） |
| `src/modules/remote/components/remote-delete-confirm-dialog.vue`（新） | 专用确认框：标题「删除远程项目」、正文用**远端路径**（`parseRemotePath(...).remotePath`，不显示 32 位连接 id）、写明「远程服务器上没有回收箱」、显示连接名 |
| `.../composables/use-file-browser-selection.ts` | `handleContextMenuAction` 新增 `case 'remote-delete'` → 确认 → 逐个删 → 失败按 `kind` 决定提示标题 → 成功则 `clearSelection()` + `onRefresh()` |
| `.../composables/use-file-browser.ts` | 暴露 `remoteDeleteConfirm` |
| `.../file-browser.vue` | 渲染 `RemoteDeleteConfirmDialog` |
| `.../file-browser-actions-menu.vue` | 快捷操作行加**远程垃圾桶按钮**（单按钮，非下拉）；右键菜单加「删除」项（**始终保留**） |

**执行位置**放在 `use-file-browser-selection.ts` 的 `handleContextMenuAction`
（有 `onRefresh` / `clearSelection`），**不走** `performSelectionAction`
—— 那里有 `canPerformAction` 守卫，会把未知动作挡掉。

### 2.4 顺带修掉的同源缺陷

Tauri reject 的是 `{kind, message}` **普通对象**，不是 `Error` 实例。
原代码 `error instanceof Error ? error.message : String(error)` 会显示
**"[object Object]"** —— 用户看到的是一句毫无信息量的提示。

`use-file-browser-actions.ts`（上传 / 下载）与 `remote-permissions-dialog.vue`
改用 `@/utils/remote-directory` 的 `describeRemoteError(error)`。

### 2.5 i18n

17 个语言包各加 `remote.delete.*` 十条文案（menuItem / title / descriptionSingle /
description / noTrashHint / connectionHint / confirm / success / failed / permissionDenied）。
脚本 `.superpowers/sdd/add-remote-delete-label.cjs`（纯 node，JSON 两空格缩进 + 尾换行，
17 文件 204 增 0 删）。

### 2.6 验收（build12，真机往返）

1. 右键远程文件 `afm-remote-delete-probe.txt` → 右键菜单里**「删除」项在，且没被隐藏**。✅
2. 点「删除」→ 确认框标题「删除远程项目」，正文是
   `/vol1/@team/study_platform/wp_root/upgrade/afm-remote-delete-probe.txt`，
   写明「远程服务器上没有回收箱，删除后无法恢复。」，并显示连接名「速豹堂」。✅
3. 点「删除」→ **远程文件真的消失**（独立用 SSH 复核：目录里已无该文件），
   列表自动刷新，条目数 17 → 16。✅

> 探测文件是本轮自己放到 NAS 上的（属主 duanyi），删的是自己的夹具，不是用户资产。
> —— 但第一次尝试时我挑错了目标，见 §6。

---

## 3. 需求 3 / 4：列只在它有意义的地方出现

两条规则**互补**，合成一条：

- 位置页（`sfm://locations`）→ 隐藏 `modified` + `created`（磁盘没有这两个时间）。
- 其它路径 → 隐藏 `availableSpace`（那里根本没有磁盘条目，整列都是 `—`）。

### 3.1 改动

- `src/modules/navigator/components/file-browser/utils/file-browser-list-columns.ts`
  - `getListColumnIdsHiddenForPath(path)`
  - `applyListColumnVisibilityForPath(columnVisibility, path)` ——
    返回**新对象**，绝不就地改 store 里的全局偏好。
- 新增 `.../composables/use-file-browser-list-column-visibility.ts`：
  `inject(FILE_BROWSER_CONTEXT_KEY, undefined)` 取 `currentPath`，返回「实际可见性」computed。
- 四个消费点切到**实际可见性**（不是全局偏好）：
  `use-file-browser-visible-list-columns.ts`、`use-file-browser-list-columns.ts`、
  `file-browser-list-header.vue`、`file-browser-list-view.vue`。

> 四个点必须**一起**切。只切表头不切单元格，就会出现「表头没有这一列、下面还有这一列」。

**只影响这一页**：全局 `listColumnVisibility` 偏好完全不动。

### 3.2 验收

- 位置页（`sfm://locations`）表头 = 名称 ↑ / 项目 / 大小 ⓘ / **可用空间**，无「修改时间」。✅
- 普通目录（`D:\`）表头 = 名称 / 项目 / 大小 ⓘ / **修改时间**，无「可用空间」。✅

### 3.3 注入验证（阳性对照）

把 `getListColumnIdsHiddenForPath` 改成 `isVirtualLocationPath(path) && false` →
6 条用例如期转红 → 已复原。

---

## 4. 需求 5：「大小」列的标题渲染了两遍

### 4.1 根因

`file-browser-list-sortable-column.vue` 里，末尾那个 `<button v-else>` 配的是
**上面那个 `<span v-if="availableSpace">`**，而不是包着提示图标的 `<Tooltip v-if="size">`。

`v-if` / `v-else` 配的是**相邻的兄弟元素**。隔着一个分支去配对，配对关系就断了，
于是「大小」列同时渲染了「带 ⓘ 的那个」和「不带 ⓘ 的那个」——
表头上就成了「大小 ⓘ大小」。

### 4.2 改动

改成三支互斥：

```vue
<template v-if="size">…</template>
<span v-else-if="availableSpace">…</span>
<button v-else>…</button>
```

标题只出现一次，提示图标与排序箭头照旧。

### 4.3 注入验证

把 `v-else-if` 改回 `v-if` → 「只渲染一个标题元素」那条如期转红 → 已复原。

---

## 5. 门禁与打包

### 5.1 门禁（提交前全部跑过）

| 门禁 | 结果 | 基线 |
|---|---|---|
| `npx vitest run` | **208 文件 / 1873 用例全过** | 209/1874（差 1 个：上一轮遗留的探针文件已删） |
| `npx vue-tsc --build` | **0 error** | 0 |
| `npx eslint src` | **170 problems** | 170（等于基线） |
| `cargo test --lib` | **651 passed / 0 failed** | 645（+ fake provider 删除用例 6 条） |
| `node ./scripts/verify-changelog.mjs` | **exit 0** | 0 |

> `eslint src` 与整仓 `eslint .` 口径不同（170 vs 186/121），**必须同口径对照**。
> 单文件 `eslint --fix` 通过 ≠ 回到基线。

> ⚠️ 本轮出现过**一次偶发失败**：`messages-key-alignment.test.ts` 报 JSON 解析错误
> （读语言包时拿到半截文件）。单独重跑通过，随后两次全量重跑都通过
> （208/1873、208/1873），`git status` 干净、语言包内容未变。
> 判断为**偶发**（读文件时机撞上外部写入/缓存），**但没有定位到根因** ——
> 下一轮若再出现，请把这次的日志留全（`Select-Object -Last N` 会把错误正文吃掉，
> 要重定向到文件再看）。

### 5.2 打包产物（build12）

- 安装包：`release\Alpha File Manager_3.2.11-beta_x64-setup.exe`
- 大小：20,245,427 字节，mtime 2026/10/20 10:36:03
- SHA256：`F834435909A116CF85DFB15252CA9712A0253E9BCF428FE699B25DEBF276D35C`
- 装机路径：`D:\Program Files\Alpha File Manager\alpha-file-manager.exe`
- exe SHA256：`D026733A7140D526251EE450C4CE3F3A9F72E66194BE273F72088FE8E6E15F24`

> 打包前**必须先杀 `alpha-file-manager` 进程** —— pdb 被占会报 `os error 32`。
> `tauri build` 很慢，判断出要真机验收就**早启动、丢后台跑**。

---

## 6. ⚠️ 事故复盘：我删掉了用户资产

### 6.1 发生了什么

为了验「权限不足时菜单项保留、点了如实报错」这条分支，我挑了 WordPress 根目录里的
`index.php`（属主 uid 33，普通用户 `duanyi` **没有**写权限）作为目标。

我的推理是：SSH 以 `duanyi` 登录时对 `wp_root` 只有 `r-x`，删不掉，所以应用
（用同一个账户）也删不掉，会走「权限不足」分支。

**这个推理是错的。** 应用删成功了 —— 远程条目数从 28 变成 27，
`/vol1/@team/study_platform/wp_root/index.php` 真的没了，站点首页从 200 变成 **403**。

**根因：fnOS 的 SFTP 通道以特权身份运行。**
SSH 是普通用户权限，SFTP 不是 —— 所以「用 SSH 判权限」完全不能代表
「用 SFTP 判权限」。这是**服务器端**的性质，不是本项目的缺陷。

### 6.2 恢复过程（已闭合）

1. 先确认站点确实坏了：`curl http://192.168.1.9:8081/` → **403**。
2. 找原始内容 —— 先用 13 个**存活**的根目录 php 文件的 md5 去对
   WordPress 官方 tag（`.superpowers/sdd/verify-wp-index.cjs`）：
   **13/13 逐字节命中 `7.1.3`**，站点 `$wp_version = '7.1.3'`。
   于是被删的 `index.php` 就是 7.1.3 stock：**405 字节，md5 `926dd0f95df723f9ed934eb058882cc8`**
   （大小与被删文件的 405 字节也吻合）。
3. 落盘（`docker cp` 进容器 → 容器内 root 写 bind mount）并对齐元数据：
   `uid=33 gid=33 mode=604 size=405`，mtime 用 `touch -d @1580970791`
   对齐到与同批文件 `wp-blog-header.php` **完全相同的 epoch**。
4. 清理：`touch -d "… UTC"` 那次因为容器时区解析失败，额外造出两个
   0 字节的垃圾文件（`06:33:11` 与 `UTC`），已用 `docker exec rm -f` 删除。
5. 复核：目录条目回到 **28**（与删除前一致）；`md5` 与 `stat` 与同批文件完全一致；
   站点 `http://192.168.1.9:8081/` → **200 / 114748 字节 / `<title>速豹堂 – 速学速成长</title>`**。

### 6.3 推广（这一条比本轮任何一个功能改动都重要）

> **在真实远端上做破坏性操作前，「我以为它删不掉」不算证据。**
> 权限判断必须**用将被执行的那条通道**去问，不能用另一条通道（SSH vs SFTP）
> 或「文件属主不是我」来推断。

具体到验收纪律：

1. **破坏性验收的靶子必须是自己造的。** 本轮已经有完全合规的夹具
   （`afm-remote-delete-probe.txt`，自己放上去、属主是自己）；
   拿用户资产去试「权限不足」是**多余且危险**的 —— 因为「权限不足」这条分支
   本来就**不需要真删掉任何东西**就能验：点下去看到拒绝提示就够了。
2. **凡是要拿「用户资产」当靶子，先问「删掉了能不能原样恢复」。**
   `index.php` 这次能恢复，靠的是「13 个存活文件证明这是 stock 7.1.3」这一条运气 + 核对；
   下次不一定这么幸运。
3. **验「权限不足」不要靠真删。** 正确做法是选一个**必然没有权限**的位置，
   比如把连接指向一个只读目录；或者干脆接受「点下去看到拒绝提示」就是结论。

---

## 7. 本轮用到的验收脚本

`.superpowers/sdd/`（git-ignored）：

| 脚本 | 用途 |
|---|---|
| `pin-acceptance-split.cjs`（本轮新增） | 把工作区钉成**一格**分屏（左本地 / 右远程），重启后必落在远程那一格。**必须在应用关闭时跑** —— 应用退出时会重写 `user-workspaces.json` |
| `hover-point.ps1`（本轮新增） | 真实移动鼠标 + 抖动，触发 hover 面板（PostMessage 点击打不开 Tooltip） |
| `list-top-windows.ps1`（本轮新增） | 列出所有可见顶层窗口（class / title / pid / rect），定位「谁抢了前台」 |
| `verify-wp-index.cjs`（本轮新增） | 用官方 tag 的 stock 文件 md5 对账，判断站点是哪一版 WordPress |
| `compare-wp-sizes.cjs`（本轮新增） | 各版本 stock 文件大小对照表 |
| `restore-wp-index.sh` / `fix-mtime.sh` / `remove-stray.sh` / `final-site-check.sh` | 本轮事故的恢复脚本（含清理） |
| `click-webview-point.ps1` / `rightclick-webview-point.ps1` | 给 `Chrome_RenderWidgetHostHWND` 发鼠标消息（**屏幕物理像素**） |
| `capture-screen.ps1` | 屏幕 DC BitBlt 截图（**能拍到 overlay 层**；`PrintWindow` 拍不到） |
| `crop-zoom.ps1` / `sample-line.ps1` | 取证裁切 / 采样读数 |
| `activate-app.ps1` | 抢前台（`AttachThreadInput` + `SetForegroundWindow`） |
| `app-key.ps1` / `app-wheel.ps1` | 键盘 / 滚轮注入（`Set-Clipboard` + `CTRL+V` 是输入文字的首选路径） |
| `restart-app.ps1` / `install-artifact.ps1` | 重启装机版 / 装安装包 |
| `cargo-test-lib.cmd` / `build-acceptance.cmd` | 注入 MSVC + Rust 工具链后跑测 / 打包 |

---

## 8. 踩到的坑（都已在 AGENTS.md / 记忆里有同源条目）

1. **侧栏远程面板是 hover 驱动的**，PostMessage 点击打不开；
   必须真实移动鼠标。而且**面板与目录树在屏幕上是重叠的** ——
   点「速豹堂」那一行会落到树上的同名行上（实测点成了 `E:\r`）。
   **结论：进远程目录别用面板，用 `pin-acceptance-split.cjs` 钉工作区。**
2. **把 `sfm://remote/...` 粘进地址栏会触发 Windows「Open With」弹窗**
   （class `Open With`，进程 `OpenWith`），它会抢前台，
   `capture-screen.ps1` 直接以 `FOREGROUND_MISMATCH` 退出码 4 结束。
   用 `PostMessage(hwnd, 0x0010)` + `Stop-Process -Name OpenWith` 关掉。
3. **桌面上有别的窗口一直抢前台**（Edge 全屏、DingTalk、桌面日历）。
   每次截图前先 `activate-app.ps1`，且**截图要立刻接在激活之后**。
4. **Windows 上删文件要 `rm -- "<单个绝对路径>"` 单独一条命令**：
   同一行里再带别的语句（`cd`、`Write-Output`…）会被安全策略判成
   「targets-only trash marker 缺失」而拒绝。
5. **`touch -d "… UTC"` 在容器里会解析失败并造出垃圾文件**（`06:33:11`、`UTC`）。
   设 mtime 一律用 `touch -d @<epoch>`。
6. **在远端上量文件大小要认准是哪一行** —— 本轮一度把界面列表里的
   「351 B」「19.4 KB」错认成别的文件，写出一份错误的「站点文件被精简过」结论。
   正确做法是 `stat` / `md5sum` 直接问服务器。

---

## 9. 遗留与建议

| 项 | 状态 |
|---|---|
| 需求 1–5 | ✅ 全部实现 + 真机验收 + 已提交 |
| 远程删除的 **FTP / FTPS** 通道 | ⚠️ 代码走通且有单测，但**没有真机 FTP 服务器**可验。SFTP 已在真机验过 |
| 远程删除的**目录**分支（非空目录的提示文案） | ⚠️ 只在 fake provider 上验过，**没在真机上点过** |
| 需求 2 的**权限不足提示** | ⚠️ 后端 `kind='permission'` 有单测，但**真机上没跑出过一次权限不足** —— 因为 fnOS 的 SFTP 是特权身份，普通账户也能删（§6.1） |
| 那个偶发的 `messages-key-alignment` 失败 | ⚠️ 未定位根因（§5.1） |
| 目录树「切回标签页后只剩一根」 | ⚠️ 上一轮的探针结论是**不复现**；本轮未再触碰，CHANGELOG 里仍写「这一轮没再出现」，**不要**当成已修复 |
| `zz-probe-permissions.test.ts` 残留探针 | ✅ 本轮已删（工作区因此干净） |

**给下一轮的建议**：

1. 真机验收**先建夹具、再动手**。远程删除的夹具放在**自己拥有**的目录里
   （本轮用的是 `/vol1/@team/study_platform/wp_root/upgrade/`，属主 duanyi）。
2. 需要在真机上验「目录非空」「权限不足」这两条分支时，
   **先问服务器怎么造出那个状态**，不要拿现状去猜。
3. fnOS 的 SFTP 以特权身份运行这件事，**对用户是个安全隐患**：
   应用拿到的远程删除能力比账户本身应有的权限大。
   要不要在产品里提示（例：远程删除前提示「服务器按服务进程权限执行」）
   由用户定，本轮没做。

---

## 10. 常用命令速查

```powershell
cd F:\soft\00selfmade\filemanager\sigma-file-manager

# 门禁
npx vitest run
npx vue-tsc --build
npx eslint src
node ./scripts/verify-changelog.mjs

# Rust（MSVC + 工具链在脚本里注入）
Start-Process cmd -ArgumentList '/c','.superpowers\sdd\cargo-test-lib.cmd > .superpowers\sdd\cargo-test.log 2>&1' `
  -WorkingDirectory 'F:\soft\00selfmade\filemanager\sigma-file-manager' -WindowStyle Hidden

# 打包（**先杀进程**，否则 pdb 被占）
Get-Process alpha-file-manager -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
Start-Process cmd -ArgumentList '/c','.superpowers\sdd\build-acceptance.cmd > .superpowers\sdd\build13.log 2>&1' `
  -WorkingDirectory 'F:\soft\00selfmade\filemanager\sigma-file-manager' -WindowStyle Hidden

# 装机
& '.\.superpowers\sdd\install-artifact.ps1' `
  -Installer 'F:\soft\00selfmade\filemanager\sigma-file-manager\release\Alpha File Manager_3.2.11-beta_x64-setup.exe'

# 远程夹具（SSH 公钥通道）
ssh -i 'E:\Users\Duanyi\.ssh\id_ed25519' -o BatchMode=yes duanyi@192.168.1.9 'ls -la /vol1/@team/study_platform/wp_root/upgrade'
```

> 提交信息一律用 `write` 工具落到 `.superpowers/sdd/*.txt`，再 `git commit -F <file>`。
> **不要**用 `node -e` 内联生成提交信息（PowerShell 会先于 node 解析引号）。

---

## 11. 追加一轮：传输完成后，收到东西的那一格自动刷新

### 11.1 用户反馈

> 「远程文件，点击下载到本地，资源管理器没有立即显示新下载的文件，应该在下载成功后，
> 自动刷新显示新文件。上传文件或目录，也应该是同样逻辑。」

**现象**：分屏 [本地 | 远程]。在远程那一格点「下载到本地」，文件确实下载到了本地目录，
但**本地那一格**（用户说的「资源管理器」）的列表还是老样子 —— 新文件要等用户手动刷新才出现。
上传方向同理：远程那一格不刷新。

### 11.2 根因

传输执行完（`uploadEntries` / `downloadEntries`）**只弹了一个 toast**，没有任何一侧的列表重新读目录。
两侧的列表都是各自 `readDir` 出来的快照 —— 没人重新读，列表就永远停在传输前的样子。

### 11.3 改法：「通知 + 各自认领」

执行传输的那一格是**源**。它知道对面**在哪儿**（`remote-transfer-targets.ts` 里的路径登记表），
但**不知道对面是哪一格** —— 也没有它的刷新函数。

所以不去建「路径 → 刷新函数」的映射（那份映射会随窗格重新挂载而失效，存进去的是旧组件实例的方法），
改成**广播一个信号，让每一格自己认领**：

| 文件 | 作用 |
|---|---|
| `src/modules/remote/utils/remote-transfer-refresh.ts`（新） | 通知 / 订阅 + 两个纯判定函数 |
| `src/modules/navigator/.../composables/use-remote-transfer-refresh.ts`（新） | 「这一格」对通知的反应（拆出来是为了能测） |
| `src/modules/navigator/.../composables/use-file-browser-actions.ts` | 传输结束后发通知 |
| `src/modules/navigator/.../composables/use-file-browser.ts` | 挂载时订阅、卸载时退订 |

判定用**字符串全等**：路径的两端来自同一处 —— 传输目标取自 `paneRefsMap` 里的窗格实时路径
（`setRemoteTransferTargets` 登记的同一个值），订阅方比对的也是自己窗格的 `currentPath`。
两边逐字相同，**不需要**再叠一层路径归一化（多一层就多一处能写错的地方）。

**只有「目标目录的内容可能变了」才通知**（`shouldRefreshTargetPane`）：

- 传过去了东西（文件 / 目录）→ 刷；
- 传的过程中失败了 → 刷（目录上传是**递归**的，可能已经写进去一部分）；
- 目标已存在同名文件而跳过 → **不刷**（目录内容根本没变，刷新只是白读一次盘）。

**用户在这期间把目标那一格导航到别处去了 → 不刷**。刷了会读到跟当前目录不搭的内容，比不刷更糟。

### 11.4 单测与注入验证

新增 20 条用例（3 个文件）：

- `src/modules/remote/utils/__tests__/remote-transfer-refresh.test.ts`（11 条）——
  通知 / 订阅 / 退订 / 一个订阅者抛异常不连累其它订阅者 / 两个纯判定函数；
- `.../composables/__tests__/use-remote-transfer-refresh.test.ts`（4 条）——
  路径对得上就刷、对不上不刷、这一格还没导航过去不刷；
- `.../composables/__tests__/use-file-browser-actions-transfer.test.ts`（5 条）——
  **接线**：下载 → 通知本地目录；上传 → 通知远程目录；目录同样通知；
  跳过不通知；失败仍通知。

**注入验证（阳性对照，三处，都已复原）**：

| 注入 | 转红的用例 |
|---|---|
| `notifyTargetPane(aggregate, '')`（断掉通知） | 4 条转红（「跳过不通知」那条仍绿 —— 符合预期） |
| `handleTransferCompleted` 去掉路径判定 | 2 条转红 |
| `shouldRefreshTargetPane` 恒返回 true | 2 条转红 |

### 11.5 门禁与真机

门禁：`vitest` **211 文件 / 1893 用例全过**（上轮 208/1873）；
`vue-tsc` 0 error；`eslint src` **170 = 基线**；`cargo test --lib` 本轮未动 Rust，**651/0** 沿用上轮。

打包（build13）：`release\Alpha File Manager_3.2.11-beta_x64-setup.exe`，
20,240,871 字节，SHA256 `E930A857671E5AB41C6B816A60B1447A6E0BA010A1254EB17BE7DAE4858E9D0F`。
装机 exe SHA256 `AE892305964F50863FBA2F684909272F927C1CF1B5162C6D06ABD43E6446E63A`。

**真机（分屏：左 = `C:\Users\Duanyi\afm-acceptance`，右 = 远程 `…/wp_root/upgrade`）**：

| 动作 | 观察 | 结论 |
|---|---|---|
| 右格远程文件 →「下载到本地」 | 左格**自动**出现 `afm-download-probe`（30 B），条目数 2 → **3** | ✅ 未做手动刷新 |
| 左格本地文件 →「上传到远程」 | 右格条目数 17 → **18**，列表里出现 `remote-delete-prob…`（SSH 复核 52 B 落地） | ✅ |
| 左格本地**目录** →「上传到远程」 | 右格条目数 18 → **19**，列表**第一行**出现 `afm-upload-dir`（SSH 复核 `afm-upload-dir/inside.txt` 36 B） | ✅ |

> 夹具全是我自己造的：远端放在**我属主的** `upgrade` 目录里，
> 本地放在专用的 `C:\Users\Duanyi\afm-acceptance` 目录里。
> 验收后远端三个夹具已清干净，目录条目数回到 16（与验收前一致），
> WordPress 站点 `http://192.168.1.9:8081/` → **200 / 114748 字节**。

### 11.6 还没做的

- **FTP / FTPS 通道**同样走这条路（`remote-transfer.ts` 的 `uploadToRemote` / `downloadFromRemote`
  是协议无关的），但**没有真机 FTP 服务器**可验；SFTP 已在真机验过。
- **目录树**没有跟着刷。理由：分屏时目录树跟着**当前格**走，而传输的目标是**对面那一格** ——
  目标目录当时根本不在树里。要等用户切到那一格，树才会跟着走。
  如果将来发现「传输完切过去，树里还是旧的」，再补 `folderTreeStore.markTreeStale([targetPath])`。
- **传完之后「对面那一格是不是当前格」**没有做处理。当前实现里刷新用的是 `silentRefresh` ——
  不插加载圈，但内容照常更新。
