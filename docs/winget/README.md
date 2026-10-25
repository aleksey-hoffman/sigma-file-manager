# winget 清单（Windows Package Manager）

本目录保存提交到 [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs) 的
清单原文，方便后续版本照着改。

## 已提交的版本

| 版本 | PR | 状态 |
|---|---|---|
| 3.5.1 | https://github.com/microsoft/winget-pkgs/pull/460744 | 校验 10 步全绿（`Validation-Completed`），等版主评审 |
| 3.6.0 | 尚未提交 | 清单**已备好**（`manifests/.../3.6.0/`），**等 3.5.1 合并后再开 PR**（2026-10-25 决定） |

目录结构与上游仓库一致：

```
manifests/<发布者首字母小写>/<发布者>/<应用名>/<版本>/
    <包 ID>.yaml                # ManifestType: version      —— 带 DefaultLocale 字段
    <包 ID>.installer.yaml      # ManifestType: installer
    <包 ID>.locale.en-US.yaml   # ManifestType: defaultLocale —— 其 PackageLocale 必须等于上面那个 DefaultLocale
    <包 ID>.locale.zh-CN.yaml   # ManifestType: locale        —— 其它语言只能是这个值
```

中间两层是**包 ID 按点拆开后的发布者段与应用名段**，不是包名 —— 本项目是
`kizemo.AlphaFileManager` ⇒ `manifests/k/kizemo/AlphaFileManager/3.5.1/`，
不是 `Alpha File Manager`（带空格，不能当目录名）。
对照：`manifests/j/Justsenger/ExHyperV/1.5.2/Justsenger.ExHyperV.yaml`。

> 踩过的坑：用 contents API 提交时，如果相对路径以 `.../winget/manifests` 为基准，
> `manifests/` 这层根目录会被吃掉，文件落到仓库根下的 `k/...` ——
> 机器人直接判 `missing the manifests folder`。相对路径必须以包含 `manifests/` 的那层为基准。

## 必须守住的规则

1. **`Publisher` 必须等于安装器写进 Windows ARP 的那个发布者。**
   它的来源是 `src-tauri/tauri.conf.json` 的 `bundle.publisher` → NSIS 模板的
   `!define MANUFACTURER` → `WriteRegStr ... "Publisher"`。
   两者对不上，包管理器就不认为你机器上装的是清单里那个程序，升级也就不会认出来。
   改 `bundle.publisher` 之后**必须重新打包并重新发版**，否则清单和安装包对不上。

2. **一个 PR 只放一个版本，只放清单文件。** 上游的校验流水线会拒绝夹带非清单改动。

3. **`InstallerSha256` 是安装包字节的 SHA-256**（大写十六进制）。
   重新打包后哈希会变，清单和 PR 都要一起更新。

4. **一个版本目录里，每种 `ManifestType` 只允许一份文件。**
   `version` / `installer` / `defaultLocale` 各一份；其它语言一律写
   `ManifestType: locale`。两份 locale 文件都写 `defaultLocale`，上游会判
   `DuplicateMultiFileManifestType`（"The multi file manifest should contain only one
   file with the particular ManifestType"），校验在第 02 步直接停掉，后面几步根本不跑。

   规则出处：`microsoft/winget-cli` 的
   `src/AppInstallerCommonCore/Manifest/YamlParser.cpp` —— `Version` / `Installer` /
   `DefaultLocale` 各自有一个「已找到」标志位，重复即报错；`Locale` 分支只查
   `PackageLocale` 是否重复（错误码 `DuplicateMultiFileManifestLocale`），允许多份。

   顺带两个 schema 差异（`aka.ms/winget-manifest.*.1.12.0.schema.json`）：

   - `defaultLocale` 必填 `Publisher` / `PackageName` / `License` / `ShortDescription`；
     `locale` 只必填 `PackageIdentifier` / `PackageVersion` / `PackageLocale` /
     `ManifestType` / `ManifestVersion`。
   - **`Moniker` 只在 `defaultLocale` 的字段表里**，`locale` 的字段表里没有。

   所以 locale 文件只放「翻译过的那些字段」（对照上游
   `manifests/m/Microsoft/AKSdesktop/0.43.0/`）：`PackageIdentifier`、`PackageVersion`、
   `PackageLocale`、`ShortDescription`、`Description`、`Tags`、`ManifestType`、
   `ManifestVersion`。完整元数据（`Publisher`、`PackageName`、`License`、`Moniker`…）
   留在 `defaultLocale` 文件里。

5. **`version` 文件的 `DefaultLocale` 必须等于 `defaultLocale` 文件的 `PackageLocale`。**
   不一致会被判 `InconsistentMultiFileManifestDefaultLocale`。

## 提交方式

不需要带 `winget` scope 的令牌 —— 那个 scope 只给「Submit new package」工具用。
直接开 PR 即可：

1. fork `microsoft/winget-pkgs`；
2. 从 `master` 拉一个分支，把 `manifests/` 下对应的文件放进去；
3. 向 `master` 开 PR，标题用 `New package: <包 ID> version <版本>`。

上游会自动跑校验流水线（会下载安装包核对哈希、跑 `winget validate`、
在沙箱里试装）。本机没装 `winget` 命令行时，本地那两项就交给流水线。

## CLA 签署：每次提交新包前先做这一步

上游机器人 `microsoft-github-policy-service` 会在 PR 里留言，要求回复一行命令：

```
@microsoft-github-policy-service agree
```

回复后 `license/cla` 校验变 success（摘要 "All CLA requirements met."）。
两个版本含义不同 —— 一个是「个人独立拥有知识产权、不是为雇主工作」，
一个是「在为雇主工作过程中提交、已获雇主许可」，**只能由账号本人选**。
同一个 GitHub 账号对 microsoft 各仓库只需签一次，之后不用重复。

代发命令（令牌身份就是 PR 作者）：

```powershell
gh pr comment <PR号> --repo microsoft/winget-pkgs --body '@microsoft-github-policy-service agree'
```

## 校验什么时候跑

上游现在是「Agentic Workflow」体系：`.github/workflows/*.lock.yml` 由打标签触发，
真正的清单校验由 `wingetvalidator-prod[bot]` 这个 App 跑。新包会先被自动打上
`Project-File` 标签，校验随后才开始 —— 要下载安装包核对哈希、在沙箱里试装，
十几分钟起步。**PR 提交后没有立刻出现校验结果是正常的**。

## 校验怎么跑、怎么看、怎么重跑

**状态看标签，不看 check runs。** 校验 App 在一次 operation 结束后会把自己的 10 条
check run 删掉，所以「PR 上没有校验条目」通常意味着**已经跑完了**。真正的状态在标签上：

| 标签 | 含义 |
|---|---|
| `Validation-Completed` | 校验通过（常同时有 `Azure-Pipeline-Passed`） |
| `Validation-Executable-Error` | 校验脚本自身出错 |
| `Validation-Installation-Error` | 沙箱试装失败 |
| `Validation-Defender-Error` | 安装包被 Defender 拦 |
| `Validation-Guide` | 机器人在 PR 里给了指引 |
| `Needs-Author-Feedback` | 要作者回复 |

**重跑校验：** ① 版主在 PR 里发 `@wingetbot run`（非版主发会被拒，机器人回
`Commenter does not have sufficient privileges`）；② 推一个新的 commit（`synchronize` 事件）——
**不能是空提交**，空提交会被判 `noContent`（"This pull request does not update any files"）。
想重跑就往清单里加一行真实的注释再推。

**踩过的坑：** 一次 operation 报 `Internal-Error-PR` / `WinGetSvcError`（03–09 步全 skipped、
10 步 neutral），发生在分支正被连续删/加文件的半路上 —— operation 是在 diff 还没稳定时算的。
**一次把清单推到位再让它跑**，别一边改一边验。

**第 08 步（沙箱试装）可能跑很久，别当成卡死。** 本项目实测 3.5.1 这一轮第 08 步
从 07:10 跑到 07:45，**约 35 分钟**（同期其它包样本约 10 分钟）。原因：
`src-tauri/tauri.conf.json` **没有配 `webviewInstallMode`**，Tauri v2 默认
`downloadBootstrapper` —— 沙箱机器上没装 WebView2 运行时时，安装过程要联网下载
引导程序再装运行时（~130MB）。这是**安装耗时**，不是挂起。
⚠️ 取舍：改 `offlineInstaller` 会让安装包多出 ~130MB；改 `skip` 则目标机没装
WebView2 就跑不起来。当前配置已通过上游校验，暂不需要动。

## 校验通过之后

机器流程到此为止，剩下的是**社区版主人工评审与合并**。上游机器人会留言：

> The check-in policies require a moderator to approve PRs from the community.
> Our moderators are community volunteers, please be patient and allow them
> sufficient time to review your submission.

已合并的上游 PR 标签形如 `Validation-Completed` + `Azure-Pipeline-Passed` +
`Moderator-Approved` + `New-Package` —— `Moderator-Approved` 是版主加的，
**我们加不了，也不该加**。版主的名单见
`doc/Moderation.md#moderators`。`@wingetbot run` 也只有版主能发。

## 3.6.0 的清单：已备好，等 3.5.1 合并

2026-10-25 决定：**不与 3.5.1 并行提交**。3.5.1 还没被版主合并，
同时提 3.6.0 有可能被要求「等前一版合了再提」；先合并、再提，链路更干净。

`manifests/k/kizemo/AlphaFileManager/3.6.0/` 下四个文件已经写好并入库，
**3.5.1 一合并就可以直接提**，剩下的只是开 PR + 回 CLA + 等校验。

### 这一版清单的几个取舍

1. **`ManifestVersion` 仍是 `1.12.0`，不升到上游当前的 `1.28.0`。**
   上游最近合并的 PR 里 1.28.0 是主流，但抽样 6 份最近合并的清单，
   仍有 2 份用 1.12.0、1 份用 1.6.0 —— **旧 schema 版本照收不误**，
   而 1.12.0 已经被 3.5.1 验证过一轮，风险最低。

2. **`Tags` 上限是 16 个，而 3.5.1 的标签**正好已经 16 个** ——
   想加新功能的标签必须先删一个。删掉的是 `file-management`
   （与 `file-manager`、`file-explorer` 语义重复），换上 `file-unlock`。

3. **`ReleaseDate` 用 `2026-10-25`** —— release 实际发布时刻是
   `2026-10-24T16:07:34Z`，按本地（UTC+8）日期算就是 10-25；
   且必须**严格晚于** 3.5.1 的 `2026-10-24`。

4. **`ShortDescription` 与 `Description` 加了本版的新能力**（解除文件锁定 / 彻底删除），
   长度远在 schema 上限内（256 / 10000）。

5. **`InstallerSha256` = `A2724AC9…D644A`**，与 GitHub release v3.6.0 的资产、
   `release/` 下的本地安装包、站点 `version.json` 三方一致（20,608,754 字节）。

### 本地自检

本机**没装 `winget` 命令行**（`Get-Command winget` 为空），所以本地那两项
（`winget validate`、沙箱试装）交给上游流水线。但上游一轮校验要十几分钟起步，
错误的往返成本很高 ⇒ 写了一个本地自检脚本，把 schema 约束与上游规则
逐条核一遍：

```powershell
npm run check:winget
```

它检查：四个文件齐全 / 无 BOM / LF / 末尾换行 / YAML 可解析；
`PackageIdentifier` 与 `PackageVersion` 一致；四种 `ManifestType` 各一份；
`version.DefaultLocale` == `defaultLocale.PackageLocale`；
locale 文件不重复声明 defaultLocale；locale 文件只带可翻译字段、`Moniker` 不外泄；
`ShortDescription` / `Description` / `Tags` 的长度与去重；
`InstallerSha256` 与**本地安装包实际字节**核对；
`InstallerUrl` 指向本版本 GitHub release 资产。

⚠️ 它**不能替代上游流水线** —— 真值仍以 `Validation-Completed` 标签为准。

### 3.5.1 合并后要做的

1. fork `microsoft/winget-pkgs`（本地还没有克隆，需要先 clone）；
2. 从 `master` 拉分支，把 `manifests/k/kizemo/AlphaFileManager/3.6.0/` 四个文件放进去；
3. 向 `master` 开 PR，标题 `New package: kizemo.AlphaFileManager version 3.6.0`；
4. 机器人要求时回一行 `@microsoft-github-policy-service agree`；
5. 等校验跑完（看标签，不看 check runs），再等版主评审。

## 还没解决的事

安装包**没有代码签名**。上游评审通常会要求签名，这需要发布者自己准备证书；
在拿到证书之前，本目录里的清单只能覆盖无签名的版本。
