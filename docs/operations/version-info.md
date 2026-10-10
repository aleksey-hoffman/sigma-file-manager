# `version.json` 字段说明

站点上的 `https://www.aiec.fun/alpha-file-manager/version.json` 是应用的**主更新源**。GitHub release 仅作兜底，主源不可用时才查询。

结构参考 WeavePage 项目的同名文件，额外增加了 `sha256`、`release_url` 与 `history[]`。

---

## 完整示例

```json
{
  "version": "2.2.0",
  "notes": "v2.2.0 —— 目录树刷新修复、首次启动按系统语言设语言",
  "pub_date": "2026-10-10T01:16:52Z",
  "sha256": "cc78158c61e48a8f88ca77edc08b4e8401618353591c4ef6119df488c94b47e7",
  "release_url": "https://www.aiec.fun/alpha-file-manager/",
  "platforms": {
    "windows-x86_64": {
      "url": "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.2.0_x64-setup.exe",
      "signature": ""
    }
  },
  "history": []
}
```

---

## 字段

| 字段 | 必填 | 作用 |
|---|---|---|
| `version` | **是** | 最新版本号。与 `package.json` 一致。不带 `v` 前缀 |
| `notes` | 否 | 更新说明。应用设置页与站点下载页都会显示。缺失或空串会被当成「无说明」 |
| `pub_date` | 否 | 发布日期，RFC3339 UTC。格式错误不影响检查，仅用于展示 |
| `sha256` | 否 | **当前版本安装包的 sha256**，64 位十六进制。应用下载后本地比对，不匹配则**删除文件** |
| `release_url` | 否 | 人类可读的版本说明页。应用「查看发布页」按钮用它。站点源没有 GitHub 的 `html_url`，**不填则该按钮拿不到地址** |
| `platforms` | **是**（要能下载时） | 按 `平台-架构` 键索引的安装包信息 |
| `history[]` | 否 | 历史版本列表，最新在前，上限 20 条 |

### `platforms.<key>`

| 字段 | 必填 | 说明 |
|---|---|---|
| `url` | **是** | 安装包完整下载地址 |
| `update_url` | 否 | 增量更新包地址。本项目未使用，保留以兼容格式 |
| `signature` | 否 | Tauri 官方 updater 签名。本项目是「下载后手动运行」，**不引入 minisign，恒为空** |

**平台键的匹配规则**（`version_json.rs` 的 `platform_key_candidates()`）：

| 当前平台 | 依次尝试的键 |
|---|---|
| Windows x64 | `windows-x86_64` → `windows` |
| Windows ARM64 | `windows-aarch64` → `windows` |
| macOS ARM64 | `macos-aarch64` → `macos` |
| Linux x64 | `linux-x86_64` → `linux` |

即清单里只写宽松的 `windows` 也能工作。

### `history[]` 每条

```json
{
  "version": "2.1.0",
  "notes": "……",
  "pub_date": "2026-09-01T00:00:00Z",
  "url": "https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.1.0_x64-setup.exe",
  "sha256": "……"
}
```

由 `release:prepare` 在版本号变化时自动写入——它会把旧的顶层条目搬进 `history`。同版本重打包时**不归档**，否则历史会被搅乱。

---

## 应用侧如何消费

```
check_for_updates
  │
  ├─ 拉主源 version.json（强制追加 ?_=<时间戳>，带 Accept-Encoding: identity）
  │    └─ 解析失败 → 回落 GitHub 兜底源
  │
  ├─ parse_version_to_number(version) <= current → 「已是最新」，【不回落】
  │
  └─ 有更新 → 取 platforms 里当前平台的 url、notes、sha256、release_url
                    │
                    └─ download_release_installer
                         └─ 下载完成 → 本地比 sha256
                              ├─ 一致 → 返回路径，用户手动运行
                              └─ 不一致 → 删除文件并报错
```

### 三条容易踩的语义

1. **主源「无更新」时不回落。** 若改成两源都查取更高者，GitHub 就成了第二条推送通道，「改回 `version.json` 即可停止推送」这个回滚开关会失效。该行为由 `does_not_query_fallback_when_manifest_says_up_to_date` 锁死。

2. **版本号没变就测不出更新。** 本地装 2.2.0、线上也是 2.2.0，应用会正确显示「已是最新」。要验证更新路径，需临时把线上 `version` 调高。

3. **清单里没有当前平台的条目时，仍报告「有更新」**，只是不给下载直链，UI 退化成「查看发布页」。静默报成「已是最新」是错的。

---

## 手工改线上清单（调试用）

```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl "https://www.aiec.fun/alpha-file-manager/version.json?_=$ts"
```

**必须带时间戳**，否则可能读到 Cloudflare 缓存而误判「改动没生效」。

改完记得改回——这是线上文件。
