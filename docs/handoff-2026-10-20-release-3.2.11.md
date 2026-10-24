# 交接文档：Alpha File Manager 3.2.11 正式版发布（2026-10-20）

- 日期：2026-10-20
- 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
- 分支：`feat/remote-phase-1-connections-transport` → 快进到 `main`
- 上一棒交接文档：`docs/handoff-2026-10-20-remote-delete-and-list-columns.md`

---

## 0. 本轮范围

用户提了三件事，本轮全部完成：

1. **打包发版** —— 补充升级说明文档、aiec 的升级版本号文件（`version.json`）、修改 README 文档、上传 GitHub 与 aiec.fun。
2. **README 新增对比表格** —— 把 AFM、SFM（Sigma File Manager）、Windows 自带文件资源管理器的不同与优势提炼成对比表格，补充到 README（中英文各一份）。
3. **撰写完整 handoff 文档 + 一句话 prompt** —— prompt 只引导新会话阅读必要文档，不重复文档内容。

本轮**没有改任何业务代码**。改动全部是文档、版本号与发布产物。

---

## 1. 发版基线：为什么是 3.2.11，而不是 3.2.12

发版前先把三处「线上现状」核实了一遍，结论是**七轮 beta 从未对外发布过**：

| 位置 | 发版前 | 发版后 |
|---|---|---|
| 站点 `version.json` | 3.2.4（history 9 条） | 3.2.11 |
| GitHub release | v3.2.4（Latest）+ v3.2.1-beta（Pre-release） | v3.2.11（Latest） |
| 仓库 `package.json` | 3.2.11-beta | 3.2.11 |

3.2.5-beta ～ 3.2.11-beta 这七段只存在于 `CHANGELOG.md` 里，**没有任何人装得到**。
按 batch11 的先例（`docs/handoff-batch11-release-3.2.4-2026-10-17.md`），
判据是「有没有人装得到」而不是「看起来像 beta」——所以它们合并成**一条 3.2.11 正式版记录**，
而不是七条 beta 记录。

`prepare --bump patch` 对**预发布形态**的语义是「去掉预发布后缀」（`3.2.11-beta` → `3.2.11`），
对**正式版形态**才是「patch + 1」。这一条在 `scripts/release-publish.mjs:97` 的
`bumpVersion()` 里有注释，写代码前先读它，能省掉一次错发版本的排查。

---

## 2. CHANGELOG 合并

### 2.1 合并规则

脚本：`.superpowers/sdd/merge-changelog-3211.cjs`（git-ignored 的一次性工具）。

- 七个 beta 段的 **「What changed」正文原样搬运**，一个字不改，按 3.2.11 → 3.2.5 排列。
- 各段自己的 Summary 行和 `### What changed` 小标题丢掉，换成一条新的 Summary。
- 各段的 `### This is a beta` **拆开重写**：
  - 技术限制（FTPS 数据通道明文、FTPS 没连过真机）→ 新的 `### Known limits`
  - 「哪些验过、哪些没验」→ 新的 `### How this release was verified`
- `### Not in this build` 整段重写进 Known limits。

### 2.2 两个必须改写的地方（不能原样搬运）

**①「上传和下载不在本包里」这句已经过时。**
3.2.11 自己的正文就写着「把远程文件下载到本地、或把文件（目录也行）上传到远程之后……」
—— 上传下载 3.2.11 **是有的**。原来那句「目前没有任何一条代码路径在本地磁盘和远程主机之间传文件」
是上一轮留下来的，**与同一段里的正文自相矛盾**。新写的版本说清楚真正缺的是什么：

> 上传和下载是**各自独立的入口**，它们是能用的；缺的是它们周围那套日常词汇 ——
> 跨本机与远程之间的复制、剪切、粘贴，给远程条目改名，以及在远程目录里新建文件或目录。

这段话的事实依据是 `src/utils/entry-action-policy.ts:51` 的
`REMOTE_PHASE0_BLOCKED_ACTIONS`：`rename` / `batch-rename` / `copy` / `cut` / `link` / `paste`
对远程条目**全部屏蔽**，而 `remote-delete`（第 62 行注释）刻意不复用本地的 `delete`。
`create-file` / `create-directory` **不在**这个屏蔽集合里 —— 原因见 §7.1。

**②「这一版是测试版」不能笼统改成「已验证」。**
只有 3.2.11 段的改动在 build12 / build13 上逐条验过；3.2.5 ～ 3.2.10 段由单测与
故障注入覆盖，**没有**逐条装机验证。所以新写的 `### How this release was verified`
明确分了三层：最后一轮在装好的应用上量的 / 前几轮靠单测与故障注入的 /
「有一条缺陷还挂着（切回标签页后远程树只剩一个根）——这一轮没再出现，**不等于已经修好**」。

### 2.3 自检（脚本内建，不通过就 exit 1）

合并后不允许残留：

- `## [3.2.5-beta]` ～ `## [3.2.11-beta]` 任一标题
- `### This is a beta` / `### 这是测试版`
- `### Not in this build` / `### 这个包里没有的`

并且 `## [3.2.11]` 与 `## [3.2.4]` 在**整份文件**里各出现且只出现一次。

> ⚠️ 自检只作用于**合并出来的那一段**。`## [3.2.1-beta]` 段里还留着一个
> `### This is a beta`（那是 3.2.1-beta 自己的历史小节），**不要**去动它。

### 2.4 13 个非中英文 locale

`de es fa fr hi it ja pt ru sl tr ur vi` 各插一条 `## [3.2.11] - October 2026`，
**正文沿用英文原文**（与它们从 3.1.3 起的做法一致），插在各自 `## [3.2.4]` 之前。

`he` / `hy` 目录**不存在**，不用处理。中文那一份（`public/changelog/ch/changelog.md`，
locale code 是 `ch` 不是 `zh`）是**完整翻译**的。

---

## 3. README 改动

中英文各改了三处（`README.md` 475 → 621 行，`README.zh-CN.md` 284 → 403 行）。

### 3.1 顶部功能表补 7 行

`## ✨ What we added on top of Sigma File Manager` 的表格最前面插入 3.2.11 的七条，
「起始版本」列写 `3.2.11`。

### 3.2 新增对比表

新章节 `## ⚖️ Alpha File Manager vs Sigma File Manager vs Windows Explorer`，
**放在功能表之后、「What's new in 3.2.11」之前** —— 落地页先讲「为什么用我们」，
再讲「这一版有什么」。

表格 5 列（图标 / 能力 / AFM / SFM / 资源管理器）**12 行**，
符号约定：`✅` 有 · `➖` 这个项目里没有 · `❌` 做不到。

**事实核对**（每一行都查过代码或上游 changelog，不是印象）：

| 行 | 依据 |
|---|---|
| SFM 没有目录树 | 本仓 README 自己的声明（「Everything below is ours. Nothing in this section exists upstream.」） |
| SFM 有分屏，但没有左右互换 | 上游 2.2.0 有 `Linked` / `Split` 两种模式，**模式切换在导航器选项菜单里**；左右互换是 fork 3.2.4 才加的 |
| SFM **没有批量改名** | 上游 changelog 里根本没有这个功能；「Adds batch rename」是 **fork 的 3.0.0**。3.0.1 修的是它自己的静默覆盖 bug |
| SFM 没有四档缩略图 | 「Four thumbnail sizes \| 3.1.0」是 fork 的版本号 → 上游没有 |
| SFM 收藏没有分类 | 「Favourites ask for a category \| 3.1.3」「Dashboard favourites grouped by category \| 3.1.2」都是 fork 的版本号 |
| SFM 与 AFM 都支持 Linux | 本仓 README 首句：*A modern file manager for Windows and Linux*（AFM 是 SFM 的构建） |

表格下面有一段「**该选哪个**」的说明，**如实写出资源管理器的强项**
（Shell 扩展、预览处理器、编解码器、网络共享、EFS、压缩、跳转列表、UAC），
再说明 AFM 的强项（本地与远程并排、助手可驱动、目录树跟着走）。
**不写「资源管理器做不到这些」这种假话** —— 写得诚实才可信。

### 3.2.1 用户反馈后的收紧（2026-10-20 晚）

用户看完第一版对比表后提了四条，都已改（中英文同步）：

1. **两格并排**要写实「同步浏览」这个功能名，并明确 **SFM 没有左右互换、也没有工具栏上的同步浏览开关**。
2. **批量改名**要指出 **SFM 根本没有这个功能**，AFM 的优势是查找替换、大小写转换、模板与编号这些更灵活的规则。
3. **左侧导航 + 收藏夹分类**要单独说明「更便捷访问常用文件夹」。
4. **去掉三行**：安装与升级、框选、与 Windows 外壳的集成。

同时在功能表里也体现了这些改动：新增「同步浏览」行（3.2.6）、
「批量改名」从「数据丢失修复 3.0.1」改成功能本身（3.0.0）、
「目录树侧边栏」改成「左侧目录树」、中文表补齐英文表本来就有的六行。

> ⚠️ 顺带修掉中文表里「四档缩略图尺寸」的**陈旧数值**：
> 24/32/48/54 → **32/48/64/80**。2026-10-15 的验收反馈改过档位
> （「小」不再是更小的排版，而是把「中」整体上移一档），
> 唯一度量来源是 `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts`。
> **凡是 README 里写着具体数值的行，都要回代码里核一遍** —— 文档比代码活得久。

**校验**：`.superpowers/sdd/verify-readme-tables.cjs` 断言中英文五张表**逐行对齐**
（图标、列数、加粗），且图例里出现的符号与表里用到的符号完全一致。
**阳性对照做过**：故意把中文表一个图标改错 → 校验转红；还原后转绿。

### 3.3 新增「What's new in 3.2.11」章节

英文 `## 🆕 What's new in 3.2.11`，中文 `## 🆕 3.2.11 新增了什么`，
8 个小节 + 一个「这个包里没有的」，末尾链到 `CHANGELOG.md`。

小节顺序按「最能吸引人」排：远程服务器 → 目录树 → 两格 → 上传下载 → 删除 → 权限 →
本地改进 → 小修 → 限制。

---

## 4. 升级说明 `_notes.md`

`_notes.md` 是**被 git 追踪**的仓库根文件，历史上放的是「当前这一版的说明」。
本轮把它改写成 3.2.11 的说明（此前里面还躺着 3.2.1-beta 的旧文案），并用它作为
`--notes-file` 的输入，让 `docs/operations/release-workflow.md` 里写的
`--notes-file ./_notes.md` 开箱可用。

**同一份文案会去两个地方**（`docs/operations/release-workflow.md` §一）：

1. 写进站点 `version.json` 的 `notes` —— 应用设置页与站点下载页会显示
2. 经 `prepare --write-notes` 生成 `_release-notes-v3.2.11.md`，再由 `release:github`
   作为 GitHub release 正文

所以**不要在 notes 里手写大小和 sha256** —— 脚本会自动把构建信息追加到 GitHub 正文里。

---

## 5. 门禁

发版前全部跑过（HEAD = 本轮提交）：

| 项 | 基线 | 本轮实测 | 结论 |
|---|---|---|---|
| `node scripts/verify-changelog.mjs` | exit 0 | **exit 0**，20 条目，`3.2.11` 在最前 | ✅ |
| `npx vue-tsc --build` | 0 error | **0 error** | ✅ |
| `npx eslint src` | 170 errors / 0 warnings | **170 errors / 0 warnings** | ✅ 逐字一致 |
| `npx vitest run` | 211 文件 / 1893 用例 | **211 文件 / 1893 用例，全过** | ✅ |
| `cargo test --lib` | 651 passed / 0 failed | **651 passed / 0 failed** | ✅ |

> ⚠️ **eslint 口径必须是 `npx eslint src`**（不是项目脚本 `eslint .`）。
> 整仓口径的基线是 `186 errors / 121 warnings`，与 `eslint src` 的 `170` 不是一回事，
> 混口径会凭空多出 16 个「回归」。

> ⚠️ **门禁不要与重构建并行跑。** 本轮是先跑完门禁，再启动 `tauri build`。
> `vitest` 与 `tauri build` 抢 CPU 会让两边都变慢，且 cargo 的构建锁会让并发行为不可预期。

### 5.3 装机冒烟：更新弹窗确实显示 3.2.11 的说明

发版不是「传上去就完事」。`use-changelog.ts` 的查找逻辑是
`releases.find(r => r.version === appVersion) || releases[0]` ——
**找不到就静默回退到文件里最旧的一条，不报错、不告警**（见 `verify-changelog.mjs`
顶部的注释）。所以「门禁绿」只说明版本号对得上，**不等于用户看得见**。

实测（`release/Alpha File Manager_3.2.11_x64-setup.exe` 静默安装后）：

```
installed: D:\Program Files\Alpha File Manager\alpha-file-manager.exe
ProductVersion = 3.2.11        ← 已装 exe 的版本号
```

打开「设置 → 左上角第二个图标（Sparkles）→ 新功能」，弹窗里：

- 左侧版本列表第一项是 **3.2.11**，带「当前」徽标；下面是 3.2.4 / 3.2.1-beta / 3.1.3 ……
  （七个 beta 段已合并，列表里不再有 3.2.5-beta ～ 3.2.11-beta）
- 主区标题 **3.2.11　2026 年 10 月**，「摘要」是合并后的那段
- 「改了什么」正文全部渲染正常，加粗与行内代码（`v-if` / `v-else` / `<span v-if>`）都对
- **新加的两个小节也在**：**已知限制**（含 `PBSZ` / `PROT P` / `AUTH TLS` 行内代码）
  与 **这一版是怎么验的**（含 `vol1` / `@team` / `study_platform` / `wp_root` / `wp-content`）

> 取证手法备忘：
> - 更新弹窗是 **DOM 里的模态**，所以 `PrintWindow` 能拍到（不需要屏幕 BitBlt）。
> - 弹窗**内层滚动容器不吃鼠标滚轮**（滚轮只动外层），但**点击内容区后按 End 可以滚到底**。
> - `app-wheel.ps1` 的方向语义是反的记法：**`Notches` 为正 = 向下滚**（发 `data=-120`）。
> - 设置页的「更新日志」入口是左上角那一排图标里的**第二个**（Sparkles），
>   不用滚到「常规」页底部找「新功能」。

---

## 6. 发版流水线（本批实际执行）

### 6.1 版本号是**手工改**的，用的是 `--bump none`

这与 `docs/operations/release-workflow.md` §一写的「日常发版」不同，理由和 batch11 完全一样：

- 版本号在仓库里**先手工改成 3.2.11**（`package.json` + `npm run sync-version` 同步三个 Cargo.toml），
- 然后 `prepare --bump none --skip-build`。

**如果这里用 `--bump patch`，版本号会被悄悄推高一位到 3.2.12** ——
因为 3.2.11 已是正式版形态，patch 的语义是「patch + 1」而不是「去后缀」。
而 `--bump none --skip-build` 还有一个好处：**每次提交都能过 changelog 门禁**。
如果让 `prepare --bump patch` 去改版本号，那么「CHANGELOG 已按 3.2.11 写好」与
「package.json 还是 3.2.11-beta」之间会有一个门禁红的窗口。

### 6.2 命令序列

```powershell
# 0. 手工升版本号
#    package.json: "3.2.11-beta" -> "3.2.11"
npm run sync-version          # 同步 3 个 Cargo.toml
npm run verify-changelog      # 此时 3.2.11 有条目，门禁绿

# 1. 打包（**先杀进程**，否则 pdb 被占报 os error 32）
Get-Process alpha-file-manager | Stop-Process -Force
.superpowers\sdd\build-fb4.cmd        # == npm run tauri build（不含 publish-bundle-to-release）

# 1.5 把新包弄进 release/ 并校正 mtime，确认 latestInstaller 选中 3.2.11
node .superpowers\sdd\pin-latest-installer.cjs 3.2.11
node scripts/release-publish.mjs status

# 2. 写站点源（version.json / 复制安装包 / 归档旧版进 history[]）
node scripts/release-publish.mjs prepare --bump none --skip-build --notes-file ./_notes.md

# 3. 生成带大小/sha256 的 _release-notes-v3.2.11.md，供 github 读取正文
node scripts/release-publish.mjs prepare --write-notes ./_notes.md

# 4. SFTP 上传到站点 + 自动回读校验
node scripts/release-publish.mjs upload

# 5. 先推代码（否则 gh release create 的 tag 会落在远端默认分支的旧 HEAD 上）
#    本地 main 是陈旧的（落后 origin/main 12 个提交），先快进：
git checkout main
git merge --ff-only origin/main
git merge --ff-only feat/remote-phase-1-connections-transport
git push origin main
git rev-list -n1 v3.2.11      # 期望 == 发布提交的 sha

# 6. GitHub 兜底 release（3.2.11 无 -beta 后缀 → 正式版并设为 latest）
node scripts/release-publish.mjs github

# 7. 单独公网回读（upload 已自动跑过一次）
node scripts/release-publish.mjs verify
```

### 6.3 产物信息

见 §10「本轮产物」。

---

## 7. 遗留与建议

### 7.1 ⚠️ 远程目录里的「新建文件 / 新建目录」会失败（本轮发现，**未修**）

**现象**：在远程面板里点右键菜单或工具栏的「新建 → 文件 / 目录」，
最终走到本地文件系统引擎，报 **`Directory does not exist: sfm://remote/...`**。

**根因（两处叠加）**：

1. `src/utils/entry-action-policy.ts:51` 的 `REMOTE_PHASE0_BLOCKED_ACTIONS`
   里有 `rename` / `batch-rename` / `copy` / `cut` / `link` / `paste` / `delete` / `delete-permanently`，
   **但没有 `create-file` / `create-directory`**。
2. 更关键的是，**创建类动作根本不经过那个门禁**。三个调用点都是先拦下
   `create-file` / `create-directory` 然后直接 `emit` / `return`，
   `isActionBlockedByEntryPolicy()` 压根没被调用：
   - `src/components/dir-entry-interactive/dir-entry-context-menu.vue:65`
   - `src/modules/navigator/components/file-browser/file-browser-context-menu.vue:32`
   - `src/modules/navigator/components/file-browser/file-browser-status-bar.vue:278`

3. 而 `FileBrowserNewSubmenu` 的显示条件是
   `selectionStats.hasDirectories && !hasVirtualLocationSelection` ——
   `sfm://remote/...` **不匹配** `isVirtualDirectoryPath`（见 `entry-action-policy.ts:68` 的注释），
   所以这个「新建」入口在远程面板里**照常出现**。

**为什么不危险**：Rust 侧 `create_item` 先 `Path::new(&directory_path).exists()`，
`sfm://remote/...` 不是一个存在的本地路径 → 直接返回 `Directory does not exist`，
**不会创建任何东西**。所以是「报错难看」，不是「误创建」。

**建议怎么修**：要么把 `create-file` / `create-directory` 加进
`REMOTE_PHASE0_BLOCKED_ACTIONS` **并**把三个调用点改成先过门禁；
要么在 `file-browser-new-submenu.vue` 的显示条件里加一条「当前是远程路径则不显示」。
前者更根本，后者改动面小。**修之前先确认远程「新建目录 / 重命名」是不是阶段 3 的一部分** ——
如果是，那这属于「功能没做完」，可以等做完再统一放行。

### 7.2 远程功能路线图现状与下一阶段

规格原文：`docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md` §8。

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | VFS 骨架 + provider 抽象 + `sfm://remote` 路径族 + 门禁 | ✅ |
| 1 | 连接管理 + 凭据存储 + 传输层（直连 / SOCKS5 / CONNECT / BIND） | ✅ |
| 2 | FTP 明文只读浏览 + 下载 / 上传 | ✅ |
| 3 | 远程写操作：新建目录 / 重命名 / **删除** | 🟡 **删除 ✅，新建目录 / 重命名 ❌** |
| 4 | FTPS 显式（AUTH TLS）/ 隐式（990） | 🟡 显式 ✅（仅桩服务器），隐式 ❌ |
| 5 | SFTP（私钥 + known_hosts） | ✅（真实服务器验过） |
| 6 | 传输队列化：暂停 / 继续 / 取消、断点续传、失败重试、删除前递归统计、跨边界批量预检 | ❌ |
| 7 | 跨边界拖拽 / 复制粘贴 | ❌ |

**下一阶段建议做「阶段 3 剩余两项：远程新建目录 + 远程重命名」**。理由：

- 阶段 6/7 的抽象依赖阶段 3 的写操作先落地（`RemoteProvider` trait 已有 `remove_path`，
  再加 `create_dir` / `rename_path` 是同构的）。
- 阶段 3 剩余两项做完，「远程目录里新建目录 / 改名」才不至于像现在这样
  「入口在、点了报错」。
- 做完阶段 3 之后，**阶段 7（跨边界拖拽 / 复制粘贴）** 才真正有用户价值 ——
  规格 §8.2 说得很清楚：它只是把「拖到远程目录」「复制后粘贴到远程目录」
  映射到「上传 / 下载」这两个已存在的任务类型，粗估 6–10 人日。

**注意「新建空文件」是永久非目标**（规格 §1），远程侧也不要加。

### 7.3 其它遗留（与上一棒一致，未变）

- **FTP / FTPS 没有真机服务器** —— 远程删除、远程传输的 FTPS 数据通道仍未加密
  （`PBSZ` / `PROT P` 未发）。这两条已经写进 3.2.11 的 `### Known limits`。
- **远程删除的「目录非空」提示**只在 fake provider 验过，未在真机点过。
- **「权限不足」提示真机上没跑出来过** —— fnOS 的 SFTP 通道以特权身份运行，
  SSH 普通用户的权限**不能**代表 SFTP 权限。
- **目录树「切回标签页后只剩一根」不复现** —— 3.2.11 的 changelog 与 README
  都明确写「这一轮没再出现，**不等于已经修好**」，**不得**当成已修复。
- `messages-key-alignment.test.ts` 偶发失败（读语言包时 JSON 解析错误），
  本轮全量重跑通过，**根因仍未定位**。
- MCP 相关界面文案未逐语种校对；13 个非中英文 locale 的 changelog 正文仍是英文。

---

## 8. 踩到的坑

### 8.1 `gh release create` 的 tag 会落在**远端默认分支**的 HEAD 上

`scripts/release-publish.mjs` 的 `github()` 走 `gh release create <tag>`，
不传 `--target` 时 tag 建在**远端默认分支（main）的 HEAD**上，**不是本地 HEAD**。
本地提交没推上去的话，tag 会指向旧提交，release 页面上看不出任何异常。
**所以必须先 `git push origin main`，再 `release:github`。**

### 8.2 本地 `main` 分支是**陈旧的**

`git rev-list --left-right --count main...origin/main` = `12  0` ——
本地 `main` 比 `origin/main` **落后 12 个提交**。它只是某个早期节点。
快进前先 `git checkout main && git merge --ff-only origin/main`。

### 8.3 `latestInstaller()` 按 **mtime** 挑包，而 `cpSync` 不保留时间戳

`scripts/publish-bundle-to-release.mjs` 会把 `bundle/nsis/` 下**每一个**历史 exe
都复制进 `release/`，`fs.cpSync` 默认不保留 mtime → 一堆包的 mtime 全变成「刚才」。
`release-publish.mjs` 的 `latestInstaller()` 按 mtime 降序取第一个，
不校正的话有相当概率**挑到 3.1.0 然后把它当正式版发出去**。
`.superpowers/sdd/pin-latest-installer.cjs <版本>` 会把目标包的 mtime 顶到
「现在 + 2 分钟」，并在最后断言 `latestInstaller()` 选中的确实含该版本号。

### 8.4 `build-fb4.cmd` 跑的是 `npm run tauri build`，**不是** `tauri:build`

`tauri:build` = `sync-version && tauri build && publish-bundle-to-release.mjs`，
多出来的 `publish-bundle-to-release.mjs` 才是把包复制进 `release/` 的那一步。
`build-fb4.cmd` 只跑 `npm run tauri build`，产物只落在
`src-tauri/target/release/bundle/nsis/`。所以 `pin-latest-installer.cjs`
负责「复制 + 顶 mtime + 断言」三件事。

### 8.5 PowerShell 里 `node -e` 带 `"` / `$` / 反引号会被先解析掉

改 `package.json` 的版本号时，`node -e "...replace(/^(\s*\"version\":...)/...)"`
被 PowerShell 解析到 `表达式或语句中包含意外的标记")"`。
**判据：只要 `node -e` 的参数里可能出现 `"`、`` ` ``、`$`，就说明这个写法不该用** ——
换 `edit` 工具，或者写成 `.cjs` 文件再跑。

---

## 9. 常用命令速查

```powershell
# 门禁
npm run verify-changelog
npx vue-tsc --build
npx eslint src
npx vitest run
.superpowers\sdd\cargo-test-lib.cmd

# 打包（**先杀进程**）
Get-Process alpha-file-manager -ErrorAction SilentlyContinue | Stop-Process -Force
.superpowers\sdd\build-fb4.cmd
node .superpowers\sdd\pin-latest-installer.cjs 3.2.11

# 发版
node scripts/release-publish.mjs status
node scripts/release-publish.mjs prepare --bump none --skip-build --notes-file ./_notes.md
node scripts/release-publish.mjs prepare --write-notes ./_notes.md
node scripts/release-publish.mjs upload
node scripts/release-publish.mjs github
node scripts/release-publish.mjs verify
```

---

## 10. 本轮产物

| 项 | 值 |
|---|---|
| 版本 | 3.2.11（正式版，无 `-beta` 后缀） |
| 安装包（站点） | `Alpha_File_Manager_3.2.11_x64-setup.exe` |
| 大小 | 20,304,867 字节（19.36 MiB） |
| SHA-256 | `df6f451bd2615511867f4ffc51047bfc9a53127b7002a66247da2568cdc7fa6b` |
| 站点清单 | `https://www.aiec.fun/alpha-file-manager/version.json`（version=3.2.11，pub_date=2026-10-20T05:45:35Z） |
| GitHub release | `https://github.com/kizemo/alpha-file-manager/releases/tag/v3.2.11`（**Latest**，非预发布） |
| 标签指向 | `v3.2.11` → `cfec0d06`（就是本轮发布提交） |
| 仓库 release/ | `release/Alpha File Manager_3.2.11_x64-setup.exe` |
| 站点源说明文件 | `E:\办公文件\L1网站\alpha-file-manager\_release-notes-v3.2.11.md` |

**上线后的公网回读结果**（`release:verify`，exit 0）：

```
[verify] 线上版本  ：3.2.11
[verify] 清单 sha256：df6f451bd2615511867f4ffc51047bfc9a53127b7002a66247da2568cdc7fa6b
[verify] 本地 sha256：df6f451bd2615511867f4ffc51047bfc9a53127b7002a66247da2568cdc7fa6b
[verify] 源站包大小：20304867 字节（绕过缓存，用户看不到这个）
[verify] 边缘包大小：20304867 字节（CF-Cache-Status=HIT, Age=201s）
[verify] 通过：版本号 / 大小 / sha256 三项均一致（源站与边缘都已生效）
```

SFTP 上传的 17 个文件**逐个 md5 + size 回读一致**（`_upload_alpha_files.py` 的第 4 步），
不是「传完就当成功」。

**GitHub release 正文非空**（这是 `prepare --write-notes` 漏掉就会静默发生的事故）：
正文 = `_notes.md` 全文 + `## 构建信息`（版本号 / 安装包名 / 大小 / SHA-256）。

---

## 11. 下一棒从哪开始

1. 先读 `docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md` §8（阶段划分）
   与 §6（远程写操作的安全设计）。
2. 然后读本文件的 §7.1（远程「新建」入口的缺陷）与 §7.2（阶段 3 剩余两项）。
3. 动手前先读仓库根目录的 `AGENTS.md`（真机验收纪律、打包纪律、夹具纪律）。
