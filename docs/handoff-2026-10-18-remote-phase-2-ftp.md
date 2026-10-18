# 接力文档：阶段 2 的 FTP 与前端信任流已落地

> 日期：2026-10-18（深夜）
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
> 分支：`feat/remote-phase-1-connections-transport`
> 三个新 commit：`fd35b2d8`（4.5 前端信任流）、`6f2290a5`（4.4 FTP provider）
> 上游快照：`handoff-2026-10-18-remote-phase-2-progress.md`（它写于 FTP 之前，
> 其中「状态」一节已过时，本文件取代它）

**状态：SFTP 与 FTP（明文）都能真实列目录了；主机公钥信任流闭环；
FTPS 明确不接（理由与所需前置见第 5 节）。真机验收尚未进行。**

---

## 0. 下一次动手先做这个

**`tauri build` → 打包产物真机验收。** 代码侧已全绿，但所有界面结论目前**一条都没有**
在本项目成立过（AGENTS.md：`tauri dev` 的路由内容区整块空白，dev 上的验收结论一律作废）。

验收清单见第 6 节。FTP 那条连接（`Acceptance-localdir-01` → `C:\Users\Duanyi\Documents`）
就是为此准备的。

---

## 1. 这一轮的两个 commit

| commit | 内容 |
|---|---|
| `fd35b2d8` | 4.5 前端信任流：`hostKeyPrompt` / `HostKeyTrustDialog` / 设置页「已信任主机」分区 |
| `6f2290a5` | 4.4 FTP provider：`ftp_parsing.rs`（纯解析）+ `ftp_provider.rs`（协议）+ command 层按协议分流 |

---

## 2. ⚠️ 纠正设计规格 §3.6 的两处自相矛盾（**动手前请先读这一节**）

规格 `docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md` 第 259–270 行
自相矛盾，第 431–443 行还据此推导了阶段划分。**这三处需要一次规格修订。**

### 2.1 「SOCKS5 走 BIND」与「只支持被动模式」互相否定

| 行 | 原文 |
|---|---|
| 263–265 | SOCKS5 + FTP：**走 BIND**。客户端请代理在本地开一个监听端口，把该端口通过 `PORT`/`EPRT` 告诉服务器，**由服务器反向连回代理** |
| 270 | 主动模式（`PORT`）在 NAT 与代理下基本不可用，代理场景下**只支持被动模式** |

SOCKS5 的 `BIND` 是 `CMD=0x02`，语义为「让代理在**代理侧**开监听并把地址返回给我」。
它服务的必然是 FTP 的**主动模式**（客户端听、服务器连回来）。
所以 263–265 描述的正是被 270 否掉的主动模式 —— 两句不能同时成立。

**被动模式过 SOCKS5 不需要 BIND**：`EPSV` 拿到端口后请代理 `CONNECT` 到
「服务器:数据端口」即可，代理只转发字节，不要求服务器能反向连回代理。
这才是远程代理下可用的那条路。

**已落地**：`ftp_provider.rs` 统一走被动模式，数据通道用
`Socks5CommandKind::Connect`。代码注释里写了完整理由。

### 2.2 HTTP CONNECT 其实**能**支持被动模式

规格第 266–268 行说「HTTP 代理没有 BIND，技术上无法干净支持远程代理下的被动模式」，
于是决策为「HTTP 代理对 FTP 报错」。这混淆了被动与主动：
`CONNECT` 之后是**原样字节隧道**，与直接 TCP 等价，被动模式完全能用；
不能用的只有需要 BIND 的主动模式。

**已落地**：`ftp_provider.rs` 对 `HttpConnect` 走同一条被动路径，不按规格报错。
注意这**扩大**了支持面，所以它是一次需要规格背书的决定，不是实现细节。

### 2.3 因此「`TCPBind` 是选定 `fast-socks5` 的决定性理由」这条也需复核

规格第 230–231 行。`TCPBind` 仍然有用（后续做 FTP 主动模式兜底时），
但它**不是**当前实现的前提。

---

## 3. FTP 的几处关键决定（改代码前先看）

1. **不用 `suppaftp`**：`connect_with_stream` 收 `T: TokioTlsStream`（即 `TcpStream`），
   **绑死 TCP、走不了代理**。用它会让 FTP 测出与实际使用不同的路径。
2. **`PASV` 返回的 IP 一律丢弃，改用控制连接的主机**（RFC 2577 §3）。
   NAT 后的服务器回内网地址或 `0.0.0.0` 是常态。`pasv_host_to_use()` 单独成函数就是为了钉住它。
3. **路径里的控制字符一律拒绝**。`/a\r\nDELE /b` 在行文本协议里是**两条命令**。
   `normalize_remote_path` 只挡 `.` / `..`，不挡控制字符，而路径来自地址栏输入。
   守卫放在 `FtpControl::command` 里（不是各调用点），这样新增命令无法绕过。
4. **列表大小上限在读的过程中强制**（`take()`），不是读完再判长度。
5. **`stat` 不用 `MLST`**，改用「列父目录再按名字找」。`MLST` 是多行回复，
   `read_reply` 只读一行；要支持得先写多行回复读取器，而本阶段没有真机可验它。
6. **`finish_transfer` 不发 `NOOP`**。`226` 是传输完成回复本身；
   先发 `NOOP` 读到的第一条是 `226`，于是 `NOOP` 校验必然失败 ——
   每次列目录都在最后一步报错，而列表早就取全了。
7. **`MLSD` 优先、`LIST` 兜底，且逐行两种都试**。真实服务器输出常是混合的
   （多半行事实列、个别是 `total 0`），只认一种会让另一种的行**静默消失**。

---

## 4. 4.5 前端信任流（`fd35b2d8`）的三个决定

1. **影子类型**：`remote-directory.ts` 曾本地重复声明一个只含 `{kind, message}` 的
   `RemoteErrorPayload`，把 `@/types/remote` 的正式类型遮住，导致
   `buildHostKeyTrustPrompt` 读 `keyType` / `expectedFingerprint` 报「属性不存在」。
   已删本地声明、改 import。「看起来对、实际少两个字段」的镜像类型比缺类型更危险。
2. **主机密钥错误必须先于通用错误分支判定**。否则 `error.value` 一写，
   `init()` 就当成「这个目录打不开」而静默跳去默认目录 ——
   用户点一次「信任」被丢回本机目录，整个信任流程等于没发生（这正是需求 1 的病根）。
3. **设置页「读失败」与「删除失败」分成两个字段**。合成一个的话，删除一失败
   `v-if` 就把整张列表换成错误提示 —— 用户刚点删除，屏幕上却连还剩哪些都看不见了。

外部模式（搜索结果等）没有导航链路，主机密钥流在那里是惰性桩；
`fb.xxx` 是普通对象上的 ref，模板只解包**顶层**绑定，所以三个字段都做了提升。

---

## 5. FTPS：明确不接，以及要接需要什么

`list_with_protocol` / `stat_with_protocol` 对 `ftps_explicit` / `ftps_implicit`
返回一条**说清原因的** `Unsupported`，而不是路由到 `AcceptAnyCertificate`。

**这是本轮的立场，也是建议保留的立场**：`AcceptAnyCertificate` 无条件放行证书，
用它「接上 FTPS 然后宣称支持」等于交付一个静默的中间人窗口 ——
比「暂时不支持」坏得多。`connection_test.rs` 顶部的告警注释也写着同一句话。

要真正接上 FTPS，需要的是**第二条信任链**，不是一段 TLS 代码：

| 前置 | 说明 | 规模 |
|---|---|---|
| `known_hosts` 加 `kind` 字段 | 现有键是 `(host, port)`，同一台主机的 SSH 公钥与 X.509 指纹会撞。需 `(host, port, kind)` 三元键 + 老文件迁移（无 `kind` 视作 `ssh`） | 中 |
| 证书指纹计算与描述 | SHA-256 over DER，`keyType` 填 `X509`，让既有的 `host_key_unknown` / `host_key_changed` 与信任弹窗**原样复用** | 小 |
| rustls `ServerCertVerifier` | 照 `HostKeyHandler` 的形状写一个 `PinnedCertificate`，走 `known_hosts::decide`；**拒绝时回 `Error`，再用观测槽翻译**（与 SFTP 同一套机制） | 中 |
| 显式 FTPS 的 `AUTH TLS` | 登录后升级 TLS，**再重新登录**（服务器会重置会话）。顺序错就是「登录成功了但读目录全 530」 | 中 |
| 隐式 FTPS | 连上就是 TLS，没有 220 欢迎语。`read_greeting` 的形状要分叉 | 小 |

做完这些还要重跑一遍注入验证：`Ok(false)` 之后的错误翻译、
`AUTH TLS` 后必须重新 `USER` —— 这两条正是当年 SSH 侧踩过的坑。

---

## 6. 真机验收清单（`tauri build` 打包产物）

1. 全量门禁六项，逐字对基线（口径必须是 `eslint src` = **179**）。
2. `tauri build` → 静默安装 → **打包产物**。
3. 用户连接：SFTP「速豹堂」`192.168.1.9:22` duanyi → `E:/website_sbt`；
   FTP `Acceptance-localdir-01` → `C:\Users\Duanyi\Documents`。
4. 逐条验：
   - 点远程连接 → **右栏列出远端目录**，不再是 `C:\Users\Duanyi`
   - 首次弹「首次连接到 192.168.1.9」+ 指纹 → 信任 → 自动重试成功
   - 用 `ssh-keygen -lf` 取 NAS 真实指纹与弹窗里的**逐字对照**
   - 故意改错密码 → 看到**认证错误**而不是别的
   - 设置页「已信任主机」能看到那一条，并能删掉；删后再连应重新弹「首次见到」
   - **FTP 那条连接也要点开看目录** —— 本轮 FTP 一次都没连过真服务器
   - 面包屑每一级点得动、Tab 名显示连接名而不是 uuid
5. 验收脚本在 `.superpowers/sdd/`（git-ignored），**新增脚本一律纯 ASCII**。

---

## 7. 门禁（同一口径逐条实测，非照抄文档）

| 项 | 结果 |
|---|---|
| `cargo test --lib` | **577 通过 / 0 失败**（基线 495 + 82） |
| 测试二进制加载 | 正常 —— `cargo test --lib` 红线未踩（`remote/` 下无任何 `tauri::` 路径） |
| `npx vitest run` | 195 文件 / 1613 用例 |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **179**（= 基线） |
| `verify-changelog.mjs` / `verify-remote-i18n.cjs` | 退出码 0 |

---

## 8. 注入验证脚本（`.superpowers/sdd/`，git-ignored）

| 脚本 | 覆盖 |
|---|---|
| `inject-hostkey.cjs` | 信任流纯函数 5 条 |
| `inject-trusted-hosts.cjs` | 设置页分区 5 条 |
| `inject-ftp.cjs` | FTP 解析 5 条 + provider 5 条（跨两个文件，含 restore） |

⚠️ **还原会整体覆盖目标文件，所以只在代码已提交之后跑。**
本轮就被它冲掉过一次尚未提交的测试与一行守卫，症状是「刚写好的断言莫名其妙不存在了」。

---

## 9. 未结事项

- **真机验收**（第 6 节）—— 本轮一条都没做。
- FTPS（第二节表格）—— 建议**单独排期**，不要顺手接。
- 会话注册表 / 连接池（规格 §3.4）：当前每次列目录重新建连。
- 远程写操作（新建目录 / 重命名 / 删除）：规格阶段 3。
- 传输、跨边界拖拽：规格阶段 6 / 7。
- `MLST` 多行回复支持（当前 `stat` 绕开了它，代价是一次列父目录）。
