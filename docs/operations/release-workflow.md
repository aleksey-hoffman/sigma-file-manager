# 发版流程

Alpha File Manager 的更新渠道：**主源是自建站 `https://www.aiec.fun/alpha-file-manager/`**，GitHub release 仅作可用性兜底。

应用检查 `version.json` 判断是否需要更新；下载安装包后本地比 sha256，不匹配就删除文件。

---

## 一、日常发版（最常用）

写好本版的更新说明后，**四条**命令：

```powershell
# 1) 升版本号 + 打包 + 写站点源（version.json 与安装包副本）
npm run release:prepare -- --bump patch --notes-file ./_notes.md

# 2) 生成带构建信息的 _release-notes-v<版本>.md —— 不能省，见下
npm run release:prepare -- --write-notes ./_notes.md

# 3) 上传到 aiec.fun，并自动做公网回读校验
npm run release:upload

# 4) 发布 / 更新 GitHub 兜底 release
npm run release:github
```

`--bump` 可选 `patch`（默认）/ `minor` / `major` / `none`。`none` 表示版本号不变、只重打包——**仅在重发同版本修复包时使用**。

### 第 2 步为什么不能省

`release:github` 只**读**站点源目录里的 `_release-notes-v<版本>.md`，它自己从不生成这个文件。
唯一的生成入口就是 `prepare --write-notes`，而且它必须在 `release:prepare`（打包）**之后**跑 ——
因为它要把实际的大小与 sha256 追加进说明。

漏掉这一步**不会报任何错**：`github()` 走 `if (fs.existsSync(notesPath))` 的假分支，
`gh release create` 不带 `--notes-file`，于是安静地发出一个**正文为空**的 release。
2026-10-14 发 3.1.0 时就是这么中招的，补跑 `--write-notes` + `release:github` 才把正文写回去。

`prepare --write-notes` 在 `prepare()` 之前短路，不会动版本号、不会触发构建，可以安全重跑。

### `_notes.md` 会被同时用作两处文案

- 写进 `version.json` 的 `notes`，应用设置页与站点下载页都会显示
- 经第 2 步生成说明文件，再由 `release:github` 作为 GitHub release 正文

所以**不要在 notes 里手写大小和 sha256**，脚本会自动把构建信息追加到 GitHub 说明里；`version.json` 里则不需要这两项。

---

## 二、四处状态必须一致

一次发版会同时改动这些地方，任何一处漏掉都会产生「看起来成功、实际不一致」的故障：

| # | 位置 | 由谁更新 |
|---|---|---|
| 1 | `package.json` / `src-tauri/Cargo.toml` 的 `version` | `release:prepare` |
| 2 | `release/Alpha File Manager_<版本>_x64-setup.exe` | `tauri build` 自动 |
| 3 | 站点源目录的安装包副本 + `version.json` | `release:prepare` |
| 4 | 服务器上的文件 / GitHub release 资产 | `release:upload` / `release:github` |

**最阴的一处是 sha256 必须与安装包成对更新。** 应用下载后会本地比 sha256，不匹配就删文件——只换包不同步清单，校验功能反而会挡住正常用户。`release:prepare` 把这两步绑在同一条命令里就是为了这个。

---

## 三、校验

```powershell
npm run release:status    # 本地与线上现状对比
npm run release:verify    # 只做公网回读，不改动任何东西
```

`verify` 会检查：线上版本号、清单 sha256、线上包 Content-Length、本地包 sha256。四项一致才通过。

> 这个校验**是有判别力的**：拿一个哈希不符的安装包喂给它，会 exit 1 并说明原因。它不是「什么都没做也绿」。

**每次上线后都要用带时间戳的地址手工回读一次**（脚本内部已这么做）：

```powershell
curl "https://www.aiec.fun/alpha-file-manager/version.json?_=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
```

---

## 四、缓存：客户端绕行是唯一手段

站点在 Cloudflare 之后，且服务器 web 服务是 **nginx**——`.htaccess` 是 Apache 专有机制，**在服务器上完全不生效**（参考项目 WeavePage 目录下那个 `.htaccess` 也一直是摆设）。

实测 Cloudflare 对该 JSON 返回 `CF-Cache-Status: DYNAMIC`（边缘不缓存），但服务端没下发 `Cache-Control`。

所以：**客户端强制追加 cache-busting 参数是唯一且充分的保障**。改客户端请求时不要把它删掉。

---

## 五、站点文件位置

| 项 | 路径 |
|---|---|
| 本地源 | `E:\办公文件\L1网站\alpha-file-manager\` |
| 服务器 | `/var/www/wordpress/alpha-file-manager/`（`47.120.26.175:22`，用户 `kizemo`） |
| SFTP 凭据 | `E:\办公文件\L1网站\.vscode\sftp.json`（**绝不外泄**） |
| 上传用的 python | `E:\办公文件\L1网站\.venv-sftp\Scripts\python.exe`（含 paramiko） |

站点目录下的 `_upload_alpha_files.py` 与 `_release-notes-*.md` 是**本地工具，不在上传白名单内**，不会被传到服务器。因为 `.htaccess` 的屏蔽规则在 nginx 上无效，安全性依赖这个白名单。

脚本路径可用环境变量覆盖：`AFM_SITE_DIR` / `AFM_SITE_URL` / `AFM_SFTP_PYTHON` / `AFM_GH_REPO` / `AFM_TOOLCHAIN_BIN`。

---

## 六、回滚

最廉价的回滚手段：**把站点 `version.json` 的 `version` 改回旧值**，用户立刻不再收到更新提示，无需回滚应用、无需重装。

Rust 侧的双源语义保证了这个开关有效——主源「解析成功但无更新」时**不会**去查 GitHub 兜底源取更高版本，否则这个开关会失效。

---

## 七、回滚之外需要改代码时

`src-tauri/src/app_updater.rs` 里两个常量定义了更新源：

- `UPDATE_MANIFEST_URL` —— 主源
- `GITHUB_RELEASES_API_URL` —— 兜底源（**必须指向自己的仓 `kizemo/alpha-file-manager`，不是 sigma 上游**）

改域名时别丢掉 `validate_download_url()` 里的 **HTTPS 强制 + localhost / 元数据服务 / 私有 IP 拒绝**——那是防 SSRF 的安全网。
