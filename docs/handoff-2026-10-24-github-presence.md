# 交接文档：GitHub 栏目改造与可发现性（2026-10-24）

> **本文件**：给**新会话**用。记录这一轮「把项目在 GitHub 上做得更专业、更多人被搜到」的
> 调研结论、已落地的改动、以及还没做的后续项。
>
> **一句话**：AFM 在 GitHub 上是 upstream 的**fork**、只有 **1 个 star**、README 有 **47 KB 的更新日志墙**、
> 侧栏许可证显示 **NOASSERTION**、winget 工作流用的是**上游的包 ID** 且从未跑过。
> 这一轮把仓库「门面」整套重做（README 双语重写、门面图、徽章、topics、许可证可识别、
> winget 修正），并向 3 个活跃的 awesome 榜单提交了收录 PR。

---

## 0. 三十秒版

| 问 | 答 |
|---|---|
| 改了什么？ | README（英/中）双语重写、仓库门面图与社交预览横幅、`description` + `topics`、许可证可识别、`winget.yml` 两个真 bug、3 个 awesome 榜单收录 PR |
| 门禁？ | `vitest` / `eslint` / `vue-tsc` 全部与基线一致（见第 5 节） |
| 推了吗？ | 已推 `origin/main`（内层仓） |
| 还有什么没做？ | social preview 需**手动上传**（GitHub 没有 API）；winget 需配 `WINGET_TOKEN` 才真正发布；awesome PR 等维护者合并 |
| 最重要的坑？ | 我们的 repo **在 GitHub 上是 upstream 的 fork**（`fork: true`），这决定了 awesome 榜单的接受度 |

---

## 1. 调研结论：upstream 的 GitHub 栏目长什么样

`aleksey-hoffman/sigma-file-manager` 的 README 栏目顺序（可作参照）：

```
[Latest news] → [h1 + logo + 一句话定位] → [大图] → [社区链接 + 「Thanks to everyone
who has been sharing this project with others!」+ Product Hunt 徽章] → [Features]
→ [Code signing policy] → [Sponsors] → [Supporters] → [Download & install（徽章 + 平台表格）]
→ [For developers]
```

**upstream 的 6719 star 靠的是这几件**（我们这一轮补的就是这些）：

| upstream 有 | 我们 2026-10-24 之前 | 差距 |
|---|---|---|
| 顶部大图 | **没有**（正文里一张，还是用户真实业务目录） | 访客 3 秒内看不到产品长什么样 |
| 徽章（stars / release / downloads / winget） | **一个都没有** | 第一屏没有任何可扫读信息 |
| 社区链接 + 「帮忙传播」的致谢 | **没有** | 没有把 star 请求说出来 |
| Features 清单 | 只有「我们在上游之上加了什么」+ 对比表，**没有功能总览** | 搜「file manager」来的人看不到功能点 |
| Download & install 平台表 | 只有一段话 | 没有安装矩阵 |
| 明确的「给开发者」段 | 只有一个 CONTRIBUTING 链接 | 贡献者门槛没降低 |
| 许可证侧栏可识别 | **NOASSERTION** | 第一眼像「没写许可证」 |
| `description` / `topics` | description 只有中文、topics 只有 10 个 | 英文搜索几乎搜不到 |

**我们的 fork 身份（关键事实）**：

```
$ gh api repos/kizemo/alpha-file-manager --jq '{fork,parent:.parent.full_name,network_count}'
{ "fork": true, "parent": "aleksey-hoffman/sigma-file-manager", "network_count": 295 }
```

⇒ AFM 是 GitHub 上的 **fork**，不是独立仓库。影响：

- 仓库页顶部会显示「forked from …」，且上游有 6719 star（**这本身是社会证明，保留 fork 反而有利**）。
- 部分 awesome 榜单**明文不收 fork**。但本轮实测：
  `Axorax/awesome-free-apps` 收了 KeePassXC（"Modern community fork of KeePass"）与
  `thechampagne/awesome-windows` 收了 Equicord（"Fork of Vencord"）⇒ **接受 fork**。
- `git cherry` 判据在本项目失效（见 upstream 评估文档）；AFM 用 `upstream` remote + 逐行命中率审计。

**是否要「Duplicate 成独立仓库」？本轮结论：不做。**
理由：① 保留 fork 能蹭到上游 6719 star 的社会证明与 fork network 曝光；
② 三个目标榜单都接受 fork；③ Duplicate 会改仓库身份、丢 fork network 关系，且与
`upstream` remote 的同步流程无冲突。**若将来某个榜单以「不收 fork」为由拒绝，再重新评估。**

---

## 2. 找到的 awesome 榜单（真实规则，不是猜的）

| 榜单 | star | 活跃度 | 规则要点 | 本轮结果 |
|---|---|---|---|---|
| `Axorax/awesome-free-apps` | 高 | 2026-10-21 | 只改 `README.md`/`MOBILE.md`，**不要动 `filter/`**（自动生成）；加在**分类末尾**；描述以句号结尾；commit `Add: 名称` | ✅ [PR #429](https://github.com/Axorax/awesome-free-apps/pull/429) |
| `chrysler-stone/awesome-tauri-apps` | 42 | 2026-10-16 | 必须 Tauri 写的**可用应用**、有公开站点/仓库、**分类内按字母序**、免费就不加 `(Paid)` | ✅ [PR #36](https://github.com/chrysler-stone/awesome-tauri-apps/pull/36) |
| `thechampagne/awesome-windows` | 295 | 2026-10-17 | 有 `README.md` 与 `README-cn.md` 两份，图标用 `[![Open-Source Software][oss icon]](repo)` | ✅ [PR #114](https://github.com/kizemo/awesome-windows/pull/114)（两份文件各加一行） |
| `0PandaDEV/awesome-windows` | 3072 | 2026-10-17 | **README 第 5 行明文禁止 AI 生成的 PR** | ⛔ **主动跳过** |
| `tauri-apps/awesome-tauri` | 8139 | — | 是**资源/插件/模板**清单，不是应用展示清单 | 不适用 |
| `521xueweihan/HelloGitHub` | 高 | 2026-09-28 | 自荐走 **hellogithub.com/periodical**，不是 GitHub PR | 需网站自荐（见第 6 节） |

> **踩坑记录**：Axorax 的条目格式里平台图标 `🪟`（Windows）必须**从它自己的图例行里复制**，
> 手写代理对会变成扫帚 `🧹`；而 `🟢` 是**带链接**的（`[🟢](仓库地址)`），不是裸字符。

---

## 3. 已落地的改动（内层仓 `sigma-file-manager`）

### 3.1 README 双语重写（47.8 KB / 37.6 KB → 16.8 KB / 16.0 KB）

栏目顺序（英文版，中文版同构）：

```
[语言切换] → [徽章 ×7] → [h1 + logo + 一句话定位] → [门面图]
→ ✨ Highlights（6 条） → 🧭 Features（5 组表格） → 📸 界面
→ ⚖️ 三方对比表 → 📦 下载与安装（表格 + SmartScreen 提示）
→ 🆕 What's new in 3.5.0（压缩成 4 段） → 👥 社区（+ 明确的 star 请求）
→ 💻 从源码构建 → Credits → License
```

**关键取舍**：3.1.0 ~ 3.4.0 的更新日志墙（原 README 里约 35 KB）**移出 README**，
改用 `CHANGELOG.md`（已有 1623 行 / 128 KB，覆盖全部版本）+ Releases 页面链接。
只保留当前版本 3.5.0 的 4 段摘要——「最近在动什么」这个信号要留，更早的历史不必占第一屏。

**徽章**：`stars` / `forks` / `issues` / `release` / `downloads` / `license` / `platform`，
统一用品牌色 `#70b59d` + `for-the-badge` 样式。

### 3.2 门面图与社交预览

| 文件 | 说明 |
|---|---|
| `docs/screenshots/afm-main-window.png` | **主门面图**，1931 px 宽，2.27 MB |
| `.github/media/alpha-file-manager-logo.png` | 我们的 `α` 图标（取自 `src-tauri/icons/128x128@2x.png`） |
| `docs/screenshots/afm-social-preview.png` | 1280×640 社交预览横幅（Edge headless 渲染） |

⚠️ **门面图的取景纪律**（这一轮踩过两次坑）：

1. 用户的真实工作区里有**业务目录名**（`G1销售管理`、`订单数据`…），**不能**出现在公开 README。
2. 目录树一旦展开某个盘根，**该盘根的全部一级目录都会列出来** —— C 盘根有 `办公文件`/`evi`/`文件位置.xlsx`，
   D 盘根有 `gbrain-latest`/`paddleocr-*`/`ComfyUI`…，**都不可用**。
3. 解法：用 `subst X: D:\AFM-Shots` 把演示目录挂成独立盘符，标签页路径写成 `X:\AlphaFM-Demo`。
   应用解析不出 `X:` 的物理位置 ⇒ **目录树里所有真实盘都保持折叠**，只有演示内容可见。
4. 演示目录本身是中性内容（`Documents`/`Photos`/`Projects`… 22 个目录 + 8 张仓库自带样图），
   放 `D:\AFM-Shots\AlphaFM-Demo`，用完 `subst X: /d` 解绑。
5. 窗口用 `MoveWindow` 调到 2400×1500 物理像素（非最大化），否则大片空白。

> 截图脚本：`.superpowers/sdd/afm-capture-only.ps1`（只抓不重启）+
> `.superpowers/sdd/hero-shot2.cjs`（建演示目录 / 写单标签 workspace / 恢复）。
> ⚠️ **恢复顺序仍是「先杀进程 → 再 restore」**：应用退出时会把内存里的工作区写回真实文件。

### 3.3 仓库元数据

- `description` 改成**英文在前 + 中文在后**（GitHub 搜索两边都能命中）：
  > `Modern file manager for Windows & Linux - permanent folder tree, compare & sync, SFTP/FTP/FTPS, MCP server for AI assistants, batch rename. 开源文件管理器：常驻目录树、目录比较与同步、远程服务器、MCP、批量重命名。`
- `topics` 从 10 个补到 **20 个**（GitHub 上限）：
  `file-manager, filemanager, file-explorer, windows, windows11, linux, cross-platform, rust, tauri, vue, typescript, mcp-server, model-context-protocol, ai-tools, sftp, ftp-client, dual-pane, batch-rename, directory-tree, file-comparison`

### 3.4 许可证：GitHub 侧栏从 `NOASSERTION` 变成可识别

**根因**：`LICENSE.md` 开头是自写的「LICENSE SUMMARY (TL;DR)」，GitHub 的许可证探测器
（licensee）要求正文是**规范原文**，前面的自写段落把匹配打断了 ⇒ 侧栏只显示 `NOASSERTION`。

**修法**：`LICENSE.md` 换成 gnu.org 的 **GPL-3.0 规范原文**（35149 字节，675 行），
原来的摘要 + 版权声明移到新的 **`NOTICE.md`**，README 的 License 段同时指向两个文件。
`package.json` 补了 `"license": "GPL-3.0-or-later"`（原来**没有**这个字段）。

> `scripts/sync-license.js` 会往源文件头部盖 `SPDX-License-Identifier: GPL-3.0-or-later`，
> 它的措辞是「See the license file in the project root」——**指向 `LICENSE.md` 仍然成立**。

### 3.5 `winget.yml` 的两个真 bug

| # | 问题 | 后果 | 修法 |
|---|---|---|---|
| 1 | `identifier: AlekseyHoffman.SigmaFileManager`（**上游的包 ID**） | 一旦配上 token，我们的二进制会**覆盖上游的 winget 包** | 改成 `kizemo.AlphaFileManager` |
| 2 | `installers-regex: '-windows-setup\.exe$'` | 我们的资产名是 `Alpha_File_Manager_3.5.0_x64-setup.exe`，**正则匹配不上** | 改成 `-x64-setup\.exe$` |

另外：这两个 bug 叠加上「仓库里没有 `WINGET_TOKEN` 这个 secret」⇒ 该工作流
**历史运行次数为 0**（`gh api .../actions/workflows/winget.yml/runs` → `total_count: 0`），
winget 上从来没有出现过 AFM。

---

## 4. 为什么 README 里没有 winget 徽章

winget 包**还没发布**（缺 `WINGET_TOKEN`），README 里放一个 `winget install` 徽章是虚假承诺。
下载表里只列了**实际存在**的两条路径（官网更新通道 + GitHub Releases 镜像）。
`winget` 一旦真的发布成功，再回来加徽章 + 加一行安装命令。

---

## 5. 门禁（2026-10-24 实测，量的是本轮改动后的工作区）

| 门禁 | 数字 | 判读 |
|---|---|---|
| `npx vitest run` | 241 文件 / 2114 用例全通过 | 与基线一致（本轮**未改 `src/`**） |
| `npx eslint src` | 175 errors | = HEAD 基线 |
| `npx eslint .` | 188 errors | = HEAD 基线 |
| `npx vue-tsc --build` | exit 0 | |
| `node scripts/verify-changelog.mjs` | OK | |

> 本轮只动 `README*.md` / `LICENSE.md` / `NOTICE.md` / `package.json` / `.github/**` / `docs/**`，
> **一行 `src/` 代码都没碰**，所以门禁数字理应完全等于基线。**若数字变了，先查是不是量错了口径。**

---

## 6. 还没做的（下一轮可接）

| # | 事项 | 怎么做 | 为什么没做 |
|---|---|---|---|
| 1 | **上传社交预览** | 仓库页 → Settings → General → Social preview → 上传 `docs/screenshots/afm-social-preview.png` | **GitHub 没有对应的 REST API**，只能网页操作 |
| 2 | **真正发布 winget 包** | 建一个带 `winget` scope 的 PAT 存成仓库 secret `WINGET_TOKEN`，然后重跑 Release | 需要用户手里的 PAT |
| 3 | **HelloGitHub 自荐** | 走 https://hellogithub.com/periodical | 走网站表单，不是 PR |
| 4 | **更多分发渠道** | Scoop bucket（`ScoopInstaller/Main`）、Chocolatey、AlternativeTo | 需要各站的账号 / 提交流程 |
| 5 | **中文社区曝光** | 少数派 / 掘金 / V2EX / 知乎 写一篇「在资源管理器之外」的实测文 | 需要人工写作，且要遵守各站规则 |
| 6 | **把 awesome PR 跟进到合并** | 维护者可能会问「是不是 fork」「能不能提供下载」 | 已把 fork 关系与 GPL 归属写进 PR 正文 |
| 7 | **仓库页的 Discussions 引导** | `has_discussions` 已经是 true，但 README 之前没链接 | 本轮已加进「社区」段 |

---

## 7. 本轮踩的坑

1. **公开截图会泄露用户的工作区**。第一版门面图直接拍真实工作区，
   结果 `G1销售管理`、`订单数据` 全部入镜；改成演示目录后又发现**目录树会列出整个盘根**。
   ⇒ 做公开截图前，先确认「树的根」和「地址栏」两处都不含个人信息。
2. **`subst` 出来的盘符应用认不出，但正因如此才安全**：应用解析不出 `X:` 的物理位置，
   树里就只剩折叠的盘符。副作用是地址栏显示 `X:`，可接受。
3. **PowerShell 5.1 把 `Copy-Item -Force` 判成删除操作**并拦下 ⇒ 仓库内文件复制一律用
   `node fs.copyFileSync`（`AGENTS.md` 已有这条纪律）。
4. **`gh api --input -` 走管道会被 PowerShell 弄坏 JSON** ⇒ 把载荷写成 UTF-8 文件再 `--input <file>`。
5. **`gh api` 的 `--jq` 表达式里带双引号在 PS 5.1 下会被吃掉** ⇒ 一律改用 `node` 解析 JSON。
6. **手写 emoji 代理对会错**（`🪟` 写成扫帚）⇒ 平台图标**从目标榜单自己的图例行里复制**。
7. **PR 的 API 路径是 `repos/{owner}/{repo}/pulls/{n}`**，不是 `repos/{owner}/{repo}/{n}`。
8. **冷启动要 3 分钟**：`afm-nav-accept.ps1` 里 90 秒的等窗口上限不够，
   表现为「AFM main window never appeared」，但应用其实好好地起来了。
   ⇒ 新增了 `afm-capture-only.ps1`（只抓不重启），可以等窗口出现后再抓。

---

## 8. 第二轮：3.5.1 发版 + winget 提交（2026-10-24 下午）

上一轮把仓库门面改好了，但 winget 与 HelloGitHub 两件事卡在同一个地方：
**发布者**。安装器写进 Windows ARP 的 `Publisher` 来自
`tauri.conf.json` 的 `bundle.publisher`，而 Tauri v2 的默认值是
**identifier 的第二段** —— 本仓 identifier 是 `com.sigma-file-manager.app`，
于是默认发布者成了 `sigma-file-manager`（上游的名字）。

包管理器靠「发布者 + 程序名 + 版本号」认领一个已安装程序，对不上就当不认识，
升级也不会接管。⇒ 必须先修发布者，再打包发版，才能拿到与清单一致的资产。

### 8.1 做了什么

1. **修发布者与包元数据**（`bundle.publisher: "kizemo"`、Cargo 的 authors/repository、
   HTTP User-Agent、Flatpak 主页与问题反馈链接全部指向本仓）。
2. **版本 3.5.0 → 3.5.1**，CHANGELOG 补条目（`verify-changelog` 是门禁，缺条目就红）。
3. **重新打包**（`npm run tauri:build`，约 8 分钟）⇒ 产物
   `Alpha_File_Manager_3.5.1_x64-setup.exe`，20,570,585 字节，
   SHA-256 `8606AD3DF0DF6747C7403BB01C0014F1915CF050CCB9FB7FE8575B7D736A3BE9`。
   生成的 `installer.nsi` 里 `!define MANUFACTURER "kizemo"` 已确认。
4. **发 GitHub release v3.5.1**（正文 = 英文摘要 + 中文详述，见 `_notes.md`）。
5. **提交 winget 清单** ⇒ https://github.com/microsoft/winget-pkgs/pull/460744
   （`New package: kizemo.AlphaFileManager version 3.5.1`，4 个文件，
   mergeable=true，上游校验流水线自动跑）。清单原文留在 `docs/winget/`。
   ⚠️ 第一个 PR **#460692 已关闭**：它的清单路径写错了（少了上游的发布者层级），
   机器人判 `missing the manifests folder`；改对路径后校验服务又报
   `Internal-Error-PR` / `WinGetSvcError`（发生在分支正被连续删/加文件的半路上）。
   ⇒ 干净重开为 #460744：**1 个 commit、4 个文件、base = 当时的 upstream master**。
6. **HelloGitHub 自荐**：提交表单是客户端模态框，**没有独立路由**；
   `/submit` 一类路径全是 404，真实存在的只有 `/report/contribution`（贡献排行榜，不是表单）。
   ⇒ 登录必须由用户本人完成（OAuth）；登录后表单与提交由 agent 代做。
7. **已提交**：2026-10-24 13:06，以账号 Kizemo 提交。
   两条独立证据：① 网络日志 `POST https://api.hellogithub.com/v1/repository/` → 200 OK
   （提交前还有一次 `GET /v1/repository/check/` 校验 GitHub 地址，200）；
   ② 侧栏贡献值从 **0/64 变成 5/64** —— HelloGitHub 的规则是「分享开源项目可获得 5 点贡献值」。
   提交内容：项目地址 `https://github.com/kizemo/alpha-file-manager`，
   标题「Alpha File Manager：Windows 与 Linux 双栏文件管理器」，描述 217 字符（限 10–300）。

### 8.2 三个未决项

| 事项 | 状态 | 谁来做 |
|---|---|---|
| winget 的 CLA 签署 | 校验任务在排队 | 用户（GitHub 账号一次性签署） |
| 安装包代码签名 | `NotSigned`，评审通常会要求 | 用户（需自备证书） |
| HelloGitHub 表单提交 | **已完成**（2026-10-24 13:06 提交，账号 Kizemo） | — |

### 8.3 这一轮踩的坑（已写进 AGENTS.md 2.4）

- **孤立 CR 地雷**：`src-tauri/src/extensions/http.rs` 的注释里夹了一个裸 `0x0D`，
  rustc 认得（整行仍是注释），但任何规范化行尾的写入路径都会把它变成换行 ⇒
  注释后半句变成裸代码 ⇒ **整个 crate 编译失败**（10 个错误，E0277 全是级联）。
  第一轮打包就是死在这。⇒ 改 `.rs` 前先扫孤立 CR，修复用 node 按字节改。
- **写工具把一个汉字写成 3 个 U+FFFD**（`双` + 三个替换符）。
  ⇒ 写完中文必须验 `U+FFFD === 0`；但 `network_shares.rs` 等文件里的 U+FFFD 是故意的。
- **`tauri build` 报 `failed to remove file ... os error 5`**：上一轮残留的应用进程
  占着 `target/release/alpha-file-manager.exe` ⇒ 打包前先杀进程并核对真实用户数据。
- **自动化点击在 HelloGitHub 上 275 秒超时且点击根本没派发**（页面持续动画，
  工具的「元素稳定」前置检查等不到稳定帧）；而 `query` 只要 150–200 毫秒
  ⇒ 读页面用 query，交互交给人。

---

## 9. 第三轮：修掉 winget 校验的 `DuplicateMultiFileManifestType`（2026-10-24 晚）

### 9.1 发生了什么

#460744 的上游校验跑完了，第 02 步 `Manifest Validation` 红了：

```
[Error] DuplicateMultiFileManifestType: The multi file manifest should contain only one
file with the particular ManifestType. (ManifestType)
```

第 03 步往后的下载安装包、核对哈希、沙箱试装**根本没跑**（校验在第 02 步就停）。

### 9.2 根因

我们自己写的两份 locale 文件**都**写了 `ManifestType: defaultLocale`：

```
kizemo.AlphaFileManager.locale.en-US.yaml   ManifestType: defaultLocale   ← 对
kizemo.AlphaFileManager.locale.zh-CN.yaml   ManifestType: defaultLocale   ← 错，应为 locale
```

上游规则（`microsoft/winget-cli`，`src/AppInstallerCommonCore/Manifest/YamlParser.cpp`）：
`Version` / `Installer` / `DefaultLocale` 三个分支各有一个「已找到」标志位，
同一版本目录里重复出现就报 `DuplicateMultiFileManifestType`；
`Locale` 分支只查 `PackageLocale` 是否重复（错误码 `DuplicateMultiFileManifestLocale`），
**允许多份**。

### 9.3 顺带发现的两处 schema 不对称

对比 `aka.ms/winget-manifest.defaultLocale.1.12.0.schema.json` 与
`aka.ms/winget-manifest.locale.1.12.0.schema.json`：

| | defaultLocale | locale |
|---|---|---|
| 必填 | 多 4 个：`Publisher` / `PackageName` / `License` / `ShortDescription` | 只 5 个身份字段 |
| `Moniker` | **在字段表里** | **不在字段表里** |

⇒ 完整元数据（`Publisher` / `PackageName` / `License` / `Moniker`…）一律留在
`defaultLocale` 文件；`locale` 文件只放翻译过的 `ShortDescription` / `Description` / `Tags`。
上游真实多语言包可对照 `manifests/m/Microsoft/AKSdesktop/0.43.0/`。

### 9.4 修法与验证

- 把 `kizemo.AlphaFileManager.locale.zh-CN.yaml` 改成 `ManifestType: locale` +
  locale schema URL + 上述最小字段集；
- 写了 `.superpowers/sdd/sync-winget-stage.cjs` 做**机器自检**：
  四个文件的 `ManifestType` 各归其位、`U+FFFD === 0`、行尾全是 LF、
  `version.DefaultLocale === defaultLocale.PackageLocale`、locale 文件不含 `Moniker`；
- 用 contents API 把该文件更新到 fork 分支（**非空提交**，空提交会被判 `noContent`），
  PR 随即 `synchronize`，校验重跑。

### 9.5 这一轮踩的坑

- **上游发布者目录名保留原始大小写**：`manifests/m/Microsoft/...`，
  不是 `manifests/m/microsoft/...`。拿上游目录当模板时按小写拼 ⇒ contents API 直接 404，
  一度以为「上游没有这个包」。
- **GitHub 上 `search/code` 对 winget-pkgs 这种超大仓索引不到**（`total_count` 恒为 0），
  改用 contents API 逐层列目录才拿到真实样例。
- **PowerShell 的 `>` 重定向会写成 UTF-16**，后续按 UTF-8 解析必炸（一堆替换字符）；
  取 API 响应要用 node 直接捕获 `gh api` 的 stdout，别走 PowerShell 重定向。
- **`raw.githubusercontent.com` 与 `api.github.com` 走的是两条路**：前者本机超时，
  后者正常。取上游文件一律走 `gh api ... -H 'Accept: application/vnd.github.raw'`。

### 9.6 最终结果：校验全绿，等版主评审

修正后的这一轮（`OperationId: WinGetSvc-Validation-460744-2`，head `5c75afac`）
**10 步全部通过**：

| 步骤 | 结论 |
|---|---|
| 01 Pull Request Validation | success |
| 02 Manifest Validation | success（修掉判重错误之后） |
| 03 URLs Validation | success |
| 04 URL Domain Validation | success |
| 05 Manifest Policy Validation | success |
| 06 Catalog Content Verification | success（含 Duplicate Hash Verification: Passed） |
| 07 Installers Scan | success（Defender 静态扫描） |
| 08 Installation Validation | success（沙箱试装，**约 35 分钟**） |
| 09 Installer Metadata Validation | success |
| 10 Validation Completed | success |

PR 标签：`Azure-Pipeline-Passed` + `Validation-Completed` + `New-Package`
（`Validation-Guide` 与 `Needs-CLA` 都被自动清掉了）。
上游机器人最后一条留言说明下一步：

> The check-in policies require a moderator to approve PRs from the community.
> Our moderators are community volunteers, please be patient and allow them
> sufficient time to review your submission.

⇒ **剩下的是社区版主人工评审与合并，不是机器流程。**

另有两条旁证：
- `github-actions[bot]` 在 06:33 发的诊断留言独立指出了同一个根因
  （"Both … .locale.en-US.yaml and … .locale.zh-CN.yaml declare `ManifestType: defaultLocale`"），
  与我们自己从 `YamlParser.cpp` 读到的规则一致。
- 第 08 步耗时 ~35 分钟，比同期样本（~10 分钟）长得多。原因基本确定：
  `tauri.conf.json` **没有配 `webviewInstallMode`**，Tauri v2 默认
  `downloadBootstrapper` ⇒ 沙箱机器上没装 WebView2 运行时时，
  安装过程要联网下载引导程序再装运行时（~130MB）。这一步是**安装耗时**，
  不是卡死。⚠️ 推论：若换成 `offlineInstaller`，包体会多出 ~130MB；
  换 `skip` 则目标机没 WebView2 就跑不起来。**当前配置下上游校验已通过，
  暂时不需要动它** —— 但这是后续发版要知道的取舍。

### 9.7 还需要人做的事

| 事项 | 状态 | 谁来做 |
|---|---|---|
| winget 版主评审与合并 | 校验已全绿，等社区版主 | 上游版主（社区志愿者） |
| 安装包代码签名 | `NotSigned`，评审通常会要求 | 用户（需自备证书） |

---

*文档生成时间：2026-10-24（Asia/Shanghai）*
*对应内层提交：见本轮 `docs(handoff): …` 提交*
