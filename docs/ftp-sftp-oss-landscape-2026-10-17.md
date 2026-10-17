# FTP / SFTP 远程空间：开源实现调研报告

- **调研日期**：2026-10-17（下文所有「最近发布」「star 数」「issue 数」均为该日现场查询结果）
- **目标项目**：Alpha File Manager（下称 AFM），Tauri 2 + Vue 3 + Rust 桌面文件管理器，上游 `aleksey-hoffman/sigma-file-manager`
- **项目许可证**：GPL-3.0-or-later（见 [`LICENSE.md`](../LICENSE.md)）
- **调研范围**：FTP / SFTP 客户端库的选型、sidecar 方案、上游现状、Windows 特有坑
- **重要前提**：本文所有版本号、许可证、活跃度均来自 crates.io API / GitHub API / crates.io 静态 crate 包 / 官方文档的**现场查询**，未核实项已显式标注「未核实」。

---

## 0. 阅读前必须知道的三个约束

1. **许可证约束**：AFM 是 GPL-3.0-or-later。任何 **SSPL / 非商业 / 字段级限制**的库都不能作为**可链接依赖**引入；若只能走 **sidecar 分发 + 进程调用**（不产生代码链接关系），许可证约束宽松得多。
   本次调研**未发现**任何候选库属于 SSPL 或非商业限制。最接近「需要额外注意」的是 **WinFsp**（GPLv3 + 对自由/开源软件的特别例外 + 另有商业授权双轨）。
2. **上游已经有一个「网络位置」概念，但它不是 FTP/SFTP 浏览**，详见第 5 节。这是本次调研最重要的现状结论。
3. **本文的示例代码未经编译验证**。代码签名逐条对照 crates.io 上解包出的真实源码（如 `suppaftp-12.2.1`、`russh-sftp-3.0.1`、`russh-0.64.1`）核实，但本机未执行 `cargo build`（受任务边界限制，不得改动依赖清单）。落地前需在真实工程里编译一遍。

---

## 1. 结论速览（TL;DR）

### 1.1 如果只能各选一个

| 角色 | 推荐 | 一句话理由 |
|---|---|---|
| **Rust FTP** | **`suppaftp` 12.2.1** | 唯一同时满足「MIT/Apache-2.0 双许可 + 2026-10 仍在发版 + 显式+隐式 FTPS + PASV/EPSV/PORT/EPRT + REST 断点续传 + MLSD/LIST 结构化解析 + tokio/smol 双运行时」的库 |
| **Rust SFTP** | **`russh` 0.64.1 + `russh-sftp` 3.0.1** | 唯一一组「纯 Rust（无 libssh2 / 无系统 OpenSSL）+ Apache-2.0 + 2026-09/10 仍在发版 + SFTP v3 全量方法」的组合，Windows 打包零 C 依赖 |
| **架构抽象层** | **抄 `remotefs` 的 `FileSystem` trait 形状**（不必直接依赖） | termscp（MIT，同一作者）已用 `remotefs` 落地了「一个 trait + 多个协议后端」，这是最贴近 AFM 需求的现成范式 |
| **sidecar 兜底** | **`rclone`（MIT）** | 许可证已逐字确认为 MIT（不是 GPLv3、不是 SSPL），且有 `serve webdav` / `serve sftp`，可在不写任何协议代码的前提下先给用户一个可用的远程空间 |

### 1.2 三个必须先说清的「反直觉」结论

1. **rclone 当前的许可证是 MIT。** 仓库根目录 `COPYING` 文件正文逐字读过（1095 字节，MIT 原文），GitHub 许可识别为 `MIT`，`README.md` 第 197–199 行写明 "This is free software under the terms of the MIT license"。**它既不是 GPLv3，也不是 SSPL。** 网上关于 rclone 许可的很多说法已经过时，请以此为一手依据。
2. **`ftp` 这个 crate 已经死了。** `ftp` 3.0.1 最后一次发布是 **2018-04-15**，仓库 `mattnenterprise/rust-ftp` 最后一次提交是 **2023-08-04**，至今 **36 个 open issue**。不要因为名字直觉就选它。
3. **`sshx` 跟 SFTP 没关系。** `ekzhang/sshx` 虽然是 Rust、MIT、7.6k star，但它是一个 **Web 端协作终端应用**，不是 SSH/SFTP 库。名字撞车，容易误选。

### 1.3 落地路线建议（三步）

- **第 1 步**：在 `src-tauri` 内定义一个 `RemoteFs` trait（照抄 `remotefs` 的方法形状：`read_dir` / `open(ReadOptions)` / `create(WriteOptions)` / `create_dir` / `remove_file` / `remove_dir` / `rename` / `copy` / `metadata` / `symlink_metadata` / `canonicalize`），先把本地盘也实现一遍，验证抽象是否够用。
- **第 2 步**：接 `suppaftp`（FTP/FTPS）与 `russh + russh-sftp`（SFTP）两个后端。注意**必须放在 Tauri 的 Rust 侧**——扩展沙箱只给 http/https 主机白名单，做不了裸 socket（见第 5.4 节）。
- **第 3 步（可选）**：把 `rclone.exe` 作为 sidecar 打包（Windows amd64 zip 约 **30.2 MB**），给「冷门协议 + 疑难连接」兜底。

---

## 2. Rust 侧 FTP 库（客户端用途）

### 2.1 对比表

> 查询日期 2026-10-17。crates.io 元数据取自 crates.io API；仓库元数据取自 GitHub API。

| 库 | 最新版 | 最近发布 | 许可证 | 是否纯 Rust | 异步运行时 | 维护状态（2026-10-17） |
|---|---|---|---|---|---|---|
| **`suppaftp`** | **12.2.1** | **2026-10-15** | `MIT OR Apache-2.0` | 是（选 rustls 时） | tokio / smol，**同步也有** | 65 个版本，4,937,245 次下载；repo 193 star、1 open issue、2026-10-15 有提交。**活跃** |
| `ftp` | 3.0.1 | **2018-04-15** | `Apache-2.0/MIT` | 否（可选 `openssl` 0.9） | 同步 | repo 最后提交 2023-08-04，**36 个 open issue**。**停更** |
| `async_ftp` | 6.0.0 | 2021-11-04 | 未在本次核实 | 未核实 | async | 2021 年后无新版本，**停更** |
| `mcai_ftp` | 3.0.1 | 2022-03-30 | 未在本次核实 | 未核实 | 同步 | 4,675 次下载，**停更** |
| `ftp4` | — | 2021-01-09 | 未在本次核实 | 未核实 | 未核实 | 8,313 次下载，**停更** |
| `remotefs-ftp` | 1.0.0 | 2026-09-15 | `MIT` | 是 | async | 新（remotefs 生态的一部分），93 star 家族仓库 |
| `suppaftp-cli` | 12.2.1 | 2026-10-15 | 未在本次核实 | 是 | 同步 | 与 suppaftp 同步发版，**可作协议实现参考** |
| `opendal-service-ftp` | 0.59.4 | 2026-10-05 | `Apache-2.0` | 未核实 | 未核实 | Apache OpenDAL 的 FTP service 实现，面向对象存储抽象，非桌面文件管理器场景 |

### 2.2 `suppaftp` 功能覆盖逐项核实

方法签名逐条对照 crates.io 上解包出的 `suppaftp-12.2.1` 源码（`src/sync_ftp.rs`）：

| 需求 | 覆盖 | 依据（源码中的公开方法 / 命令） |
|---|---|---|
| 显式 FTPS（21 + AUTH TLS） | ✅ | `FtpStream::connect` → `into_secure(connector, domain)`；或 `RustlsFtpStream` / `NativeTlsFtpStream` 类型别名 |
| 隐式 FTPS（990） | ⚠️ **需要 feature** | `connect_secure_implicit(addr, connector, domain)` 被 `#[cfg(all(feature = "secure", feature = "deprecated"))]` 门控 |
| 被动模式 PASV / EPSV | ✅ | `Mode::{Active, ExtendedPassive, Passive}` + `set_mode(Mode)`；命令层含 `Command::Pasv` / `Command::Epsv` |
| 主动模式 PORT / EPRT | ✅ | `active_mode(Duration)` + `eprt(address)` + `ActivePeerCheck`（`ControlPeer` / `Any` / `Allow(Vec<IpAddr>)`） |
| 断点续传 REST | ✅ | `resume_transfer(&mut self, offset: usize)` |
| 目录列举（含时间戳与大小） | ✅ | `mlsd()` / `list()` / `nlst()` / `mlst()`；`mdtm()`；`size()`；`suppaftp::list::parse_mlsd/parse_posix/parse_dos` → `list::File`（含 `size()`、`modified() -> SystemTime`、`is_directory()`、`uid()/gid()`） |
| MKD / RMD / RNFR-RNTO / DELE | ✅ | `mkdir()` / `rmdir()` / `rename()` / `rm()` |
| UTF-8 文件名 | ✅ | `set_encoding(impl Encoding)`；`pub use encoding::{Encoding, Utf8Encoding}`；`FEAT` 解析支持 `UTF8` |
| 代理 | ❌ **不支持** | 全 crate 内检索 `proxy` 只命中一处**注释**（讲 NAT 回连），没有任何 SOCKS/HTTP 代理实现 |
| 服务端能力探测 | ✅ | `feat() -> Features`、`opts(option, value)`、`site(command)`、`custom_command()` / `custom_data_command()` |
| 大文件流式传输 | ✅ | `retr_as_stream()` / `put_with_stream()` 返回自终结的 `TransferStream`（需 `finish()` 检查结果） |

**两个值得记下的实现细节**（都是一手文档，不是我的推测）：

- `resume_transfer` 的文档注释明确写道：*RFC 3659 §5.3 要求 `REST` 紧邻传输命令，有些服务器（**FileZilla Server**）会在中间插入其他命令时静默丢弃 offset。* 并且 `src/lib.rs` 里有一个 `restart_fixture` 模块，专门模拟「一旦有别的命令跟在 `REST` 后面就忘掉 offset」的服务器，并对所有客户端做续传测试。**这说明断点续传不是三行代码的装饰功能，是被认真测过的。**
- 隐式 FTPS 被作者标为 `deprecated` feature。功能在，但作者在劝退。

### 2.3 `suppaftp` 最小可用示例（同步 + FTPS + 断点续传）

> Cargo.toml：
> ```toml
> suppaftp = { version = "12.2", features = ["native-tls", "deprecated"] }
> ```
> 说明：不加 `deprecated` 则 `connect_secure_implicit` 不可用（隐式 FTPS 990）。

```rust
use std::io::{Cursor, Read, Write};
use suppaftp::list;
use suppaftp::FtpStream;

fn run() -> Result<(), Box<dyn std::error::Error>> {
    // 1) 连接 + 登录（显式 FTPS：先明文连 21，再 into_secure 升级）
    let mut ftp = FtpStream::connect("ftp.example.com:21")?;
    ftp.login("anonymous", "anonymous@example.com")?;

    println!("当前目录: {}", ftp.pwd()?);
    ftp.cwd("pub")?;

    // 2) 列目录：优先 MLSD（结构化），退路 LIST（解析 POSIX/DOS 两种格式）
    let entries: Vec<String> = match ftp.mlsd(Some(".")) {
        Ok(raw) => raw,
        Err(_) => ftp.list(Some("."))?,
    };
    for line in &entries {
        if let Ok(f) = list::parse_mlsd(line) {
            println!("{:<10} {:>12}  {}", if f.is_directory() { "<dir>" } else { "file" }, f.size(), f.name());
        }
    }

    // 3) 下载到内存（小文件）
    let buf = ftp.retr_as_buffer("readme.txt")?;
    std::fs::write("readme.txt", buf.into_inner())?;

    // 4) 断点续传：本地已有 1024 字节，就从 1024 接着下
    let local_len = std::fs::metadata("big.iso").map(|m| m.len()).unwrap_or(0) as usize;
    let remote_len = ftp.size("big.iso")?;
    if remote_len > local_len {
        ftp.resume_transfer(local_len)?;            // 发 REST <offset>
        let mut out = std::fs::OpenOptions::new()
            .create(true).append(true).open("big.iso")?;
        let mut stream = ftp.retr_as_stream("big.iso")?;
        std::io::copy(&mut stream, &mut out)?;      // 逐块落盘，不占内存
        stream.finish()?;                           // 必须 finish 才知道传输结果
    }

    // 5) 上传
    let mut payload = Cursor::new(b"hello from Alpha File Manager");
    let written = ftp.put_file("greeting.txt", &mut payload)?;

    // 6) 目录与重命名
    ftp.mkdir("new_dir")?;
    ftp.rename("greeting.txt", "greeting2.txt")?;
    ftp.rm("greeting2.txt")?;
    ftp.rmdir("new_dir")?;

    ftp.quit()?;
    Ok(())
}

fn main() {
    if let Err(err) = run() {
        // suppaftp 的错误类型统一是 suppaftp::FtpError
        eprintln!("FTP 操作失败: {err}");
    }
}
```

补充：若用 `rustls` 而不是 `native-tls`，把 feature 换成 `rustls-ring` 或 `rustls-aws-lc-rs`，类型换成 `RustlsFtpStream`。作者在 README 里明确建议 **兼容性优先选 `native-tls`**；若要静态链接 libssl 才用 `native-tls-vendored`。

### 2.4 `suppaftp` 异步示例（tokio）

```rust
use suppaftp::AsyncNativeTlsFtpStream;
use suppaftp::async_native_tls::TlsConnector;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let stream = AsyncNativeTlsFtpStream::connect("ftp.example.com:21").await?;
    let mut ftp = stream
        .into_secure(AsyncNativeTlsFtpStream::connector(TlsConnector::new()), "ftp.example.com")
        .await?;
    ftp.login("user", "pass").await?;
    let entries = ftp.list(None).await?;
    println!("{entries:?}");
    ftp.quit().await?;
    Ok(())
}
```

⚠️ **注意版本差异**：suppaftp 仓库 `README.md` 的依赖示例仍写 `suppaftp = "^11"`，而 crates.io 最新已是 **12.2.1**（edition 2024、MSRV 1.88.0）。**README 没跟上版本**。上面示例的 `AsyncNativeTlsFtpStream::connector(...)` 这一行属于按官方 README 的 `AsyncNativeTlsConnector::from(TlsConnector::new())` 改写而来，**该行的确切写法请以 `cargo doc` 输出的 12.2.1 签名为准**——这是本报告中我唯一没有在源码里逐字核对到的一处。

---

## 3. Rust 侧 SFTP / SSH 库

> **需求边界声明**：AFM 需要的是 **SFTP 文件传输**（浏览远程目录、读写文件），**不是执行远程 shell 命令**。因此下表中「能否执行远程命令」只作为成熟度参考，不作为选型依据。两者在协议层是同一条 SSH 连接上的不同 subsystem/通道类型。

### 3.1 对比表

| 库 | 最新版 | 最近发布 | 许可证 | 是否需要外部 C 库 / 系统 OpenSSL | 成熟度 |
|---|---|---|---|---|---|
| **`russh`** | **0.64.1** | **2026-10-05** | `Apache-2.0` | **不需要**。加密后端为 `aws-lc-rs` 或 `ring` feature，二者全关则编译失败 | edition 2024，MSRV 1.89；8,545,820 次下载 |
| **`russh-sftp`** | **3.0.1** | **2026-09-28** | `Apache-2.0` | **不需要**。依赖仅 async-trait / bitflags / bytes / chrono / dashmap / log / serde / thiserror / tokio | 3,836,725 次下载；repo 117 star、9 open issue、2026-10-07 有提交 |
| `ssh2` | 0.9.6 | 2026-06-30 | `MIT OR Apache-2.0` | **需要 `libssh2`（C）**；macOS 还要 OpenSSL；feature `vendored-openssl` / `openssl-on-win32` | 8,295,005 次下载；repo 569 star、46 open issue |
| `thrussh` | 0.49.0 | 2026-08-28 | `Apache-2.0` | 不需要 | 334,018 次下载；仓库在 **Pijul**（`nest.pijul.com/pijul/ssh`），不在 GitHub。russh 是它的 fork |
| `openssh` | 0.11.6 | 2025-12-03 | `MIT OR Apache-2.0` | **需要系统 `ssh` 可执行文件**；crate 文档首行即 **"Scriptable SSH through OpenSSH (**only works on unix**)"** | 5,463,836 次下载 |
| `openssh-sftp-client` | 0.15.10 | 2026-10-01 | `MIT` | 依赖上面的 `openssh` crate（同样 unix-only） | 2,594,595 次下载 |
| `async-ssh2-tokio` | 0.13.0 | 2026-07-12 | crates.io 显示 **`non-standard`**；其 `Cargo.toml` 用 `license-file = "LICENSE"`，而 `LICENSE` 正文是 **Apache-2.0** | **需要 libssh2（C）** | 121 star，10 open issue |
| `sshx` | 0.4.1 | 2025-02-12 | `MIT` | — | **不是 SSH/SFTP 库**（见第 8 节） |
| `async-ssh2-russh` | 0.3.0 | 2025-12-16 | `Apache-2.0` | 不需要 | 81,225 次下载 |
| `async-ssh2-lite` | 0.5.0 | 2024-07-21 | `Apache-2.0 OR MIT` | **需要 libssh2（C）** | 346,104 次下载 |
| `sftp` | 0.3.0 | 2026-04-20 | `Apache-2.0` | 未核实 | `jelmer/sftp-rs`，31,735 次下载 |
| `ssh-key` | 0.6.7 | 2026-06-29 | `Apache-2.0 OR MIT` | 不需要 | RustCrypto 官方密钥 crate，russh 的底层依赖 |

**仓库归属提醒**：crates.io 上 `russh` 的 `repository` 字段写的是 `https://github.com/warp-tech/russh`，但用 GitHub API 查询 `warp-tech/russh` 返回的 `full_name` 是 **`Eugeny/russh`**（重定向）。两者指向同一仓库。

### 3.2 `russh` + `russh-sftp` 的关键优势：传输层可替换

这是本次调研对 AFM 最有价值的一个发现。

`russh-sftp` 的 `Cargo.toml` 里，`russh` 出现在 **`[dev-dependencies]`**（version 0.63.2），**不是 `[dependencies]`**。它的会话入口签名是：

```rust
pub async fn new<S>(stream: S) -> SftpResult<Self>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
```

也就是说 **`russh-sftp` 只要求「一条异步双向字节流」，完全不绑定 SSH 实现**。你可以：

- 用 `russh`（推荐，纯 Rust）
- 用 `thrussh`（同一个 trait，喂它自己的 stream）
- 甚至在将来换成别的传输而不动 SFTP 层

⚠️ **没有 `thrussh-sftp` 这个 crate**（crates.io 查询 404）。若要用 thrussh，得自己接流。

### 3.3 `russh-sftp` 功能覆盖逐项核实

对照解包出的 `russh-sftp-3.0.1/src/client/session.rs`（高层 API，形状接近 `std::fs`）：

| AFM 需求 | 方法 |
|---|---|
| 列远程目录 | `read_dir(path) -> ReadDir`（条目含 `file_name()` / `file_type()` / `metadata()` / `path()`） |
| 读文件 | `open(filename)` → `File`，实现 `AsyncRead`；另有 `read(path) -> Vec<u8>` |
| 写文件 | `create(filename)` / `open_with_flags(filename, OpenFlags::CREATE\|TRUNCATE\|WRITE\|READ)` → `File`，实现 `AsyncWrite` / `AsyncSeek` |
| 新建目录 | `create_dir(path)` |
| 删除文件 / 目录 | `remove_file` / `remove_dir` |
| 重命名 | `rename(oldpath, newpath)` |
| stat（含大小与时间） | `metadata(path)` / `symlink_metadata(path)` |
| 设置属性 | `set_metadata(path, Metadata)` |
| 存在性判断 | `try_exists(path) -> bool` |
| 绝对路径解析 | `canonicalize(path)` |
| 符号链接 | `symlink(path, target)` / `read_link(path)` |
| 硬链接 | `hardlink(oldpath, newpath) -> bool` |
| 扩展 | `fs_info(path) -> Option<Statvfs>`（`statvfs@openssh.com`）、`expand_path(path)`、`limits@openssh.com`、`hardlink@openssh.com`、`fsync@openssh.com` |

另有底层 `RawSftpSession`：`opendir` / `readdir` / `lstat` / `fstat` / `setstat` / `fsetstat` / `fsync` / `statvfs` / `extended`，需要发扩展报文时用。

**SFTP 侧的「断点续传」不需要特殊 API**：SFTP v3 协议本身就是带偏移量的 `READ`/`WRITE`，用 `AsyncSeek`（`stream_position()` / `seek()`）即可，语义比 FTP 的 `REST` 干净得多。

### 3.4 最小可用示例

**(a) 官方原版示例**（来自 `russh` 仓库 `russh/examples/sftp_client.rs` 与 `russh-sftp` 仓库 `examples/client.rs`，两处内容一致）：

```rust
use russh::keys::*;
use russh::*;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

struct Client;

impl client::Handler for Client {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        // ⚠️ 官方示例是无条件返回 true（等于关掉主机密钥校验）。
        //    真实产品必须改成比对 known_hosts，见下方 (b)。
        println!("server key: {server_public_key:?}");
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: ChannelId,
        _data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        Ok(())
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = russh::client::Config::default();
    let mut session = russh::client::connect(Arc::new(config), ("localhost", 22), Client).await?;

    if session.authenticate_password("root", "password").await?.success() {
        let channel = session.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        let sftp = SftpSession::new(channel.into_stream()).await?;

        println!("cwd: {:?}", sftp.canonicalize(".").await?);

        for entry in sftp.read_dir(".").await? {
            let e = entry?;
            println!("{} {:?} {}", e.file_name(), e.file_type(), e.metadata().size);
        }

        let mut file = sftp
            .open_with_flags("test_new.txt",
                OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE | OpenFlags::READ)
            .await?;
        file.write_all(b"magic text").await?;
        file.flush().await?;
        println!("cursor at {:?}", file.stream_position().await?);

        file.rewind().await?;
        let mut s = String::new();
        file.read_to_string(&mut s).await?;
        println!("内容: {s}");

        file.shutdown().await?;
        sftp.remove_file("test_new.txt").await?;
    }
    Ok(())
}
```

**(b) 生产环境要补的两件事：私钥认证 + known_hosts**

```rust
use russh::keys::PrivateKeyWithHashAlg;
use std::sync::Arc;

// 私钥认证：russh 用 RustCrypto 的 ssh-key 类型
// 0.64.1 的签名是：
//   pub async fn authenticate_publickey<U: Into<String>>(
//       &mut self, user: U, key: PrivateKeyWithHashAlg,
//   ) -> Result<AuthResult, crate::Error>
let key_bytes = std::fs::read("~/.ssh/id_ed25519")?;   // 用 expand 处理 ~
let key = PrivateKeyWithHashAlg::new(
    russh::keys::decode_secret_key(&key_bytes, "")?,
    None,
);
let auth = session.authenticate_publickey("myuser", key).await?;
assert!(auth.success());
```

russh 的工作区里还有一个 `russh-config` crate，**明确支持 `~/.ssh/config` 与 known_hosts**：

- `pub fn parse(file: &str, host: &str) -> Result<Config, Error>`
- `pub fn parse_home(host: &str) -> Result<Config, Error>`
- `pub fn parse_path<P: AsRef<Path>>(path: P, host: &str) -> Result<Config, Error>`
- `HostConfig { pub user_known_hosts_file: Option<PathBuf>, ... }`

也就是说「照 OpenSSH 的行为读用户已有的 `~/.ssh/config` + `known_hosts`」这条路 russh 已经铺好了，`check_server_key` 里拿 `user_known_hosts_file` 去比对即可。

**可用认证方式**（`russh-0.64.1/src/client/mod.rs` 中的公开方法）：
`authenticate_none` / `authenticate_password` / `authenticate_publickey` / `authenticate_publickey_with` / `authenticate_certificate_with` / `authenticate_openssh_cert` / `authenticate_keyboard_interactive_start` + `_respond` / `authenticate_gssapi_with_mic`。覆盖了密码、公钥、证书、键盘交互、GSSAPI。

**加密后端的坑**：russh README 明确写着「enable at least one of the `aws-lc-rs` or `ring` features. `russh` fails to compile when both are disabled」。选 feature 时必须二选一，否则直接编译失败。

---

## 4. Node / TypeScript 侧库（若走「扩展 + JS sidecar」路线）

> 查询日期 2026-10-17，npm registry。

| 包 | 最新版 | 发布时间 | 许可证 | 原生模块 | 维护状态 |
|---|---|---|---|---|---|
| **`basic-ftp`** | **6.2.3** | **2026-10-09** | **MIT** | **无**，`package.json` 里 `dependencies` 为空，纯 JS | **活跃**（8 天前刚发版） |
| `ftp-ts` | 1.1.0 | **2022-08-01** | MIT（仓库 `raw/master/LICENSE`） | 无依赖，纯 TS | **停滞 4 年** |
| `ssh2-sftp-client` | 12.1.1 | 2026-03-25 | Apache-2.0 | **依赖 `ssh2`**（原生） | 活跃 |
| `node-ssh` | 13.2.1 | 2025-03-20 | MIT | **依赖 `ssh2`**（原生） | 一般 |
| `ssh2` | 1.17.0 | 2025-08-20 | MIT（`package.json` 的 `licenses` 数组） | **必须编译** | 活跃 |

**`ssh2` 的原生编译问题**（这是打包难度的核心）——其 `package.json` 原文：

```json
"scripts": { "install": "node buildcheck.js && node-gyp rebuild --release" },
"optionalDependencies": { "cpu-features": "~0.0.10", "nan": "~2.27.0" },
"dependencies": { "asn1": "^0.2.6", "bcrypt-pbkdf": "^1.0.2" }
```

**没有 prebuilt 二进制分发**，安装即触发 `node-gyp rebuild`。对 AFM 的 Tauri/NSIS 打包链来说，这意味着：目标用户的机器上要有 Visual Studio Build Tools + Python 才能装成功；electron-builder / NSIS 里还得处理 ABI 版本与 Electron/Node 版本匹配。**这是把 `ssh2` 塞进 sidecar 的主要成本。**

**结论**：
- FTP 走 JS sidecar 是**可行的**（`basic-ftp` 零依赖纯 JS，无原生编译）。
- SFTP 走 JS sidecar **成本明显更高**（`ssh2` 强制 node-gyp）。
- 但既然 AFM 后端本来就是 Rust，且 `russh + russh-sftp` 是纯 Rust，**没有理由把 SFTP 绕到 JS**。JS sidecar 只在「扩展生态里让第三方作者写 FTP 功能」时才有意义。

---

## 5. 可作为 sidecar 二进制 / 挂载层的成熟项目

### 5.1 rclone —— 推荐作为兜底 sidecar

**许可证（逐字核实，这是本报告最关键的一次核对）**：

我打开 `https://raw.githubusercontent.com/rclone/rclone/master/COPYING`，全文只有 **1095 字节**，开头即：

```
Copyright (C) 2012 by Nick Craig-Wood http://www.craig-wood.com/nick/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
...
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, ...
```

**这是 MIT 原文。** 三方交叉印证：

1. GitHub API 对 `rclone/rclone` 的许可识别：`"license": "MIT"`；
2. 仓库根目录文件清单里**只有** `COPYING` 一个许可证文件（1095 字节），没有并存的 GPLv3/SSPL 副本；
3. `README.md` 第 197–199 行：`## License` / `This is free software under the terms of the MIT license`。

> **给上游的澄清**：任务里「rclone 历史上 GPLv3 与 SSPL 之间有过变更」的说法，与仓库当前状态不符。至少在 2026-10-17 的 `master` 分支上，rclone 是 **MIT**。若采纳，建议在发布前把 rclone 的 `COPYING` 原文归档进本仓库作为凭据。

**能力核实**（官方文档站）：

| 问题 | 结论 | 依据 |
|---|---|---|
| VFS 层能否把 ftp/sftp 后端呈现成目录树 | ✅ 可以 | `rclone lsd` / `ls` 列出远程目录；`rclone serve webdav` 页面描述为 "Serve remote:path over WebDAV."，且文档里有 **"Access WebDAV on Windows"** 专节 |
| 能否 `rclone serve webdav` 对外服务 | ✅ | `https://rclone.org/commands/rclone_serve_webdav/` |
| 能否 `rclone serve sftp` 对外服务 | ✅ | `https://rclone.org/commands/rclone_serve_sftp/`，支持 `--user`/`--pass`、`--authorized-keys`（可挂到 sshd 的 `authorized_keys`）、不指定 `--key` 时自动生成 rsa/ecdsa/ed25519 主机密钥、支持 socket activation |
| Windows sidecar 打包难度 | **低** | 官方发布 Windows amd64 zip：`rclone-current-windows-amd64.zip` 实测 **30.2 MB**；固定版本 `v1.71.2` 为 **24.1 MB** |
| 维护活跃度 | 高 | 60,358 star，2026-10-17 当天仍有提交，1,212 个 open issue |

**rclone 方案的风险**：
- 它是一个**进程边界**。每次列举目录、上传下载都要 fork 一个 rclone 进程再解析 JSON 输出，**延迟与内存开销都不可忽略**，不适合高频交互式浏览。
- 适合的定位是「冷门协议 / 疑难连接的逃生舱」，不是主路径。
- 30 MB 的 sidecar 会让安装包明显变大。

### 5.2 WinSCP

- **许可证**：`https://raw.githubusercontent.com/WinSCP/WinSCP/master/license.txt` 共 **722 行**，开头小标题为 `A. GNU General Public License` / `B. License of WinSCP Icon Set` / `C. Privacy Policy`，正文是 **GNU GPL v3 全文**（"Version 3, 29 June 2007"）。仓库根目录只有这一个许可证文件。
- **性质**：.NET 桌面应用（`description` 里自称 "A powerful tool ... like .NET assembly"）。
- **能不能链接进 Rust 应用**：**不能**。它不是 Rust/原生库，是独立的 .NET GUI 程序。
- **能不能当 sidecar**：WinSCP 自带命令行脚本能力，理论上可作 sidecar CLI。但**本次调研未核实**其脚本接口在无 GUI 环境下（无桌面会话的 service 场景）的行为，故标注为未核实。
- **用户是否需要额外装驱动/运行时**：**不需要驱动**；WinSCP 官方分发的是自包含安装包。但它是**另一个 GUI 应用**，会装进用户的开始菜单并注册关联，与 AFM 的产品定位冲突。

### 5.3 sshfs-win（SSHFS-Win + WinFsp）

**结论：用户必须额外安装内核驱动，直接破坏「装完即用」。**

`winfsp/sshfs-win` 的 README 原文：

> SSHFS-Win is a minimal port of SSHFS to Windows. Under the hood it uses **Cygwin** for the POSIX environment and **WinFsp** for the FUSE functionality.
>
> ## Installation
> - Install the latest version of **WinFsp**.
> - Install the latest version of **SSHFS-Win**. Choose the x64 or x86 installer according to your computer's architecture.
>
> Once you have installed WinFsp and SSHFS-Win you can map a network drive to a directory on an SSHFS host using Windows Explorer or the `net use` command.

也就是说：**两个安装器，用户手动装**，其中 WinFsp 是内核模式文件系统驱动。

**WinFsp 的许可证**（`winfsp/winfsp` README 原文）：

> **Flexible licensing**: Available under the **GPLv3** license with a **special exception for Free/Libre and Open Source Software**. A **commercial license is also available**.

对 AFM（GPL-3.0-or-later）而言，GPLv3 兼容，且「对开源软件的特别例外」条款正面。但**双轨授权的存在意味着这条路一旦做大要付商业授权咨询**，这是选型时要知道的风险。

此外，WinFsp 的核心形态是「kernel mode file system driver (FSD) + user mode DLL」——**这不是应用能静默打包的东西**。

### 5.4 FileZilla

- **用途定位**：按任务要求，**仅作协议实现参考**，不作为可链接库。
- **许可证**：**未核实**。官方 `https://filezilla-project.org/license.php` 与 `sourcecode.php` 页面当前返回的正文被 JavaScript 反爬/混淆（返回的是 base64 挑战串），无法读到一手许可证正文。`https://svn.filezilla-project.org/filezilla-client/` 可连通但同样被人机验证拦截；GitHub 上**不存在** `filezilla/filezilla` 仓库（API 404）。
- **已知**：它是 wxWidgets + C++ 的桌面应用，**无论如何不可链接进 Rust 项目**。这一结论与许可证无关，架构上就已经排除。

### 5.5 「用户是否需要额外安装系统级驱动或运行时」总表

| 方案 | 需要额外装驱动 | 需要额外装运行时 | 破坏「装完即用」 |
|---|---|---|---|
| `suppaftp` / `russh` 内嵌 | 否 | 否 | **否** |
| `basic-ftp` JS sidecar | 否 | 需 Node（但可随包分发） | 否 |
| `ssh2` JS sidecar | 否 | 需 Node + **编译工具链**（node-gyp） | 基本否，但安装门槛高 |
| rclone sidecar | 否 | 否（单 exe） | **否** |
| WinSCP sidecar | 否 | .NET 运行时（官方包自包含） | 否，但装了第二个 GUI 软件 |
| **sshfs-win** | **是（WinFsp 内核驱动）** | 是（Cygwin） | **是** |
| `openssh` / `openssh-sftp-client` crate | 否 | **是（系统 `ssh`/`sftp` 二进制）**，且 `openssh` crate 自述 **only works on unix** | **是（Windows 上直接不可用）** |

---

## 6. 上游与生态现状

### 6.1 AFM / 上游代码里已有的「远程相关」资产

我逐个读了相关源文件，结论如下：

| 位置 | 实际内容 | 是否支持 FTP/SFTP 浏览 |
|---|---|---|
| `src-tauri/src/dir_reader/network_shares.rs` | `mount_network_share(params: NetworkShareParams) -> Result<String, String>`；`#[cfg(windows)]` 分支里**只有 `smb`**，走 `net use \\host\share`；非 Windows 分支 `match params.protocol.as_str()` 支持 `"sshfs"` / `"nfs"` / `"smb"`，全部通过 `std::process::Command` 调系统挂载命令 | **否**。是**操作系统级挂载**，不是协议客户端 |
| `src/modules/home/components/mount-dialog.vue` | `type Protocol = 'sshfs' \| 'nfs' \| 'smb'`；选项文案为 `SSHFS (SSH)` / `NFS` / `SMB / CIFS`；端口输入框仅 sshfs 显示，用户名/密码仅 sshfs 与 smb 显示 | **否** |
| `src-tauri/src/lan_share/` | 存在 **FTP 服务端**：`server.rs` 里 `"ftp" => build_ftp_router(state.clone())`，跑在 axum 上。CHANGELOG 的 "LAN Sharing" 段描述为「share files over FTP for direct access from other apps」 | **方向相反**——它是把本地文件**分享出去**的 FTP 服务器 |
| `src/utils/remote-file.ts` | `isHttpUrl(value)` 只接受 `http://` / `https://` | 单元测试 `src/utils/__tests__/remote-file.test.ts:18` 明确断言 `isHttpUrl('ftp://example.com/image.jpg')` 为 **`false`** |
| `CHANGELOG.md:1019` | Beta 2 的 "Network locations: allows you to connect a network location (SSHFS (SSH) / NFS / SMB / CIFS)" | 与代码一致 |

**总结**：上游有一个「网络位置」概念，但它的实现方式是**调用操作系统挂载 / `net use`**，而不是内嵌协议栈。它连 FTP URL 都在测试里被显式排除。**AFM 要做的 FTP/SFTP 浏览是完全新增的能力，不是在既有抽象上扩展。**

同时，上游的这个「网络位置」抽象**在概念上仍然值得复用**——它是用户心智里「远程位置」的既有入口，远程浏览功能可以挂到同一处。

### 6.2 扩展市场 `sigma-hub/sfm-marketplace`

我下载了仓库快照（`codeload.github.com/sigma-hub/sfm-marketplace/zip/refs/heads/main`），仓库只有 4 个文件：`LICENSE`、`README.md`、`registry.json`、`registry.schema.json`。

- `LICENSE` = **MIT License**
- 仓库最近提交：**2026-06-25**；star 数：**2**
- `registry.json` 里**共 6 个扩展**：

| id | 名称 |
|---|---|
| `sigma.clipboard` | Clipboard History |
| `sigma.video-downloader` | Video Downloader |
| `sigma.excalidraw` | Excalidraw |
| `sigma.media-converter` | Media Converter |
| `cos-overclock.catppuccin-themes` | Catppuccin Themes |
| `hetima.light-themes` | Hetima Light Themes |

- 对 `registry.json` 全文检索 `ftp|sftp|webdav|remote|ssh`：**零命中**。

**结论：市场里没有任何现成的远程 / FTP / SFTP 扩展，也没有人在做这个方向。**

### 6.3 扩展机制能不能承载 FTP/SFTP：不能

这是路线选择上的一个硬约束。读 `src-tauri/src/extensions/manifest_permissions.rs` 与 `security.rs`：

- 扩展的网络能力叫 **`http` 权限**，且**必须同时提供一个非空的 hosts 允许列表**，否则报 `"Access denied: http permission is missing"`；列表项要过 `validate_http_host_pattern(pattern)`。
- `security.rs` 里 `HostAllowlistPattern { scheme, host, port }` 与 `default_port_for_scheme(scheme)`（只区分 `https` → 443 与其余 → 80），全部围绕 **http/https** 主机模式设计。
- 单测用例里的合法值长这样：`"https://httpbin.org"`、`"http://localhost:*"`。

**扩展沙箱里没有裸 TCP / socket 能力，只有 http/https 主机白名单。** 因此：

> **FTP / SFTP 浏览不能走「第三方扩展」路线，必须实现在 `src-tauri` 的 Rust 后端里。**

（顺带说明：本仓库本地 `extensions/` 目录当前只有 `kizemo.focus-sync` 一个扩展。）

### 6.4 别人是怎么做的：可借鉴的架构

**`termscp` 是最贴题的现成范式。**

- `termscp` 1.2.0，**MIT**，发布于 **2026-09-03**，仓库 `veeso/termscp`。
- 它的自述：「a feature rich terminal file transfer and explorer with support for **SCP/SFTP/FTP/Kube/S3/GCS/SMB/WebDAV**」。
- **作者与 `suppaftp` 同一位（veeso）**——即 suppaftp 的作者自己写多协议客户端时，选的也是「统一抽象层 + 每协议一个 crate」。

它的 `Cargo.toml` 依赖结构是：

```toml
[dependencies.remotefs]                 # 核心抽象
[dependencies.remotefs-ssh]  features = ["russh"]
[dependencies.remotefs-webdav]
[dependencies.remotefs-aws-s3]
[dependencies.remotefs-gcs]
[dependencies.remotefs-kube]
[dependencies.remotefs-smb]   features 见 smb / smb-vendored
[dependencies.remotefs-ftp]              # unix 与 windows 两个 target 都有
[dependencies.ssh2-config]
```

`remotefs` 家族（**全部 MIT**，edition 2024，MSRV 1.89）：

| crate | 版本 | 发布日期 | 许可证 |
|---|---|---|---|
| `remotefs` | 1.0.1 | 2026-09-15 | MIT |
| `remotefs-ssh` | 1.0.0 | 2026-09-15 | MIT |
| `remotefs-ftp` | 1.0.0 | 2026-09-15 | MIT |

`remotefs` 的核心 `FileSystem` trait 形状（从源码提取）：

```rust
fn open(&self, path: &Path, opts: &ReadOptions)  -> RemoteResult<ReadStream>;
fn create(&self, path: &Path, opts: &WriteOptions) -> RemoteResult<WriteStream>;
async fn create_dir(&self, path: &Path, mode: Option<UnixPex>) -> RemoteResult<()>;
async fn remove_file(&self, path: &Path) -> RemoteResult<()>;
async fn remove_dir(&self, path: &Path) -> RemoteResult<()>;
async fn rename(&self, src: &Path, dest: &Path) -> RemoteResult<()>;
async fn copy(&self, src: &Path, dest: &Path) -> RemoteResult<()>;
// 同步版与异步版各一套；另有 metadata / symlink_metadata / canonicalize / read_dir
```

**给 AFM 的具体借鉴点**：

1. **trait 与实现分离**：`FileSystem` trait 在 `remotefs` 核心 crate，协议实现各自独立 crate。对应到 AFM 就是一个 `RemoteFs` trait + `FtpFs` / `SftpFs` / `LocalFs` 三个实现。
2. **`ReadOptions` / `WriteOptions` 显式建模断点与覆盖语义**：`open(path, &ReadOptions)` 里的 offset 直接对应断点续传；`WriteOptions` 对应 truncate vs append。AFM 做「续传」时不必在 trait 外另开旁路。
3. **`UnixPex` 作为可选参数而非必需**：SFTP 有 POSIX 权限位，FTP 基本没有。抽象层必须容纳这种协议差异，否则 FTP 实现会被迫实现一堆假方法。
4. **同步与异步两套 trait**：termscp 是 TUI，同步够用；AFM 的 Tauri 命令层虽是异步的，但复制/移动等长任务可能更适合同步 + `spawn_blocking` 路径。值得照抄这个双轨设计。
5. **作者身份是强信号**：同一个人写的 `suppaftp` 与 `russh` 组合，在 `termscp` 里被验证过能跑通多协议客户端。

**其他可参考的项目**：
- `rclone`（MIT）：VFS + 多后端 + `serve webdav` / `serve sftp`，是把任意远程后端变成可访问目录树的成熟范式。
- `yazi-sftp`（26.5.6，2026-05-05）：Rust 写的终端 SFTP 客户端，可作为 SFTP 协议交互的补充参考。

---

## 7. Windows 特有的坑

> 本节只写有据可查的部分；无法核实的一律不写。

### 7.1 FTP 主动 / 被动模式与 NAT、防火墙

- **标准依据**：RFC 2428《FTP Extensions for IPv6 and NATs》（1998-09）明确规定 **"PORT and PASV are replaced with EPRT and EPSV, respectively."** EPSV 的意义在于服务端**不再需要在响应里回传自己的地址**，从而绕开 NAT 造成的地址不一致。
- **实际选型**：客户端应**优先尝试 EPSV，失败再退回 PASV**。`suppaftp` 已经把这个选择暴露成 `Mode::{Active, ExtendedPassive, Passive}`（`ExtendedPassive` 的文档注释直接引了 RFC 2428 第 3 节），并额外提供 `set_passive_nat_workaround(bool)`。
- **主动模式在 NAT 下不可用**：AFM 作为**客户端**连出去时，只有被动模式能穿过 NAT。`suppaftp` 的 `active_mode(Duration)` 只是给「能反向连回来」的场景用的兜底。
- **主机防火墙**：被动模式要求客户端能从**本地一个临时端口**连到服务器的 PASV 端口。企业 Windows 上常见的「出站只放行特定端口」策略会直接打死文件传输。**AFM 侧应把「控制通道通、PASV 端口不通」识别成一类可诊断的错误**，而不是笼统的「连接超时」。

### 7.2 隐式 FTPS（990）vs 显式 FTPS（21 + AUTH TLS）

- `suppaftp` 把隐式 FTPS 放在 **`connect_secure_implicit()`**，且被 `#[cfg(all(feature = "secure", feature = "deprecated"))]` 门控——**必须同时开 `secure` 与 `deprecated` 两个 feature**。
- 它的源码注释举的默认端口就是 `"127.0.0.1:990"`。
- **常见失败原因（可从协议事实推出）**：
  - 连 990 但服务端只配了 21 + AUTH TLS → 连不上或握手无响应；
  - 990 端口在很多云安全组/企业防火墙里被默认拦截；
  - 隐式 FTPS 证书校验失败时，错误发生在 TLS 握手阶段而不是 FTP 层，容易被误报成「登录失败」。
- **产品建议**：连接配置里必须让用户显式选择「隐式(990) / 显式(AUTH TLS) / 明文」，不要自动嗅探——自动嗅探在 990 被封时会给出难以理解的超时。

### 7.3 REST 断点续传的服务器兼容性

一手依据来自 `suppaftp` 的源码注释与其内置测试夹具：

> RFC 3659 §5.3 requires `REST` to immediately precede the transfer command, and some servers (**FileZilla Server**) silently drop the offset when another command comes in between.

以及 `suppaftp` 的 `src/lib.rs` 里 `restart_fixture` 模块的注释：

> A fake server that forgets a `REST` offset as soon as another command follows it, for the resumed transfer tests of every client. ... `REST` beyond CONTENT is refused with `501`.

`resume_transfer` 的语义还明确写了两点：
- offset 只对**下一个**数据命令生效，无论成功失败都会被消耗；
- **列举命令（`LIST` / `NLST` / `MLSD`）会丢弃该 offset 且不发 `REST`**；
- 传 `0` 可取消挂起的 offset；
- 该方法自身**永不失败**，服务器拒绝 offset 的错误会由下一个传输命令以 `FtpError::UnexpectedResponse` 报出。

**对 AFM 的含义**：续传失败不会在调用点报错，必须在传输结束后检查返回值。**在 Tauri 命令层如果写成「调用即成功」，用户会拿到一个静默截断的文件。**

SFTP 侧无此问题：SFTP v3 的 `READ`/`WRITE` 原生带偏移量。

### 7.4 Windows 上 SFTP 私钥文件的权限

微软官方文档（OpenSSH Server 配置页）明确要求：

> The `administrators_authorized_keys` file **must only have permission entries for the `NT Authority\SYSTEM` account and `BUILTIN\Administrators` security group**. The `NT Authority\SYSTEM` account must be granted full control. The `BUILTIN\Administrators` security group is required to enable administrators to manage the authorized keys.

并给出具体命令：

```powershell
icacls.exe "C:\ProgramData\ssh\administrators_authorized_keys" /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
```

**对 AFM 的含义**：

- 这是**服务端**的要求，但同一套 ACL 严格性也内建在 OpenSSH 客户端里，私钥 ACL 过宽会被拒绝加载。
- **`russh` 走的是自己的密钥解析路径（RustCrypto `ssh-key`），不必然施加同样的 ACL 检查**——好处是用户不需要去修权限；代价是**「在 OpenSSH 下能用、在 AFM 下报错」的不一致风险变小，但「用户以为安全」的 ACL 期望不会自动满足**。
- 产品层面建议：AFM 读取私钥时给明确提示（文件类型、指纹），并**绝不把私钥内容写进日志或崩溃报告**。

### 7.5 凭据安全存储

Windows 上的一手可选项（微软 DPAPI 文档确认的 API）：

| API | 用途 |
|---|---|
| `CryptProtectData` | 对 `DATA_BLOB` 结构中的数据做加密 |
| `CryptUnprotectData` | 解密 |
| `CryptProtectMemory` | 加密**内存中**的数据，防止同进程内被窥视 |
| `CryptUnprotectMemory` | 内存解密 |
| `CRYPTPROTECT_PROMPTSTRUCT` | 控制解密时的提示 UI |

对 AFM 的含义：

- DPAPI 的加密密钥绑定到**用户凭据**，天然做到「换个 Windows 用户就读不到」，这正符合远程连接的凭据模型。
- `CryptProtectMemory` 值得用于**运行期**的密码驻留，而不只是落盘加密——密码在内存里明文存活是这类应用最常见的泄露面。
- 另一条路是 **Windows Credential Manager**（`CredWrite` / `CredRead`）——**本次未核实其具体 API 细节**，故只列出选项名，不给结论。
- macOS / Linux 需要各写一套（keychain / libsecret），所以**建议在 Rust 侧定义一个 `CredentialStore` trait，Windows 实现 DPAPI，其余平台留待实现或降级为「不落盘、每次会话输入」**。

---

## 8. 明确的「不推荐」清单

| 方案 | 被否决的理由 | 证据 |
|---|---|---|
| **`ftp` crate** | 2018-04-15 停更，仓库 2023-08-04 后无提交，36 个 open issue 无人处理；且 FTPS 依赖 `openssl 0.9`（多年以前的版本） | crates.io API + GitHub API |
| **`sshx`** | **它不是 SSH/SFTP 库**。`ekzhang/sshx` 是一个基于 Web 的协作终端应用（"A secure web-based, collaborative terminal"）。名字撞车 | 仓库 README 原文 |
| **`openssh` / `openssh-sftp-client`** | `openssh` crate 的文档首行就是 **"only works on unix"**，Windows 上不可用；且需要系统存在 `ssh` / `sftp` 可执行文件 | `openssh` crate `src/lib.rs` 首行 |
| **`ssh2`（Rust）** | 需要 `libssh2`（C 库），macOS 还要 OpenSSL。对一个已经用 Tauri + 纯 Rust 的应用来说，这是引入 C 工具链、C 交叉编译、C 运行时排查的净负担，而 `russh` 提供了同样的能力且零 C 依赖 | `ssh2-rs` README 的 "Building on OSX 10.10+" 段 + Cargo.toml 的 `vendored-openssl` / `openssl-on-win32` feature |
| **`async-ssh2-tokio` / `async-ssh2-lite`** | 同样绑定 libssh2（C）。且 `async-ssh2-tokio` 在 crates.io 上显示许可证为 **`non-standard`**（因为用了 `license-file`），虽其 LICENSE 正文确为 Apache-2.0，但**许可证元数据不规范本身就是分发时的风险点** | crates.io license 字段 + Cargo.toml 的 `license-file` |
| **`thrussh` 作为首选** | 虽然仍在维护（2026-08-28 发布 0.49.0）、Apache-2.0，但：① 仓库在 Pijul 而非 GitHub；② **生态重心已迁移到它的 fork `russh`**（russh README 自述 "This is a fork of Thrussh"）；③ **crates.io 上没有 `thrussh-sftp`**（查询 404），SFTP 层要么用 `russh-sftp` 手接流，要么自己写。综合下来不如直接选 `russh` | crates.io + 仓库 README |
| **`ftp-ts`（npm）** | 最后发布 2022-08-01，停滞 4 年。有 `basic-ftp` 这个更好的纯 JS 替代 | npm registry |
| **`ssh2` / `node-ssh`（npm）作为 SFTP sidecar** | `ssh2` 的 `install` 脚本是 `node buildcheck.js && node-gyp rebuild --release`，无 prebuilt 分发。目标机需要 VS Build Tools + Python；进 NSIS 打包还要处理 ABI 匹配 | `ssh2` 的 `package.json` 原文 |
| **FileZilla 作为依赖** | wxWidgets + C++ 桌面应用，架构上就不可链接进 Rust 项目。仅可作为人工阅读的协议实现参考 | 通用架构事实（其 GitHub 官方仓库不存在，源码在 `svn.filezilla-project.org` 且被人机验证拦截） |
| **sshfs-win 作为默认远程路径** | 用户必须手动安装 **WinFsp 内核模式文件系统驱动** + **Cygwin** 两个安装器，直接破坏「装完即用」。且 WinFsp 是 GPLv3 + 特别例外 + 商业授权双轨，做大要付商业授权咨询 | `winfsp/sshfs-win` README 的 Installation 段 + `winfsp/winfsp` README 的 "Flexible licensing" 段 |
| **走「第三方扩展」实现 FTP/SFTP** | 扩展沙箱的网络权限只有 `http`，且强制要求 http/https 主机白名单（`"Access denied: http permission is missing"`）。**没有裸 socket 能力** | `src-tauri/src/extensions/manifest_permissions.rs` + `security.rs` |
| **在 Tauri 后端里用 `spawn_blocking` 包 suppaftp** | 不是选型问题而是集成风险，但值得点出：`suppaftp` 的异步 API（`tokio` feature）是更合适的接入点，AFM 的 Tauri 命令本身就跑在 tokio 上。若用同步 API 塞进 `spawn_blocking`，会让每个远程操作都占用一个阻塞线程，且背压失效 | 架构推断，基于两库均已核实的 API |

---

## 9. 全部引用链接清单

> 所有链接均于 **2026-10-17** 访问成功（标注「未能读取」的除外）。

### 9.1 crates.io

| 资源 | URL |
|---|---|
| suppaftp（crate 页 / API） | https://crates.io/crates/suppaftp · https://crates.io/api/v1/crates/suppaftp |
| suppaftp 文档 | https://docs.rs/suppaftp/ |
| ftp（crate 页 / API） | https://crates.io/crates/ftp · https://crates.io/api/v1/crates/ftp |
| ftp 搜索结果（async_ftp / mcai_ftp / ftp4） | https://crates.io/api/v1/crates?q=ftps&per_page=30&sort=recent-downloads |
| russh | https://crates.io/crates/russh · https://crates.io/api/v1/crates/russh |
| russh 文档 | https://docs.rs/russh/ |
| russh-sftp | https://crates.io/crates/russh-sftp · https://crates.io/api/v1/crates/russh-sftp |
| russh-sftp 文档 | https://docs.rs/russh-sftp/ |
| ssh2 | https://crates.io/crates/ssh2 |
| thrussh | https://crates.io/crates/thrussh |
| thrussh-sftp（**不存在，404**） | https://crates.io/api/v1/crates/thrussh-sftp |
| sshx | https://crates.io/crates/sshx |
| openssh | https://crates.io/crates/openssh |
| openssh-sftp-client | https://crates.io/crates/openssh-sftp-client |
| async-ssh2-tokio | https://crates.io/crates/async-ssh2-tokio |
| async-ssh2-russh | https://crates.io/crates/async-ssh2-russh |
| async-ssh2-lite | https://crates.io/crates/async-ssh2-lite |
| sftp | https://crates.io/crates/sftp |
| ssh-key | https://crates.io/crates/ssh-key |
| remotefs / -ssh / -ftp | https://crates.io/crates/remotefs · https://crates.io/crates/remotefs-ssh · https://crates.io/crates/remotefs-ftp |
| termscp | https://crates.io/crates/termscp |
| suppaftp-cli | https://crates.io/crates/suppaftp-cli |
| opendal-service-ftp | https://crates.io/crates/opendal-service-ftp（`Apache-2.0`，直接核实） |
| opendal（主 crate） | https://crates.io/crates/opendal · https://crates.io/api/v1/crates/opendal |

### 9.2 GitHub（仓库与一手文件）

| 资源 | URL |
|---|---|
| suppaftp 仓库 | https://github.com/veeso/suppaftp |
| suppaftp README | https://raw.githubusercontent.com/veeso/suppaftp/main/README.md |
| suppaftp CLI 说明 | 同上 README 的 "Built-in CLI client" 段 |
| russh 仓库（API 会把 `warp-tech/russh` 重定向到此处） | https://github.com/Eugeny/russh |
| russh README | https://raw.githubusercontent.com/Eugeny/russh/master/README.md |
| russh 官方 SFTP 客户端示例 | https://github.com/Eugeny/russh/blob/master/russh/examples/sftp_client.rs（原始文件 `https://raw.githubusercontent.com/Eugeny/russh/master/russh/examples/sftp_client.rs`） |
| russh-config（known_hosts / ssh config） | https://raw.githubusercontent.com/Eugeny/russh/master/russh-config/src/lib.rs |
| russh-sftp 仓库 | https://github.com/AspectUnk/russh-sftp |
| russh-sftp README | https://raw.githubusercontent.com/AspectUnk/russh-sftp/master/README.md |
| russh-sftp 客户端示例 | https://github.com/AspectUnk/russh-sftp/blob/master/examples/client.rs |
| ssh2-rs（`alexcrichton/ssh2-rs` 会重定向至此） | https://github.com/rust-lang/ssh2-rs |
| ssh2-rs README / Cargo.toml | https://raw.githubusercontent.com/rust-lang/ssh2-rs/master/README.md · https://raw.githubusercontent.com/rust-lang/ssh2-rs/master/Cargo.toml |
| libssh2（C 库本体） | https://github.com/libssh2/libssh2 |
| rust-ftp（`ftp` crate 的休眠仓库） | https://github.com/mattnenterprise/rust-ftp |
| async-ssh2-tokio 仓库 / LICENSE / Cargo.toml | https://github.com/Miyoshi-Ryota/async-ssh2-tokio · https://raw.githubusercontent.com/Miyoshi-Ryota/async-ssh2-tokio/main/LICENSE · https://raw.githubusercontent.com/Miyoshi-Ryota/async-ssh2-tokio/main/Cargo.toml |
| openssh-rust / openssh-sftp-client | https://github.com/openssh-rust/openssh · https://github.com/openssh-rust/openssh-sftp-client |
| openssh crate lib.rs（"only works on unix"） | https://raw.githubusercontent.com/openssh-rust/openssh/master/src/lib.rs |
| openssh-sftp-client README | https://raw.githubusercontent.com/openssh-rust/openssh-sftp-client/main/README.md |
| sshx（协作终端，非 SSH 库） | https://github.com/ekzhang/sshx · https://raw.githubusercontent.com/ekzhang/sshx/main/README.md |
| remotefs 家族 | https://github.com/remotefs-rs/remotefs-rs · https://github.com/remotefs-rs/remotefs-rs-ssh · https://github.com/remotefs-rs/remotefs-rs-ftp |
| termscp | https://github.com/veeso/termscp · https://raw.githubusercontent.com/veeso/termscp/main/README.md |
| **rclone 许可证正文（MIT）** | https://raw.githubusercontent.com/rclone/rclone/master/COPYING |
| rclone README 的 License 段 | https://raw.githubusercontent.com/rclone/rclone/master/README.md |
| **WinSCP 许可证正文（GPLv3）** | https://raw.githubusercontent.com/WinSCP/WinSCP/master/license.txt |
| **sshfs-win README（WinFsp + Cygwin 依赖）** | https://raw.githubusercontent.com/winfsp/sshfs-win/master/README.md |
| **WinFsp README（GPLv3 + 例外 + 商业授权）** | https://raw.githubusercontent.com/winfsp/winfsp/master/README.md |
| 上游 sigma-file-manager | https://github.com/aleksey-hoffman/sigma-file-manager |
| 扩展市场 | https://github.com/sigma-hub/sfm-marketplace · https://raw.githubusercontent.com/sigma-hub/sfm-marketplace/main/README.md |

### 9.3 npm registry

| 资源 | URL |
|---|---|
| basic-ftp | https://registry.npmjs.org/basic-ftp |
| ftp-ts | https://registry.npmjs.org/ftp-ts · https://raw.githubusercontent.com/lumphe/ftp-ts/master/package.json |
| ssh2-sftp-client | https://registry.npmjs.org/ssh2-sftp-client |
| node-ssh | https://registry.npmjs.org/node-ssh |
| ssh2（含 `install` 脚本） | https://registry.npmjs.org/ssh2 · https://raw.githubusercontent.com/mscdex/ssh2/master/package.json |

### 9.4 协议与平台文档

| 资源 | URL |
|---|---|
| RFC 2428《FTP Extensions for IPv6 and NATs》 | https://www.rfc-editor.org/rfc/rfc2428.html |
| RFC 3659 §5.3（REST 的位置要求，由 suppaftp 源码注释引用） | https://www.rfc-editor.org/rfc/rfc3659.html |
| RFC 2389（FTPS，suppaftp README 声明已实现） | https://www.rfc-editor.org/rfc/rfc2389.html |
| SFTP v3 规范（draft-ietf-secsh-filexfer-02） | https://datatracker.ietf.org/doc/html/draft-ietf-secsh-filexfer-02 |
| rclone `serve webdav` | https://rclone.org/commands/rclone_serve_webdav/ |
| rclone `serve sftp` | https://rclone.org/commands/rclone_serve_sftp/ |
| rclone `lsd` | https://rclone.org/commands/rclone_lsd/ |
| rclone Windows 下载产物 | https://downloads.rclone.org/rclone-current-windows-amd64.zip（实测 30.2 MB）· https://downloads.rclone.org/v1.71.2/rclone-v1.71.2-windows-amd64.zip（24.1 MB） |
| rclone sftp 后端 | https://rclone.org/sftp/ |
| Windows DPAPI | https://learn.microsoft.com/en-us/windows/win32/api/dpapi/ |
| OpenSSH for Windows 配置（含私钥 ACL 要求） | https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration |

### 9.5 未能读取的一手来源（如实记录）

| 目标 | 尝试的 URL | 结果 |
|---|---|---|
| FileZilla 许可证正文 | https://filezilla-project.org/license.php | 页面正文被 JavaScript 人机验证/混淆，返回 base64 挑战串，**未能读到许可证文本** |
| FileZilla 源码获取方式 | https://filezilla-project.org/sourcecode.php · https://svn.filezilla-project.org/filezilla-client/ | 同样被人机验证拦截 |
| FileZilla 的 GitHub 仓库 | https://api.github.com/repos/filezilla/filezilla | **404，仓库不存在** |
| termscp 仓库（GitHub 侧 star / issue） | https://github.com/veeso/termscp | 本次未取到 GitHub 侧统计（API 限流）；crates.io 元数据已核实 |

---

## 10. 给下一步的落地检查清单

在动代码之前，建议先把这几件事验证掉（本报告无法替你完成）：

1. **编译验证**：把第 2.3、2.4、3.4 节的示例放进一个临时 crate 里 `cargo check` 通过。示例的签名已逐条对照真实源码，但未经编译。
2. **MSRV 对齐**：suppaftp 12.2.1 要 **Rust 1.88**，russh 0.64.1 要 **Rust 1.89**，russh-sftp 无 rust-version 字段，remotefs 家族要 **Rust 1.89**。确认 AFM 的 toolchain 满足最高的那个。
3. **russh 加密后端**：必须显式选 `aws-lc-rs` 或 `ring`，两个都不开会直接编译失败。
4. **rclone 许可证归档**：把 `https://raw.githubusercontent.com/rclone/rclone/master/COPYING` 的快照存进仓库，避免日后再次出现「GPLv3 还是 SSPL」的口径争议。
5. **真机验收**：按 `AGENTS.md` 的既有约定，界面验收必须用 `tauri build` 的打包产物；远程连接功能需要真实 FTP/FTPS/SFTP 服务器，建议自建本地容器（suppaftp 仓库自带 `test_container.rs` 测试夹具，可作搭建参考）。
6. **凭据存储**：先确定 Windows 侧走 DPAPI 还是 Credential Manager，并据此设计 `CredentialStore` trait；macOS/Linux 的实现可以先不落地，但接口要预留。
