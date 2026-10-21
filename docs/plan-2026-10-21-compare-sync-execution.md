# 执行计划：分屏比较并同步（阶段 A）+ 网络驱动器映射入口（2026-10-21）

> 依据 `docs/plan-2026-10-21-directory-compare-and-sync.md` 的需求表。
> §7 的 4 个待拍板问题**已按推荐口径定案**（见 §1）。
> 本轮目标：**阶段 A 全部 + 网络驱动器映射入口**，做完打包 exe。

---

## 1. 四项拍板结论（已定案，按推荐执行）

| # | 问题 | **定案** | 落点 |
|---|---|---|---|
| 1 | 双向同步遇到「时间相同、内容不同」 | **列为「方向待定」，默认跳过并单独列出，不自动覆盖** | 差异树 `CompareStatus::Indeterminate`；执行计划里这类项不产生动作，只进报告 |
| 2 | 远程删除要不要「移到备份目录」 | **阶段 A 不做删除，所以暂不实现**；阶段 B 做成可选项、默认关闭 | 留到阶段 B |
| 3 | 阶段 A 是否支持「本地↔本地」 | **支持**。比较引擎用 `LocationRef` 泛化，本地↔本地免费拿到，且是最省事的正确性靶子 | `LocationRef::Local` vs `LocationRef::Local` |
| 4 | 命名 | **「比较并同步」/ Compare & Sync**；结果面板叫「比较结果」/ Comparison；**绝不单独用「同步」二字**（已被「同步浏览」占用） | i18n key 前缀 `compareSync*` |

---

## 2. 批次划分

| 批次 | 内容 | 产出 | 判据 |
|---|---|---|---|
| **B0** | 执行计划文档 | 本文件 | — |
| **B1** | **网络驱动器映射入口** | 侧边栏盘符条下的「添加网络驱动器」按钮 + 对话框 + 挂载后刷新盘符 | 装机后能真的挂出一个盘并出现在侧边栏 |
| **B2** | 比较引擎后端 + 单测 | `src-tauri/src/compare/`（location / criteria / tree / compare_blocking / commands） | `cargo test --lib` 全绿，且新增单测锁住准则语义 |
| **B3** | 同步计划 + 后台 job | `compare/sync_plan.rs` + `compare_sync_job.rs`（progress / finished / cancel） | job 能跑、能取消、失败项单独上报 |
| **B4** | 前端 UI | 工具栏入口 + 对话框（目录/准则/排除/时区/大小写）+ 差异树面板 + 筛选统计 + 预览清单 + 执行 | 装机后能跑通一轮「比较 → 预览 → 执行」 |
| **B5** | i18n | 17 个语言包（中文 locale code 是 `ch`） | `sync-i18n` 校验通过 |
| **B6** | 门禁 + 真机验收 + 打包 + 发版 | 安装包 + 验收记录 + 交接文档 | 见 §5 |

**B1 提前做的理由**：它独立、范围小、用户明确点名，且**后端与表单都已存在**（只缺入口），
放在最前面能把「一个完整可交付的小功能」先落地，再上大头。

---

## 3. B1 细节：网络驱动器映射入口

### 3.1 现状

| 已有 | 位置 |
|---|---|
| `mount_network_share(params)` 命令 | `src-tauri/src/dir_reader/commands.rs` → `network_shares.rs` |
| `NetworkShareParams{protocol, host, port, username, password, remote_path, mount_name}` | `dir_reader/types.rs` |
| Windows 实现：`net use * \\host\share`（**自动分配盘符**），可选 `/user:` + 密码 | `network_shares.rs` |
| `disconnect_drive(device_path, mount_point, drive_type)` | `dir_reader/commands.rs` → `mount.rs` |
| **现成表单对话框**（协议/主机/远程路径/用户名/密码/挂载名） | `src/modules/home/components/mount-dialog.vue` |
| 盘符条（C D E F G …） | `src/modules/nav-sidebar/nav-sidebar.vue` 的 `nav-sidebar-drives` |

### 3.2 缺口

1. **侧边栏没有入口** —— `mount-dialog.vue` 只在主页的「驱动器」区可达
2. **Windows 上协议选择没用**：`sshfs` 需要 WinFSP、`nfs` 需要 Windows 功能，
   在 Windows 上**必然失败**，但对话框照样列出来
3. **`net use *` 不让用户选盘符** —— 资源管理器的「映射网络驱动器」允许指定盘符
4. 挂载后**盘符列表不刷新**

### 3.3 做法

| 改动 | 内容 |
|---|---|
| 后端 | `NetworkShareParams` 增加 `drive_letter: Option<String>`；Windows 实现里 `net use *` 改成：有指定则 `net use <letter> \\host\share`，没有则保持 `*` |
| 后端 | 抽出 `mount_network_share_blocking` 同步内核（`net use` 是子进程调用，属于阻塞 IO） |
| 前端 | `nav-sidebar.vue` 的 `nav-sidebar-drives` 下加一个「添加网络驱动器」按钮（`NetworkIcon` + `Plus`），点击打开对话框 |
| 前端 | 复用 `mount-dialog.vue`，加 `mode="network"` 属性：只保留 **SMB** 协议（Windows）；暴露盘符选择（可选，留空=自动） |
| 前端 | 挂载成功后 `useDrives()` 刷新（查 `useDrives` 的 refresh 机制） |
| i18n | `navSidebarAddNetworkDrive` / `mountDialog*` 若干 |

> **对话框复用还是新建**：复用 `mount-dialog.vue`（它已经写好了表单、校验、错误展示、
> `mount_network_share` 调用）。改动限定在「加一个 `networkOnly` 模式」，不重写表单。

---

## 4. B2–B4 细节：比较并同步

### 4.1 后端模块结构

```
src-tauri/src/compare/
├── mod.rs            模块出口 + 对外类型
├── location.rs       LocationRef（Local / Remote）+ list_children 抽象
├── criteria.rs       CompareCriteria（时间/大小/校验和）+ 优先级 + 大小写 + 时区
├── tree.rs           CompareNode / CompareStatus / 差异树
├── compare.rs        compare_blocking（同步内核）+ 递归遍历
├── sync_plan.rs      差异树 -> SyncPlan（上传/下载/建目录/跳过）
├── commands.rs       Tauri 命令
└── __tests__/        单测（不碰 tauri runtime）
```

### 4.2 关键类型

```rust
enum LocationRef {
    Local(PathBuf),
    Remote { connection_id: String, path: String },
}

struct CompareCriteria {
    by_time: bool,        // 默认 true
    by_size: bool,
    by_checksum: bool,
    case_sensitive: bool,
    remote_time_offset_seconds: i64,
    recursive: bool,
    max_depth: Option<usize>,
    exclude_patterns: Vec<String>,
}

enum CompareStatus {
    OnlyLeft, OnlyRight, Newer, Older, SizeDiff, ContentDiff, Same, Indeterminate,
}
```

### 4.3 准则语义（照抄 WinSCP，单测锁死）

| 组合 | 判定 |
|---|---|
| 只开时间 | 时间不同即不同；源更旧 → `Older`，源更新 → `Newer` |
| 时间+大小 | **时间优先**：时间不同就按时间判，不再看大小 |
| 全不勾 | 已存在即视为相同（`Same`），只报单侧独有 |
| 时间相同 + 内容不同 | `Indeterminate`（拍板结论 #1） |
| 大小写不敏感 | `Foo.txt` 与 `foo.txt` 视为同名 |

### 4.4 同步计划（阶段 A 不含删除）

```
SyncAction::UploadFile { from, to }
SyncAction::DownloadFile { from, to }
SyncAction::CreateRemoteDir { path }
SyncAction::CreateLocalDir { path }
SyncAction::Skip { reason }        // 含 Indeterminate
```

执行走 `remote::transfer` 的既有管线（`write_file` / `read_file` / `make_dir`），
失败与跳过沿用 `RemoteTransferReport` 的口径。

### 4.5 前端

- 工具栏（分屏时可见）：「比较并同步」按钮 → 打开对话框
- 对话框页签：`目录`（左右根目录 + 递归 + 深度）/ `准则`（时间/大小/校验和/大小写/时区）/ `排除`（掩码）
- 结果面板：差异树（左侧）+ 统计条 + 状态筛选 + 逐条状态徽标
- 执行前：预览清单（上传/下载/新建目录/跳过 分栏）
- 执行中：进度（复用 job 事件模式），可取消

---

## 5. 门禁与验收

| 门禁 | 口径 |
|---|---|
| `cargo test --lib` | 现有 702 全绿 + 新增单测全绿 |
| `npx vitest run` | 现有 229 文件 / 2031 用例全绿 + 新增 |
| `npx eslint src` | 现有 170 errors / 0 warnings 逐字一致 + 新增文件不引入新问题 |
| `npx vue-tsc --build` | 0 |
| `node scripts/verify-changelog.mjs` | OK（发版前） |

**真机验收**（按 AGENTS.md 纪律）：
- 必须用 `tauri build` 的**打包产物**，`tauri dev` 的界面结论一律作废
- 破坏性场景的靶子**必须自造**，不许用用户真实目录
- 比较同步的验收靶子：自造本地目录树 + 上一轮留下的 `\\localhost\AFMTest` 那种
  自建 SMB 共享（用完复原）
- 网络驱动器入口的验收靶子：自建 SMB 共享 → 挂载 → 侧边栏出现 → 卸载 → 复原

---

## 6. 风险与退路

| 风险 | 退路 |
|---|---|
| B2–B4 工作量超预期 | 优先保证 B1 + B2 + B3 + 最小 UI（结果树 + 预览 + 执行），分屏入口可延到下一轮 |
| 远程递归遍历慢 | 限并发 + 进度可中断（B5 阶段 A 已含 E2/E4） |
| 破坏性操作误伤用户数据 | 阶段 A **不含删除**；验收靶子自造 |
| 17 语言包文案量 | 英文/中文写全，其余语言先给英文占位（`sync-i18n` 校验只查 key 对齐） |
| `cargo test --lib` 红线 | 比较引擎写成同步内核 + async 包装，不碰 `tauri::async_runtime` |

---

## 7. 交付物

- 安装包 `Alpha File Manager_3.4.0_x64-setup.exe`（版本号在 B6 决定）
- `docs/handoff-2026-10-21-compare-sync-and-network-drive.md` —— 交接文档
- README / CHANGELOG / 本地化 changelog 补新功能
- 推送 `origin/main` + 标签 + GitHub release + aiec.fun
