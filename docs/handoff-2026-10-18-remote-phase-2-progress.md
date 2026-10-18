# 接力文档：阶段 2 进度快照（SFTP 已通，FTP 与前端信任流未做）

> 日期：2026-10-18（晚间）
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
> 分支：`feat/remote-phase-1-connections-transport`
> 最新 commit：`775d6750`
> **状态：Rust 侧全部就绪且门禁全绿；前端只做了「让 `sfm://remote/...` 有真实出口」的接线，
> known_hosts 的确认弹窗与 FTP 都还没做 —— 现在构建出来的包，点远程连接会停在
> 「首次连接到 …，指纹还没有被信任」且没有继续的路径。**

---

## 0. 先读这一条

**下一次动手先做 4.5（前端信任流），再做 4.4（FTP）。**
理由：4.5 是 SFTP 能用的**前置条件** —— 没有它，用户确认指纹这条路根本不存在，
真机验收第一条就过不去。FTP 是同批交付的第二协议，不阻塞 SFTP 的可用性。

---

## 1. 三个设计决策已由用户拍板（2026-10-18）

| # | 决策 | 结论 |
|---|---|---|
| 1 | `remote_read_dir` 的连接配置由谁提供 | **方案 C**：Rust 自己读 `user-remote-connections.json` + DPAPI 密码，command 只收 `path` |
| 2 | FTP 与 SFTP 是否同批 | **是**，同批交付 |
| 3 | known_hosts 存储与首见策略 | **自建文件 + 首见弹窗确认指纹**（规格 §3.5） |

决策 1 已经落地（`registry.rs`），前端 4.1 的 `{ path }` 载荷正好对得上，**一行没改**。

---

## 2. 已完成并门禁通过的部分

### 2.1 前端连带项（commit `ea5648e9`）

| 文件 | 做了什么 |
|---|---|
| `src/utils/remote-directory.ts`（新） | 远程 command 名的单一定义点 + `describeRemoteError` |
| `src/utils/virtual-locations.ts` | `resolveDirectoryContents` / `resolveDirEntry` 加远程分支 |
| `.../file-browser/address-bar-parts.ts` | 远程面包屑，用 `buildRemotePath` 拼，不再把 `sfm:` 当盘符 |
| `.../file-browser/address-bar.vue` | 面包屑接连接名（复用 `settingsTabs.remote`，**没有新增 i18n 键**） |
| `.../use-file-browser-navigation.ts` | 错误解包、Tab 名显示连接名、监听与目录大小守卫、`directoryPathExists` 远程分支 |

### 2.2 Rust 侧（commits `6ebc4838` / `775d6750`）

- `registry.rs` —— 连接表读取 + DPAPI 密码装配
- `known_hosts.rs` —— 主机公钥记录与 `decide()` 判定
- `sftp_provider.rs` —— `SftpRemoteProvider`
- `dir_adapter.rs` —— `RemoteEntry` → `DirEntry` / `DirContents`
- `error.rs` —— 新增 `HostKeyUnknown` / `HostKeyChanged` 两类 + 结构化指纹字段
- `commands.rs` / `lib.rs` —— `remote_read_dir` / `remote_stat_dir_entry` /
  `remote_list_known_hosts` / `remote_trust_host` / `remote_forget_host`

### 2.3 门禁实测（逐条量过，不是照抄文档）

| 门禁 | 结果 |
|---|---|
| `cargo test --lib` | **541 通过 / 0 失败**（基线 495 + 新增 46） |
| 测试二进制加载 | **正常** —— `russh-sftp` 没有把 tao 拖进来，红线未被踩 |
| `npx vitest run` | 193 文件 / 1586 用例（4.1 那轮） |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **179**（= 基线口径 `eslint src`，不是 `eslint .` 的 186） |
| `node scripts/verify-changelog.mjs` | 退出码 0 |
| `verify-remote-i18n.cjs` | 59 键 × 17 语言包齐全 |

---

## 3. 下一步 4.5：前端信任流（**优先级最高**）

### 3.1 现状

Rust 已经会返回这两类错误：

```jsonc
// 首见
{ "kind": "host_key_unknown", "message": "首次连接到 192.168.1.9…", "fingerprint": "SHA256:…" }
// 变了
{ "kind": "host_key_changed", "message": "…", "fingerprint": "SHA256:新", "expectedFingerprint": "SHA256:旧" }
```

前端**已经**有判别用的工具函数：`src/types/remote.ts` 的 `isHostKeyError(error)`
与 `HOST_KEY_UNKNOWN_KIND` / `HOST_KEY_CHANGED_KIND`。**它现在还没有任何调用点。**

### 3.2 要做的三件事

1. **确认弹窗**（首见）：显示 `fingerprint`，让用户核对后点「信任」。
   - 用户点了 → `invoke('remote_trust_host', { host, port, fingerprint, keyType })`
   - 然后**自动重试**刚才那次导航。
   - `keyType`：后端目前没把它带出来（`RemoteError` 只有 fingerprint）。
     要么加一个 `keyType` 字段，要么 UI 只显示指纹。**建议先只显示指纹**，
     加字段要改 `RemoteError` 的 serde 形状与那条「阶段 1 JSON 逐字节相同」的测试。
2. **警告弹窗**（变了）：显示**两个**指纹，默认动作是拒绝。
   - 用户坚持 → 先 `remote_forget_host` 再 `remote_trust_host`，然后重试。
   - **绝不能自动接受。**
3. **设置页**：列出 `remote_list_known_hosts`，允许删除。
   后端已就绪（`remote_list_known_hosts` / `remote_forget_host`）。

### 3.3 接线点

`resolveDirectoryContents`（`src/utils/virtual-locations.ts`）的远程分支是**唯一入口**。
建议把「捕获 host key 错误 → 弹窗 → 信任 → 重试一次」封装成
`src/utils/remote-directory.ts` 里的一个函数，导航侧只调它，
这样目录树、地址栏、workspace 预载四条路径自动一起受益。

⚠️ **重试只做一次**。循环重试会让「指纹一直不匹配」变成一个无限循环。

⚠️ 新增 i18n 键要跑 `npm run sync-i18n`（**必须在仓库根**），
门禁是 `.superpowers/sdd/verify-remote-i18n.cjs`。

---

## 4. 下一步 4.4：FTP（与 SFTP 同批，用户已拍板）

**不用 `suppaftp`。** 它的 `connect_with_stream` 收 `T: TokioTlsStream`（即 `TcpStream`），
**绑死 TCP、走不了代理** —— 用它会让 FTP 测出与实际使用不同的路径。

手写控制通道，复用 `connection_test.rs` 里已经 `pub(crate)` 化的零件：
`transport::connect` / `send_command` / `read_reply` / `decode` /
`parse_ftp_reply_code` / `upgrade_tls` / `AcceptAnyCertificate`。

⚠️ **数据通道是这里最难的部分，规格 §3.6 已经把规则写死了：**

| 代理 | 数据通道 |
|---|---|
| 直连 | `EPSV` → `TcpStream::connect`（失败退 `PASV`） |
| SOCKS5 | `EPSV` → `transport::connect(..., Socks5CommandKind::Bind)`（`TCPBind` 已核实存在） |
| HTTP CONNECT | **不支持**，必须显式报错说明原因（HTTP 代理没有 BIND） |

⚠️ **`AcceptAnyCertificate` 是 FTPS 的定时炸弹。** 它无条件放行证书。
阶段 2 真正读远端目录时**不得**用它 —— 与 `ProbeHandler` 同理。
本阶段 FTP 明文可以先跑通，FTPS（显式/隐式）**要么不在本批交付，要么单独排期**，
不要顺手把它接上然后宣称支持。

⚠️ FTP 的 `mtime` 精度通常是**秒级**，且 `MLSD` 可能返回 `modify=20230101120000`
这种格式，解析要覆盖 `YYYYMMDDHHMMSS` 与 `Jan 15 12:00` 两种。

---

## 5. 已踩到 / 已核实的坑（省掉新会话的时间）

- **`--offline` 加 `russh-sftp` 会失败**：缺 `dashmap` / `hashbrown` / `serde_bytes` /
  `gloo-timers` 四个传递依赖，本地 registry 里没有。已联网 `cargo fetch` 取回，
  之后可以继续用 `--offline`。
- **`cargo` 解析 `russh-sftp 3.0.1` 时没有引入第二个 russh** —— 0.63 的版本锁是被
  cargo 自己确认的，不是我们断言的。想复验就删 `Cargo.lock` 里那几行再 `cargo fetch`。
- **`crate::dir_reader::types` 是私有模块**：要用 `crate::dir_reader::{DirContents, DirEntry, OpenedDirectoryTimes}`
  （`dir_reader.rs` 已经 `pub use` 出来了）。两处都踩过。
- **`RemoteError` 加了 `rename_all = "camelCase"`**：`expectedFingerprint` 才与前端对上。
  单数字段不受影响，阶段 1 定死的 `{"kind":"auth","message":"…"}` 仍然逐字节相同 ——
  那条测试在 `error.rs::serializes_kind_as_snake_case`。
- **`PublicKeyOrCertificate::public_key()`（russh 自带）**返回 `PublicKey`，
  自己 match 的话 `Certificate` 分支的 `cert.public_key()` 返回的是 `&KeyData`，
  类型对不上。**用它就对了。**
- **`PublicKey::fingerprint(HashAlg::Sha256)` 返回 `Fingerprint` 不是 `String`**，
  要 `.to_string()`。
- **`AsyncFnOnce` 在 Rust 1.90 还不稳定**，所以 provider 里没有做「带闭包的
  `with_session`」，而是把打开会话的代码在 `list` / `stat` 里各写一遍。
- **PowerShell 里 `node -e` 的引号**：本轮又踩了一次。参数里出现 `"` 就改用 write 工具落盘。
- **`cargo test --lib` 的过滤参数**：`remote::` 前缀可用，`--offline` 现在也可用。

---

## 6. 真机验收怎么做（4.5 + 4.4 做完之后）

1. 全量门禁六项，逐字对基线（口径必须是 `eslint src`）。
2. `tauri build` → 静默安装 → **打包产物**（`tauri dev` 的界面结论一律作废）。
3. 用户的连接「速豹堂」是 SFTP 192.168.1.9:22 duanyi → `E:/website_sbt`，两条都存了密码。
4. 验收要点：
   - 点导航栏远程连接 → **右栏列出 NAS 上的远端目录**，不再是 `C:\Users\Duanyi`
   - 首次会弹「首次连接到 192.168.1.9」+ 指纹 → 信任 → 自动重试成功
   - 故意改错密码 → 看到**认证错误**而不是别的
   - 用 `ssh-keygen -lf` 取 NAS 的真实指纹与弹窗里的**逐字对照**
   - 把 NAS 的 `known_hosts` 记录删掉再连一次 → 应当重新弹「首次见到」
   - 面包屑每一级点得动、Tab 名显示连接名而不是 uuid
5. 验收脚本在 `.superpowers/sdd/`（git-ignored），**新增脚本一律纯 ASCII**。

---

## 7. 未结事项（写在这里以免被忘）

- 会话注册表 / 连接池（规格 §3.4）：当前每次列目录重新建连，是方案 C 的已知代价。
- FTPS 显式与隐式：规格阶段 4，本批不做。
- 远程写操作（新建目录 / 重命名 / 删除）：规格阶段 3。
- 传输、跨边界拖拽：规格阶段 6 / 7。
- `RemoteError` 还没有 `keyType` 字段；前端信任弹窗只显示指纹。
