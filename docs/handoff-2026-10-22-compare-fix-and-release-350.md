# 交接文档：比较与同步的缺陷修复 + 3.5.0 线上发布

> 日期：2026-10-22
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`（origin `kizemo/alpha-file-manager`）
> 外层仓：`F:\soft\00selfmade\filemanager`（origin `kizemo/focus-sync`）—— 本轮只改了 `AGENTS.md`（`baa4187`）
> 版本：3.4.0 → **3.5.0**（已上线）
> **当前状态：代码完成、门禁全绿、3.5.0 已打包装机、真机验收通过、站点与 GitHub release 均已发布并回读校验通过。**
> **已提交并推送**：内层仓 `a5bf6ecb`（比较修复 + 进度指示，25 文件）、`5776e946`（发布说明 + README + CHANGELOG，4 文件）、`60a55a45`（本交接文档），外层仓 `baa4187`（`AGENTS.md` 沉淀），均已推到各自 `origin/main`；tag `v3.5.0` 指向 `5776e946`。
> **未完成：无。** 上一份交接文档 `handoff-2026-10-22-delete-progress-and-installer-log.md` 第 7 节第 6 条「站点 / GitHub release 未发布」已在本轮完成，该行已同步更正。
> **不需要接力会话**：用户提的两件事（线上发布 + 比较缺陷修复）均已闭环验收；第 10 节列的是**下一轮**可选项，不是未完成的活。

---

## 0. 新会话必读（按顺序）

| # | 文档 | 为什么读 |
|---|---|---|
| 1 | `F:\soft\00selfmade\filemanager\AGENTS.md` | 本项目的硬约束与本机环境事实。**改代码前必须先读。** |
| 2 | 本文件 | 本轮目标、结论、证据、剩余计划。 |
| 3 | `src-tauri/src/compare/compare.rs` | 比较引擎（本轮大改：容错 + 并行收集 + 流式校验和 + 进度回调）。 |
| 4 | `src-tauri/src/compare/commands.rs` | Tauri 命令层与 `compare-progress` 事件接线。 |
| 5 | `src/modules/navigator/components/compare-sync/compare-sync-dialog.vue` | 对话框 UI：进度指示、渲染上限、结果统计。 |
| 6 | `src-tauri/src/compare/bench.rs` | 性能基准（旧实现原样搬进来做对照）。**跑之前必须设 `AFM_COMPARE_BENCH_LAB`**，否则默认跳过。 |

**上一份交接文档**（`handoff-2026-10-22-delete-progress-and-installer-log.md`）讲的是批量删除进度重做与安装链路修复，与本轮是两件独立的事，但**共用同一次 3.5.0 发布**。

---

## 1. 本轮做了两件事

### 1.1 用户反馈：「比较与同步」进度非常缓慢，最后变成一个报错页面

原话拆成三个可验证的问题：

1. 进度非常缓慢；
2. 最后变成一个报错页面；
3. 希望比较时能加进度指示。

### 1.2 线上发布 3.5.0（README / CHANGELOG / 版本文件一并更新）

用户明确授权发布。

---

## 2. 报错根因：任何一个读不了的子目录，让整个比较失败

### 2.1 「查日志」这条路只能证明一件事

应用日志 `%LOCALAPPDATA%\com.sigma-file-manager.app\logs\Alpha File Manager.log` 里，
**compare 模块一行日志都没有**（整份日志只有 `drag_no_activate` 的 INFO 噪音）。

这不是「日志里没找到错误」的结论，而是「后端根本没埋点」的事实。
所以「查日志」只能证明一件事：**报错页面上那句话不是从日志推出来的，是前端直接把后端抛出的错误显示出来了。**

要拿到真正的错误文本，只能**造出同样的现场复现**。

### 2.2 复现与定位

造一个拒绝访问的目录（`icacls <dir> /deny Duanyi:(OI)(CI)F`），放进比较靶子里，
跑一次比较，得到：

```
panicked: collect left: "无法读取目录「…\left\denied」：拒绝访问。 (os error 5)"
```

对应代码在 `src-tauri/src/compare/compare.rs` 的 `collect_local_tree`：

```rust
std::fs::read_dir(&dir_path).map_err(...)?   // ← 任何一个子目录读不了，整个比较就失败
```

**根因坐实**：这不是「比较逻辑算错了」，而是「收集阶段没有容错」——
一个无关紧要的权限问题（一个子目录读不到）就能让整轮比较罢工，
哪怕其余 10 万个条目完全正常。

### 2.3 修法

**读不了的目录跳过并计数，不中断整轮比较。**

- `FlatTree` 增 `unreadable` / `skipped` 两个计数；
- 只有**根目录**读不了才算真错误（根目录都读不了，说明用户填的路径本身有问题，必须报错）；
- 子目录读不了 → 记数、跳过、继续；
- 界面把计数显示出来，红色提示「无法读取 N」，**不假装什么都没发生**。

远程侧收集同样处理。

---

## 3. 性能根因与实测数据

### 3.1 时间都花在哪（10,020 条目/侧）

| 阶段 | 耗时 | 占比 |
|---|---|---|
| 收集 | 4.3 s | **93%** |
| 判定 | 0.11 s | 2% |
| 序列化 | 0.17 s | 4% |

判定逻辑根本不是瓶颈，**收集阶段占了 93%**。

### 3.2 元凶

```rust
std::fs::symlink_metadata(item.path())   // ← 为每个条目重拼一次绝对路径，再查一次元数据
```

`DirEntry` 本身已经缓存了目录项信息，却丢掉它去重新按路径查询一次。
10 万个条目 = 10 万次多余的路径拼接 + 路径解析。

### 3.3 基准对照表

基准写在 `src-tauri/src/compare/bench.rs`（把旧实现**原样搬进来**做对照，同一批文件）：

| 实现 | 收集 10,020 条目 |
|---|---|
| 旧实现 | **1.18 s** |
| 旧实现去掉「无条件缓存绝对路径」 | 1.44 s（无改善 → **不是元凶**） |
| 旧实现改用 `DirEntry::metadata()` | **35.7 ms（33×）** |
| 新实现（并行 + 容错） | **23 ms** |

> 第二行是个**否定性对照**：先怀疑「缓存绝对路径」是无辜的，用数据排除掉，才敢把矛头指向 `symlink_metadata`。
> 这一步没做的话，很容易修错地方。

### 3.4 顺序对照（排除冷热缓存偏差）

| 顺序 | 第一遍 | 第二遍 | 倍数 |
|---|---|---|---|
| 旧 → 新 | 1.33 s | 29.6 ms | **44.95×** |
| 新 → 旧 | 22.9 ms | 1.13 s | **49.54×** |

两种顺序都做，是因为「先跑的那个吃亏」这种冷热缓存偏差能把结论带偏。

### 3.5 最终实现

- 4 个 worker 并行收集（IO 密集型，理由与批量删除一致）；
- `item.metadata()` 取代 `symlink_metadata(item.path())`；
- sha256 改 **64 KB 流式读**（原来整文件读进内存）；
- sha256 放在 worker 内并行计算。

---

## 4. 进度指示

### 4.1 设计取舍

**进度事件的载荷里不带文案**，只有：

```
{ jobId, phase, side, percent, scanned, total }
```

文案由界面按 `phase` / `side` **本地化**。
这样 17 个语言包都能说人话，事件本身也保持轻量（每 256 条节流一次）。

### 4.2 改了什么

| 位置 | 改动 |
|---|---|
| `src-tauri/src/compare/compare.rs` | 新增 `CollectProgress` / `CompareProgress`；`collect_local_tree_with`（并行、容错、每 64 条报进度、每条目检查取消）；`compare_trees_with_progress` |
| `src-tauri/src/compare/commands.rs` | `CompareRequest` / `ComparePlanRequest` 增 `job_id`；新增 `CompareProgressPayload`；事件名 `compare-progress`；`emit_compare_progress` / `collect_progress_emitter`（每 256 条节流）/ `compare_progress_emitter`（每 1024 键）；补 `log::info!` / `log::warn!` |
| `src-tauri/src/compare/tree.rs` | `CompareStats` 增 `unreadable` / `skipped` |
| `src/types/compare-sync.ts` | `CompareStats` 增 `unreadable` / `skipped`；新增 `CompareProgressPayload` |
| `compare-sync-dialog.vue` | 监听 `compare-progress`（**按 `jobId` 过滤**，防止上一轮的残留事件串台）；进度条 UI + CSS；`runCompare` / `runPreview` 传 `jobId`；`onBeforeUnmount` 清理监听 |
| `src/localization/messages/*.json`（17 个） | 各加 10 个 key |

### 4.3 界面证据

`.superpowers/sdd/shots/cmp-350-progress.png`：

> **正在比对差异…**
> 已比对 69632 / 100021 个条目
> （进度条约 2/3 处）

这一轮特意**打开「按内容校验和」准则**让比较变慢才抓到的。
默认准则下 10 万条目只要 354 ms，UIA 轮询根本抓不到进度条。

---

## 5. 顺带解决的一个「条目太多撑爆界面」问题

用户原始反馈里没提，但真机验收时必然撞上：**10 万条差异全部渲染出来，界面直接卡死。**

### 5.1 为什么截断的是**渲染**而不是**结果**

- **不截断结果树** —— 截断会让同步计划漏文件，**危险**；
- 改为前端**渲染上限 2000 行**（`allRows` 摊平后 `allRows.slice(0, renderLimit)`）；
- 底部明说「共 58354 条，已显示 2000 条。条目太多时请用筛选缩小范围。」；
- 提供「再显示 2000 条」按钮，按批次放行；
- 统计与同步计划本来就是全量 / 后端自算，**不受影响**。

---

## 6. 测试与门禁

### 6.1 新增回归测试

**Rust**（`src-tauri/src/compare/compare.rs`）：

- `an_unreadable_directory_is_skipped_instead_of_failing_the_whole_compare`
  —— 用 `icacls /deny` 造拒绝访问目录，断言比较继续、`unreadable == 1`。
  非 Windows 或加规则失败时走兼容分支（不因环境差异而红）。
- `the_collect_progress_callback_is_called`
  —— 130 个文件 → 进度回调 ≥ 2 次且单调。

**前端**（`compare-sync-dialog/__tests__/compare-sync-dialog.test.ts`）：8 条源码断言测试
—— 进度事件订阅、`jobId` 对号入座、比较/预览传 `jobId`、进度文案、渲染上限、明说总数、筛选重置上限。

### 6.2 门禁结果（全部与基线同口径量）

| 门禁 | 结果 |
|---|---|
| `cargo test --lib` | **789 passed / 0 failed** |
| `npx vitest run` | **234 文件 / 2076 用例全通过** |
| `npx eslint src` | **170 errors / 0 warnings**（与基线一致；本轮改动的文件零违规） |
| `npx vue-tsc --build` | exit 0 |
| `node scripts/verify-changelog.mjs` | OK |
| 17 个语言包 key 一致性自检 | **0 mismatch** |

> `eslint` 的数字必须用**同一条命令**（`eslint src`）在**同一提交**上量基线 —— 混口径会凭空多出 7 个「回归」。详见外层 `AGENTS.md`。

---

## 7. 真机验收（打包产物，不是 `tauri dev`）

### 7.1 靶子

`C:\Users\Duanyi\afm-compare-big\{left,right}`
—— 20 个目录 × 5000 文件 = **100,000 文件/侧**（共 200,000 个文件），
`left\denied` 用 `icacls /deny Duanyi:(OI)(CI)F` 造拒绝访问目录。

### 7.2 日志硬证据

默认准则：

```
compare started: job=compare-1792680662331 left=…\left right=…\right criteria(time=true, size=true, checksum=false, …)
compare collected left: entries=100021 digests=0 excluded=0 unreadable=1 skipped=0 elapsed=50.3882ms
[WARN] compare left skipped 1 unreadable director(ies) and 0 unreadable entr(ies)
compare collected right: entries=100020 … unreadable=0 … elapsed=50.7156ms
compare finished: total=100021 differences=58334 review=0 unreadable=1 skipped=0 elapsed=354.1123ms
```

开启「按内容校验和」准则（为了抓进度指示那一轮）：

```
compare collected left:  entries=100021 digests=100000 … elapsed=8.8010675s
compare collected right: entries=100020 digests=100000 … elapsed=9.0310868s
compare finished: total=100021 differences=58334 … elapsed=18.174789s
```

**`unreadable=1` 出现在统计里、比较没有失败、日志有 WARN 说明跳过了什么** —— 三处互相印证。

### 7.3 界面证据

`.superpowers/sdd/shots/cmp-350-result.png`：

- 统计栏：共 100021 / 相同 41687 / 有差异 58334 / 待定 0 / **无法读取 1（红色）**
- 底部：共 58354 条，已显示 2000 条。条目太多时请用筛选缩小范围。 +「再显示 2000 条」
- 差异树正常渲染，**无错误横幅**

---

## 8. 线上发布（3.5.0）

### 8.1 版本号为什么还是 3.5.0

用 `prepare --bump none`。理由：**3.5.0 从未对外发布**（线上一直是 3.4.0），
上一轮做的批量删除进度重做与本轮的比较修复属于**同一个 3.5.0 交付单元**，
保持版本连续、不跳号。版本文件（`package.json` + 3 个 `Cargo.toml`）已是 3.5.0，无需改动。

### 8.2 产物指纹

| 项 | 值 |
|---|---|
| 安装包 | `release\Alpha File Manager_3.5.0_x64-setup.exe` |
| 大小 | **20,494,128 字节** |
| sha256 | **`76f3a5957c4626378e1de53cafc1ca56331cfb689c163c14e168afe45f895ef4`** |

### 8.3 站点

- 站点源目录：`E:\办公文件\L1网站\alpha-file-manager\`
  （含 `version.json`、`Alpha_File_Manager_3.5.0_x64-setup.exe`、`_release-notes-v3.5.0.md`）
- 平台键名是 **`windows-x86_64`**（**不是** `windows-x64`）
- SFTP 上传：21 个文件、306.44 MB，**回读 md5 + size 全部一致**
- 公网回读校验：

```
[verify] 线上版本  ：3.5.0
[verify] 清单 sha256：76f3a5957c4626378e1de53cafc1ca56331cfb689c163c14e168afe45f895ef4
[verify] 源站包大小：20494128 字节（绕过缓存，用户看不到这个）
[verify] 边缘包大小：20494128 字节（CF-Cache-Status=MISS）
[verify] 通过：版本号 / 大小 / sha256 三项均一致（源站与边缘都已生效）
```

独立复核：`HEAD` → HTTP 200，`Content-Length: 20494128`。

- 下载地址：`https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_3.5.0_x64-setup.exe`
- 版本清单：`https://www.aiec.fun/alpha-file-manager/version.json`（history 14 条，3.4.0 已归档）

### 8.4 GitHub

- Release：**https://github.com/kizemo/alpha-file-manager/releases/tag/v3.5.0**
- 标题：`Alpha File Manager v3.5.0`，非草稿、非预发布
- 资产：`Alpha_File_Manager_3.5.0_x64-setup.exe`，20,494,128 字节，
  GitHub 回报摘要 `sha256:76f3a5957c4626378e1de53cafc1ca56331cfb689c163c14e168afe45f895ef4` —— **与本地包逐位一致**
- 正文：`_release-notes-v3.5.0.md`（9,294 字节）
- tag `v3.5.0` → `5776e946`（与 `origin/main` HEAD 一致）

### 8.5 发布的命令序列

```powershell
node scripts/release-publish.mjs prepare --bump none --write-notes _notes.md   # 已跑
node scripts/release-publish.mjs upload     # SFTP 上传 + 回读 + 公网校验
node scripts/release-publish.mjs github     # 创建 release + tag + 资产
node scripts/release-publish.mjs status
```

---

## 9. 顺带修掉的既有缺陷

**英文 README 第 2 张表缺「🎨 背景效果支持混合模式」一行**（原 en=17 行 / zh=18 行）。
现已 18/18 逐行对齐（`verify-readme-tables.cjs` 5 张表全 OK）。

这是**本来就存在**的中英不对齐，本轮动了 README 就顺手修了。

---

## 10. 本轮没做的（明确的遗留项）

1. **比较的 ETA（预计剩余时间）**。没做。理由与删除进度条一样：机械硬盘上速率抖动大，给一个看似精确的数字不如不给。
2. **同步阶段的进度指示**。本轮只做了**比较阶段**。同步阶段原本就有进度条，但同样没有 ETA。
3. **`collect_children` 递归改迭代式**。评估后确认递归深度受 Windows 路径长度天然限制（约 130 层），不构成栈溢出风险，**不改**以避免引入风险。
4. **远程侧收集的并行化**。本轮远程侧只做了容错与进度，**没有**并行化（远程 IO 延迟特性不同，需要单独测）。
5. **本地化 changelog**（`public/changelog/*/changelog.md`）仍停在 3.2.11 —— fork 早前就有的状态，`verify-changelog.mjs` 只警告不失败。
6. **上一份交接文档第 7 节第 6 条**（删除进度日志采样太稀）仍然遗留，本轮没碰。

---

## 11. 提交与推送状态

| 仓库 | 提交 | 内容 |
|---|---|---|
| 内层 | `a5bf6ecb` | `fix(compare): 比较撞上读不了的目录不再整个失败,提速约五十倍并加进度指示`（25 文件，+1858 / −125） |
| 内层 | `5776e946` | `docs(release): 3.5.0 发布说明、README 与 CHANGELOG`（4 文件，+242 / −37） |
| 外层 | 无改动 | — |

两仓本地 = 远端，`origin/main..HEAD` 与 `HEAD..origin/main` 均为 0。
tag `v3.5.0` 已存在于远端，指向 `5776e946`。

---

## 12. 这轮踩过的坑（给下一个会话）

1. **`PrintWindow` 抓不到 hover / overlay 层** —— 但进度条是普通 DOM，**能**抓到。
   真正的问题是**太快**：默认准则下 10 万条目只跑 354 ms，UIA 轮询根本来不及。
   解法是**打开「按内容校验和」准则**把耗时拉到 18 秒。
2. **验收脚本判「本次完成」必须按本次运行的日志字节标记之后的内容匹配** ——
   读日志尾部 40 KB 会误命中上几轮的 `compare finished`。
3. **Radix 对话框在 UIA 里是 `[Window]`**，可访问名 = 标题（「比较并同步」）。
   **必须把搜索限定在这个子树内**，否则位置启发式会点到对话框标题栏的**关闭按钮**
   （点完对话框消失，后续找不到「比较」按钮）。
4. **粘贴前必须 Ctrl+A** —— 输入框有初始值，否则是**追加**而不是替换。
   粘贴后按 `END` 抑制内联补全，**读回值必须等于期望**。
5. **「按内容校验和」这个 Switch 没有可访问名**，靠「同一行右侧的小控件」定位（实测约 `(1886,694)`）。
6. **应用日志被应用独占锁着** —— 读它必须用
   `File.Open($p, 'Open', 'Read', 'FileShare.ReadWrite')` + `StreamReader`。
   日志时间戳是 **UTC**（比本地少 8 小时）。
7. **验收靶子不要建在 `%TEMP%` 下** —— `global_search` 的忽略规则含 `/AppData/Local/Temp`，
   夹具会被整棵剪掉。
8. **`icacls /deny` 造出来的目录，删除前必须先 `/remove:d`** —— 否则删不掉。
9. **`rm --` 会被安全层拦**（「requires the targets-only trash marker」），
   要用 `mavis-trash.cmd --`（在 `%activeDataDir%\bin\` 下）。
10. **本机代理 `127.0.0.1:7897` 的 TLS 握手是间歇性坏的**（2026-10-22 23:0x 实测）：
    `git push` 报 `TLS connect error: error:0A000126:SSL routines::unexpected eof while reading`，
    `curl -x http://127.0.0.1:7897 https://github.com/` 也报 `failed to receive handshake`，
    但**直连完全正常**（`curl --noproxy '*' https://github.com/` → HTTP 200）。
    ⇒ 推送报 TLS 错时**先试直连**，不要重试到怀疑仓库坏了：
    ```powershell
    git -c http.proxy= push origin main      # 只对这一次命令禁用代理，不动全局配置
    ```
    注意 `gh api` 走 `api.github.com` 是好的，**别用 `gh api` 能不能用来判断 git 通不通**。
