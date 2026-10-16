# 批次 5：递归搜索修复 + 搜索选项常驻 + 分屏方向 + 深度 9 层

> 本文档只记录「这一批做到哪、为什么这么做、下一步做什么」。

- 文档生成时间：2026-10-16（批次 4 打包 beta 之后，用户装包实测后提的四条反馈）
- 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
- 起点：`main` @ `1d9dec87`（3.1.3-beta.1 已交付给用户实测）
- 交付：**3.1.3-beta.2 安装包**，只交付路径，不发布到 GitHub / aiec.fun

---

## 0. 一句话现状

四条反馈全部落地、门禁全绿、已打包 3.1.3-beta.2。其中「目录内搜索没有实现递归搜索」
**经查是真缺陷**，由两个独立原因叠加造成，都已修掉并有回归测试。

---

## 1. 递归搜索：此前确实没生效（本批最要紧的一处）

用户原话：「目录内搜索，仍然没有实现递归搜索」。

### 先取证，再动手

不能凭截图猜。先量了两件事：

```
Get-ChildItem 'G:\photos' -Recurse -Filter '*095*'
  → G:\photos\1991_广州\20251009_0095_27.jpg          （确实存在，深度 2）
  → G:\photos\1997-08-02_石人山\Scan_20200208_095054_001.jpg

(Get-ChildItem 'G:\photos' -Recurse -Force).Count
  → 43167                                          （目录确实很大）
```

**「文件存在 + 目录很大」两个条件同时成立**，才值得往下查。

### 根因 1：遍历上限数错了对象

`query.rs` 的 `search_directory_recursive_blocking`：

```rust
let collection_cap = effective_limit.saturating_mul(20);   // 50 × 20 = 1000
...
seen += 1;                      // seen 数的是**扫描过的条目**
if seen > collection_cap { break; }
```

注释写的是「命中数远超 limit 时提前收工」，实现数的是扫描数。
43,167 个条目的目录里扫到第 1000 个就收工 —— 表现和「只搜当前层」一模一样。

**改法**：拆成两个量 —— `collection_cap` 数扫描量（安全阀，给足余量
`limit*200` / 下限 100_000），`match_cap` 数命中量（真正的提前收工）。

### 根因 2：短查询的命中被评分门槛丢掉

这一条与目录大小**无关**，小目录也一样搜不到，所以更隐蔽。

`scoring.rs:17-19` 对「名字比查询长」的子串命中提前返回
`0.8 + (query_len / name_len) * 0.15`。而 1-3 字符查询的门槛是 **0.9**：

| 项 | 值 |
|---|---|
| 查询 `095` | 3 字符 → `min_score = 0.9` |
| 命中 `20251009_0095_27.jpg` | 含子串 → 走提前返回 |
| 得分 | `0.8 + (3/21)×0.15` = **0.821** |
| 结果 | 0.821 < 0.9 → **当场丢弃** |

粗筛已经用 `contains` 确认过「查询是文件名的子串」——那是用户明确敲出来的字面量，
再用一道为模糊搜索排序设计的分数门槛去过滤它，是语义错配。

**改法**：分数只用于排序，不再当门槛。

> 因此 3.1.2 更新日志里「目录内搜索已递归化」那句话**当时并不成立**，
> 已在 beta 更新日志中明确订正。

---

## 2. 搜索选项从弹窗搬到结果正上方

用户原话：「在结果的上面直接显示搜索选项，当前是以按钮、弹窗的形式」。

调选项的目的恰恰是**看着结果变**。藏在弹窗里，每调一次都要开合一次浮层。

新增 `file-browser-search-options-bar.vue`：常驻在内容区顶部、**滚动区之外**，
所以改一个勾能一直看着下面的列表更新。非搜索态不渲染，不占那一行高度。

旧的弹窗面板与滑块按钮已从 `file-browser-toolbar-filter.vue` 移除；
该组件现在只保留「按列筛选」那组结构化谓词按钮 —— 那是目录内搜索独有的，
全局搜索没有对应物。

### 拼写容错这次补上了真实实现

上一轮**刻意没搬**，理由是「没有对应实现，放了就是假开关」。用户这次的截图里
红框圈住了「拼写容错」，所以补上：

- Rust 侧粗筛改为「子串命中走零成本快路径一律收录；没命中时且
  `typoTolerance` 开启才算一次相似度」。
- **不每次都算分**：`calculate_similarity_score` 内部是 Levenshtein 的
  O(n·m) 双行 DP，43,167 个条目每敲一键都算一遍会卡。
- 容错粗筛阈值取 **0.7**，刻意不复用 `get_min_score_for_query_length`
  （那个是 1-3 字符给 0.9 的模糊**排序**门槛，恰好会挡掉 0.82 这种明显命中）。
- 关闭/开启两个方向都有测试，且有一条断言「不会把毫不相关的文件名也收进来」。

---

## 3. 分屏方向

用户原话：「左侧保持目录视图，右侧切换到搜索界面」。

`navigator.vue` 里 `GlobalSearchView` 此前排在 `ResizablePanelGroup` **之前**，
于是搜索界面占左、目录被挤到右。左右对调即可。

「打开所属目录」那套（左目录 / 右结果）**本来就符合要求**，没动。

---

## 4. 默认搜索深度 7 → 9

`DEFAULT_SCAN_DEPTH = 9` 与 `LEGACY_DEFAULT_SCAN_DEPTH = 7` 放在 schemas 层，
与迁移步骤共用同一常量。

**必须走 schema 迁移（31 → 32）**：只改 `DEFAULT_USER_SETTINGS` 对已装机用户无效，
他们本地已经写着 7。迁移判定写成「当前值恰好是旧默认 7」或「字段缺失」，
**无条件覆盖会把用户自己调过的深度按回 9**。

同时把 `use-file-browser-entries.ts` 里字面量 `?? 7` 的兜底换成常量 ——
不改它会出现「设置页显示 9、实际只搜 7 层」。

---

## 5. 更新日志（发版固定动作）

3.1.3-beta.1 条目写入 **14 个语言目录**的 `public/changelog/<locale>/changelog.md`。

**语言取舍**：中文与英文给完整正文，其余 12 个语种先落英文。
缺条目比落英文更糟 —— 缺条目时用户在更新弹窗里会看到「这版没有更新说明」；
用机翻批量产出质量太差。正文放独立 `.md` 文件由脚本读取插入，
避免 markdown 里的反引号在 JS 模板字符串中逐个转义（第一版就是这么写崩的）。

---

## 6. 门禁

| 项 | 结果 |
|---|---|
| `cargo test --lib` | **324 passed, 0 failed** |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **179 errors**（与基线逐字相同）/ 59 warnings（基线 121） |
| `npx vitest run` | **182 文件 / 1418 断言全绿** |

### warnings 从 121 降到 59 的原因（不是新增问题）

移动分屏模板时，那块 60 行的**历史错缩进**顺带被修正了。
已用「同一条命令 + `git show HEAD:` 落盘基线文件」逐字对照确认：
`navigator.vue` 基线 7 errors/120 warnings → 当前 6/59，
**errors 减少、warnings 减少，无任何新增**。

---

## 7. 本轮在探针与环境上踩的坑

1. **`tempfile::TempDir` 被忽略规则整棵剪掉**。
   `builtin_ignored_paths()` 覆盖 `/AppData/Local/Temp`，而 `TempDir` 默认就建在那里，
   `filter_entry` 会剪掉整棵夹具 → 三个 Rust 测试全 0 命中，
   看起来像「递归搜索完全失效」。**这是本项目第二次栽在同一个坑**
   （前端夹具那次记在 AGENTS.md 里）。夹具改建在 `~/afm-rust-search-fixtures/`，
   并在注释里写明原因。

2. **测试脚本顺手删 PATH 弄坏了两个无关测试**。
   为让 MSVC 的 `link.exe` 抢在 Git 的同名命令前面，第一版脚本把
   `Git\usr\bin` 从 PATH 里删了，结果 `dir_reader` 的两个测试
   （要真的调外部程序建 `.lnk`）报 `program not found`。
   改成「只把 MSVC 置顶」即可 —— PATH 从左往右取，命中第一个就结束。
   **这类「顺手清理」就是典型的把两件事混成一件。**

3. **PowerShell 的 `>` 重定向把基线文件写坏**。
   `git show HEAD:path > file` 用的是 PowerShell 默认编码，导致
   逐字对照得出「基线 15 errors」这种假数字（真实是 7）。
   改用 node `execSync` 取 buffer 再 `writeFileSync`。

4. **删除临时对照文件被安全策略拦下**。
   `__baseline-nav.vue` 落在 `src/` 里被 eslint 一起扫，全量数字被污染成
   365 problems。必须清掉再重测 —— 这条也是「判定前先确认观察对象」的实例。

5. **并行跑 eslint 与 vitest 导致 6 个测试文件加载失败**。
   `Tests 1373 passed / 0 failed` 但 `6 failed` suites —— 是资源竞争导致
   import 超时，独占重跑后全绿。**「Failed Suites」与「断言失败」要分开看。**

---

## 8. 待办

- [ ] 用户实测 3.1.3-beta.2
- [ ] 实测通过后发正式版 3.1.3（含 12 个语种的本地化更新日志）
- [ ] 目录树视图等三处的「添加到收藏」是否也要加分类步骤，待确认

---

## 9. 复用提示

- Rust 测试环境（含正确的 MSVC 链接器）：`.superpowers/sdd/test-rust.cmd`
- 打包：`.superpowers/sdd/build-fb4.cmd`
- 版本号：`snapshot`-free 的 `.superpowers/sdd/bump-beta-version.cjs`
- 本批提交信息：`.superpowers/sdd/commit-msg-batch5.txt`
