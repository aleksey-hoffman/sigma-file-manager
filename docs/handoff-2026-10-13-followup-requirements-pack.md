# 交接文档 — Alpha File Manager 后续需求包

- **交接时间**：2026-10-13
- **项目根目录**：`F:\soft\00selfmade\filemanager\sigma-file-manager`
- **当前分支**：`docs/navigator-behavior-parity-spec`
- **HEAD**：`087aecd9 feat(settings): 换用用户指定的软件简介文案`
- **工作区状态**：干净，仅有未跟踪的 `_acceptance/`（验收辅助脚本）与 `_notes.md`
- **远端**：`origin` = `https://github.com/kizemo/alpha-file-manager`，
  `upstream` = `https://github.com/aleksey-hoffman/sigma-file-manager`
- **开发计划全文**：`docs/superpowers/plans/2026-10-13-followup-requirements-pack.md`

---

## 1. 项目是什么

Alpha File Manager 是上游开源项目 Sigma File Manager（作者 Aleksey Hoffman）的二次开发版，
定位是 Windows 桌面文件管理器。品牌名、图标已锁定，不要重新讨论。

新增能力集中在三块：

1. **目录树** —— 左侧树形导航 + 树节点右键菜单
2. **快速切换（文件对话框路径焦点同步）** —— 在 Alpha 里切换目录时，
   外部程序（浏览器、下载器等）已打开的文件对话框自动跟随到同一路径。
   实现在 `extensions/kizemo.focus-sync/`（扩展 JS + Rust sidecar 二进制，
   以计划任务 `KizemoFocusSync` 常驻，监听端口 37421）
3. **批量重命名** —— 多选后统一改名

---

## 2. 本轮之前的进展（已完成，未发布）

### 2.1 修了两个只会在真机上暴露的问题

| 提交 | 内容 |
|---|---|
| `16461d6b` | `file-tree-context-menu.vue:84,89` 的 `clipboardStore.setClipboard()` 第三参误传字符串，触发 TS2559 构建门禁失败。改为省略第三参，与 `use-dir-entry-actions.ts` 的 `copyItems`/`cutItems` 行为对齐 |
| `fb0ca4d1` | 真机上目录树右键菜单「剪切」显示字面量 `fileBrowser.actions.cut` —— **17 个语言包一致地缺这道键**。根因：原 `messages-key-alignment.test.ts` 只比各语言包之间的 key 集合，不检查代码引用了哪些键，17 个一致地缺反而判「通过」。已补齐 17 个包，并新增 `src/localization/__tests__/messages-used-keys-exist.test.ts` 扫源码 `t('...')` 字面量逐个对 `en.json` 校验 |

> 关键影响认定：`b617b270`、`41a1b87d` 两轮改动**从未进入过任何安装包**。

### 2.2 打包与安装（两轮，均未发布）

最终产物：

- `src-tauri\target\release\bundle\nsis\Alpha File Manager_3.0.3_x64-setup.exe`
- 18,090,689 字节
- SHA256 `b37221e0d016bb4b30e0f7fd5bb7906a6c7c4c1017b5253f9f07b01c8d787ee5`

站点暂存区（`E:\办公文件\L1网站\alpha-file-manager\`）四处 SHA256 一致：
build 产物 / repo `release/` / 站点 exe / `version.json` 的 `sha256` 字段。
**未上传、未 push。**

已安装版本 3.0.3，装在 `D:\Program Files\Alpha File Manager`。
用户数据在 `%APPDATA%\com.sigma-file-manager.app\user-data\`。

### 2.3 真机验收 12 项全部通过

主页标题不再重叠、点主题图打开背景管理器、`sfm://locations/` 按盘符排序、
磁盘只显示空余空间、设置页文案去重、官网链接、缩略图 4 档含 54px、
工具栏布局、目录树右键菜单 6 项、「剪切」实际生效、覆盖安装、用户数据保留。

### 2.4 已排除的三个假象（别再当成 bug 查）

1. **已安装 exe 与构建产物 SHA 差 3 字节** —— `__TAURI_BUNDLE_TYPE_VAR_UNK__`
   vs `__TAURI_BUNDLE_TYPE_VAR_NSS__`。Tauri bundler 打进 NSIS 时的预期标记改写，
   `target\release` 保持未标记态。已安装的才是正确产物。
2. **`user-extensions.json` 体积从 73KB 涨到 330KB** —— 安装器 STAGE 6 调
   `tools\register.ps1`，用 PowerShell `ConvertTo-Json -Depth 100` 重写。
   `register.ps1:294-298` 明确写了这是预期的。内容逐项相同，无重复键。
3. **主页第 6 张磁盘卡「被裁切」** —— 截图脚本没声明 DPI 感知，窗口按 150% 虚拟化后位图缺了右半边。
   `drives-section__grid` 是 `repeat(auto-fill, minmax(280px, 1fr))`，正常换行。

---

## 3. 本轮已完成的改动

### 3.1 需求 5：设置页简介文案（commit `087aecd9`）

按用户给定文案重写，新增 `app.developer` 键承载「开发：段燚」。

- 17 个语言包定点替换 `app.description` / `app.copyright`，新增 `app.developer`。
  用定点文本插入而非整份 JSON 重序列化，**每个包只动 5 行**
- 非中文的 16 个包填英文：替换前 dump 过，这 16 个包的 app 文案本来就是英文原文
  （上游从未翻译），沿用既有惯例，不凭空引入机器翻译
- `header.vue` 删掉了去前缀正则 `.replace(/^"[^"]*"\s*/, '')` —— 新文案已不含引号前缀，
  该正则永不生效，连同其 FORK-MODIFICATION 注释一并移除
- 新增 `src/modules/settings/ui/__tests__/header.test.ts`：
  **直接读真实 `ch.json` 而非回显 key**，这样才能同时覆盖语言包的值和模板结构两端；
  含「品牌名只出现一次」断言，守住历史上真实出现过的重复渲染

门禁：`vue-tsc --build` exit 0；i18n 门禁 30/30；新增用例 5/5；
全量 1222/1224（余 2 例见第 6 节）。

---

## 4. 下一步要做什么

用户已确认全部范围决策，详见 `docs/superpowers/plans/2026-10-13-followup-requirements-pack.md`
第 0 节。按顺序：

| # | 需求 | 规模 | 关键风险 |
|---|---|---|---|
| 1 | 需求 5 追加：英文版开发者名改 `kizemo`、「——」改两个空格、加 GitHub 链接 | 30 min | 两个空格在 HTML 里会折叠，必须用 `&nbsp;&nbsp;` |
| 2 | 需求 1：磁盘卡片「空余空间 / 总空间」 | 15 min | 顺带修 `ch.json` 的 `freeOf` = `"自由于"` |
| 3 | 需求 4：递归目录内搜索 + 「打开所属目录」 | 4–6 h | **最大的一块**，需新增 Rust 命令 |
| 4 | 需求 3 A 档：补注册 shell 动词 | 2 h | 注册表改动，**必须回滚 + 真机验证** |
| 5 | 需求 2：「打开」对话框路径焦点同步 | 2–4 h | **先跑诊断实验再改**，别猜 |

### 两个需要拍板的点

1. **需求 3 的 `*\shell\open` 建议换掉**。该键覆盖所有文件系统对象，
   设了它双击任何文件都会走 Alpha 的打开流程，与「默认文件资源管理器」的目标不符。
   建议改成 `Directory\shell\open` + `Directory\shell\explore` +
   `Drive\shell\open` + `Drive\shell\explore`（Windows 自己就是这么写的，不含 `*`）。
2. **需求 4 的「打开所属目录」点击后是否选中该条目** —— 计划里暂定「选中」，待确认。

---

## 5. 几个必须知道的技术事实

### 5.1 sidecar 有运行时日志（上轮判断是错的）

```
%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log     （每日轮转）
```

依据 `extensions/kizemo.focus-sync/sidecar/src/logger.rs:56-62` 的 `log_dir()`，
`main.rs:69-85` 接到 `tracing_appender::rolling::daily`。
sidecar 的 console subsystem 是 `windows`，stdout 不可见，**所有诊断只能靠这个文件**。

2026-10-13 的日志有 771KB / 6190 行，事件 kind 频次：
`read_failed` 1570、`set_path_dialogs` 424、`path_update` 424、
`set_path_dialogs_retry` 312、`heartbeat` 237、`opened_write_back` 224、
`dialog_closed` 141、`set_path_deferred_not_foreground` 77、`set_path_dedup` 60、
`set_path_iter` 48。

其中 `set_path_dialogs` 的 `dialogs_count` 分布：0 → 312 次、1 → 88 次、≥2 → 23 次。

### 5.2 `global_search_query_paths` 不递归

`src-tauri/src/global_search/query.rs:337-357` 只做一层 `read_dir`。
递归遍历的项目里已有成熟写法在 `scan.rs:292-298`（`WalkDir` + `max_depth` +
`follow_links(false)` + `should_scan_walk_entry`），`walkdir = "2.5"` 已在
`Cargo.toml:49`。**但注意该命令目前被全局搜索当 priorityPaths 用**
（`src/stores/runtime/global-search.ts:394`），改递归必须加开关，否则静默改变现有语义。

### 5.3 默认文件管理器有两份独立实现

`src-tauri/src/default_file_manager.rs` 和
`src-tauri/default-file-manager-launcher/src/main.rs` 各自维护注册表写入。
**改键必须同步两处**，漏一处表现为「装了又被删回去」，极难定位。

`default-file-manager-common/src/lib.rs:16-20` 的 `ROOT_REGISTRY_KEYS: [&str; 3]`
同时驱动快照 / 恢复 / 撤销 —— 加键只需扩这个数组，清理代码自动覆盖。

### 5.4 三种搜索结果复用同一个 FileBrowser

`global-search-view.vue:564-575` 用 `:external-entries` + `:base-path` 复用
`FileBrowser` 组件。**但 external 模式没有导航能力** ——
`use-file-browser.ts:255-261` 的 `handlePathSubmit` / `openFile` 全是 no-op。
需求 4 的主要工作量就在打通这条链路。

### 5.5 本机环境

- DPI 150%，窗口物理尺寸 3862x2110（逻辑 2575x1407），截图脚本必须声明 DPI 感知
- wry 不透传 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`，CDP 连不上，
  **拿不到 webview console**。可用取证手段只有 `PrintWindow(hwnd, hdc, 2)` 截图、
  UIA 树枚举、坐标/Invoke 点击
- PowerShell 5.1：写含中文的 `.ps1` 必须带 UTF-8 **BOM**，
  改完用 `[System.Management.Automation.Language.Parser]::ParseFile` 做语法自检
- Node 20+：`spawnSync('npm.cmd', ...)` 在 Windows 上返回 EINVAL，
  解法是 `cmd.exe /d /c <shim> <args>`，**不要改 `shell:true`**（站点源路径含中文）

---

## 6. 已知既有缺陷（不在本轮范围）

- **全量测试 2 例并行超时**：`use-navigator-item-icon.test.ts`、
  `home-banner-click-opens-background-manager.test.ts`。把改动 stash 掉在干净 HEAD 上
  跑同一轮同样失败，失败数在 2–4 之间跳，单独跑都通过。与任何新改动无关。
- **长按置顶**：代码层无 favorite 触发路径，判定为 Windows 焦点/drag plugin 行为。
- **P1 启动崩溃**：调查已接受现状，不再处理。

---

## 7. 全局硬约束

- 品牌名固定 **Alpha File Manager**
- **不得修改**：mDNS 服务名、legacy 数据目录名、Tauri `identifier` `com.sigma-file-manager.app`
- 17 个语言包必须同步（**中文 locale code 是 `ch`，不是 `zh`**）
- **零新依赖**
- 版本号**固定 3.0.3**，不得升 3.0.4
- `tauri build` 前必须关闭所有 `alpha-file-manager.exe` 实例，否则文件锁失败
- **真机验收必须用 `tauri build` 打包产物**；`tauri dev` 会渲染空白路由页，不能用于验收
- Rust 工具链固定 1.90.0：
  `C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`
- **发布前不得运行** `npm run release:upload` / `npm run release:github`
- 用户可见文本、注释、文档一律简体中文（标识符、技术专有名词除外）
- 删除文件用可恢复方式：`rm -- "<target>"`（**必须正斜杠**，反斜杠会被 shim 吞掉）

构建命令：

```powershell
$env:PATH = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin;$env:PATH"
cmd.exe /d /c "npm run tauri:build"
```

---

## 8. 相关文档

| 文档 | 用途 |
|---|---|
| `AGENTS.md` | 项目硬约束（输出语言、保护常量、真机验收纪律） |
| `docs/superpowers/plans/2026-10-13-followup-requirements-pack.md` | **本轮开发计划全文，含逐文件改动点** |
| `docs/operations/release-workflow.md` | 发版流程 |
| `docs/operations/version-info.md` | 版本信息与更新渠道 |
| `_acceptance/shot.ps1` | PrintWindow 截图（已声明 DPI 感知） |
| `_acceptance/ui.ps1` | UIA 树枚举 / 点击 / 键值注入 |

`_acceptance/` 未被 git 跟踪，是本地验收工具，可自由增补。