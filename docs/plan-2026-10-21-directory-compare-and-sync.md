# 需求分析与设计：分屏左右目录比较 + 数据同步（2026-10-21）

> **状态：仅设计，未动代码。** 本轮交付的是需求表与设计决策，供下一轮排期与实现。
> 参照对象：FileZilla、WinSCP、Total Commander、rsync。
> 术语约定：本仓库已有的 **「同步浏览」/ Synchronized browsing**（`splitViewMode: 'linked'`）
> 是**导航联动**（左格选中目录，右格跳到同名目录），
> 与本文的**数据同步**（比较内容并传输/删除）**完全无关**。全文一律用
> 「比较并同步 / Compare & Sync」指新功能，绝不简称为「同步」。

---

## 0. 一句话结论

FTP 客户端在这个领域已经收敛出一套相当稳定的模型，本设计直接沿用：
**「比较（Compare）→ 差异树（差异清单）→ 干跑预览（Dry-run）→ 执行（Apply）」**
四段式。核心差异点是 **WinSCP 式递归**（FileZilla 的目录比较只比当前一层），
以及 **Total Commander 的逐条改判**和 **rsync 的「默认不删」**。

本仓能复用的基础设施比预想的多：远程 provider trait 已经能列目录、能递归上传下载、
已有后台 job + 进度事件、已有分屏模型。**真正缺的是三样**：
递归目录遍历的通用内核、比较准则与差异树的数据结构、以及一个「按差异集驱动」的同步编排层。

---

## 1. 参照对象调研结论

### 1.1 FileZilla —— 「当前层比较 + 直接给两个列表上色」

| 事实 | 出处 |
|---|---|
| `View > Directory Comparison > Enable`（CTRL-O） | FileZilla Wiki「Other Features」 |
| 两种比较依据二选一：**compare file size** 或 **compare modification time** | 同上 |
| **Hide identical files** 开关 | 同上 |
| 配色约定：**无色 = 完全相同**；**黄 = 只在一边存在**；**绿 = 较新的一方**；**红 = 大小不同（两边都标红）** | 同上 + FileZilla Pro 文档 |
| 开启目录比较**会自动打开同步浏览** | FileZilla Pro 文档 |
| **前置条件：本地与远程的过滤规则必须一致或都关闭** | FileZilla Pro 文档 |
| 目录比较**不递归**，只比当前这一层 | Wiki 未提供递归选项；递归靠同步浏览逐层下钻 |

**取用**：配色语义（黄/绿/红/无色）非常好用，直接借鉴。
**不取**：不递归 —— 用户的诉求明确要求「子目录递归检查」。

### 1.2 WinSCP —— 「递归同步」的行业基准

`Commands > Synchronize` 对话框的结构：

- **Directories**：Local/Left directory + Remote/Right directory（默认取当前工作目录）
- **Direction/Target directory**：Both / Remote-Right / Local-Left
- **Mode**：**Synchronize files** / **Mirror files** / **Synchronize timestamps**
- **Synchronize Options**：
  - **Delete files**（目标端多出来的删掉；**Both 方向下不可用**，因为那些文件在另一侧算「新增」）
  - **Existing files only**（不把「对方没有的文件」当成新增，直接忽略）
  - **Preview changes**（先出变更清单再决定）
  - **Selected files only**（只处理面板里选中的文件）
- **Comparison Criteria**（**位域，可组合**）：
  - **Modification time**（默认开）
  - **File size**
  - **Checksum**（SHA-256 优先，自动回退 SHA-1；**需要服务器支持算校验和**）
  - **优先级明确**：勾了时间就以时间为准 —— 「源文件比目标旧时，即使大小或校验和不同也不算已更新」
  - **一个都不勾** → 「已存在的文件一律视为相同」，只同步新增
  - **Both 方向下** 强制只按时间比
  - **Case sensitive** 开关
- **Synchronize timestamps** 模式额外有 **Same size only**，且 **仅 SFTP 可用**
- 文件掩码（include/exclude）**同时影响删除**
- 删除本地文件**可以进回收站**（一个偏好项）
- 「Preview changes」可把动作推进**后台队列**
- .NET API `Session.CompareDirectories(mode, localPath, remotePath, removeFiles, mirror, criteria, options)`
  → 返回 `ComparisonDifferenceCollection`（**只返回差异**，与同步同源）

**取用**：几乎全部。这是目前最成熟的模型。
**注意**：WinSCP 的分屏是「本地 vs 远程」的固定结构；本仓的左右两格**可以任意组合**
（本地↔本地、本地↔远程、远程↔远程），所以 UI 上不能照抄「左=本地 右=远程」。

### 1.3 Total Commander —— 「逐条改判 + 方向中性」

`比较目录`（Alt+F7）+ `同步目录`：

- **Subdirs**：递归比较子目录（改这个选项要重新比较）
- **by content**：对**大小和日期都相同**的文件再比内容
- **ignore date**：同大小同名即视为相同（此时结果只有「相等/不等」两种，**方向要用户自己定**）
- **Asymmetric**（镜像）：以左侧为准造右侧，**左侧没有的右侧会被删**。
  官方警告：**「不要用来同步桌面和笔记本」** —— 这个警告值得直接抄进本仓的提示里
- 四个筛选按钮 = 四种方向语义：
  `→` 需从左拷到右 / `=` 需从右拷到左（或镜像模式下右侧删除）/ `!=` 当前设置下视为相等 /
  `←` **有差异但没有默认方向**（例如时间相同、或忽略了时间）
- 快速选择：**duplicates**（两边都有）/ **singles**（只有一边有）
- 统计：总数 / 相同数 / 不同数 / 左侧独有 / 右侧独有
- **逐条可改动作**：比如让「旧文件覆盖新文件」，或改判覆盖方向
- **FTP time offset dt=..h**：本地与 FTP 服务器的**时区差**，**按服务器名保存**
- 「Equal Text icon」：Unix 服务器上的远程文件只有是**文本文件**才算与本地相同（CRLF vs LF）

**取用**：逐条改判、方向中性的第四类状态、时区偏移、统计口径。
**不取**：`ignore date` 那个「只有相等/不等」的退化模式（信息量太低）。

### 1.4 rsync —— 「默认不删 + 干跑」

- `-n` / `--dry-run`：干跑
- `--itemize-changes`：逐条列出将要发生什么（`>f`, `cd`, `..d` 等）
- `--delete`：删除目标端多余文件（**默认不删**）
- `--checksum` / `--size-only` / `--ignore-times`：比较准则
- `--exclude` / `--include`：排除规则（**同时影响删除**）
- `-a`：归档模式（递归 + 保留权限/时间/符号链接）

**取用**：**默认不删**这个默认值，以及「干跑先行」的流程。

---

## 2. 本仓现状与差距

### 2.1 能直接复用的

| 能力 | 位置 | 说明 |
|---|---|---|
| 本地列目录 | `dir_reader::commands::read_dir` | 返回 `DirEntry{name, size, modified_time, is_dir, is_hidden, is_symlink, …}` |
| 远程列目录 | `remote::commands::remote_read_dir` | 返回 `RemoteEntry{name, path, is_dir, size, modified_time, is_hidden, is_symlink}` |
| 统一远程路径形式 | `sfm://remote/<连接id>/<远端路径>` | 两侧都可用同一套 URI 表达 |
| 递归上传 / 下载 | `remote::transfer::{upload, download}` | 传目录会递归；产出 `RemoteTransferReport{files, dirs, failures, skipped}` |
| 远程增删改 | `remote_make_dir` / `remote_remove_path` / `remote_rename_path` / `remote_chmod` | 同步动作的执行器 |
| 后台任务 + 进度 | `copy_move_job.rs` / `delete_job.rs` | 模板：`start_*_job` + `*-job-progress` / `*-job-finished` 事件 + `cancel_*_job(job_id)` |
| 分屏模型 | `stores/storage/workspaces.ts` | `tabGroup` 长度 > 1 即分屏，每 tab 一格，`paneWidth` 定宽；左 = tab[0]，右 = tab[1] |
| 拖放传输管线 | `use-file-browser-drag.ts` | 同步执行可复用同一套上传/下载实现 |
| 连接注册表 | `remote::registry` | 同步不需要新的连接配置 |

### 2.2 缺的（这就是本项目的实际工作量）

| 缺口 | 现状 |
|---|---|
| **比较功能本身** | 全仓唯一的 "compare" 是 `data/extensions.ts` 的 semver 比较。**没有任何目录比较** |
| **通用递归遍历内核** | `dir_reader` 只列一层。递归逻辑散落在 `dir_size.rs`、`global_search/`、`remote/transfer.rs` 三处，各自实现、互不通用 |
| **校验和能力** | `RemoteProvider` trait **没有** checksum 方法，FTP/SFTP 都没接。`RemoteEntry` 只有 size + modified_time |
| **「按差异集驱动」的传输** | 现有 upload/download 语义是「把这一整个路径传过去」，**不能**只传「差异的那几个文件」 |
| **删除的编排** | `delete_job` 是给用户交互用的，没有「镜像同步时删除目标端多余项」这种语义 |
| **差异树数据结构** | 无 |
| **比较准则 / 时区 / 大小写** | 无 |

### 2.3 两个必须遵守的既有约束

1. **`cargo test --lib` 红线**：被测试链接到的代码**不能碰** `tauri::AppHandle` 或
   `tauri::async_runtime::*`，否则测试二进制在加载阶段以 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉。
   → 比较引擎必须写成**同步内核**（`*_blocking`） + async 包装，
   调用方自己选执行器（同 `dir_reader.rs` / `global_search.rs` 的既有做法）。
2. **本地目录遍历是阻塞 IO**：递归遍历大目录必须放 `spawn_blocking`，否则卡 UI 线程。

---

## 3. 需求表（主交付物）

优先级：**P0** = MVP 必需 · **P1** = 重要 · **P2** = 增强

### A 组 · 比较范围与准则

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| A1 | 比较输入默认为**当前分屏左右两格的所在目录**，可在对话框里改成任意目录 | WinSCP 目录框 | P0 | 打开时预填左右当前目录；改目录后结果重算 |
| A2 | **递归比较子目录**，默认开启，可关闭 | WinSCP / Total Commander「Subdirs」 | P0 | 关闭时只比当前层；开启时子目录差异进入结果 |
| A3 | 递归深度可设上限，超过时**明确提示**，不静默截断 | 本仓 `global_search` 的 scan cap 先例 | P1 | 触顶时在结果里标出「已达上限」并给出实际深度 |
| A4 | 比较准则可多选：**修改时间 / 文件大小 / 内容校验和** | WinSCP Comparison Criteria | P0 | 三项均可勾选 |
| A5 | 准则**优先级：修改时间 > 大小 > 校验和**（勾了时间就以时间为准） | WinSCP 明文规定 | P0 | 源文件比目标旧但大小不同时，**不**判为「需更新」 |
| A6 | 一个准则都不勾 = 「已存在即视为相同」，只同步新增 | WinSCP | P0 | 勾选全空时结果里只有「单侧独有」一类 |
| A7 | 内容校验和为**可选项**，需远程端支持；不支持时该选项置灰并说明原因 | WinSCP（SHA-256 优先，回退 SHA-1） | P1 | FTP 场景下该项的可用性提示正确 |
| A8 | **文件名大小写敏感**可配，默认随「源」一侧的系统语义 | WinSCP Case sensitive | P0 | 本地 Windows + 远程 Linux 的默认组合要在界面上写清楚 |
| A9 | **本地与远程的时区偏移**可设，并**按连接保存** | Total Commander「FTP time offset」 | P0 | 远程快 8 小时时不会把全部文件误判成「较新」 |
| A10 | **排除规则**：包含/排除掩码（目录与文件）；排除项**同时排除删除** | WinSCP 文件掩码 / rsync `--exclude` | P0 | 排除 `.git` 后 `.git` 既不比较也不被删 |
| A11 | **符号链接**：默认不跟随、不比较、报告为「已跳过」 | 本仓 `transfer::upload` 既有语义 | P0 | 链接不会导致整棵子树被复制 |
| A12 | **空目录**参与比较（两侧都有的空目录 = 相同；只有一侧有 = 需创建） | rsync `-a` | P1 | |
| A13 | 比较过程**完全只读**，不产生任何副作用 | 通用 | P0 | 比较前后两侧目录的 mtime 不变 |
| A14 | 比较两端可**任意组合**：本地↔本地、本地↔远程、远程↔远程 | 本仓分屏不限本地/远程 | P1 | 远程↔远程走两套 provider 实例 |

### B 组 · 结果呈现

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| B1 | 结果按**目录树**组织，不是扁平列表 | Total Commander | P0 | 父目录差异可见，且可整棵展开/收起 |
| B2 | 每条带状态徽标：**仅左 / 仅右 / 较新 / 较旧 / 大小不同 / 内容不同 / 相同 / 方向待定** | FileZilla 配色（黄/绿/红/无色）扩展 | P0 | 语义与 §1.1 的配色一一对应 |
| B3 | 顶部**统计**：总数 / 相同 / 不同 / 左侧独有 / 右侧独有 | Total Commander | P0 | 数字与结果列表一致 |
| B4 | **按状态筛选**（只看不同 / 只看左侧独有 / 只看相同 …） | FileZilla「Hide identical files」 | P0 | 筛选即时生效，计数同步 |
| B5 | 每条标出**建议方向**（← / → / ↔ / 无默认方向） | Total Commander 四个筛选按钮 | P0 | 「方向待定」是一等状态，不是错误 |
| B6 | **逐条可改判**：改覆盖方向、改判为跳过、临时排除 | Total Commander「Individual files which you can manipulate」 | P1 | 改判结果不重新扫描，直接影响执行清单 |
| B7 | 差异**同时着色在左右两个面板的文件列表上**（不只在弹窗里） | FileZilla | P1 | 两格文件列表出现对应色标 |
| B8 | 大结果集**虚拟滚动 / 分页**，不卡 UI | — | P1 | 十万级条目仍可滚动 |
| B9 | 扫描过程有**进度与可取消** | — | P0 | 扫描中可中断，且已扫出的部分保留 |

### C 组 · 同步动作

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| C1 | **方向**：仅上传 / 仅下载 / 双向 | WinSCP Both / Remote / Local | P0 | 三种方向都可用 |
| C2 | **模式**：同步文件（只补差异）/ 镜像（目标端多出来的也删） | WinSCP Synchronize files / Mirror files | P0（镜像 P1） | 镜像模式**显式开启**，并附带官方同款警告 |
| C3 | 双向模式下以**较新的一方**为准 | WinSCP 双向固定只比时间 | P0 | 时间相同且内容不同 → 归入「方向待定」 |
| C4 | **「只处理已存在的文件」**（不把单侧独有当新增） | WinSCP「Existing files only」 | P1 | 勾选后单侧独有项被忽略 |
| C5 | **干跑预览**：先出「将要做什么」清单，确认后才执行 | WinSCP「Preview changes」/ rsync `-n` | P0 | 清单按「上传/下载/新建目录/删除/跳过」分栏，逐条列路径 |
| C6 | 执行**只针对差异集**，不整目录重传 | — | P0 | 相同文件不产生任何传输 |
| C7 | 远端缺失的**父目录按需创建** | 现有 `transfer::upload` | P0 | 深层新建目录能成功 |
| C8 | **删除**：镜像模式 + 排除规则之后仍然多出来的项 | WinSCP「Delete files」 | P0（默认关） | 「Delete files」在双向模式下不可用（与 WinSCP 一致） |
| C9 | 同步时**保留远端权限位** | 现有 `remote_chmod` | P1 | 同步后远端 mode 不被改成默认值 |
| C10 | **同步时间戳模式**（仅 SFTP） | WinSCP Synchronize timestamps | P2 | 明确标注仅 SFTP 可用 |
| C11 | 支持**只处理面板里选中的文件** | WinSCP「Selected files only」 | P1 | 有选中时该选项才可用 |

### D 组 · 安全与可逆

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| D1 | **删除默认关闭**，必须显式勾选 | WinSCP / rsync | P0 | 首次进入同步面板时删除未勾选 |
| D2 | 删除前必须先看**预览清单**，逐条列出将被删的路径 | — | P0 | 清单里的删除条数与实际执行一致 |
| D3 | 本地删除**走回收站**而不是直接抹掉 | WinSCP「Delete local files to recycle bin」 | P0 | 本仓 `delete_job` 已有回收站路径可复用 |
| D4 | 确认框写清**方向 / 模式 / 涉及文件数 / 将删除数** | — | P0 | 文案与预览清单数字一致 |
| D5 | **同名且目标更新时不盲目覆盖** | 通用 | P0 | 覆盖只在「源更新」时发生 |
| D6 | 传输中断**不留半截文件**：先写临时名，成功后改名 | — | P1 | 中断后目标端无残缺同名文件 |
| D7 | 产出**同步报告**：做了什么 / 跳过了什么 / 失败了什么，可导出 | — | P1 | 报告内容与实际落盘一致 |
| D8 | **默认排除清单**可配（如 `.git` `node_modules` `.svn`） | rsync 惯例 | P1 | 默认可用且用户可改 |
| D9 | 执行失败**不中断整体**，失败项单独列出 | 现有 `RemoteTransferReport` 已有 failures | P0 | 失败项在报告里可逐条查看 |
| D10 | 执行过程**可取消** | 现有 `cancel_*_job` | P0 | 取消后已完成的保留，剩余不再进行 |

### E 组 · 执行与性能

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| E1 | 长任务走**后台 job**，复用 `copy-move-job` / `delete-job` 的事件模式 | 本仓既有模式 | P0 | 事件名与既有 job 一致风格 |
| E2 | 扫描阶段**限并发**：远程 `read_dir` 是网络往返，不能一次打爆 | — | P0 | 并发上限可配，失败自动退避重试 |
| E3 | 传输**并发度**可配 | FTP 客户端标配 | P1 | |
| E4 | 大目录比较有**进度、耗时、可中断** | — | P0 | 扫描 10 万条不卡 UI |
| E5 | 传输复用现有 `upload`/`download` 管线（含失败与跳过上报） | 现有 | P0 | 失败原因与既有文案一致 |
| E6 | 扫描结果**可缓存**并在两侧内容变化时失效 | — | P1 | 缓存键含两侧路径 + 目录 mtime |
| E7 | **断点续传** | WinSCP | P2 | 需先给远程传输加续传能力 |

### F 组 · 配置与入口

| 编号 | 需求 | 参照 | 优先级 | 验收要点 |
|---|---|---|---|---|
| F1 | 入口在**分屏时的工具栏**；非分屏时给出「先开分屏」的可执行提示 | — | P0 | 提示可一键开分屏 |
| F2 | **命名严格区分**「比较并同步」与已有「同步浏览」 | 本仓 `syncBrowsing` i18n | P0 | 界面、提示、文档三处都不混用 |
| F3 | 比较/同步参数可**存为方案**，下次一键复用 | WinSCP「Use same options next time」 | P1 | 方案存本地，可命名 |
| F4 | 远程端点复用**现有连接注册表**，不引入新的连接配置 | 现有 `remote::registry` | P0 | 无需重新填主机/账号 |
| F5 | 差异项**右键直接动作**（上传/下载/删除/在文件夹中显示） | FileZilla | P1 | |
| F6 | 排除规则、准则、时区偏移等设置**持久化** | WinSCP | P1 | 重启后保留 |
| F7 | 比较结果可**导出**为清单（CSV/文本） | — | P2 | |

---

## 4. 关键设计决策

### D-1 · 比较引擎放后端，且写成同步内核 + async 包装

- **为什么必须在后端**：递归遍历远程目录必须走 `RemoteProvider::read_dir`，
  前端拿不到 provider 实例，也拿不到 `connection_id` 的私有连接。
- **为什么要同步内核**：`cargo test --lib` 红线（§2.3）—— 比较逻辑要能被单测覆盖，
  就不许依赖 `tauri::async_runtime`。做法与 `dir_reader.rs` / `global_search.rs` 一致：
  `compare_blocking(...)` 纯函数 + `#[tauri::command]` 里包 `spawn_blocking`。

### D-2 · 统一位置抽象 `LocationRef`

```rust
enum LocationRef {
    Local(PathBuf),
    Remote { connection_id: String, path: String },
}
```
比较器只认 `list_children() -> Vec<ChildEntry>`。
好处：**本地↔本地**、**本地↔远程**、**远程↔远程**共用同一套引擎，
不为「远程 vs 远程」再写一遍。

### D-3 · 比较结果是一棵**差异树**，不是扁平列表

```rust
struct CompareNode {
    name: String,
    rel_path: String,
    kind: EntryKind,            // File | Dir | Symlink | Skipped
    status: CompareStatus,      // OnlyLeft | OnlyRight | Newer | Older | SizeDiff | ContentDiff | Same | Indeterminate
    left: Option<EntryMeta>,     // size / modified_time
    right: Option<EntryMeta>,
    suggested_action: Option<SyncAction>,
    children: Vec<CompareNode>,
}
```
**为什么是树**：整目录同步时，「这个子目录整体只在左侧」必须能作为一个整体被识别，
否则只能退化成逐文件传输。扁平列表做不到。

### D-4 · 准则优先级照抄 WinSCP

`修改时间 > 大小 > 校验和`。理由：这是被行业验证过的语义，且能避免
「源文件比目标旧、但内容其实不同」被误判成「需要更新」而白白覆盖掉更新的文件。
**「一个准则都不勾 = 已存在即视为相同」** 同样照抄 —— 这是安全的默认。

### D-5 · 「方向待定」是一等状态

当两侧时间相同但内容不同（或启用了 `ignore date`），系统**不能**替用户决定覆盖方向。
参照 Total Commander 的第四个筛选按钮：这种情况**明确列为待定**，由用户逐条或批量选择。
本仓 B5 徽标与 C3 语义都依赖这一点。

### D-6 · 删除 = 独立开关 + 独立清单 + 独立确认，且默认关

三层保险：默认不勾（D1）→ 预览清单逐条列出（D2）→ 确认框写清删除条数（D4）。
本地删除走回收站（D3）。**远程删除没有回收站，误删不可逆** —— 这是本功能最大的风险点，
所以「镜像模式」的界面必须带 Total Commander 同款警告：
> **不要用镜像模式同步两台都还在用的机器。**

### D-7 · 排除规则同时作用于比较与删除

与 WinSCP / rsync 一致。排除规则在**比较阶段**就把项排除掉，
这样删除清单天然不会包含它们 —— 比「先比较再在删除时过滤」更不容易出错。

### D-8 · 时区偏移与大小写是两个独立的「环境适配旋钮」

它们都不是「比较逻辑」，而是「让比较结果符合人的直觉」的输入：
远程服务器在另一个时区（A9）、远程是 Linux 而本地是 Windows（A8）。
两者都**按连接保存**（时区偏移）或**全局可配**（大小写），并在结果面板上显示当前取值，
避免用户看不懂为什么某个文件被判成「较新」。

### D-9 · 第一版不做校验和

`RemoteProvider` trait 加 checksum 意味着给 FTP / FTPS / SFTP 三个实现各加一遍，
且**服务器不一定支持**（SFTP 的 `SSH_FXP_CHECKSUM` 未必实现，FTP 根本没有标准校验和命令）。
成本高、可用性不确定 → 放 P1，第一版只做**时间 + 大小**，
并在界面上说明「内容级比较暂不可用」而不是假装有。

### D-10 · 执行复用现有传输管线，但以「差异集」为输入

现有 `transfer::upload(path)` 是「把这一个路径整棵传过去」。
同步需要的是「只传这些差异文件，目录按需创建」。
→ 不改 `upload` 的签名，**新增**一个以差异树为输入的编排层，
内部仍调用 `provider.write_file` / `provider.read_file` / `provider.make_dir`，
这样失败与跳过的上报口径与现有传输保持一致（D9）。

---

## 5. 风险与边界

| 风险 | 说明 | 缓解 |
|---|---|---|
| **远程 `read_dir` 是网络往返** | 递归比较一棵远程大树 = N 次 RTT | 并发上限 + 退避重试（E2）+ 进度可中断（E4） |
| **时间戳精度/时区差异** | NTFS 100ns vs ext4 秒级；SFTP 秒级 | 时区偏移（A9）+ 时间容差 + 大小作为二级准则 |
| **CRLF vs LF** | 文本传输模式会改大小，导致大小判据失真 | 本仓远程传输走**二进制**（`read_file`/`write_file` 是字节流），天然不受影响；**但要在文档里写明**，若将来加文本模式必须禁用大小判据 |
| **本地符号链接** | 跟随会复制整棵子树 | A11 默认不跟随 |
| **大目录内存占用** | 差异树全量驻留内存 | B8 虚拟滚动 + E6 缓存；必要时改为流式产出 |
| **`cargo test --lib` 红线** | 比较模块若引入 tauri runtime，测试二进制加载即崩 | D-1：同步内核 + async 包装 |
| **误删不可逆** | 远程没有回收站 | D-6 三层保险；**验收时靶子必须自造**（沿用 AGENTS.md 既有教训） |
| **双方同时是远程** | 两个 provider 实例的生命周期与并发 | A14 / P1，需专门设计连接配对 |
| **既有「同步浏览」语义混淆** | 用户可能以为两者是一回事 | F2：命名与文案三处严格区分 |

---

## 6. 分期建议

| 阶段 | 内容 | 交付判据 |
|---|---|---|
| **A · 可用** | 递归比较（时间+大小）、差异树 UI、筛选与统计、干跑预览、执行「上传/下载/新建目录」、排除规则、时区偏移、大小写 | 本地↔本地、本地↔远程 都能跑通一轮完整「比较 → 预览 → 执行」 |
| **B · 完整** | 删除 + 镜像模式（带警告）、双向同步 + 方向待定、逐条改判、方案保存、同步报告、差异着色回两个面板 | 镜像模式在自造靶子上验过「多出来的文件被删、排除项没被删」 |
| **C · 增强** | 内容校验和、同步时间戳、断点续传、结果导出、远程↔远程 | 校验和在真机 SFTP 上验过（或明确记录「服务器不支持」的降级） |

**阶段 A 不含删除** —— 这是刻意的：先让「比较」这个只读能力建立信任，
再引入不可逆的删除。

---

## 7. 需要拍板的问题（4 项，其余按本文件推荐默认执行）

1. **双向同步遇到「时间相同、内容不同」怎么办？**
   推荐：**列为「方向待定」，默认跳过并单独列出**，不自动覆盖。
   （WinSCP 双向会按时间硬判；Total Commander 给「无默认方向」状态。本仓取后者更安全。）
2. **远程删除是否需要「移到备份目录」这一档？**
   远程没有回收站，误删不可逆。推荐：提供「删除前先移到 `/.afm-trash-<日期>/`」的可选策略，
   但这会引入服务端依赖（需要写权限 + 磁盘空间），默认关闭。
3. **阶段 A 是否就支持「本地↔本地」？**
   推荐：支持。成本几乎为零（比较引擎本就是 `LocationRef` 泛化的），
   而且本地↔本地是检验比较逻辑正确性最省事的靶子。
4. **界面入口与命名**
   推荐：工具栏按钮「比较并同步」/ 英文 **Compare & Sync**；
   结果面板标题「比较结果」/ **Comparison**；
   **绝不使用**「同步」二字单独出现（已有「同步浏览」占用）。

---

## 8. 涉及文件（预估，供下一轮排期参考）

**新增（后端）**
- `src-tauri/src/compare/mod.rs` —— 比较引擎
- `src-tauri/src/compare/location.rs` —— `LocationRef` 抽象
- `src-tauri/src/compare/criteria.rs` —— 准则与优先级
- `src-tauri/src/compare/tree.rs` —— 差异树数据结构
- `src-tauri/src/compare/sync_plan.rs` —— 差异 → 执行计划
- `src-tauri/src/compare/commands.rs` —— Tauri 命令（`compare_directories` / `start_compare_sync_job` / `cancel_compare_sync_job`）
- `src-tauri/src/compare/__tests__/` —— 单测（**不碰 tauri runtime**）

**新增（前端）**
- `src/modules/navigator/components/compare-sync/` —— 对话框、差异树面板、预览清单
- `src/modules/compare-sync/`（或就近放）—— 状态 store、事件订阅

**改动**
- `src-tauri/src/lib.rs` —— 注册新命令
- `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue` —— 入口按钮
- `src/localization/messages/*.json` —— **17 个语言包**都要加（中文 locale code 是 `ch`）
- `src/modules/navigator/components/file-browser/file-browser-list-view.vue` / `file-browser-grid-card.vue` —— 差异着色（阶段 B）

**复用**
- `src-tauri/src/remote/transfer.rs` —— 传输管线
- `src-tauri/src/copy_move_job.rs` / `delete_job.rs` —— 后台 job + 进度事件模板
- `src-tauri/src/remote/commands.rs` —— 远程增删改

---

## 9. 下一步（等拍板后执行）

1. 按 §7 的 4 个问题确认口径
2. 先写比较引擎的**单测**（假 provider 造数据，锁住 §1.2/§1.3 的准则语义）——
   判别性测试：时间优先级、`ignore date` 退化、方向待定、排除规则同时抑制删除
3. 再做 `LocationRef` 的后端命令 + 一个最小 CLI/脚本入口，**先不碰 UI**
4. UI 阶段 A：工具栏入口 → 差异树面板 → 预览清单 → 执行
5. 真机验收：按 AGENTS.md 既有纪律，破坏性场景的靶子必须自造，
   且 `tauri dev` 的界面结论一律作废，必须用 `tauri build` 的打包产物
