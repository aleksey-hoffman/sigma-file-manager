# 批次 11：3.2.4 正式版发布 —— 实施结果与交接

> 写入时间：2026-10-17
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
> 分支：`main`
> 本文覆盖批次 8/9/10 的**正式版收尾**：版本号去 beta、README 与 14 语种更新日志补齐、
> 打包并推送到 GitHub 与 aiec.fun。

---

## 0. 一句话结论

3.2.2-beta / 3.2.3-beta / 3.2.4-beta 这三个测试版**从未对外发布过**
（`gh release list` 最高只到 `v3.2.1-beta`，站点 `version.json` 也停在 `3.2.1-beta`），
因此本批把它们**合并成一条 `3.2.4` 正式版记录**，而不是在 changelog 里留三条没人装过的版本。
README 与 14 份本地化 changelog 同步补齐，打包 → 站点 → GitHub 全链路走通。

---

## 1. 为什么合并而不是保留三条 beta

| 版本 | 站点发过？ | GitHub 发过？ | 合并处理 |
|---|---|---|---|
| 3.2.1-beta | ✅ 是 | ✅ 是（Pre-release） | **保留**，用户真能拿到 |
| 3.2.2-beta | ❌ 否 | ❌ 否 | 合并进 3.2.4 |
| 3.2.3-beta | ❌ 否 | ❌ 否 | 合并进 3.2.4 |
| 3.2.4-beta | ❌ 否 | ❌ 否 | 合并进 3.2.4 |

判据不是「看起来像 beta」，而是**「有没有人装得到」**。3.2.1-beta 是站点与 GitHub
上都存在的版本，删掉它会让一个真实存在过的发行版本从历史里消失；3.2.2–3.2.4 三个
从未上传，留着只会让更新弹窗与 README 的版本脉络出现没人走过的断档。

> 如果将来决定要把 beta 历史完整留档，判据仍然是上表 —— 用
> `gh release list --repo kizemo/alpha-file-manager` 与站点 `version.json` 对一遍，
> 不要凭印象。

---

## 2. 改动清单

### 2.1 版本号（四处 + lock）

`3.2.4-beta` → `3.2.4`：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/default-file-manager-common/Cargo.toml`
- `src-tauri/default-file-manager-launcher/Cargo.toml`
- `src-tauri/Cargo.lock`（由 cargo 自动跟随，非手改）

前三处与 package.json 的同步由 `npm run sync-version` 保证（`scripts/sync-version.js`）。
**发版时只改 `package.json` 一个文件即可**，但本批四个都显式改了，便于 diff 自检。

### 2.2 `CHANGELOG.md` 与 `public/changelog/ch/changelog.md`

三条 beta 合并为一条正式版，去掉全部 `### This is a beta` / `### 这是测试版` 段落，
并在结尾补一段说明 3.2.1-beta 的 MCP 服务原样保留、仍然只读。

正式版正文覆盖三块功能（地址栏 / 分屏互换 / 窄屏缩略图入口），即三个 beta 的内容总和。

### 2.3 其余 13 个 locale

`de es fa fr hi it ja pt ru sl tr ur vi` 各补一条 `## [3.2.4] - October 2026`。

**正文沿用英文原文**，与这些目录既有做法一致 —— 它们从 3.1.3 起就是「只翻译首行标题
（`# Änderungsprotokoll` / `# 変更履歴` …），正文保持英文」。若要真正本地化，
那是另一个工作量，不应在本批顺带做一半。

> `public/changelog/he/` 与 `hy/` 目录不存在，`use-changelog.ts` 会回退到英文根
> `CHANGELOG.md`，行为正确，无需处理。

### 2.4 `README.md` / `README.zh-CN.md`

- 顶部「我们在 Sigma File Manager 之上加了什么」表格补三行（起始版本 3.2.4）：
  地址栏按资源管理器方式工作 / 分屏左右互换 / 窄窗口菜单里有缩略图大小；
- 新增 `## 🆕 What's new in 3.2.4`（英）与 `## 🆕 3.2.4 新增了什么`（中）章节，
  插在 3.2.1-beta 章节之前。

README 的下载链接是站点根 URL（`https://www.aiec.fun/alpha-file-manager/`），
**没有硬编码版本号**，因此发新版不需要改链接。

---

## 3. 本批踩的坑

### 3.1 合并脚本第一版把「切分点」写成了锚点位置，等于什么都没删

```js
// ❌ 错的：anchor 是 3.2.1-beta 的位置
write(relPath, source.slice(0, anchor.index) + stableEntry + source.slice(anchor.index));
```

这个写法把「前缀切分点」和「后缀接续点」都设成了 3.2.1-beta，结果是**旧的三条
beta 一条没删，只是把新条目插到了 3.2.1-beta 前面**。

正确写法需要两个不同的 index：

```js
const start  = /^## \[3\.2\.4-beta\] - /m.exec(source);   // 删从哪里开始
const anchor = /^## \[3\.2\.1-beta\] - /m.exec(source);   // 删到哪里结束
write(relPath, source.slice(0, start.index) + stableEntry + source.slice(anchor.index));
```

**为什么值得记**：脚本自查了「还有没有残留的 `3.2.x-beta`」，所以它**报了错**，
而不是安静地产出一个错误的 changelog。但因为版本号已经改过了，重跑前必须先
`git checkout -- CHANGELOG.md public/changelog/ch/changelog.md` 才能恢复幂等判断。

> 推广：批量改文档的脚本，**自检要检查「不该存在的旧内容」**，而不只是检查
> 「新内容在不在」。只查后者的话，「插进去了但没删干净」这类错误会静默通过。

### 3.2 `npm run tauri build` 根本不把产物放进 `release/`，而且就算放了 mtime 也全乱

这条坑有两层，第二层比第一层更隐蔽。

**第一层：脚本名字对不上。** `.superpowers\sdd\build-fb4.cmd` 跑的是
`npm run tauri build`。npm 会把 `build` 当参数追加到 `tauri` 脚本后面，
于是实际执行的是 `tauri build` —— **不含** `scripts/publish-bundle-to-release.mjs`。
后者只串在 `tauri:build` 上（`npm run tauri:build` 才是
`sync-version && tauri build && publish-bundle-to-release`）。

结果就是：产物只在 `src-tauri/target/release/bundle/nsis/` 里，`release/` 里根本没有它。
本批实测 `release-publish.mjs status` 挑到的是 **`Alpha File Manager_3.2.1-beta`** ——
一个 3.2.1 的包。照着这个状态跑 prepare，会把 3.2.1-beta 当成 3.2.4 发出去。

**第二层：即使跑了 publish 脚本，mtime 也会全乱。**
`publish-bundle-to-release.mjs` 遍历 `bundle/nsis/` 下**每一个** exe 复制到
`release/`，而 `fs.cpSync` 默认 `preserveTimestamps: false` —— 于是 17 个包的
mtime 全变成「刚才」。而 `latestInstaller()` 是按 mtime 降序取第一个，
排序结果就变得不确定。

**本批的处理**：`.superpowers/sdd/pin-latest-installer.cjs` 做两件事 ——
把 `bundle/nsis/` 里的新包复制进 `release/`（若尚不存在），再用 `fs.utimesSync`
把它的 mtime 顶到「现在 + 2 分钟」，最后**断言** `latestInstaller()` 选中的就是它，
不是就退出码非零。

> 这解释了 AGENTS.md 里「发版前必须先把新包复制进 `release/`」那条约定的**根因**。
> 更准确的说法是：**复制完还要确保它 mtime 最新，且发版前用 `status` 亲眼确认一次**。
> `prepare` 自己不会验证挑中的包对不对版本 —— 它只会把挑中的那个发给全世界。

### 3.3 `git commit -F` 在中文 locale 下会打 setlocale 警告

`sh: warning: setlocale: LC_ALL: cannot change locale (zh-CN): No such file or directory`

无害，提交正常完成。提交信息文件一律用 node `fs.writeFileSync(..., 'utf8')` 生成
（PowerShell `Out-File -Encoding utf8` 会加 BOM，表现为 `git log` 里提交信息开头有
不可见字符）。

---

## 4. 门禁（HEAD = 本批提交）

| 项 | 基线 | 本批实测 | 结论 |
|---|---|---|---|
| `cargo test --lib` | 386 passed | **386 passed / 0 failed** | ✅ |
| `npx vue-tsc --build` | 0 error | **0 error** | ✅ |
| `npx eslint src` | 179 errors / 0 warnings | **179 errors / 0 warnings** | ✅ 逐字一致 |
| `npx vitest run` | 186 文件 / 1465 用例 | **186 文件 / 1465 用例，全过** | ✅ |
| `node scripts/verify-changelog.mjs` | 退出码 0 | **退出码 0，14 语种全覆盖** | ✅ |

> ⚠️ **eslint 口径必须是 `npx eslint src`**（不是项目脚本 `eslint .`）。
> 基线 `186 errors / 121 warnings` 是整仓口径，`eslint src` 在同一提交上是
> `179 / 121`，差的那 7 个是 `src` 之外的存量。混口径会凭空多出 7 个「回归」。

### 4.1 一次 flaky：`has no blank or whitespace-only values anywhere`

全量 `vitest run` 第一次跑出 `1 failed | 1464 passed`，失败的是
`src/localization/__tests__/messages-key-alignment.test.ts` 里
「no blank or whitespace-only values anywhere」这一条。单独重跑该文件是
`18 passed / exit 0`，全量重跑是 `186 passed / 1465 passed / exit 0`。

本批**没有改动任何 `src/localization/**` 文件**，因此判定为全量并行下的偶发。
未深查成因；若后续频繁复现，需要单独排查该测试是否与其他测试共享
`src/localization/messages/` 的读写。

---

## 5. 发版流水线（本批实际执行）

脚本：`scripts/release-publish.mjs`

> ⚠️ **本批实际执行的 prepare 命令与「常规流程」不同，照抄常规流程会发错版本。**
> 因为本批已经把 `package.json` 手工改成 `3.2.4`（见 §2.1），此时再跑
> `--bump patch`，`bumpVersion('3.2.4', 'patch')` 会返回 **`3.2.5`** ——
> `3.2.4` 已是正式版形态，不再带预发布后缀，patch 的语义是「patch + 1」。
> 所以必须用 `--bump none` 冻结版本号，并加 `--skip-build` 免得再打一次包。

```bash
# 0. 打包
.superpowers\sdd\build-fb4.cmd          # == npm run tauri build（见 §3.2 的坑）

# 0.5 把新包弄进 release/ 并校正 mtime，确认 latestInstaller 选中 3.2.4
node .superpowers/sdd/pin-latest-installer.cjs 3.2.4
node scripts/release-publish.mjs status

# 1. 写站点源（version.json / 复制安装包 / 生成 release notes）
#    版本号已在仓库里手工改好，这里必须 --bump none
node scripts/release-publish.mjs prepare --bump none --skip-build \
     --notes-file .superpowers/sdd/release-notes-3.2.4.md

# 2. 生成带大小/sha256 的 _release-notes-v3.2.4.md，供 github 读取正文
node scripts/release-publish.mjs prepare --write-notes .superpowers/sdd/release-notes-3.2.4.md

# 3. SFTP 上传到站点 + 自动回读校验
node scripts/release-publish.mjs upload

# 4. 发布 GitHub 兜底 release（3.2.4 无 -beta 后缀 → 正式版并设为 latest）
node scripts/release-publish.mjs github

# 5. 单独公网回读（upload 已自动跑过一次）
node scripts/release-publish.mjs verify

git push
```

### 5.0 下一棒该怎么用这四步

**如果版本号还没改**（常规发版流程）：先跑 `prepare --bump patch`，让它自己
`3.x.y-beta` → `3.x.y` 并顺带打包。

**如果版本号已经在仓库里改好了**（本批这种「先改代码再发」的顺序）：用
`--bump none --skip-build`，否则版本号会被悄悄推高一位。

`--bump patch` 对**预发布形态**才是「去后缀」：

| 仓库里的版本 | `--bump patch` 的结果 |
|---|---|
| `3.2.4-beta` | `3.2.4` ✅ 去后缀 |
| `3.2.4` | `3.2.5` ❌ patch + 1 |
| `3.2.4` + `--bump none` | `3.2.4` ✅ |

### 5.1 关键事实

- **`--bump patch` 对预发布号的语义就是「去掉预发布后缀」**（`3.2.4-beta` → `3.2.4`），
  见 `release-publish.mjs` 的 `bumpVersion()`。这是脚本内置能力，不是本文的约定。
  用 `--bump minor` / `major` 会直接 fail 并提示改用 patch。
- `github` 子命令按 `/^\d+\.\d+\.\d+-/` 判断是否 `--prerelease`。
  `3.2.4` 无 `-`，因此**会作为正式版并设为 Latest release** —— 批次 7 的修复在
  正式版路径行为不变。
- `verify` 区分「源站包大小」与「边缘包大小（CF-Cache-Status）」：
  **源站不一致才 fail**，边缘不一致只警告并估算自愈时间。
- 环境变量默认值：
  `AFM_SITE_DIR=E:\办公文件\L1网站\alpha-file-manager`、
  `AFM_SITE_URL=https://www.aiec.fun/alpha-file-manager`、
  `AFM_SFTP_PYTHON=E:\办公文件\L1网站\.venv-sftp\Scripts\python.exe`、
  `AFM_GH_REPO=kizemo/alpha-file-manager`。

---

## 6. 产物

| 版本 | 状态 | 说明 |
|---|---|---|
| 3.2.2-beta / 3.2.3-beta / 3.2.4-beta | **作废** | 从未发布，已合并进 3.2.4 |
| **3.2.4** | **正式版** | 见下表 |

正式版安装包：

- 路径：`src-tauri/target/release/bundle/nsis/Alpha File Manager_3.2.4_x64-setup.exe`
- 大小：见 §9 实测表
- SHA-256：见 §9 实测表

> **不要复用已交付过的版本号**。3.2.2-beta 曾被打两次并分发，两次的 sha256 不同。
> 每个新功能点升一个新版本号，且发出去之后就不再改动该版本的产物。

---

## 7. 关键路径

**必读文档**

- `F:/soft/00selfmade/filemanager/AGENTS.md` —— 项目硬约束（**不在仓库内**，
  但优先级高于仓库内一切说明）
- `docs/handoff-batch11-release-3.2.4-2026-10-17.md` —— 本文
- `docs/handoff-batch9-swap-split-panes-2026-10-17.md` —— 分屏互换 + 批次 10 追补
- `docs/handoff-batch8-address-bar-partA-2026-10-17.md` —— 地址栏 Part A
- `docs/handoff-batch7-mcp-client-deploy-2026-10-17.md` —— MCP 客户端一键部署
- `docs/superpowers/plans/2026-10-17-address-bar-explorer-behavior.md`
  —— **Part B1/B2 已明确放弃**，不得当待办

**代码入口**

- 地址栏：`src/modules/navigator/components/`（`addressBarQueryMeansBrowseInsideDirectory`、
  `resolveAddressBarUnseparatedDirectoryBrowsePath`、`resolveAddressBarTypedTarget`、
  `createTargetDirectorySuggestionGroup`）
- 分屏互换：`src/modules/navigator/utils/swap-split-pane-paths.ts`
- 窄屏折叠菜单：`file-browser-toolbar-nav-buttons.vue`
- MCP 服务：`src-tauri/src/global_search/` 等，见批次 6/7 handoff

**发版**

- `scripts/release-publish.mjs` —— 四步流水线
- `scripts/verify-changelog.mjs` —— changelog 与版本号一致性门禁
- `scripts/publish-bundle-to-release.mjs` —— 产物平铺到 `release/`
- `release/` —— git-ignored，装配包不进仓库

---

## 8. 下一步建议

1. **真机验收 3.2.4**：地址栏粘路径按回车、分屏互换、窄窗口「⋯」菜单里的缩略图大小
   —— 三处都要在 `tauri build` 产物上验（`tauri dev` 的界面结论一律作废，
   见 AGENTS.md）。
2. **MCP 配置自愈**：批次 7 之后的既定方向，`mcp-access.json` 配置损坏时
   不应要求用户手改。
3. **MCP Phase 1 加固**：写操作仍全部缺席，需要先定权限模型再动代码。
4. **17 语种界面文案定稿**：MCP 相关文案在 beta 期标注「各语言界面文案未必定稿」，
   正式版已发布，需回头校对。

---

## 9. 实测记录

### 9.1 产物

| 项 | 值 |
|---|---|
| 安装包 | `Alpha_File_Manager_3.2.4_x64-setup.exe` |
| 大小 | **19 178 095 字节**（18.29 MiB） |
| SHA-256 | `5c6bfce83daba440676dedb95331f60de70383cab1b95dd6d16a450a8ad884a8` |
| 本地路径 | `release/Alpha File Manager_3.2.4_x64-setup.exe` |
| 构建路径 | `src-tauri/target/release/bundle/nsis/Alpha File Manager_3.2.4_x64-setup.exe` |
| 打包耗时 | rust `Finished release profile in 3m 07s` + NSIS 打包 |

### 9.2 站点（aiec.fun）

```
[verify] 线上版本  ：3.2.4
[verify] 发布日期  ：2026-10-17T14:13:37Z
[verify] 清单 sha256：5c6bfce83daba440676dedb95331f60de70383cab1b95dd6d16a450a8ad884a8
[verify] 源站包大小：19178095 字节
[verify] 边缘包大小：19178095 字节（CF-Cache-Status=HIT, Age=35s）
[verify] 通过：版本号 / 大小 / sha256 三项均一致（源站与边缘都已生效）
```

- 下载页：<https://www.aiec.fun/alpha-file-manager/>
- 清单：<https://www.aiec.fun/alpha-file-manager/version.json>
- 直链：<https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_3.2.4_x64-setup.exe>
- SFTP 回读 16 个文件全部 **md5+size 一致**；`version.json` 的 `history[]`
  顶部已归档 `3.2.1-beta`，history 条数 8 → 9。

### 9.3 GitHub

- release：<https://github.com/kizemo/alpha-file-manager/releases/tag/v3.2.4>
- `isPrerelease: false`、`isDraft: false`，列表中标记为 **Latest**
- 资产 `Alpha_File_Manager_3.2.4_x64-setup.exe`，
  GitHub 侧 digest `sha256:5c6bfce8...` 与本地一致
- tag `v3.2.4` → 提交 `f68b8260`

### 9.4 代码推送

`git push origin main`：`ece6fd61..f68b8260`，共 12 个提交
（地址栏 3 项 + 分屏互换 + 窄屏修复 + 三批 handoff + 正式版收尾）。

### 9.5 ⚠️ 本批踩到：release 的 tag 一开始指向了错误的提交

`node scripts/release-publish.mjs github` 是在 `git push` **之前**跑的。
`gh release create` 会把 tag 建在**当时远端默认分支的 HEAD** 上 ——
也就是 `ece6fd61`（批次 8 之前，仓库版本号还停在 `3.2.1-beta`）。

结果：release v3.2.4 挂着一个指向旧代码的 tag，资产是新的、代码是旧的。
**release 本身不报错，`gh release view` 一切正常**，只有 `git ls-remote` 才看得出来。

修正（不删除 release，资产与说明都保留）：

```bash
git push origin main                              # 先把代码推上去
git tag -f v3.2.4 HEAD                            # 本地 tag 移到正确提交
git push --force origin refs/tags/v3.2.4           # 强推 tag
```

**正确顺序：先 `git push`，再 `release-publish.mjs github`。**

> 推广：任何「先建 tag / release，后推代码」的流程都有这个坑。
> 判断方法只有一个 —— `git ls-remote origin refs/tags/<tag>` 和 `git rev-parse HEAD` 对一下。
> release 页面上看不出任何异常。

---

## 10. 本批未做 / 留给下一棒

- **3.2.4 尚未做真机验收。** 地址栏粘路径回车、分屏互换、窄窗口「⋯」菜单里的缩略图大小，
  三处都还需要在 `tauri build` 产物上实测（`tauri dev` 的界面结论一律作废，见 AGENTS.md）。
- **13 个非中英文 locale 的 changelog 正文仍是英文原文。** 与它们 3.1.3 起的既有做法一致，
  本批未做本地化，也未做一半。
- **MCP 相关界面文案未逐语种校对。** 3.2.1-beta 的更新日志里标注过「各语言的界面文案
  也未必都已定稿」，正式版已发布，这项需要回头补。
- **地址栏 Part B1/B2 仍处于放弃状态。** 见
  `docs/superpowers/plans/2026-10-17-address-bar-explorer-behavior.md`，不得当待办。
- **`messages-key-alignment.test.ts` 的一次偶发失败**（见 §4.1）未深查，若再次出现需单独排查。
