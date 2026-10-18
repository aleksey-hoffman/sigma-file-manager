# 接力文档：Alpha File Manager FTP/SFTP 远程空间 · 阶段 2（真正列远端目录）

> 阶段 1（连接管理 + DPAPI 凭据 + 设置页 + 「测试连接」+ 导航栏入口）**已完成并验收**。
> 本文件只讲**阶段 2 要做什么**、**已经踩过什么坑**、以及**必须先确认的事实**。
> 阶段 1 的背景与已核实事实见 `docs/handoff-2026-10-18-remote-phase-1.md`（仍在，先读它）。

---

## 1. 一句话说清为什么现在做这个

用户 2026-10-18 的原话：**「如果远程目录和文件无法在 AFM 显示，这个功能就没有意义了。」**

阶段 1 的入口、设置、凭据、探测都已就绪，但**远端目录一格仍是空的** —— 点导航栏里的
远程连接会开出双栏，右边那格显示的是本机的默认目录。**阶段 2 之前这个功能确实还不能用。**

---

## 2. 当前状态（已核实，不要重新调查）

| | 状态 |
|---|---|
| 分支 | `feat/remote-phase-1-connections-transport` |
| 最新 commit | `0c184551` |
| 阶段 1 门禁 | `cargo test --lib` **495** · `vitest` **1562 / 192 文件** · `vue-tsc` **0** · `eslint src` **179**（= 分支起点 `3810069e` 基线）· `changelog` 0 · 远程 i18n **59 键 × 17 语言包** |
| 打包产物 | `src-tauri/target/release/bundle/nsis/Alpha File Manager_3.2.4_x64-setup.exe`（18.89 MiB） |
| 已装位置 | `D:\Program Files\Alpha File Manager\alpha-file-manager.exe` |
| 用户真实连接 | `user-remote-connections.json` 里有 2 条，**两条都存了密码**（「速豹堂」SFTP 192.168.1.9:22 duanyi → `E:/website_sbt`；`Acceptance-localdir-01` FTP → `C:\Users\Duanyi\Documents`） |
| NAS | 192.168.1.9：22 SSH 可用、**21 FTP 也在跑**、443/139/445 可用 |

`src-tauri/src/remote/` 现有 10 个模块：`commands / connection / connection_test /
credentials / error / fake / path / provider / transport`。
其中 `provider.rs` 只有 trait + `RemoteEntry`，`fake.rs` 的假实现**只在测试里被调用**。

---

## 3. 需求 1 的根因（已坐实，不是推测）

远程路径 `sfm://remote/<连接id>/<远端路径>` 的前端定义在 `src/utils/remote-paths.ts`
（Rust 侧镜像 `src-tauri/src/remote/path.rs`），两端规则必须一致。

导航器读目录的唯一出口是 `src/utils/virtual-locations.ts` 的
`resolveDirectoryContents(path, options)`（:198-214）：它只认「位置」与「WSL 主机」两种
虚拟路径，**其余一律 `invoke('read_dir', { path })`**。`sfm://remote/...` 落到本地
`read_dir`，Rust 拿它去 `fs::metadata` 必然失败。

失败之后：`src/modules/navigator/components/file-browser/composables/use-file-browser-navigation.ts:827-843`

```ts
async function init() {
  if (currentTab?.path) {
    await readDir(currentTab.path);
    if (error.value) { await navigateToDefaultDirectory(); }   // ← 静默跳走
```

**这就是用户截图里右栏变成 `C:\Users\Duanyi` 的机制** —— 不是渲染问题，是一次静默兜底。
所以阶段 2 的第一件事不是「画远端目录」，而是**让这条路径有真实出口**。

---

## 4. 阶段 2 的任务清单（按依赖排序）

### 4.1 前端连带项（先做，风险最低，独立有价值）

1. `src/utils/virtual-locations.ts` 的 `resolveDirectoryContents` 加 `isRemotePath` 分支 →
   `invoke('remote_read_dir', …)`。**这是唯一接入点**，改一处即同时修好主列表、目录树、
   地址栏下拉、workspace 预载四条路径。
2. `resolveDirEntry`（同文件 :216）同样加分支，否则点单个远程条目拿不到元数据。
3. **错误形状**：`read_dir` 的 `Err` 是 `String`，而远程 `RemoteError` 序列化成
   `{kind, message}` 普通对象；`use-file-browser-navigation.ts:698` 的 `String(caughtError)`
   会渲染成 `[object Object]`。要么让新 command 也返回 `String`，要么前端加解包。
4. `address-bar-parts.ts`（:27-99）**没有远程分支**：`getAddressBarSegments('sfm://remote/c/pub')`
   会切出 `['sfm:','remote','c','pub']`，再被 :65-71 当成 Windows 盘符拼成 `sfm:/remote/c/pub`
   —— 点任意面包屑都导航到不存在的路径。crumb 的 path 必须用 `buildRemotePath` 而不是字符串拼。
5. Tab 名：`:450-452` 走 `getPathDisplayName`，远程根会显示成**连接 id（uuid）**。应显示连接名。
6. 守卫补齐：`use-file-browser-navigation.ts` 的 `watch_directory`（:685-691）与
   `dirSizesStore.requestSizesBatch`（:469-476）只跳过 `isVirtualDirectoryPath`，
   远程路径会照样触发 `watch_directory` 与 `get_dir_sizes_batch` 的无效 invoke
   （两者都 catch 掉只打日志，不崩，但会刷控制台、且远程目录卡片的「大小」列永远转圈）。

### 4.2 Rust provider

新增 `SftpRemoteProvider`（实现已有的 `RemoteProvider` trait）+ 新 command `remote_read_dir`。
**接线要改两处**：`commands.rs:148-153` 的 `REMOTE_COMMANDS` 数组 + `src-tauri/src/lib.rs` 的
`generate_handler!`。该文件有一条双向守卫测试（:156-199），只改一处会红。

⚠️ **`RemoteEntry` 不是 `DirEntry` 的超集**（缺 `is_file` / `ext` / `mime` /
`created_time` / `accessed_time` / `item_count`，且命名不同）。而 command 层返回给前端的
契约是 `DirContents`（`src-tauri/src/dir_reader/types.rs:69-76`）。
**适配放在 command 层做，不要让 provider 返回 `DirContents`** —— 那会把本地目录的字段语义
污染进 provider trait。远端的 `opened_directory_times` 填 0。

⚠️ **`modified_time` 单位**：`RemoteEntry.modified_time` 已经刻意约定为 **Unix 纪元毫秒**
（`provider.rs:11-14`），而 SFTP 的 `FileAttributes.mtime` 是 **u32 秒**。忘了 ×1000
的后果是「按修改时间排序」在远程目录下变成一片随机顺序，而且**不会报错**。

### 4.3 known_hosts（硬要求，不是加分项）

`connection_test.rs:15-23` 已经把代价写在明面上：SSH 的 `check_server_key` 目前无条件
`Ok(true)`、FTPS 用 `AcceptAnyCertificate`，「阶段 2 真正读取远端目录时**不得复用本模块**」。
跳过它等于交付一个静默的中间人窗口。

**注意**：`connection_test.rs` 的 `ProbeHandler`（:313-328）与模块顶部的告警注释都在说
「阶段 2 必须换掉」。但 `read_ssh_banner` / `classify_ssh_banner` / `ReplayStream` /
`classify_ssh_handshake_error` / `parse_ftp_reply_code` / `read_reply` / `send_command` /
`upgrade_tls` / `transport::connect` 这些**零件可以复用**，不要重写。
同一个文件的顶部注释已经写了「不校验身份」的完整理由与代价，别删。

---

## 5. ⚠️ 已核实的事实（省掉新会话半天时间）

以下全部已从 `~/.cargo/registry/src/.../` 源码逐字核对，**不要再重新查**。

### 5.1 SFTP 的完整调用链（russh 0.63 + russh-sftp 3.0.1）

```rust
// 1) 传输层：三种出口统一，支持 SOCKS5 / HTTP CONNECT
let stream = transport::connect(&proxy, host, port, Socks5CommandKind::Connect).await?;
// 2) 预读标识串 —— 复用 connection_test.rs 的 classify_ssh_banner / ReplayStream
let stream = read_ssh_banner(stream).await?;
// 3) SSH 握手
let mut handle = russh::client::connect_stream(config, stream, handler).await?;
handle.authenticate_password(user, pass).await?.success();
// 4) 开 session channel 并请求 sftp 子系统
let channel = handle.channel_open_session().await?;          // client/mod.rs，签名已核对
channel.request_subsystem(true, "sftp").await?;              // channels/mod.rs:249 / :550
// 5) 拿到字节流 —— ChannelStream<S> 实现了 AsyncRead + AsyncWrite
let sftp = russh_sftp::client::SftpSession::new(channel.into_stream()).await?;  // session.rs:38
// 6) 列目录
let read_dir = sftp.read_dir(path).await?;                   // session.rs:180 -> ReadDir
```

关键类型与出处：
- `Handle::channel_open_session(&self) -> Result<Channel<Msg>, Error>` —— `client/mod.rs`
- `Channel::request_subsystem<A: Into<String>>(&self, want_reply: bool, name: A)` —— `channels/mod.rs:249` / `:550`
- `Channel::into_stream(self) -> ChannelStream<S>` —— `channels/mod.rs:661`
- `ChannelStream<S>` 实现在 `channels/channel_stream.rs`，`AsyncRead` + `AsyncWrite`
- `SftpSession::new<S>(stream: S)` —— `russh-sftp-3.0.1/src/client/session.rs:38`
- `SftpSession::read_dir<P: Into<String>>(&self, path: P) -> SftpResult<ReadDir>` —— `session.rs:180`
- `SftpSession::metadata<P: Into<String>>(&self, path: P) -> SftpResult<Metadata>` —— `session.rs:248`
- `FileAttributes { size, uid, user, gid, group, permissions, atime, mtime }`（全部 `Option`）
  —— `mtime` 是 **u32 秒**；目录判定用 `permissions` 里的 `S_IFDIR` 位

### 5.2 版本对齐

`russh-sftp 3.0.1` 的 dev-dependency 是 `russh = "0.63.2"`。
**本仓必须继续锁 `russh 0.63`** —— 升到 0.64 会出现两个 russh，`SftpSession` 的类型对不上
我们自己实现的 `Handler`，报出来是一串无线索的类型不匹配。
`src-tauri/Cargo.toml` 里已经写了这个理由的注释。

两者都**关 default feature 走 `ring`**（default 带 `aws-lc-rs`，Windows 要 cmake/nasm；
本项目早已因 reqwest 用 ring）。

### 5.3 本地 registry 已有缓存

`russh-sftp-3.0.1` 与 `suppaftp-12.2.1` 都已在
`C:\Users\Duanyi\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\` 下，
**加依赖不需要等下载**。

### 5.4 FTP 侧

- `suppaftp` 12.2.1 已在本地缓存，但它的 `ImplAsyncFtpStream::connect_with_stream` 收
  `T: TokioTlsStream`（即 `tokio::net::TcpStream`），**绑死 TCP、走不了代理**。
  连接模型有代理字段，用它会让 FTP 测出与实际使用不同的路径。阶段 1 已因此弃用它做探测。
  **FTP 列目录要么继续手写控制通道（在 `connection_test.rs` 的 `ftp_login` 基础上加
  `CWD` / `MLSD` 或 `LIST` / `EPSV`），要么接受「FTP 不支持代理」这个限制。**
- `fast-socks5` 的 `TCPBind` 已经可用（`Cargo.toml:74` 有注释），FTP 被动模式的前置条件已就位。
- 建议顺序：**先把 SFTP 做通**（用户手上唯一在用的是 SFTP），FTP 作为后续。

---

## 6. 还没定的设计决策（动手前先拍板）

1. **连接配置由谁提供？** Rust 侧目前对 `user-remote-connections.json` **零引用**
   （连接元数据归前端 store，密码归 Rust 的 DPAPI 档案，`credentialKey` 就是连接 id）。
   - 方案 A：前端把 `RemoteConnection` 连同密码一起传给 `remote_read_dir`
     —— 与已有的 `remote_test_connection` 同构，改动最小，但每次翻目录都要重连重认证。
   - 方案 B：Rust 侧建会话注册表（`connectionId` → 已认证会话），翻目录复用
     —— 体验好，但要处理失效与并发，且**必须**配 known_hosts。
   阶段 1 的「关闭远程界面自动断开」需求天然要求方案 B。
2. **FTP 与 SFTP 是否同批交付？** 建议否，先 SFTP。
3. **known_hosts 的存储位置与首见策略**（TOFU 记录 / 严格校验）。

---

## 7. 会踩的坑（都已真实踩过或已核实）

- **`cargo test --lib` 红线**：`src-tauri/src/remote/` 下**不得出现** `tauri::AppHandle`、
  `tauri::async_runtime::*`、任何 `tauri::` 路径。碰到就会把 tao 整条窗口链拖进测试二进制，
  测试二进制没有 application manifest 声明 comctl32 v6，`TaskDialogIndirect` 解析不到，
  进程在**加载阶段**以 `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，
  且报错与你的模块毫无关系。`spawn_blocking` 只能放 `commands.rs`。
  **单测永远不要调用 command 函数**（linker 靠「没人引用」才没拖进 tao）。
- **`rust` 环境每次 bash 调用都要重注入**：`cmd /c ".superpowers\sdd\cargo-test.cmd"`。
  `.cmd` 必须**纯 ASCII**（cmd.exe 按 ANSI 读，UTF-8 中文注释会变成「不是内部或外部命令」）。
- **长构建命令接管道会伪装成假死**。判断 cargo 在不在干活看 `Get-Process cargo,rustc` 的 CPU
  时间，**不看它有没有打印东西**。长构建一律重定向到文件。
- **真机验收必须用 `tauri build` 的打包产物，不能用 `tauri dev`**：dev 构建下所有路由页面
  的内容区都是空白，界面结论一律作废。
- **拿不到 webview console 是常态**。可用取证：`PrintWindow(hwnd, hdc, 2)` 截图、UIA 树枚举
  （`InvokePattern` 可点）、屏幕 DC BitBlt（hover / overlay 层只能这样拍）。
  - 导轨按钮的无障碍 Name **全是空串**，且**运行时顺序 ≠ DOM 顺序**（远程按钮实际排最后）。
    **逐个 hover 按面板内容认人**，按序号会 hover 到「拓展功能」。
  - 悬停面板**约 500ms 后就会收起**：检测到之后必须**同一次遍历里立刻点**，中间插一次查询就点不到了。
  - 面板里的连接行无障碍名是 **「<连接名> <双屏标记>」**，不是连接名本身 → 用前缀匹配。
  - **`.ps1` 必须纯 ASCII**：PS 5.1 按 ANSI（GBK）读无 BOM 文件，中文注释会被拆成 GBK
    双字节，**吞掉后面的 ASCII `}` 或引号**，报出来的 `ParserError` 指向几行之后一个无辜的右括号。
    标签一律用码点拼。
- **不要用 PowerShell 的 `Get-Content -Raw` / `Set-Content` 改带中文注释的源文件**。
  改完立刻用 node 验 `s.includes('某个中文注释')` 且 `s.match(/\uFFFD/g)` 为空。
- **`node -e "..."` 的参数里只要可能出现 `"`、`` ` ``、`$`，就改用 write 工具落盘再执行** ——
  PowerShell 会先于 node 解析引号。
- 门禁基线必须用**同一条命令**量。基线是 `eslint src` = **179**；
  改成整仓 `eslint .` 会得到 186，混口径会凭空多出 7 个「回归」。
  **单文件 `eslint --fix` 通过 ≠ 回到基线**，必须再跑一次全量对照。
- `$ErrorActionPreference = 'Stop'` 会把原生命令的 stderr 变成终止错误，
  调 `npm` / `npx` / `powershell` 前后必须显式切回 `Continue`。
- `vitest --reporter=basic` 在本仓库这版不存在，跑全量单测用默认 reporter，
  再按 `Test Files` / `Tests` 两行抓结果。
- **测试纪律**：阳性对照 + 注入验证（故意改坏 → 确认转红 → **独立还原**）。
  注入/还原脚本要用 `snapshot` / `inject <子串>` / `restore` 三条**显式**子命令，
  不要让「不带参数」等于「注入全部」。
- 判绿时额外问两句：**注释里关于因果的每一句主张都是待验证的断言**；
  **测量前先确认被测对象存在**（`v-if` 会让控件整块不渲染，量了个寂寞）。

---

## 8. 验收怎么做

1. 全量门禁：`cargo test --lib` / `vitest` / `vue-tsc` / `eslint src` / `verify-changelog` /
   `.superpowers/sdd/verify-remote-i18n.cjs`。
2. `tauri build` → 静默安装 → 真机：点导航栏远程连接，**右栏必须列的是 NAS 上的远端目录**
   （192.168.1.9 的 SFTP 根），且不能再出现 `C:\Users\Duanyi` 那种静默兜底；
   故意填错密码时要看到认证错误而不是别的。
3. 验收脚本在 `.superpowers/sdd/`（git-ignored）：
   `accept-round2.ps1`（clearPassword / TLS 提示 / 导航面板）、
   `accept-round3.ps1`（切页 / `***` 掩码 / 齿轮直达编辑，**纯 ASCII**）、
   `accept-wrongproto.ps1`（SFTP 指到 FTP 端口的耗时判定）、
   `fixture-remote.cjs`（`snapshot` / `add` / `add-proto` / `restore` 四条显式子命令，
   收尾校验两份 JSON 的 sha256 与快照一致）。
   **新增脚本一律纯 ASCII。**
4. 验收夹具**不要建在 `%TEMP%` 下**。

---

## 9. 环境速查

- Rust：`C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`
- MSVC：`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat`
  （工具版本 `14.44.35207`）
- dumpbin：`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\dumpbin.exe`
- russh 源码：`C:\Users\Duanyi\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\russh-0.63.3\src\`
- russh-sftp 源码：`...同一父目录...\russh-sftp-3.0.1\src\`
- 用户数据：`C:\Users\Duanyi\AppData\Roaming\com.sigma-file-manager.app\`
  （连接在 `user-data\user-remote-connections.json`，密文在 app-data 根的 `remote-credentials.json`）
- 显示器 2560×1440，DPI 144（150%）；物理像素 ÷ 1.5 才是 CSS 逻辑像素。
- 测试二进制名是 `sigma_file_manager_lib-*.exe`（**不是** `alpha_file_manager-*.exe`）。

---

## 10. 硬约束（不得改动）

- 品牌名统一 **Alpha File Manager**。
- 受保护常量：mDNS 服务名、legacy 数据目录名、Tauri `identifier`（`com.sigma-file-manager.app`）。
- 面向用户的输出一律**简体中文**；17 个语言包，中文 locale code 是 **`ch`** 不是 `zh`。
- 许可证 GPL-3.0-or-later：SSPL / 非商业 / 字段级限制的库不能作为可链接依赖。
- 两条存储链刻意分离：连接元数据归前端 store，密码归 Rust DPAPI。
  写顺序硬约束：`save` = 密文先、storage 后；`delete` = storage 先、密文后且密文失败不抛错。
- 密码框空串 = **不碰**已存密码；清空必须显式 `clearPassword`。
- `CRYPTPROTECT_UI_FORBIDDEN` 不可省；非 Windows 必须返回 `Unsupported` 错误而不是 panic；
  密文不进 storage 链。
- 「测试连接」的返回契约：**只有入参非法才 `Err`**，其余一律 `Ok(report)` 带 `outcome`。
  前端**只按 `outcome` 分支渲染，绝不解析 `message`**。
