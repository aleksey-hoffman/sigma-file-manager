# winget 清单（Windows Package Manager）

本目录保存提交到 [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs) 的
清单原文，方便后续版本照着改。

## 已提交的版本

| 版本 | PR | 状态 |
|---|---|---|
| 3.5.1 | https://github.com/microsoft/winget-pkgs/pull/460692 | open（等待 CLA 与评审） |

目录结构与上游仓库一致：

```
manifests/<包 ID 首字母小写>/<包名>/<包 ID>/<版本>/
    <包 ID>.yaml                # ManifestType: version
    <包 ID>.installer.yaml      # ManifestType: installer
    <包 ID>.locale.en-US.yaml   # ManifestType: defaultLocale
    <包 ID>.locale.zh-CN.yaml   # ManifestType: defaultLocale
```

## 三条必须守住的规则

1. **`Publisher` 必须等于安装器写进 Windows ARP 的那个发布者。**
   它的来源是 `src-tauri/tauri.conf.json` 的 `bundle.publisher` → NSIS 模板的
   `!define MANUFACTURER` → `WriteRegStr ... "Publisher"`。
   两者对不上，包管理器就不认为你机器上装的是清单里那个程序，升级也就不会认出来。
   改 `bundle.publisher` 之后**必须重新打包并重新发版**，否则清单和安装包对不上。

2. **一个 PR 只放一个版本，只放清单文件。** 上游的校验流水线会拒绝夹带非清单改动。

3. **`InstallerSha256` 是安装包字节的 SHA-256**（大写十六进制）。
   重新打包后哈希会变，清单和 PR 都要一起更新。

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

## 还没解决的事

安装包**没有代码签名**。上游评审通常会要求签名，这需要发布者自己准备证书；
在拿到证书之前，本目录里的清单只能覆盖无签名的版本。
