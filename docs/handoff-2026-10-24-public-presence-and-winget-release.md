# 交接文档：GitHub 公开存在度 + winget 发布（2026-10-24 收官）

> **本文是自足的接续入口。** 新会话只读本文 + 第 9 节的「必须先读」清单，即可接手，
> 不需要回放历史对话。
> 三轮的完整过程记在 `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-github-presence.md`
> （第 1–9 节，本文**不重复**它的内容，只在需要溯源时去查）。

---

## 0. 一分钟版

| 问 | 答 |
|---|---|
| 项目是什么 | **Alpha File Manager（AFM）**，Windows + Linux 双栏文件管理器（Tauri 2 + Rust + Vue 3）。在 GitHub 上是上游 `aleksey-hoffman/sigma-file-manager` 的 **fork**（`kizemo/alpha-file-manager`），GPL-3.0-or-later |
| 这轮做了什么 | 仓库「门面」整套重做 + 3.5.1 发版 + winget 清单提交并通过上游 10 步校验 + HelloGitHub 自荐 + 3 个 awesome 榜单 PR + 表格门禁加固 |
| 现在卡在哪 | **只剩等外部的人**：winget 版主评审合并、3 个 awesome 维护者合并、安装包代码签名（需你自备证书） |
| 下一步 | 见第 5 节；**第一件事是查 winget PR 有没有被合并**（合并了就加 winget 徽章） |
| 最容易踩的坑 | ① 清单的 `ManifestType` 判重；② 表格的 GFM 判据；③ `webviewInstallMode` 让试装跑 35 分钟；④ PowerShell 的 `>` 写成 UTF-16；⑤ git 推送要看代理状态 |

---

## 1. 仓库与目录（全部为完整路径）

### 1.1 两个仓

| 仓 | 本地路径 | GitHub | 装什么 |
|---|---|---|---|
| 内层（产品代码） | `F:\soft\00selfmade\filemanager\sigma-file-manager` | `kizemo/alpha-file-manager`（fork of `aleksey-hoffman/sigma-file-manager`） | AFM 全部源码、测试、CI、文档 |
| 外层（约定） | `F:\soft\00selfmade\filemanager` | `kizemo/focus-sync` | `AGENTS.md`（项目硬约定，**每次改代码前必读**） |

外层仓里另有 3 个**未跟踪**目录，按约定一直未动：
`F:\soft\00selfmade\filemanager\docs\blog\`、
`F:\soft\00selfmade\filemanager\docs\marketing\`、
`F:\soft\00selfmade\filemanager\docs\SFM-EXTENSION-DEVELOPMENT-GUIDE.md`。

### 1.2 本工作流的关键文件

| 文件 | 说明 |
|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\README.md` | 英文主 README（16,889 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\README.zh-CN.md` | 中文 README（16,051 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\LICENSE.md` | GPL-3.0 **规范原文**（35,149 B）—— 换成原文后 GitHub 侧栏才从 `NOASSERTION` 变可识别 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\NOTICE.md` | 自写摘要 + 版权声明（1,241 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\screenshots\afm-main-window.png` | 主门面图（2,328,080 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\screenshots\afm-social-preview.png` | 1280×640 社交预览横幅（461,038 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\.github\media\alpha-file-manager-logo.png` | `α` 图标（41,379 B） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\winget\README.md` | **winget 清单规则**（目录结构、ManifestType 规则、CLA 流程、校验状态判读） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\winget\manifests\k\kizemo\AlphaFileManager\3.5.1\` | 清单原文 4 个文件（与 PR 上的**逐字节一致**） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\.github\workflows\winget.yml` | 自动发布 winget 的工作流（**仍缺 `WINGET_TOKEN` secret**） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\utils\__tests__\readme-markdown-table.test.ts` | 表格门禁（77 例，覆盖根 README + `docs/**/*.md`） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\localization\messages\*.json` | 17 个语言包（中文是 **`ch.json`**，不是 `zh`） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\audit-upstream-port.mjs` | upstream 逐行命中率审计（判「是否已移植」用这个，**不是 `git cherry`**） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\sync-i18n.js` | 同步 17 个语言包（**它会把文件末尾换行写掉**，见第 7 节） |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\tauri.conf.json` | `bundle.publisher: "kizemo"`、`installMode: "perMachine"`、**没有 `webviewInstallMode`** |

一次性脚本都在 `F:\soft\00selfmade\filemanager\sigma-file-manager\.superpowers\sdd\`（gitignored，150+ 个 `.cjs`/`.ps1`）。
本工作流可复用的：
`dump-validation-any.cjs`（查 winget 校验）、`watch-pr.cjs`（盯 PR）、`push-winget-locale-fix.cjs`（往 fork 推清单）、
`sync-winget-stage.cjs`（清单自检）、`scan-md-tables.cjs`、`show-broken-tables.cjs`。

---

## 2. 不可改的约束（跨会话有效）

- 品牌名统一 **Alpha File Manager**，命名与图标已锁定，不要重新讨论。
- **受保护常量不得改**：mDNS 服务名、legacy 数据目录名、Tauri `identifier`（`com.sigma-file-manager.app`）。
- `bundle.publisher` 必须显式写 `kizemo` —— Tauri v2 默认取 identifier 第二段（`sigma-file-manager`），
  对不上 ARP 发布者，包管理器就不认领、升级不接管。
- 面向用户的输出一律**简体中文**；代码标识符 / 路径 / 命令保持原样。
- 真机验收只能用 `tauri build` 产物，`tauri dev` 的界面验收结论一律作废。

---

## 3. 本轮完成情况

### 3.1 仓库门面

- README 双语重写（47.8 KB / 37.6 KB → 16.8 KB / 16.0 KB），含 Features、下载矩阵、社区与 Star 引导。
- `description` 改成**英文在前 + 中文在后**；`topics` 从 10 补到 **20**（GitHub 上限）。
- 许可证可识别（`GPL-3.0`），`package.json` 补了 `"license": "GPL-3.0-or-later"`。
- 修掉 `.github/workflows/winget.yml` 的两个真 bug：包 ID 误用上游的 `AlekseyHoffman.SigmaFileManager`
  （一旦配 token 会**覆盖上游的包**）、资产正则 `-windows-setup\.exe$` 匹配不上我们的 `..._x64-setup.exe`。
- ⚠️ 该工作流**历史运行次数为 0**（仓库里没有 `WINGET_TOKEN`）⇒ winget 上从未出现过 AFM。

### 3.2 3.5.1 发版

- `bundle.publisher` 改成 `kizemo`、版本 3.5.0 → 3.5.1、CHANGELOG 补条目（`verify-changelog` 是门禁）。
- 产物 `Alpha_File_Manager_3.5.1_x64-setup.exe`，**20,570,585 B**，
  SHA-256 `8606AD3DF0DF6747C7403BB01C0014F1915CF050CCB9FB7FE8575B7D736A3BE9`。
- `v3.5.1` 已是 **Latest** release。安装包**未代码签名**（`NotSigned`）。

### 3.3 winget（主线）

- PR：https://github.com/microsoft/winget-pkgs/pull/460744
  —— **state=open，head `5c75afac`，2 commits / 4 files**，标签
  `Azure-Pipeline-Passed` + `Validation-Completed` + `New-Package`。
- **上游 10 步校验全部 success**（`OperationId: WinGetSvc-Validation-460744-2`）：
  01 PR / 02 Manifest / 03 URLs / 04 URL Domain / 05 Policy / 06 Catalog Content（含哈希核验）/
  07 Installers Scan（Defender）/ **08 Installation Validation（沙箱试装）** / 09 Installer Metadata / 10 Completed。
- 路径：`manifests/k/kizemo/AlphaFileManager/3.5.1/`，4 个文件
  `kizemo.AlphaFileManager{,.installer,.locale.en-US,.locale.zh-CN}.yaml`。
- CLA **已签**（账号级，`license/cla` = success）。触发方式见
  `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\winget\README.md`。
- 第一个 PR **#460692 已关闭**（清单路径写错 + 校验服务 `Internal-Error-PR`），#460744 是干净重开的那一个。
- 清单里的 `ProductCode: Alpha File Manager` / `Scope: machine` / `ElevationRequirement: elevatesSelf` /
  `DefaultInstallLocation: '%ProgramFiles%\Alpha File Manager'` 都与生成的
  `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\target\release\nsis\x64\installer.nsi` 逐项对上。

### 3.4 HelloGitHub 自荐（已完成）

- 2026-10-24 13:06 以账号 **Kizemo** 提交，站点 `hellogithub.com`。
- 项目地址 `https://github.com/kizemo/alpha-file-manager`；标题「Alpha File Manager：Windows 与 Linux 双栏文件管理器」；
  描述 217 字（限 10–300）。
- 两条独立证据：网络日志 `POST https://api.hellogithub.com/v1/repository/` → **200 OK**；
  侧栏贡献值 **0/64 → 5/64**。
- ⚠️ 提交表单是**客户端模态框，没有独立路由**（`/submit` 一类路径全 404）。

### 3.5 awesome 榜单（3 个 PR，全 open 未合并）

| 榜单 | PR | 状态 |
|---|---|---|
| `Axorax/awesome-free-apps` | https://github.com/Axorax/awesome-free-apps/pull/429 | open，未合并 |
| `chrysler-stone/awesome-tauri-apps` | https://github.com/chrysler-stone/awesome-tauri-apps/pull/36 | open，未合并 |
| `thechampagne/awesome-windows` | https://github.com/thechampagne/awesome-windows/pull/114 | open，未合并（从 fork `kizemo/awesome-windows` 的 `main` 开的） |

主动跳过：`0PandaDEV/awesome-windows` —— 其 README 第 5 行**明文禁止 AI 生成的 PR**。
`tauri-apps/awesome-tauri` 是资源/插件清单，不是应用展示清单，不适用。

### 3.6 社交预览

- 已生成并**已上传到 GitHub**（GitHub 没有 API，只能手动上传；已传完）。
- 图片 URL：`https://repository-images.githubusercontent.com/1385753263/8952fe4f-9bed-4884-9684-7b5a9019a417`
  （200 / `image/png` / 461,038 B，已复核）。
- 仓库页 `og:image` / `twitter:image` 都指向它，`twitter:card = summary_large_image`。
- ⚠️ **它不会显示在仓库页**，只在外部分享（Slack / 微信 / X）时作为卡片图出现。

### 3.7 附带修的：Markdown 表格门禁

- 判据与 GFM 规范（`github/gfm` §4.10）对齐：只有「分隔行 ≠ 表头」和「数据行比表头多列」是真缺陷；
  **「数据行比表头少列」不是缺陷**（GFM 会补空单元格）—— 早先的门禁把它算成错误，是误报。
- 覆盖面从根 README 扩到 `docs/**/*.md`（77 条用例，含负向用例，门禁自身必须能红）。
- 修了 6 处真缺陷（内层仓 2 行、外层仓 4 份文档）。

---

## 4. 现在还开着的口子（按优先级）

| # | 事项 | 现状 | 谁来做 | 下一动作 |
|---|---|---|---|---|
| 1 | **winget 版主评审与合并** | 校验全绿，等社区版主（机器人留言：版主是社区志愿者，要有耐心） | 上游版主 | 每周查一次 PR 状态；**合并后立刻回 README 加 winget 徽章 + `winget install` 命令**（现在故意没放，见第 5.1 节） |
| 2 | **安装包代码签名** | `NotSigned`，评审通常会要求 | **用户**（自备证书） | 拿到证书后：改签名流程 → 重新打包 → 换哈希 → 更新清单 → 提新 PR |
| 3 | 3 个 awesome PR | 全 open 未合并，维护者还没回应 | 各榜维护者 | 若被问「是不是 fork / 能不能提供下载」，PR 正文里已写好 fork 关系与 GPL 归属 |
| 4 | 收藏页签的分类侧栏 | **待用户拍板** | 用户 | 见第 5.5 节 |
| 5 | upstream 同步剩余 2 项 | 见第 5.4 节 | agent 可做 | 按 `docs/audit-upstream-port` 的逐行命中率判据复核后补 |
| 6 | 中文社区曝光 | 未做 | 需人工写作 | 少数派 / 掘金 / V2EX / 知乎 写一篇「在资源管理器之外」的实测文；各站规则不同，**先读规则再发** |
| 7 | 更多分发渠道 | 未做 | 需各站账号 | Scoop bucket（`ScoopInstaller/Main`）、Chocolatey、AlternativeTo |

---

## 5. 下阶段计划

### 5.1 winget 合并后的收尾（**优先级最高，改动最小**）

合并后需要做三件事：
1. README 的下载矩阵加一行 `winget install kizemo.AlphaFileManager`；
2. 加一个 winget 徽章（ Shields 的 `winget/v/...` 或 badge.fury.io 形式，**先确认徽章能解析出已发布的包**再放）；
3. `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\winget\README.md` 的状态行更新为「已合并」。

⚠️ **在包真正发布前不要放 winget 徽章** —— 那是虚假承诺。放之前用
`gh api repos/microsoft/winget-pkgs/contents/manifests/k/kizemo/AlphaFileManager` 确认包已在 master 上。

### 5.2 曝光扩展

按「投入产出」排：中文社区文章（自有渠道、可控）> Scoop > AlternativeTo > Chocolatey。
每个平台都要先读它的收录规则，**并确认是否接受 fork**（已验证 awesome-free-apps 与 awesome-windows 接受）。

### 5.3 安装包签名

上游已有 `F:\soft\00selfmade\filemanager\sigma-file-manager\.github\workflows\sign-windows.yml`
（SignPath 路线，**upstream 引入，我们没移植**）。若走这条路：
① 先拿到证书/SignPath 组织资格；② 移植工作流；③ 重新打包发版（哈希必变）；
④ 更新清单的 `InstallerSha256` 并提新 PR（**新版本要新目录**，`manifests/k/kizemo/AlphaFileManager/<新版本>/`）。

### 5.4 upstream 同步剩余两项

现状（2026-10-24 21:xx 实测 `git -c http.proxy= fetch upstream main`）：
merge-base `fed49cee`，AFM **领先 280**，**落后 23**，upstream head `2b8bed43`。

23 个 upstream commit 里 10 个已无合并价值（SSRF 修复、扩展隔离加固、扩展主流程测试、
Shift+方向键连选、双击标题栏最大化、全屏后窗口状态恢复、SMB 移入回收站前确认、
e2e 全新 Windows profile、e2e 临时数据目录隔离、隔离目录删除重试）。

**真正还没落地的只有两项**：
1. **CI 的 `e2e-windows` job + e2e 残留数据检查**（upstream 一串 e2e commit：
   `b42aa683` / `979d6e2c` / `8908e214` / `1305d81d` / `7f9ebf2b` / `2b8bed43` / `e00011fd` / `5b6cab44` / `4b0a2419`）。
   我们**已有全套 e2e 脚本**，但 `F:\soft\00selfmade\filemanager\sigma-file-manager\.github\workflows\ci.yml` 里
   **完全没有 e2e job**。这是两块拼图：移植 upstream 的 e2e 脚本 + 往 ci.yml 加 job。
2. **locale JSON 末尾换行**（upstream `a4d4f4f1`）—— 我们的
   `F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\sync-i18n.js` 会把末尾换行写掉，
   要改脚本而不是改 17 个文件。

⚠️ **判「是否已移植」只能用逐行命中率，不能用 `git cherry`**（AFM 历史上做过两轮重写式移植，
`git cherry` 会把 23 个全判成未移植）：
```powershell
git -c http.proxy= fetch upstream main
node F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\audit-upstream-port.mjs
```
判据：命中率 ≥ 90% ≈ 已落地（差的是注释/license 头/格式化）；< 60% ≈ 真落后。

### 5.5 仪表盘：仍待用户拍板的一件事

- **标记页签整体骨架 → 已拍板「不换」**：保持 AFM 现有的「多分组平铺 + 每组一条可编辑标题条」，
  **不引入 upstream 的「左侧标签栏 + 右侧单组」双栏工作台**。
  连带把 upstream 的「标签侧栏」降级为**不移植**（它会动到 AFM 的分组编辑，与该决策冲突）。
- **收藏页签的分类侧栏 → 仍待拍板**：upstream 无对应实现可搬（AFM 的收藏分类体系 upstream 完全没有），
  得自己设计，难度**高**。选项大致是：① 不做，保留平铺；② 做一个简化侧栏；
  ③ 等 upstream 自己长出分类体系再对齐。
  背景与冲突清单见
  `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-dashboard-phase3-handoff.md` 第 5.3 节。

---

## 6. 门禁与基线（量的时候一律用同一条命令）

| 门禁 | 基线数字 | 备注 |
|---|---|---|
| `npx eslint .`（整仓） | **188 errors / 0 warnings** | 基线**随提交变**，量的时候用 `git stash push -u` 量 HEAD |
| `npx eslint src` | 175 | 同上，别拿它去对 188 |
| `npx vitest run` | **242 文件 / 2191 用例全过** | 本轮把表格门禁从 7 例扩到 77 例，所以用例数比上一轮的 2114 多 |

- `vitest --reporter=basic` 在本仓库这版**不存在**，会 `Failed to load custom Reporter from basic` 直接中止 ⇒ 跑全量用默认 reporter。
- `$ErrorActionPreference = 'Stop'` 会把**原生命令的 stderr**变成终止错误 ⇒ 门禁脚本调 `npm`/`npx` 前后要显式切回 `Continue`。
- `eslint` **不读 `.gitignore`** ⇒ `.superpowers/**` 与 `graphify-out/**` 已写进
  `F:\soft\00selfmade\filemanager\sigma-file-manager\eslint.config.ts` 的 `globalIgnores`。
  没写进去的话，同一个提交在干净检出是 188、在工作副本能变成 689。
- 单文件 `eslint --fix` 通过 **≠** 回到基线（它会把该文件里基线本来就有的违规一起修掉），必须再跑全量对照。

---

## 7. 已知的坑（跨会话有效，细节在 `F:\soft\00selfmade\filemanager\AGENTS.md` 2.4 / 外层 AGENTS.md 2.4）

1. **winget 清单的 `ManifestType` 判重** —— 同一版本目录里每种 `ManifestType` 只允许一份文件；
   `version` / `installer` / `defaultLocale` 各一份，**其它语言一律 `ManifestType: locale`**。
   两份都写 `defaultLocale` ⇒ 上游报 `DuplicateMultiFileManifestType`，校验在第 02 步就停。
   规则出处：`microsoft/winget-cli` 的 `src/AppInstallerCommonCore/Manifest/YamlParser.cpp`。
   另外 `Moniker` **只出现在 defaultLocale 的 schema 字段表里**，别往 locale 文件里放。
2. **GFM 表格判据** —— 见第 3.7 节；单元格正文里的 `|` 必须写成 `\|`。
3. **第 08 步沙箱试装可能跑 35 分钟**（同期其它包样本约 10 分钟）——
   `tauri.conf.json` 没配 `webviewInstallMode`，Tauri v2 默认 `downloadBootstrapper`，
   沙箱没装 WebView2 运行时时要联网下载引导程序再装（~130MB）。**是安装耗时，不是卡死。**
4. **PowerShell 的 `>` 重定向写成 UTF-16**，后续按 UTF-8 解析必炸 ⇒ 取 API 响应要用 node 直接捕获 `gh api` 的 stdout。
5. **`raw.githubusercontent.com` 本机超时，`api.github.com` 正常** ⇒ 取上游文件用
   `gh api repos/<repo>/contents/<path> -H 'Accept: application/vnd.github.raw'`。
6. **GitHub `search/code` 对 winget-pkgs 这种超大仓索引不到**（`total_count` 恒为 0）⇒ 改用 contents API 逐层列目录。
7. **git 推送的代理状态会变** —— 本机 git 全局配了 `http.proxy = http://127.0.0.1:7897`，
   直连与经代理**都可能**失败。判据顺序：先 `Test-NetConnection github.com 443`，
   直连通 ⇒ `git -c http.proxy= push`；不通 ⇒ `git -c http.proxy=http://127.0.0.1:7897 push`；
   两条都试过还不通就重试。**不要改用户的全局代理配置。**
8. **上游发布者目录名保留原始大小写**（`manifests/m/Microsoft/...`，不是 `manifests/m/microsoft/...`）。
9. **公开截图不能带用户真实工作区**；目录树展开盘根会把该盘全部一级目录列出来 ⇒ 用 `subst X:` 挂演示盘符。
10. **写工具可能把一个汉字写成 3 个 U+FFFD** ⇒ 写完中文必须验 `U+FFFD === 0`。
    （`src-tauri/src/network_shares.rs` 与一份 plans 文档里的 U+FFFD 是**故意的**。）
11. **孤立 CR 字节是地雷** ⇒ 改任何 `.rs` 前先扫，改用 node 按字节改。
12. **PowerShell 里 `[System.IO.Directory]::EnumerateFiles(...).Count` 不会真枚举** ⇒ 要包一层 `@(...)`。
13. **应用日志被独占锁着** ⇒ 用 `File.Open(..., FileShare.ReadWrite)` 读；日志时间戳是 **UTC**（比本地少 8 小时）。

---

## 8. 必须先读的文档清单

按顺序读，读完就能接手，不用翻历史对话：

| 顺序 | 路径 | 读它是为了知道 |
|---|---|---|
| 1 | `F:\soft\00selfmade\filemanager\AGENTS.md` | **项目硬约束**（输出语言、真机验收纪律、PowerShell/编码坑、winget 与 GitHub 规则）—— 必读 |
| 2 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-github-presence.md` | 三轮完整过程与溯源（本文不重复的部分） |
| 3 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\winget\README.md` | winget 清单规则、CLA 流程、校验状态怎么读、怎么重跑 |
| 4 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-dashboard-phase3-handoff.md` | 仪表盘阶段 3 的状态与**唯一待拍板项**（收藏页签的分类侧栏） |
| 5 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-23-upstream-sync-and-dashboard-review.md` | upstream 新仪表盘与 AFM 的 12 条冲突清单（拍板依据） |
| 6 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-21-compare-sync-and-network-drive.md` | 比较同步与网络盘的现状（另一个活跃工作流） |
| 7 | `F:\soft\00selfmade\filemanager\sigma-file-manager\CHANGELOG.md` | 版本脉络（当前 3.5.1） |

---

## 9. 接手后第一件事（照着做）

```powershell
# 1. 确认 winget PR 状态（最可能的第一个变化）
gh pr view 460744 --repo microsoft/winget-pkgs --json state,mergedAt,labels,mergeable
#    若 merged=true → 按第 5.1 节加 winget 徽章 + 安装命令，并更新 docs/winget/README.md

# 2. 确认 3 个 awesome PR 状态
gh pr view 429 --repo Axorax/awesome-free-apps --json state,mergedAt
gh pr view 36  --repo chrysler-stone/awesome-tauri-apps --json state,mergedAt
gh pr view 114 --repo thechampagne/awesome-windows --json state,mergedAt

# 3. 确认两仓工作区干净
git -C 'F:\soft\00selfmade\filemanager\sigma-file-manager' status -sb
git -C 'F:\soft\00selfmade\filemanager' status -sb

# 4. 确认门禁还在基线上
cd 'F:\soft\00selfmade\filemanager\sigma-file-manager'; npx vitest run; npx eslint .
```

> ⚠️ 本文档写于 2026-10-24 21:4x（Asia/Shanghai）。
> 第 3 节的「校验全绿」是**当时的快照**；接手时**以第 9 节第 1 步的实时查询为准**。

---

*对应内层提交：`02a6650b` / `fad47ee6` / `db7abc76`；外层提交：`19a9c23` / `24472cf` / `4873cd7`*
