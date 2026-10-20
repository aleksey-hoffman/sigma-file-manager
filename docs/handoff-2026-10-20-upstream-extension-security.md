# 交接文档：上游扩展安全加固（2026-10-20）

## 0. 本轮范围

**来源**：上游 `sigma-file-manager` 的三个提交（本仓 `upstream/main` = `2b8bed43`，领先我们 23 个提交）。

| 上游提交 | 内容 |
|---|---|
| `45cedf89` | 修扩展下载的 SSRF（DNS rebinding + 跳转） |
| `4b0a2419` | 加固扩展隔离与权限判定（主机侧读 manifest、删掉进程内假沙箱） |
| `5b6cab44` | 给扩展主流程补测试 |

**为什么挑这三条**：上一轮把上游 23 个提交逐条分类后（A 直接引入 / B 需二次开发 / C 无意义 / D 需拍板），这是「A 直接引入」里风险最高、收益最大的三条 —— 三条都是**安全边界**，且都只有上游改过、我们逐字停在修复前的版本。

**本轮不做**：上游其余 20 个提交。分类结论见上一轮交付（A/B/C/D 四类清单）。

**一条超出上游的补充**：`rename_part_files_to_ts` 这条命令的权限门禁。**上游最新版本里它同样没有门禁**（见 §2.4），本轮顺手补上了 —— 理由见该节。

---

## 1. 三条修复各自在防什么

### 1.1 SSRF：扩展下载能被指向你自己的内网

扩展的下载地址来自 manifest / 注册表条目 —— 也就是**不可信输入**。修复前只查了 URL 里写的那个主机名，而且只在请求开头查一次。于是：

- 域名解析到内网地址（`127.0.0.1`、`192.168.x.x`、`169.254.169.254` 云元数据）→ 放行；
- 服务器回一个 302 指向别处 → 跳转目标**完全不查**；
- 重试、备用镜像（jsDelivr / codeload）→ 各自都不查。

修复后：判定挪到 **DNS resolver 内部**，解析出来的每个地址都要过一遍「是不是公网」；每一次跳转（含重定向链上的每一跳）重新校验；`0.0.0.0/8`、CGNAT、组播、保留段、IPv4-mapped/compatible IPv6、NAT64、6to4、带方括号的 IPv6 字面量都在拦截名单里。

### 1.2 权限：扩展能不能运行程序，以前是它自己说了算

`run_extension_command` / `start_extension_command` 原来只校验「调用者自称的身份 == 目标扩展」。但**这个扩展自己有没有申请过 `shell` 权限**，从来没人问过 —— 判定完全在前端（`context.hasPermission('shell')`）。前端被绕开就没有第二道门。

修复后：Rust 侧读**磁盘上**扩展目录里的 `package.json`，`permissions` 里必须有 `shell`。磁盘上的 manifest 是安装时写下的、运行中的扩展改不了，所以它才是权威来源。

### 1.3 假沙箱：`createSandbox` 根本不是沙箱

原来的 `createSandbox` 在**宿主 realm** 里建一个 Proxy，把 `eval`/`Function`/`window` 等名字藏起来。但 `Object['con' + 'structor']('return globalThis')()` 一步就能绕回去 —— 它共享宿主内建对象，挡不住计算属性访问。留着只给虚假的安全感。

真正的隔离边界一直都在：api 扩展跑在**独立 module Web Worker** 里，iframe 扩展跑在**跨源 sandboxed iframe** 里，两者都不暴露宿主 `window`、Tauri IPC 桥和宿主 DOM。`createSandbox` / `createSandboxedFunction` 因此被删掉。

---

## 2. 后端（Rust）

### 2.1 整份取上游的四个文件

这四个文件在本仓**与上游修复前逐字相同**（用 `git diff --no-index` 逐字节核对过），所以直接取上游修好的版本：

| 文件 | 取自 |
|---|---|
| `src-tauri/src/extensions/security.rs` | `45cedf89` |
| `src-tauri/src/extensions/github.rs` | `45cedf89` |
| `src-tauri/src/extensions/binaries.rs` | `45cedf89` |
| `src-tauri/src/extensions/install.rs` | `45cedf89` |

核对脚本：`.superpowers/sdd/verify-pre-fix-identical.ps1`（输出 `IDENTICAL-PRE` / `DIFFERS-PRE`）。
取用脚本：`.superpowers/sdd/take-upstream-rust.ps1`。

### 2.2 手工合并的 `http.rs`

`http.rs` 与上游修复前的差别只有一处 —— 本仓为大陆网络做的连接超时调优：

```rust
// v6.5.1: was 15s. raw.githubusercontent.com intermittently blackholes on
// mainland-CN connections, ... (注释见 http.rs:19-26)
const HTTP_CONNECT_TIMEOUT_SECS: u64 = 5;   // 本仓 5，上游 15
```

所以取上游修好的版本之后，把这 5 秒和那段注释**回填**回去，其余（`base_http_client_builder` / `PublicOnlyResolver` / `remote_redirect_policy` / `build_remote_http_client` / `BlockedTargetError`）整份照收。

> ⚠️ `http.rs` 里有一处**不能**照收上游的默认值：`HTTP_CONNECT_TIMEOUT_SECS`。上游是 15 秒，本仓是 5 秒 —— 大陆网络下 raw.githubusercontent.com 会黑洞，15 秒 × 重试 × N 个候选曾把冷启动拖到 180 秒。这条是本仓自己的调优，回填时别改回 15。

### 2.3 权限主机侧判定

- `src-tauri/src/extensions/manifest_permissions.rs`：整份取上游 `4b0a2419`，另加本仓的 `require_extension_shell_permission` / `require_extension_shell_permission_in_dir`（§2.4）。
- `src-tauri/src/extensions/processes.rs`：整份取上游 `4b0a2419`（本仓与上游修复前逐字相同），落点是两行：

```rust
authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
super::manifest_permissions::require_extension_permission(&app_handle, &extension_id, "shell")?;
```

**上游把判定拆成了两个函数是有原因的**：`require_extension_permission` 要 `&tauri::AppHandle`，而 `require_extension_permission_in_dir` 不要。测试走后者，于是测试二进制不会因为它而把 `tauri::AppHandle` 拖进来 —— 这条是本仓 `cargo test --lib` 的隐形红线（见 §11）。

### 2.4 超出上游的一条：`rename_part_files_to_ts`

**上游最新版本（`2b8bed43`）里这条命令也没有门禁**：

```rust
#[tauri::command]
pub async fn rename_part_files_to_ts(directory: String) -> Result<u32, String> {
    misc::rename_part_files_to_ts(directory).await
}
```

没有 caller 绑定、没有权限判定 —— 谁都能让它去改任意目录下的文件名。本轮补上：

```rust
#[tauri::command]
pub async fn rename_part_files_to_ts(
    app_handle: tauri::AppHandle,
    extension_id: String,
    directory: String,
    caller_extension_id: Option<String>,
) -> Result<u32, String> {
    super::manifest_permissions::require_extension_shell_permission(
        &app_handle, &extension_id, caller_extension_id.as_deref(),
    )?;
    misc::rename_part_files_to_ts(directory).await
}
```

前端相应补传 `extensionId`（`create-shell-api.ts`）。

**为什么值得做**：本轮的主题就是「主机侧权限判定」。只补两条命令而留着第三条，「特权命令由 manifest 说了算」这句话就不成立 —— 而且这是个**能演示**的洞，不是理论上的。

**影响面**：本仓唯一调用方是扩展 API 的 `shell.renamePartFilesToTs`（`src/modules/extensions/api/__tests__/create-shell-api.test.ts` 已覆盖其前端拒绝路径）。主应用没有调用点。两个已装扩展（`kizemo.focus-sync` / `sigma.clipboard`）都没声明 `shell`，也不用这个 API。

### 2.5 `Cargo.toml`

tokio 的 feature 要加 `net`（`tokio::net::lookup_host`）和 `time`（`tokio::time::timeout`）：

```toml
tokio = { version = "1", features = ["rt", "rt-multi-thread", "sync", "io-util", "net", "time"] }
```

**`io-util` 保留**（上游没有这个 feature，但本仓的 FTP/FTPS/SFTP provider 和局域网共享在用 `AsyncReadExt` / `copy_bidirectional`）。

**没有引入任何新的第三方 crate**：`Cargo.lock` 的依赖列表逐行未变 —— `net` / `time` 这两个 feature 本来就被 reqwest 的依赖统一启用了。所以本轮**不需要**做许可证核查。

---

## 3. 前端（TypeScript）

### 3.1 `src/modules/extensions/runtime/sandbox.ts`

- 删掉 `createSandbox` / `createSandboxedFunction`；
- `ExtensionSandbox` 类型从 `{extensionId, globalContext, console, evaluate, destroy}` 缩窄到 `{extensionId, destroy}`（本仓的 `loader.ts` 只用 `sandbox.destroy()`，而且该字段**从来没被赋过非空值**，一直是 `null`）；
- 加上游的隔离边界说明注释；
- 加一条规则：计算属性访问 `obj['constructor']` / `obj["__proto__"]` / `fn[\`prototype\`]`。

### 3.2 必须保留的本仓改进：剥掉注释与字面量

本仓比上游多一个 `src/modules/extensions/runtime/strip-non-code.ts`。它把注释、字符串/模板/正则字面量**按原长度抹成空格**，再拿去跑静态屏幕。

**为什么必须有**：本仓真机撞到过 focus-sync 扩展被 `/(?<![\w$.])self\b/` 拒绝的真实事故 —— 它的英文注释里有一句 "a self-inflicted false alarm"，于是扩展**从未创建 worker、从未激活**，界面上看不出任何异常。上游至今没有这一层。

> 所以合并时**不能**整份取上游 `sandbox.ts`，否则丢掉这个改进，focus-sync 会当场挂掉。

### 3.3 上游新规则与本仓改进的冲突 —— 以及怎么解的

上游新加的那条「计算属性访问」规则，正则里**必须有那个字符串字面量**：

```ts
pattern: /\[\s*(['"`])(?:constructor|__proto__|prototype)\1\s*\]/g
```

而本仓的剥除逻辑恰好**把字面量抹掉** —— `({})["constructor"]` 变成 `({})[        ]`，规则永远匹配不到。

**顺带查出一处本仓自己的静默失效**：上游早就有的 `.constructor("...")` 规则（`/\.constructor\s*\(\s*['"`]/g`）在本仓**从来就没生效过** —— 因为它同样需要那个被抹掉的引号。本仓的测试没覆盖到这一条，所以「全绿」掩盖了它。

**解法**：按规则需要的东西分成两路扫。

| 规则类型 | 扫什么 | 例子 |
|---|---|---|
| 抓**标识符**的规则 | 剥除后的代码 | `self`、`window.`、`fetch(`、`navigator` |
| 抓**字面量本身**的规则 | 原文 | `.constructor("x")`、`["__proto__"]` |

实现上给这两条规则加 `literal: true` 标记，逐条选扫描目标。**错误信息的顺序保持上游原样**（两路合进同一个循环）。

**回归风险已量化**：真实扩展（仓库内 focus-sync + 已装的 focus-sync / clipboard）在原文上对这两条规则的命中数**都是 0**（`node .superpowers/sdd/check-literal-rules.cjs`）。

### 3.4 `src/modules/extensions/runtime/index.ts`

移除 `createSandbox` / `createSandboxedFunction` 两个导出，并留了一行中文注释说明为什么删。

### 3.5 `src/modules/extensions/api/create-shell-api.ts`

`renamePartFilesToTs` 补传 `extensionId`。

---

## 4. 测试

### 4.1 取自上游的三个测试文件

| 文件 | 取自 | 用例数 |
|---|---|---|
| `src/modules/extensions/runtime/__tests__/sandbox.test.ts` | `4b0a2419` | 5 |
| `src/modules/extensions/api/__tests__/create-shell-api.test.ts` | `5b6cab44` | 4 |
| `src/modules/extensions/runtime/__tests__/extension-main-flow.test.ts` | `5b6cab44` | 4 |

`extension-main-flow.test.ts` **原样可用**，不用改：本仓 `loader.ts` 的 `loadExtensionRuntime` / `unloadExtensionRuntime` / `getLoadedRuntime` 签名、`workerHost.initialize(entryUrl)` 的入参、`activationContext` 的四个字段（`extensionId` / `extensionPath` / `storagePath` / `activationEvent`）与上游**完全一致**。

### 4.2 本仓新增的「接线层」契约门禁

**新增**：`src/modules/extensions/api/__tests__/shell-host-permission-contract.test.ts`（8 个用例）。

**为什么必须有**：权限判定函数有 Rust 单测、前端有单测，但两边都验不到一件事 —— **主机侧那道门禁到底接没接到命令上**。门禁函数写对了、命令没调用它，两边单测**照样全绿**，真机上却毫无保护。这正是「纯函数测试全绿 + 运行时静默失效」的典型形态。

做法沿用本仓上一轮 `remote-command-contract.test.ts` 的先例：**直接读 Rust 源码**把接线关系抠出来断言 ——

- 每条特权命令的函数体里确实有权限判定调用；
- 调用者身份校验也在（`authorize_extension_caller`）；
- 判定读的是**磁盘上的 manifest**（`fs::read_to_string(&manifest_path)`），不是 IPC 调用方给的；
- Rust 参数名与前端实际传的键逐条对得上（Tauri v2 按 Rust 参数名的 camelCase 形式匹配）。

### 4.3 注入验证（5 次，全部做过）

方向必须与被测断言一致：**验「门禁在起作用」要让门禁失效（恒真），负例才转红**。

| # | 注入 | 期望转红 | 实测 |
|---|---|---|---|
| A | Rust：`extension_declares_permission` 恒真 | manifest_permissions 的「拒绝」类用例 | **5 红** ✓ |
| B | Rust：`is_private_ip_address` 恒假 | security + http 的 SSRF 用例 | **5 红** ✓ |
| C | 前端：删掉「计算属性访问」规则 | sandbox 的 computed-access + main-flow 的 realm-escape | **2 红** ✓ |
| D | 前端：把假沙箱放回来 | sandbox 的「不再导出共享 realm 沙箱工厂」 | **1 红** ✓ |
| E | Rust：摘掉 `rename_part_files_to_ts` 的门禁调用 | 契约门禁的「gated too」 | **1 红** ✓ |

注入脚本 `.superpowers/sdd/inject.cjs` 会**先备份、注入、跑命令、最后无条件还原并逐字节校验**，中途被打断也不会留下坏文件。

---

## 5. 门禁（逐字对照基线）

| 门禁 | 基线 | 本轮 | 结论 |
|---|---|---|---|
| `cargo test --lib` | 666 passed / 0 failed | **686 passed / 0 failed** | ✅ +20 |
| `npx vitest run` | 214 文件 / 1925 用例 | **218 文件 / 1946 用例** | ✅ +4 文件 / +21 用例 |
| `npx eslint src` | 170 errors / 0 warnings | **170 errors / 0 warnings** | ✅ 逐字一致 |
| `npx vue-tsc --build` | 0 error | **0 error** | ✅ |
| `node scripts/verify-changelog.mjs` | OK | **OK** | ✅ |

eslint 的口径是 **`npx eslint src`**（整仓 `eslint .` 的基线是 186/121，差 7 个是 `src` 之外的存量）。逐文件核对过：本轮碰过的文件**没有一条诊断**，170 条全在没碰过的存量文件里。

Rust 侧新增的 24 个安全用例（4 个 `remote_url_tests` + 4 个 `remote_client_tests` + 11 个 `manifest_permissions` + 4 个本仓新增的 `shell_permission_gate`）全部实跑过，不是「应该会通过」。

---

## 6. 版本号

`3.2.12-beta` → **`3.2.13-beta`**。

理由：`3.2.12-beta` 已经公开发布（站点 + GitHub release），同号换内容会让「哪个包是哪个」分不清。

`npm run sync-version` 同步了 `package.json` + 3 个 `Cargo.toml`；`Cargo.lock` 的版本号由 cargo 自动更新（**依赖列表逐行未变**）。

---

## 7. 真机验收

打包产物装机后逐条验的，明细见 §9。

**结论**：四条验收全过。带 SSRF 守卫的新 HTTP 客户端在真机上**直连公网**正常（市场注册表 + 每条条目的可达性探测 + 版本预取 + 完整扩展包下载全部成功）；删掉假沙箱之后 focus-sync **照常激活**并与自己的 sidecar 保持连接；扩展连自己 `127.0.0.1` 的那条 HTTP 通道**没有**被守卫误伤（它用的是另一个客户端）。

**没验到的**：SSRF 的**拒绝**分支没有在真机上触发过 —— 要触发它需要一个解析到内网的地址，本机没有这样的入口。该分支由 9 个 Rust 单测 + 1 道契约门禁覆盖（§4.2 / §4.3）。

---

## 8. 常用命令速查

```powershell
# 门禁
npx vue-tsc --build
npx eslint src
npx vitest run
.superpowers\sdd\cargo-test-lib.cmd
node scripts\verify-changelog.mjs

# 注入验证
powershell -NoProfile -ExecutionPolicy Bypass -File .superpowers\sdd\run-injection.ps1 <label> <inject args...>

# 打包（**先杀进程**，否则 pdb 被占报 os error 32）
Get-Process alpha-file-manager -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process cmd -ArgumentList '/c','.superpowers\sdd\build-acceptance.cmd > .superpowers\sdd\build.log 2>&1' -WorkingDirectory '<repo>' -WindowStyle Hidden

# 装机
& '.\.superpowers\sdd\install-artifact.ps1' -Installer '<repo>\release\Alpha File Manager_3.2.13-beta_x64-setup.exe'
```

---

## 9. 真机验收明细

### 9.1 产物

| 项 | 值 |
|---|---|
| 安装包 | `release\Alpha File Manager_3.2.13-beta_x64-setup.exe` |
| 大小 | 20,340,899 字节（2026-10-20 19:52:20） |
| SHA256 | `D544097502E2FADA6C7CEBCCA8D6D82D75537368F26C398B4504707ECB50EC0C` |
| 装机 exe | 55,249,408 字节（19:51:56） |
| 装机 exe SHA256 | `7AD44E2140EF1750CE731004EFD92F328DA93099D0CED09248240634D947C64E` |

### 9.2 环境（先量，再验）

先确认这台机器的网络环境，免得把「网络不通」误判成「代码坏了」：

| 项 | 实测 |
|---|---|
| `raw.githubusercontent.com` 解析 | `185.199.108/109/110/111.133` —— **4 个都是公网地址** |
| `HTTP_PROXY` / `HTTPS_PROXY` 环境变量 | Process / User / Machine 三个域**都没有**（只有 `NO_PROXY=localhost,127.0.0.1,::1`） |
| WinINET 代理 | `ProxyEnable=0`（未启用） |
| WinHTTP 代理 | Direct access |

⇒ 应用是**直连**出去的，会走 `PublicOnlyResolver` 的公网判定。检查脚本：`.superpowers/sdd/check-network-env.ps1`。

### 9.3 验收 A：新功能弹窗显示的是 3.2.13-beta ✅

首启弹出的「新功能」窗口，标题栏写 **3.2.13-beta**，正文是本轮写的中文更新日志（左侧版本列表 3.2.13-beta 标着「当前」）。证明：版本号同步 + `CHANGELOG.md` + `public/changelog/ch/changelog.md` 三处接线都对，中文没有乱码。

证据：`.superpowers/sdd/s1-start.png`

### 9.4 验收 B：市场页从网络拉到了注册表 ✅

扩展功能页 →「市场」标签下有：

- **精选** 4 个：Clipboard History `v1.0.1`、Video Downloader `v1.1.0`、Excalidraw `v1.0.0`、Media Converter `v1.1.0`
- **其他扩展** 2 个：Catppuccin Themes、Hetima Light Themes

**为什么这能证明网络真的通了**（而不是读了缓存）：注册表在 `src/stores/runtime/extensions.ts:118` 是 `ref<ExtensionRegistry | null>(null)` —— **纯内存态，从不落盘**；应用是刚装完冷启动的，内存里不可能有旧数据。而且卡片上那些版本号来自 `prefetchAllVersions()`，即**每个条目各一次网络请求**（连同注册表本身和 `filterReachableRegistryEntries` 的逐条可达性探测，一次冷启动十几个请求）。

**这一条直接压到了本轮改的代码**：这些请求全部走 `github.rs` → `build_remote_http_client()` → `PublicOnlyResolver`（DNS 解析 + 公网判定）→ `remote_redirect_policy()`（每次跳转重新校验）。

证据：`.superpowers/sdd/s3-extensions.png`

### 9.5 验收 C：focus-sync 照常激活 ✅（删掉假沙箱之后）

focus-sync 是本仓**最容易被误伤**的那个扩展：它的英文注释里有一句 "a self-inflicted false alarm caused by our own installer"，历史上把 `self` 规则触发过一次，导致扩展**从未创建 worker、从未激活**，界面上看不出任何异常。

本轮同时动了静态屏幕（新增一条规则、改变两条规则的扫描目标）并删掉了假沙箱，所以必须确认它还活着。

实测三条独立证据：

| 证据 | 实测 |
|---|---|
| sidecar 进程 | `focus-sync-sidecar` pid 264308，**启动时间 19:55:19**（正是本次冷启动之后） |
| 端口监听 | `127.0.0.1:37421` 处于 **Listen**（owner = 那个 sidecar 进程） |
| **Established 连接** | `127.0.0.1:37421` 有一条 **Established** —— 是扩展 worker 在跟它说话 |

> 第三条最有说服力：只有扩展**真的激活了**，worker 才会去连自己的 sidecar。sidecar 进程活着不等于扩展活着（可能是残留），但「有连接」说明数据在流动。

另外确认：**focus-sync 不用 shell API** —— 在它的 `dist/index.js` 里 `start_extension_command` / `run_extension_command` / `get_extension_binary_path` 命中数**都是 0**，它通过 HTTP 与 sidecar 通信。所以新增的 `shell` 门禁**不会**误伤它。

证据：`.superpowers/sdd/s4-installed-zoom.png`、`.superpowers/sdd/verify-binary-redownload.ps1` 的输出

### 9.6 验收 D：从市场装一个扩展（远程下载全链路）✅

为了把 `install.rs` 的下载路径也压到（注册表拉取只验了「取文本」，这条验的是「下二进制包」）：

- 在市场页搜 `Catppuccin` → 选 **Catppuccin Themes**（cos-overclock · v1.0.0）→ 点「安装」；
- 结果：20:18:48 下载并解包出**几百个文件**（`dist/*/icons/*.svg` 若干、`assets/preview*.png`、`package.json` 8562 字节），`extensions\cos-overclock.catppuccin-themes\` 目录建成；
- 扩展页「已安装」从「总计 1」变成「总计 2 / 已启用 2」，主题**当场生效**（UI 变紫）。

这条路径依次经过：`validate_remote_url` → `build_remote_http_client` → DNS resolver 公网判定 → 二进制体流式下载 + 大小上限 → sha256 完整性校验 → 解包 → 暂存目录 → 原子替换。**全程走新的 SSRF 守卫客户端。**

**⚠️ 选扩展时的坑**：**不能选 Clipboard History**。这台机器的 `extensions\sigma.clipboard\` 下**本来就有一份**（10/18 装的，但没登记进应用），从市场装它会覆盖，卸载时就会把用户原有那份删掉。挑一个「装前不存在」的扩展才安全。

**清理**：装完后用应用自己的「🗑 卸载」删掉。复核：

- 磁盘上 `extensions\cos-overclock.catppuccin-themes\` **已消失**；
- `user-extensions.json` 的 `installedExtensions` 只剩 `kizemo.focus-sync`；
- 主题自动还原成原来的配色；
- focus-sync 及其 sidecar 仍完好。

证据：`.superpowers/sdd/s11-zoom.png`、`.superpowers/sdd/s12-zoom.png`、`.superpowers/sdd/s13-zoom.png`

### 9.7 顺带复验：扩展连自己的 `127.0.0.1` 没被误伤 ✅

focus-sync 声明的 `http` 权限是 `http://127.0.0.1:37421` —— 也就是**访问本机**。这正是 SSRF 守卫要拦的东西，必须确认它没被拦住。

结论：**不受影响**。`src-tauri/src/extensions/extension_http.rs:29` 里扩展的 HTTP API **自己建了一个 reqwest 客户端**，既不是 `build_http_client()` 也不是 `build_remote_http_client()`。上游的 `45cedf89` 也没碰这个文件。

**这是一件需要盯住的事**：扩展的 HTTP 通道**至今没有** SSRF 防护（它靠 manifest 里的 host 白名单兜底）。上游也没加。本轮不扩这个范围，但值得记一笔（§10）。

### 9.8 证据文件

全部在 `.superpowers/sdd/`（git-ignored）：

| 文件 | 内容 |
|---|---|
| `s1-start.png` | 新功能弹窗（3.2.13-beta 中文更新日志） |
| `s3-extensions.png` | 市场页，注册表已从网络拉到 |
| `s4-installed-zoom.png` | 已安装页（Focus Sync v0.5.5，依赖项徽章） |
| `s5-hover-zoom.png` | 卡片上的四个动作按钮（↻ 重新安装 / ⚙ / 🗑 / 开关） |
| `s9-zoom.png` | 搜索 `Catppuccin` 的结果 |
| `s11-zoom.png` | 安装后的应用主界面（位置页） |
| `s12-zoom.png` | 已安装页：总计 2，Catppuccin Themes 在列，主题已生效 |
| `s13-zoom.png` | 卸载后：主题已还原 |

### 9.9 验收过程中顺手修掉的一个坏脚本

`.superpowers/sdd/hover-point.ps1` 里 `Layout.Explicit` 应为 `LayoutKind.Explicit`（两处），导致 `Add-Type` 编译失败、脚本整个不可用。已修（`hover-point.ps1` 是 git-ignored 的工具脚本，不进仓库）。

---

## 10. 遗留与建议

1. **上游 `2b8bed43` 里 `rename_part_files_to_ts` 仍然没有门禁** —— 本轮补的是本仓自己的。这条值得给上游提一个 issue / PR。
2. **上游其余 20 个提交**按上一轮的四类清单处理，B 类（需二次开发）里还有：e2e 数据隔离、Shift+方向键连选、删除前确认、窗口状态修复、仪表盘标签视图。
3. **上游 `e2e-webdriver/wdio.conf.js` 有 `SFM_E2E_DATA_DIR` 隔离**，本仓**没有** —— 我们的 e2e 直接在真实用户目录跑。这条是 B 类，需要二次开发。
4. **本仓的 17 个语言包没有上游那个自检测试**（`src/localization/__tests__/locale-json-format.test.ts`）—— 一行脚本就能补，属于 A 类但本轮没排上。
5. **FTP / FTPS 的写操作仍无真机验证**（真机只有 SFTP），承自上一轮。
6. **扩展自己的 HTTP 通道至今没有 SSRF 防护**。`extension_http.rs` 用的是自己建的 reqwest 客户端，只靠 manifest 里的 host 白名单兜底 —— 一个声明了 `http://127.0.0.1:*` 的扩展可以访问本机（focus-sync 就声明了 `http://127.0.0.1:37421`）。**上游也没加这一层**（`45cedf89` 没碰 `extension_http.rs`）。本轮不扩这个范围（会误伤 focus-sync 这类「连自己 sidecar」的正当用法），但要记一笔。

---

## 11. 踩到的坑（都已在 AGENTS.md / 记忆里有同源条目）

1. **上游的规则和本仓的改进会互相抵消**（本轮最关键的一处）。上游那条新规则要字符串字面量，本仓的剥除逻辑把字面量抹掉 —— 照单全收的话，规则等于没加；而且本仓原有的 `.constructor` 规则**本来就一直是死的**。**教训**：合并上游的安全补丁时，要逐条问「这条规则依赖输入里的什么」，别只比文件行数。
2. **`.cmd` 必须是纯 ASCII**（沿用既有约定，本轮新增的 `inject.cjs` / `patch-inject-*.mjs` 都是纯 ASCII 注释）。
3. **注入脚本必须无条件还原 + 逐字节校验**。本轮的 `inject.cjs` 在 `finally` 里还原并比对字节，中途被打断也不会留坏文件。
4. **`cargo test --lib` 的隐形红线**：被测试链接到的代码不能把 `tauri::AppHandle` 拖进来。上游把判定拆成 `require_extension_permission`（要 AppHandle）和 `require_extension_permission_in_dir`（不要）正是为了这个 —— **测试走后者**。本仓新增的 `require_extension_shell_permission_in_dir` 沿用了同一套拆法。
5. **`git checkout <sha> -- <file>` 会覆盖工作区改动** —— 取上游文件前先确认目标文件与上游修复前**逐字相同**，否则就会把本仓自己的改动一起冲掉。
6. **PowerShell 的 `-Encoding UTF8` 会写 BOM，`Get-Content -Raw` 按 ANSI 读会毁中文**。本轮所有源文件改动都用编辑工具，验证用 `node` 读。
