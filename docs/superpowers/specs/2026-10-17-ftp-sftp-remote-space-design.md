# FTP / SFTP 远程空间 —— 设计规格

> 写入时间：2026-10-17
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
> 基线：`aa530414`（批次 11 交接提交，3.2.4 正式版）
> 状态：**待评审**
> 上游约束：`F:\soft\00selfmade\filemanager\AGENTS.md`

---

## 0. 已锁定的决策（2026-10-17 用户拍板）

| 决策点 | 结论 |
|---|---|
| 集成深度 | **L2 虚拟位置** —— 远程目录出现在导航器里，能新建标签、用地址栏跳转、在目录树中出现；**跨本地边界的拖拽/复制首版禁用** |
| 形态 | **内嵌进主线**（不做扩展） |
| 协议范围 | **FTP 明文 + FTPS 显式 + FTPS 隐式 + SFTP 全上** |
| 读写范围 | **读写全支持**：浏览、上传下载、新建目录、重命名、删除 |

> 「读写全支持」比首版建议的范围更大（建议是只读 + 传输）。因此**删除与重命名的安全性**
> 必须和功能同时设计，不能事后补 —— 见 §6 破坏性操作。

---

## 1. 目标与非目标

### 目标

让 AFM 能把远程服务器上的目录当作「本地目录一样的地方」来浏览和管理，
复用导航器已有的多标签、地址栏、目录树、面包屑、分屏、排序、视图切换等能力。

### 非目标（首版明确不做）

- **远程 shell**（SSH exec）。本需求的 SSH 指 **SFTP 文件传输**，不是登录远程机器执行命令。
- **WebDAV / SMB / S3**。SMB 在 Windows 上有原生支持；S3 与 WebDAV 留给后续协议。
- **跨边界拖拽 / 复制粘贴**（本地 ↔ 远程、远程 ↔ 远程）。见 §5 门禁矩阵。
- **双向实时同步 / 文件夹镜像**。那是另一个产品形态。
- **远程文件的全局搜索**（现有 `global_search` 索引的是本地盘）。
- **远程缩略图与预览**。列为阶段 7，理由见 §8。

---

## 2. 关键前提：现有代码已经为此铺了路

这一节是本设计可行性的根据，全部来自仓库代码核实，不是推测。

### 2.1 已有自定义 scheme 与虚拟路径机制

`src/utils/virtual-path-constants.ts` 已经定义了 `sfm://locations`，
`src/utils/virtual-locations.ts` 的 `resolveDirectoryContents()` 会**先判断虚拟路径、
再回落到 `invoke('read_dir')`**。`Locations`（系统位置）与 `WSL` 两个虚拟目录就是这样实现的。

远程位置沿用同一套机制，路径方案定为：

```
sfm://remote/<connectionId>/<remotePath>
例：sfm://remote/c-7f3a/uploads/2026/
```

`connectionId` 是稳定的短标识，指向凭据存储里的连接记录；`remotePath` 是服务器上的路径。

### 2.2 列目录只有一个收口点

`resolveDirectoryContents()` 被以下全部入口复用，**没有旁路**：

- `stores/storage/workspaces.ts`（标签页加载）
- `modules/navigator/composables/use-file-tree.ts`（目录树）
- `modules/navigator/components/file-browser/use-file-browser-navigation.ts`（主导航）
- `modules/navigator/components/file-browser/address-bar.vue`（面包屑同级目录）
- `modules/navigator/components/file-browser/address-bar-editor-dialog.vue`（地址编辑器）

这意味着**加一个 provider 分支，远程目录就能自动获得上面全部能力**，而不是逐个入口去改。

### 2.3 已有动作门禁的统一收口

`src/utils/entry-action-policy.ts` 现在有三个策略：`virtual-location` / `system-mount-root` / `normal`，
用两张 `Set<ContextMenuAction>` 表来禁用动作。远程路径加一个 `remote` 策略是自然的第四种。

### 2.4 项目惯例是内嵌而非扩展

MCP、LAN 分享、批量重命名、默认文件管理器、终端、归档 —— 全部在主线内实现。
唯一的扩展 `kizemo.focus-sync` 是跨产品（要同步到别的软件的对话框），性质不同。

而且：**扩展 API 里不存在虚拟文件系统挂载点**（`packages/api/index.d.ts` 的
`sigma.fs.*` 全部只认本地路径，`ExtensionPermission` 也没有网络出口类别）。
所以「做成扩展」并不能真正避开核心改动，只是把改动挪到更曲折的地方，
还要额外重写一整套 iframe 界面。详见 §7 形态对比。

---

## 3. 架构

### 3.1 总体分层

```
┌─────────────────────────────────────────────────────────────┐
│  Vue 前端（导航器 UI，不感知 FTP/SFTP 存在）                  │
│  resolveDirectoryContents ←── provider 分发                   │
│  entry-action-policy      ←── remote 策略门禁                 │
└────────────────────────────┬────────────────────────────────┘
                             │ Tauri invoke
┌────────────────────────────┴────────────────────────────────┐
│  Rust 远程层 src-tauri/src/remote/                           │
│  ├─ paths.rs       sfm://remote 路径解析/构造/父级/显示名      │
│  ├─ credentials.rs 连接元数据 + DPAPI 机密存储                 │
│  ├─ connection.rs  连接池（按 connectionId 复用）             │
│  ├─ provider.rs    RemoteBackend trait + 注册表               │
│  ├─ transfer.rs    传输任务、队列、进度、续传                  │
│  ├─ ftp/backend.rs FTP / FTPS 实现                           │
│  └─ sftp/backend.rs SFTP 实现                                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 路径解析与归一化（新增）

在 `virtual-path-constants.ts` 增补：

- `isRemotePath(path)` —— 是否远程
- `parseRemotePath(path)` → `{ connectionId, remotePath } | null`
- `buildRemotePath(connectionId, remotePath)` → `sfm://remote/...`
- `getRemoteParentPath(path)` → 远程父目录；到根时返回 `sfm://remote/<id>`

在 `virtual-locations.ts` 的三个函数（`resolveDirectoryContents` / `resolveDirEntry` /
`getNavigableParentPath`）加远程分支，与现有 Locations 分支并列。

**注意**：`normalize-path.ts` 里的 `canonicalizePath` / `getParentPath` 对 `sfm://` 前缀的
行为必须显式测试，不能假设。远程路径**不做本地风格的盘符补全、不做 `..` 越出服务器根的钳制**
（服务器根由协议决定，`..` 越过根应当原样交给服务器处理并把错误映射成可读提示）。

### 3.3 后端 trait

```rust
// provider.rs —— 刻意保持小，只放「元数据 + 写操作」
// 传输不在这里，走 transfer.rs，避免 trait 被传输需求撑大
pub trait RemoteBackend: Send + Sync {
    fn list(&self, path: &str) -> BoxFuture<'_, Result<Vec<RemoteEntry>, RemoteError>>;
    fn stat(&self, path: &str) -> BoxFuture<'_, Result<RemoteEntry, RemoteError>>;
    fn mkdir(&self, path: &str) -> BoxFuture<'_, Result<(), RemoteError>>;
    fn rename(&self, from: &str, to: &str) -> BoxFuture<'_, Result<(), RemoteError>>;
    fn remove(&self, path: &str) -> BoxFuture<'_, Result<(), RemoteError>>;
}
```

> ⚠️ **`cargo test --lib` 红线（AGENTS.md 已记录，本设计必须遵守）**
> 被测试链接到的代码**不得触碰 `tauri::AppHandle` 或 `tauri::async_runtime::*`**。
> 否则 `GlobalRuntime<Wry>` 会单态化出 `<Wry as Runtime>`，把 tao 拖进测试二进制，
> tao 里的 `comctl32.dll!TaskDialogIndirect` 需要 comctl32 v6 而测试二进制没有 manifest
> → 加载期以 `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉，一个测试都跑不了，
> **且报错里完全看不出跟本模块有关**。
>
> 落地方式：沿用项目既有模式（`dir_reader.rs` / `global_search.rs` 的 `*_blocking` 同步内核
> + 调用方选执行器）。trait 的每个方法都要有对应的同步内核入口，
> 单测只跑同步内核，不引入任何 tauri 类型。

### 3.4 连接池

按 `connectionId` 复用连接。规则：

- 列目录、stat 等元数据操作**复用**已有连接，不每次重连
- 连接空闲超时自动断开（可配，默认 5 分钟）
- 传输期间连接**独占**，不与元数据操作争用
- 断线后不自动重放写操作（见 §6）

### 3.5 凭据存储

| 内容 | 存放 | 保护方式 |
|---|---|---|
| 连接元数据（协议、主机、端口、用户名、初始目录、编码、被动/主动） | `user-data/remote-connections.json` | 明文（不含机密） |
| 密码 | `remote-credentials.json` | **Windows DPAPI** 加密后 base64 |
| SSH 私钥 | **只存路径**，不存内容 | 由用户自己控制文件 ACL |
| SSH 主机公钥（known_hosts） | `user-data/remote-known-hosts.json` | 明文，首次连接需用户确认指纹 |

> 目录与命名沿用 `%APPDATA%\com.sigma-file-manager.app\` 的既有布局，
> 与 `mcp-access.json`（MCP 令牌）并列。**受保护常量不得改动**：
> mDNS 服务名、legacy 数据目录名、Tauri `identifier` 都不动。

---

## 4. 功能分层

| 层 | 内容 | 前置 |
|---|---|---|
| **L1 浏览** | 连接、列目录、进/退目录、面包屑、排序、刷新、连接复用 | 连接管理 + 凭据 |
| **L2 传输** | 上传/下载、进度、失败提示 | L1 |
| **L3 远程写操作** | 新建目录、重命名、删除 | L1 |
| **L4 预览** | 缩略图、文本/图片预览、属性 | 阶段 7 |
| **L5 跨边界** | 本地↔远程拖拽、复制粘贴 | **首版不做** |

---

## 5. 门禁矩阵（L2 + 读写全支持）

`entry-action-policy.ts` 新增 `remote` 策略。远程条目与本地条目混选时，取**最严格**的策略。

| 动作 | 远程条目上 | 远程目录内 | 跨边界（本地 + 远程混选） |
|---|---|---|---|
| 打开 / 进入目录 | ✅ | ✅ | — |
| 新建标签、地址栏跳转、目录树 | ✅ | ✅ | — |
| 新建目录 | ❌ | ✅ | ❌ |
| 新建文件 | ❌ | ❌（见下注） | ❌ |
| 重命名 | ✅ | ✅ | ❌ |
| 删除 | ✅ | ✅ | ❌ |
| 下载到本地 / 从本地上传 | ✅ | ✅ | ✅（这是传输，不是文件操作） |
| 复制 / 剪切 / 粘贴 | ❌ | ❌ | ❌ |
| 拖拽 | ❌ | ❌ | ❌ |
| 链接 / 快捷方式 | ❌ | ❌ | ❌ |
| 缩略图 / 快速查看 / 打印 | ❌（阶段 7 再开） | ❌ | ❌ |
| 属性 | ✅（只读展示远程元数据） | ✅ | ✅ |

> **注**：在远程目录内「新建文件」首版**不支持** —— 新建空文件在 FTP/SFTP 上
> 没有统一的语义（SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件），
> 强行实现会得到一个行为不可预期的功能。首版只支持「新建目录」。

---

## 6. 破坏性操作与错误处理

删除与重命名是本设计里**后果最重**的操作，与「读写全支持」的决定同时落地。

### 6.1 删除

- **删除远程目录必须递归**，且二次确认对话框要显示**远端完整路径**与**将被删除的条目数**
  （条目数需要先做一次递归统计，可能慢 —— 首版可先只显示路径，统计列入阶段 6）
- 删除**不做回收站**。FTP/SFTP 没有本地那样的回收站语义。
  确认对话框文案必须明确写出「**此操作不可撤销**」
- 删除进行中若断线，**状态是「未知的部分删除」**，必须如实告知，不得显示成成功或失败

### 6.2 断线时不自动重放

传输类的重试是安全的（幂等或可续传）；**写操作不自动重放**。
断线后重试一次 `rename` / `remove` 可能作用在状态已变的对象上。
统一策略：写操作失败即停，把控制权交回用户。

### 6.3 错误分类

`RemoteError` 必须能区分下面几类，因为用户对它们的处置完全不同：

| 类别 | 含义 | 界面处置 |
|---|---|---|
| `Auth` | 认证失败 / 私钥被拒 / known_hosts 不匹配 | 提示重新输入凭据；host key 不匹配要**显式警告** |
| `Unreachable` | 网络不可达 / DNS 失败 / 连接超时 | 提示检查网络与主机名 |
| `Permission` | 有权限但对该路径无权限 | 提示权限不足，可返回上级 |
| `NotFound` | 路径不存在 | 与 Permission 分开（FTP 上两者可能同码） |
| `Protocol` | 服务器拒绝命令、命令不支持 | 明确说明是哪一步失败 |
| `Encoding` | 文件名编码无法解码 | 显示原始字节的替代表示 |
| `Disconnected` | 传输中断 | 传输类给续传；写操作按 §6.2 处理 |

**判死「连接失败」这一个笼统错误** —— 那会让用户无法判断该换密码还是换网络。

### 6.4 文件名编码

很多国内 FTP 服务器是 GBK/GB2312 而不是 UTF-8。连接配置里必须提供**字符编码**选项
（UTF-8 / GBK / Latin-1 / 服务器声明值），并且在无法解码时走 `Encoding` 错误而不是崩溃。

---

## 7. 形态对比（为什么是内嵌）

### 7.1 结论

**内嵌进主线。**

### 7.2 证据

| 维度 | 内嵌 | 做成扩展 |
|---|---|---|
| 远程能否像本地一样用 | ✅ 天然可以 | ❌ 扩展 API 无 VFS 挂载点，**仍要改核心** |
| 列目录接入 | 低，`resolveDirectoryContents` 单收口点 | 同样要动这个收口点 |
| UI 复用 | ✅ 多标签/地址栏/目录树/分屏全白拿 | ❌ iframe 独立页面，**整套 UI 重写** |
| 主线风险 | FTP 边角（被动模式、编码、FTPS 变体）拖慢主线发版 | ✅ 完全隔离 |
| 迭代速度 | 慢，跟发版节奏 | ✅ 独立发版，marketplace 已有分发链路 |
| 许可证面 | ⚠️ 每个引入库都要核 GPL-3 兼容 | ✅ 独立仓库，风险低 |
| 符合项目惯例 | ✅ MCP / LAN 分享 / 批量重命名都在主线 | 仅 focus-sync，且性质不同 |

### 7.3 工作量对比（粗估，人日，误差可能 ±50%）

| 阶段 | 内嵌 | 扩展（含必要的 VFS 钩子） |
|---|---|---|
| VFS 抽象 + `sfm://remote` + 门禁 | 8–12 | 10–15（还要设计向后兼容的公共 API） |
| 连接管理 + 凭据 | 5–8 | 5–8 |
| FTP 浏览 + 传输 | 10–15 | 20–30（sidecar + 重写 UI） |
| FTP 写操作 | 5–8 | 5–8 |
| FTPS | 3–5 | 3–5 |
| SFTP | 5–8 | 5–8 |
| 传输队列化 | 8–15 | 8–15 |
| 预览与缩略图 | 5–8 | 5–8 |
| **合计** | **约 49–79** | **约 61–89** |

**扩展路线更贵、UX 更差、核心还一样要改。**

---

## 8. 阶段划分

每个阶段都能独立发一个 beta，符合项目「一功能点升一个版本号」的既有做法
（批次 8/9/10 每批各升一个 beta 版本号）。

| 阶段 | 内容 | 产出 | 粗估 |
|---|---|---|---|
| **0** | VFS 骨架：provider 抽象 + `sfm://remote` 路径族 + `remote` 门禁 + **假 provider**（不含任何 FTP 代码） | 内核可用，无用户可见功能 | 8–12 |
| **1** | 连接管理 + 凭据存储（DPAPI）+ 设置页 + 传输队列骨架 | 可保存连接，尚不能浏览 | 5–8 |
| **2** | **FTP 明文** 只读浏览打通导航器 + 下载/上传（简单同步传输，带进度） | 首个可用 beta | 10–15 |
| **3** | FTP 远程写操作：新建目录 / 重命名 / 删除（含 §6 的安全设计） | | 5–8 |
| **4** | **FTPS** 显式（AUTH TLS）与隐式（990） | | 3–5 |
| **5** | **SFTP**（SSH 私钥 + known_hosts 校验） | 三协议齐备，**首版达成** | 5–8 |
| **6** | 传输队列化：暂停/继续/取消、断点续传、失败重试；删除前递归统计 | | 8–15 |
| **7** | 远程预览与缩略图（下载到临时目录再渲染） | | 5–8 |
| **8** | 跨边界拖拽 / 复制粘贴（**待用户确认是否需要**） | | 8–12 |

**阶段 0 单独有价值**：它不含任何 FTP 代码，但把「非本地文件系统」这件事在核心里表达清楚，
未来接 S3 / WebDAV / 局域网共享时不必重来。

### 8.1 实施拆分（scope decomposition）

本规格覆盖 8 个阶段，**规模上不允许写成一份实施计划** —— 后续应**逐阶段**
走「计划 → 实施 → 打包验收 → 交接」的循环，每阶段一份计划文档
（沿用 `docs/superpowers/plans/` 的既有约定）。
建议的第一个计划是**阶段 0**；它不含 FTP 代码，风险最低，且是后面所有阶段的地基。

各阶段之间的依赖是**严格串行**的（阶段 N+1 依赖阶段 N 的抽象），
不存在可并行的阶段 —— 计划排期时不要试图并行压缩。

---

## 9. 测试策略

沿用本仓库既有门禁，逐字对照基线：

| 项 | 基线（HEAD = `aa530414`） |
|---|---|
| `cargo test --lib` | 386 passed |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | 179 errors / 0 warnings |
| `npx vitest run` | 186 文件 / 1465 用例 |
| `node scripts/verify-changelog.mjs` | 退出码 0 |

> ⚠️ **eslint 口径必须是 `npx eslint src`**，不是项目脚本 `eslint .`（整仓是 186/121）。
> 混口径会凭空多出 7 个「回归」。单文件 `eslint --fix` 通过 ≠ 回到基线，必须再跑全量对照。

### 9.1 单测

- **路径层**：`sfm://remote` 解析、父级计算、边界情况（根目录、`..`、尾斜杠、中文与空格）
- **门禁层**：§5 矩阵逐格断言，含混选时的最严格取值
- **provider**：用**假 backend** 驱动，覆盖成功/各类错误/断线，**不连真实网络**
- **连接池**：复用、空闲超时、传输独占
- **传输状态机**：暂停/继续/取消/续传/重试的状态迁移
- **前端**：连接表单校验、传输队列 UI 状态、连接管理页

### 9.2 测试纪律（本项目既有教训，必须遵守）

- **阳性对照**：每条断言要证明「新行为确实发生」，不能只测「不报错」。
  同义反复的占位测试（如 `expect(typeof fn).toBe('function')`）一律删掉。
- **注入验证**：至少挑一处判定**故意改坏**，确认对应测试转红；
  还原必须是与注入语义完全无关的独立命令（`snapshot` / `inject` / `restore` 三条显式子命令），
  不要让同一个脚本靠「参数有无」区分两种相反行为。
- **探针要带阳性对照**：判定「某个机制不支持」之前，先确认探针本身能测到已知为真的东西。
- **只断言内存状态的测试抓不到落盘缺陷**：涉及连接配置持久化，
  必须断言真正走一遍存储 `entries()` 的往返。

### 9.3 端到端验收

真机验收**必须用 `tauri build` 的打包产物**（`tauri dev` 下路由页内容区是空白，结论一律作废）。
需要一个本地测试服务器（FTP + SFTP 各一），建议用容器或嵌入式测试服务端起在
`C:\Users\<user>\` 下的普通目录 —— **不要放 `%TEMP%`**，
`global_search/ignore.rs` 的 `builtin_ignored_paths()` 含 `/AppData/Local/Temp`，会被忽略规则剪掉。

---

## 10. 技术选型（待回填）

开源实现的调研正在进行，报告将写入
`docs/ftp-sftp-oss-landscape-2026-10-17.md`。本节待回填的内容：

- FTP 库选定（含许可证与 GPL-3 兼容性结论）
- SFTP 库选定（**是否需要外部 C 库 / 系统 OpenSSL**，这直接决定 Windows 打包与交叉编译难度）
- 是否引入 rclone 作为 sidecar（**必须现场核对其仓库当前 LICENSE**，历史上 GPLv3 与 SSPL 之间有过变更）
- `cargo test --lib` 红线对所选库的影响（是否会单态化出 tauri 类型）

**选型的硬约束**：AFM 是 GPL-3.0-or-later，任何 SSPL / 非商业 / 字段级限制的库
**不能作为可链接依赖**引入；若只能以 sidecar 形式使用则另行评估。

---

## 11. 未决问题

1. **跨边界拖拽 / 复制粘贴**（阶段 8）首版不做 —— 需确认用户是否要，以及优先级。
2. **远程文件的全局搜索**是否要 —— 现有索引器面向本地盘，远程接入需要另一套策略。
3. **多连接同时打开**是否要 —— 连接池已按 id 设计，但 UI 上同时开多个远程标签页的
   体验与内存占用需要实测再定。
4. **代理支持**（SOCKS5 / HTTP proxy）是否要 —— 很多企业环境必须走代理。
