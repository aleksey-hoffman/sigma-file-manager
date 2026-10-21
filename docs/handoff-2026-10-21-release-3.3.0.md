# 交接文档：3.3.0 正式版发版（2026-10-21）

## 0. 本轮范围与结论

用户交代四件事，全部完成：

| 编号 | 事项 | 状态 |
|---|---|---|
| 需求一 | commit 当前改动 | **已完成**，两个提交 |
| 需求二 | 重新打包，版本号升到 3.3 | **已完成**，`3.2.16-beta` → `3.3.0` |
| 需求三 | 升级 README（中英），补新增功能 | **已完成** |
| 需求四 | 升级更新日志与版本说明，上传 GitHub + aiec.fun | **已完成**，两边都发出来了 |
| 附加 | **在功能对比表格里补上「针对文件拖拽的优化」** | **已完成**（用户明确点名的这一项） |

**交付状态**：代码已提交并推送、门禁全绿、打包版装机真机验收通过、
aiec.fun 与 GitHub 两边都已发布并回读校验。

---

## 1. 版本号决策：为什么是 `3.3.0`（正式版，不是 beta）

仓库当前停在 `3.2.16-beta`，站点（aiec.fun）停在 `3.2.12-beta`，
`3.2.13` ~ `3.2.16` 四轮 beta **从未对外发布过**。

用户说「版本号升级到 3.3」+「发版」，据此定成 **`3.3.0`**（正式版）：

1. **新 minor 线 + 正式版**。用户说的是「3.3」不是「3.3-beta」；
   而且 GitHub 上带 `-beta` 后缀的 release 会被标成 *Pre-release*，
   不作为 *Latest* 出现在所有人的下载入口，正式版反而被压在下面。
   这次用户要的是「发版」，所以给正式版。
2. **四轮 beta 一次收进来**。3.2.13（扩展加固）、3.2.14（键盘连选 + 网络盘删除确认 +
   窗口状态修复）、3.2.15（背景混合模式）、3.2.16（长按拖出 + 颜色选择器）合起来才是
   一个能发的版本。3.3.0 的更新日志条目写的就是「从 3.2.12-beta 升上来的人」视角。
3. **`3.3` 不是合法的 X.Y.Z**。仓库的 `sync-version.js` 与 `verify-changelog.mjs`
   都按 `X.Y.Z` 走，站点 `version.json` 与 `download.php` 也按三段号解析版本，
   所以落成 `3.3.0`。

### 脚本上的一个坑

`release-publish.mjs prepare --bump minor` **不能**用在预发布版本号上：
`bumpVersion()` 见到 `3.2.16-beta` 会直接 `fail()`，只有 `--bump patch`
能把预发布转正式版（`3.1.3-beta.2` → `3.1.3`）。要跳到 3.3.0，只能**先手改
`package.json`**，再用 `--bump none` 让 prepare 走「不改版本号、只打包 + 写站点源」的路径。

---

## 2. 文档改动

### 2.1 README.md / README.zh-CN.md（中英同步）

三处都改了：

**① 「我们在 Sigma File Manager 之上加了什么」表** —— 顶部新增 5 行：

| 行 | 版本 |
|---|---|
| 🫳 按住文件拖到别的程序里 —— 窗口不抢前台 | 3.3.0 |
| 👁️ 鼠标停在哪个程序上，哪个窗口就提到前面 | 3.3.0 |
| 🎨 背景视觉效果支持 Photoshop 式混合模式 + 自定义填充色 | 3.3.0 |
| ⌨️ Shift + 方向键连选（从锚点往外扩） | 3.3.0 |
| 🔒 扩展再也不能被引到你自己的内网上 | 3.3.0 |

**② 「Alpha File Manager vs Sigma File Manager vs Windows 资源管理器」对比表** ——
用户点名要加的**拖拽优化**就在这里，加了 4 行：

| 行 | Alpha | Sigma | 资源管理器 |
|---|---|---|---|
| 🫳 **把文件拖到别的程序里** | ✅ **按住文件就能拖出去** —— 微信、钉钉、浏览器都行，而且拖的那个窗口待在后台不抢前台 | ➖ | ✅ |
| 👁️ **拖的时候目标程序提到前面** | ✅ 鼠标停在哪个应用上，哪个窗口就替你带到前面，落点一眼就看见 | ➖ | ➖ Windows 的拖拽不会把目标窗口提到前面 |
| ⌨️ **键盘连选** | ✅ **Shift + 方向键**从你起手的锚点往外扩选 | ➖ | ✅ Shift + 方向键也能扩选 |
| 🎨 **背景效果支持混合模式** | ✅ Photoshop 的图层模式全套，还能配自己的填充色 | ➖ | ❌ |

> 资源管理器那两格是**如实**写的：它**能**拖到别的程序里，但 Windows 的 OLE 拖拽
> **不会**把悬停到的目标窗口提到前面 —— 这正是本 fork 改掉的那一条。

**③ 新增「🆕 What's new in 3.3.0」整节**（中英各一份），分五小节：
长按拖出 / 背景混合 / 键盘连选 / 扩展加固 / 小修清单，末尾附一条
「从 3.2.12-beta 升上来」的提示（说明中间四轮 beta 从未单独发布过）。

### 2.2 更新日志

- `CHANGELOG.md`（英文）—— 顶部加 `## [3.3.0] - October 2026` 条目
- `public/changelog/ch/changelog.md`（中文，locale code 是 `ch`）—— 同步加 `## [3.3.0] - 2026 年 10 月`

两个条目都覆盖了从 3.2.12-beta 到 3.3.0 的全部内容（新增 + 修复 + 升级提示）。
其余 13 个语言包仍停在 3.2.11 —— 与 3.2.12 之后的既有惯例一致
（`verify-changelog.mjs` 对未覆盖的 locale 只**提示**不报错）。

### 2.3 `_notes.md`（中文发布说明）

改成 3.3.0 的版本。这份文件同时喂给两处：
站点的 `version.json.notes`（更新弹窗正文）与 GitHub release 的正文。

---

## 3. 顺带修掉的一个门禁口径问题（`eslint .` 的数字不可复现）

发版前跑门禁时发现：`npx eslint .` 报 **689 errors**，而 `npx eslint src` 只有 170。
差的 500 多个全部来自 **`.superpowers/`** —— 那是本机的一次性脚本区
（`.superpowers/sdd/.gitignore` 是 `*`，整个目录**不进版本库**）。
**eslint 不读 `.gitignore`**，所以这些只存在于工作副本、干净检出里根本不存在的脚本，
被一起 lint 了。同一份代码，两个数字，门禁就失去了意义。

`eslint.config.ts` 里本来就有同一类规则（`_acceptance/**`，注释里写明
「少了这条规则，光探针脚本就会往门禁里灌进 600 多个错误」），
所以把 `.superpowers/**` 与 `graphify-out/**` 一并加进 `globalIgnores`：

```
eslint .   → 177 errors / 0 warnings   （= src 170 + scripts 7）
eslint src → 170 errors / 0 warnings    （与交接文档基线逐字一致）
```

`AGENTS.md` 已补一条口径说明，并写明「看到几百个错误先按目录分组看」。

---

## 4. 门禁

| 门禁 | 结果 | 口径 |
|---|---|---|
| `cargo test --lib` | **702 passed / 0 failed** | 与基线逐字一致 |
| `npx vitest run` | **229 文件 / 2031 用例** 全绿 | 基线 229 / 2031 |
| `npx eslint src` | **170 errors / 0 warnings** | 与基线逐字一致 |
| `npx eslint .` | **177 errors / 0 warnings** | 修完忽略项后的新口径（见 §3） |
| `npx vue-tsc --build` | **0** | — |
| `node scripts/verify-changelog.mjs` | **OK** | CHANGELOG 覆盖 3.3.0，条目顺序正确 |

---

## 5. 产物

| 项 | 值 |
|---|---|
| 安装包 | `release\Alpha File Manager_3.3.0_x64-setup.exe` |
| 字节数 | 20,407,375 |
| SHA256 | `CC932BFAE9C517C6239EF70887A4279B57D72712144B378A74B8135BD25A8D9B` |
| 装机后 | `D:\Program Files\Alpha File Manager\alpha-file-manager.exe` |
| 字节数 | 55,490,048（built at 2026/10/21 21:07:54） |
| SHA256 | `8A7DE1962712A4B280A8D0FDA4C087CC8A6FD1AD900FA9DA10062F075FCE80EE` |
| **FileVersion / ProductVersion** | **3.3.0 / 3.3.0** |

| 节点 | 说明 |
|---|---|
| `2460aa22` | 版本号 3.3.0 + README/CHANGELOG/_notes.md |
| `fee24ddd` | eslint 忽略项 + Cargo.lock 同步 |
| 标签 `v3.3.0` | 指向 `fee24ddd` |

---

## 6. 真机验收（用 `tauri build` 的打包产物，不是 dev 构建）

```
--- silent install ---
installer exit code: 0
installed: D:\Program Files\Alpha File Manager\alpha-file-manager.exe
bytes:     55490048
file ver:  3.3.0
prod ver:  3.3.0

--- launching ---
MAIN WINDOW READY after 5s
size:  1721x927 physical = 1147.3x618 logical
```

**三项硬证据**：

1. **版本号真的是 3.3.0** —— 装好的 exe 的 FileVersion / ProductVersion 都是 `3.3.0`。
2. **更新日志真的生效了** —— 首启弹出的「新功能」对话框里，
   `3.3.0 / 2026 年 10 月 / 当前` 排在列表第一位，
   下面是 3.2.16-beta ~ 3.2.12-beta；正文渲染的是本轮新写的 3.3.0 条目。
   **这就是 `verify-changelog` 那道门禁在真机上的样子** —— 它防的正是
   「版本号对不上、更新弹窗静默回退到最旧一条」那个事故。
3. **路由内容区不是空白** —— 截图确认：左侧目录树、面包屑地址栏、文件列表（名称/项目列）、
   右侧详情面板（大小/类型/路径/修改内容/创建/访问/链接数）全部正常渲染。

截图：`.superpowers\sdd\afm-3.3.0-main.png`（新功能弹窗）、
`.superpowers\sdd\afm-3.3.0-main2.png`（主界面）。

> 代码本身与上一轮真机验收过的 `3.2.16-beta` **完全一致**（本轮只改了版本号与文档），
> 所以拖拽四模式（Control / TargetActivate / QuickClick / Hold）的验收结论沿用
> `docs/handoff-2026-10-21-outbound-target-and-color.md`，没有重跑。

---

## 7. 发布

### 7.1 aiec.fun（主源）

```
[4/4] 服务器端校验 (md5 + size)
  index.html                          OK  md5+size 均一致
  .htaccess                           OK  md5+size 均一致
  version.json                        OK  md5+size 均一致
  download.php                        OK  md5+size 均一致
  Alpha_File_Manager_3.3.0_x64-setup.exe  OK  md5+size 均一致

[verify] 线上版本  ：3.3.0
[verify] 清单 sha256：cc932bfae9c517c6239ef70887a4279b57d72712144b378a74b8135bd25a8d9b
[verify] 源站包大小：20407375 字节（绕过缓存，用户看不到这个）
[verify] 边缘包大小：20407375 字节（CF-Cache-Status=MISS）
[verify] 通过：版本号 / 大小 / sha256 三项均一致（源站与边缘都已生效）
```

站点 `version.json`：`version = 3.3.0`，旧的 `3.2.12-beta` 已归档进 `history[]`
（现 12 条），`platforms['windows-x86_64'].url` 指向新包。

> **上传策略**：`_upload_alpha_files.py` 默认会把站点源目录里**所有** `.exe` 全量重传
> （15 个包 ≈ 285 MB，其中 14 个在服务器上已经有一模一样的副本）。
> 本轮把未变更的 14 个安装包临时移开，只传新增的 3.3.0 + 4 个页面/清单文件，
> 上传完原样移回。**服务器上的旧包一个都没动**，`download.php` 照样能翻到它们。
> 那个空的中转目录已用 `mavis-trash` 清掉。

### 7.2 GitHub（兜底镜像）

```
[release] GitHub 上没有 v3.3.0，创建 release
https://github.com/kizemo/alpha-file-manager/releases/tag/v3.3.0
[release] 资产 Alpha_File_Manager_3.3.0_x64-setup.exe  20407375 字节
```

回读确认：

- `tagName = v3.3.0`，`isDraft = false`，**`isPrerelease = false`** → 列表里显示为 **Latest**
- 资产 `state = uploaded`，20,407,375 字节
- GitHub 自己算的 digest = `sha256:cc932bfae9c517c6239ef70887a4279b57d72712144b378a74b8135bd25a8d9b`
  —— 与本地包**逐字一致**

### 7.3 git

`main` 已推到 `origin/main`（`6f4cdc43..fee24ddd`），标签 `v3.3.0` 已推，
`git ls-remote` 确认 `refs/tags/v3.3.0^{}` = `fee24ddd`。

---

## 8. 涉及文件

**修改**

- `package.json` —— 版本 `3.2.16-beta` → `3.3.0`
- `src-tauri/Cargo.toml` + `default-file-manager-common/Cargo.toml` +
  `default-file-manager-launcher/Cargo.toml` —— 版本同步（`sync-version.js`）
- `src-tauri/Cargo.lock` —— 版本同步
- `CHANGELOG.md` —— 3.3.0 条目
- `public/changelog/ch/changelog.md` —— 3.3.0 条目（中文）
- `README.md` / `README.zh-CN.md` —— 3.3.0 章节 + 两张表新增行
- `_notes.md` —— 3.3.0 中文发布说明
- `eslint.config.ts` —— `globalIgnores` 加 `.superpowers/**` 与 `graphify-out/**`
- `.gitignore` —— 忽略 `graphify-out/`（上一轮遗留，本轮一并入库）

**新增**

- `docs/handoff-2026-10-21-release-3.3.0.md` —— 本文

**仓库外（站点源目录，不进版本库）**

- `E:\办公文件\L1网站\alpha-file-manager\version.json` —— 3.3.0
- `E:\办公文件\L1网站\alpha-file-manager\Alpha_File_Manager_3.3.0_x64-setup.exe`
- `E:\办公文件\L1网站\alpha-file-manager\_release-notes-v3.3.0.md`

**验收脚本（`.superpowers/sdd/`，不进版本库）**

- `build-3.3.0.cmd` —— vcvars64 + MSVC 链接器置顶 + 钉死 rustup 工具链，再跑 prepare
- `install-and-launch-3.3.0.ps1` —— 静默安装 + 校验版本 + 起窗口
- `test-lib.cmd`（沿用）—— `cargo test --lib` 门禁

---

## 9. 留给后续的几件事

1. **`3.3` 线还开着**。主题色 / accent 色仍然没有（上游 main 也没有），
   现在这个「自定义颜色」只是混合填充色，别当成主题色用。
2. **长按拖出只验过 Windows**。本 fork 的打包产物走 NSIS，Linux 侧没有验证。
3. **FTP / FTPS 依旧没有真机验过**（承自 3.2.11）。
4. **扩展自己的网络请求仍然没有 SSRF 那一层防护**。扩展要访问哪个地址，
   现在仍然只靠它自己描述文件里的白名单兜底。
5. **`WS_EX_NOACTIVATE` 挡不住 Chromium 自己的 click-to-activate**：
   按下瞬间仍会收到一次 `WM_ACTIVATE state=2`。真前台没有立刻切过去，
   但哪天出现「按下就跳前台」的回归，第一嫌疑就是这条。
6. **本机 `gh` 在 PowerShell 里传复杂 `--jq` 表达式会被打散**
   （`gh api X --jq '... | ...'` 报 `accepts 1 arg(s), received 3`）。
   用 `gh release list` / `gh release view --json` 这类不带管道符的写法，或者把
   JSON 落到文件再让 node 解析。
7. **站点全量上传很费带宽**。`_upload_alpha_files.py` 默认重传所有 `.exe`；
   下一轮可以给脚本加个「只传新增文件」的开关，省掉 280 MB 的重复上传。
