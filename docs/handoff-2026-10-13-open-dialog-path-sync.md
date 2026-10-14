# handoff: Open Dialog 路径同步 — 从 v0.5.10 回滚到 P1 探针

**项目**: Alpha File Manager (Tauri 子项目代号 Sigma File Manager)
**Tauri identifier**: `com.sigma-file-manager.app` (带 `.app` 后缀，受保护常量)
**sidecar 包名**: `com.sigma-file-manager.app.extensions.kizemo.focus-sync`
**当前 SPIKE_VERSION**: `0.5.10`
**Cargo 工具链**: `C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin\cargo.exe`
**报告时间**: 2026-10-13 21:14 (CST)

---

## 0. TL;DR（接任者第一段读完即可）

**核心矛盾**：3.0.3 安装包里的 sidecar **v0.5.11** 引入了 dedup 闪动 regression（已通过 v0.5.10 回滚修复）。回滚后又出现"无路径同步"现象，分两层独立 bug：
1. **stale-path gate** — Sigma FM 扩展的 worker 没在跑 `setInterval` 发 `/ext_alive` ping，导致 sidecar 60 秒后拒绝写入。**这是独立 bug**，与 Open dialog 机制无关。
2. **Open dialog 路径同步本身不工作** — 用户反馈"下载弹窗能同步，文件打开弹窗不能"。调查后确认：Save As / Download 对话框是 **WinUI 3 hosted Chromium**，address_band 是可写的 URL bar；File Open 对话框是 **Win32 IFileDialog**，address_band 是 shell COM toolbar。两者实现机制完全不同。

**已做（v0.5.11 → v0.5.10 回滚 + 全部诊断）**：方案 A 三处代码回滚（`state.rs` / `main.rs` / `http_server.rs`），81/81 单测绿，release binary 已部署到包路径 + AppData 路径，smoke test 验证 v0.5.10。

**下阶段**：执行 P1 探针（PowerShell 脚本已写好），验证 Open dialog 的 `AccessibleObjectFromWindow → IServiceProvider → QueryService(IFileOpenDialog)` COM 链可达。拿到接口 = P1 通过 → 进入 H3 fallback 实现。拿不到 = P1 失败 → 回退 P2（EnumChildWindows + SendMessage）或 P3（直接降级提示用户手动 Ctrl+L）。

---

## 1. 问题陈述

### 1.1 主问题

**File Open 对话框无法路径同步**，用户需要在文件打开弹窗里**手动** Ctrl+L 然后粘贴路径，才能让 dialog 跳到目标目录。

### 1.2 已修复（不再需要碰）

**v0.5.11 dedup 闪动 regression** — 用户最早报告"路径同步后出现闪动"现象。已通过 v0.5.10 全回滚修复：

- `state.rs` `should_opened_write_back` 回到 2-arg 形式（无第 4 子句）
- `main.rs` 调用点回到 `(initial_path, current_path)` 签名
- `http_server.rs` `SPIKE_VERSION` 改回 `"0.5.10"`，注释块记录 0.5.11 rollback event
- `cargo test --lib` 81/81 绿
- `cargo build --release` → spike.exe sha256 `36AC01042BE843402ED9851643F603F00CB1D5B2D8205A9697E94F95BA357E24`
- 包路径和 AppData 路径都部署了 v0.5.10 二进制
- smoke test `/health` 返回 `version=0.5.10`

**真机验证**：hwnd=5312578 (download dialog) 12:06:28 `v0.5.10 ROUTE shape=winui3-wrapped` → `Write strategy=uia target=F:\books` ✅

### 1.3 仍存在的 bug

#### 1.3.1 stale-path gate（独立 bug，独立修复方向）

**症状**：sidecar 日志报 `WriteFailed reason="extension_not_alive"`，所有 write 被 60 秒 stale-path gate 拒绝。

**真因**：Sigma FM 扩展的 `dist/index.js:432-512` 有 `checkHealth()` + `startHealthCheck()` 函数，本应每 15 秒发 `/ext_alive` ping。**实测 30+ 分钟 uptime 收到 0 个 ping**，意味着 `setInterval` 没在跑（或循环里抛错了）。

**manual ping 能恢复**：`curl http://localhost:37421/ext_alive` 后 `extension_alive=false→true`，60 秒后衰减回 false。

**这个 bug 跟 Open dialog 的 address_band 写路径无关**——它是路径同步的所有触发都被 gate 拦住了。**不在本 handoff 任务范围内**（独立修复需要查 Sigma FM 扩展 worker 为什么不跑 ping，但当前 handoff 专注路径同步本身）。

#### 1.3.2 Open dialog 路径同步不工作（本 handoff 目标）

**真机证据**：

| hwnd | 类型 | 现象 |
|---|---|---|
| 2556706 | File Open | image 1 — filename_edit 空，address_band 文本 CJK 解码乱码（"涓?浗"），无任何注入 |
| 6754446 | File Open | 12:09:50 log — `Read path="涓?浗"` → `WriteFailed extension_not_alive`（stale-path gate 拦截，不是 H1 失败）|
| 10555930 | Download (Save As) | image 2 — filename_edit "abc"（用户输入），address_band `此电脑 > 数据(F:) > books`，H1 写 address_band + Enter 成功 ✅ |
| 5312578 | Download (Save As) | 12:06:28 log — `v0.5.10 ROUTE shape=winui3-wrapped` → `Write strategy=uia target=F:\books` ✅ |

**用户实测结论（2026-10-13 21:11 反馈）**：「filename_edit 输入路径是无效的，必须实现在 address_band 成功切换路径。」

---

## 2. 机制差异：Open dialog vs Save As / Download dialog

**这两类对话框在 Windows 里不是同一个东西**，不能套用同一个写路径方案。

| 维度 | Save As / Download | File Open（浏览/导入）|
|---|---|---|
| **实现栈** | WinUI 3 hosted **Chromium 浏览器对话框** | Win32 native `IFileDialog` COM 接口 |
| **触发者** | Edge 下载、Edge Save As、Chrome 下载 | 几乎所有「打开」「浏览」「导入」按钮 |
| **address_bar 是谁** | Chromium URL bar widget（**真正的 Edit 控件**） | Shell COM `Address Band`（**toolbar 显示**当前路径，不是输入框）|
| **Ctrl+L** | ✅ Chromium 标准快捷键，把焦点搬到 URL bar | ❌ 没有标准绑定，shell toolbar 不响应 |
| **SetValue(ValuePattern) 可行** | ✅ Chromium URL bar 暴露 ValuePattern | ❌ ToolbarWindow32 无 ValuePattern（uia 树里 aid=1001 class=ToolbarWindow32 name='地址: <当前目录>'）|
| **SetFolder COM API** | N/A（Chromium 自己管）| ✅ `IFileDialog::SetFolder(IShellItem)` 是 Microsoft 官方支持的路径 |

### 2.1 真机 UIA 树对比

**Open dialog (hwnd=2556706 那棵，135 节点)**：

```
aid='1148' class='ComboBoxEx32'              → 文件名框
aid='1090' class='Static' name='文件名(N):'   → 文件名标签
aid='41477' class='Address Band Root'        → 地址栏的容器（shell band COM object）
aid='1001' class='ToolbarWindow32' name='地址: <当前目录>'  ← 注意：这里的 1001 是地址栏本体，但它是 Toolbar 不是 Edit
```

**Save As / Download dialog (hwnd=10555930 那棵)**：

```
aid='FileNameControlHost' 或 '50003'  → WinUI 3 Pane 容器
aid='1148' class='ComboBoxEx32'        → 文件名框
aid='41477' class='Address Band Root'  ← 但这里是 Chromium hosted Edit，能 SetValue + Enter
```

**关键差异**：同样的 aid `41477` 名字都是 `Address Band Root`，**但内部实现完全不一样**——Open dialog 的是 shell COM band，Save As 的是 Chromium widget。class name 表面看一样，**实现栈完全两个世界**。

### 2.2 H1 在 Open dialog 里的失败链（uia_inject.rs:525-850）

| H1 子步骤 | Save As / Download | File Open |
|---|---|---|
| `await_dialog_foreground` | ✅ | ✅ |
| `SendInput Ctrl+L` | ✅ Chromium 焦点跳转 | ❌ shell toolbar 不响应 |
| `foreground_focus_element()` + SetValue (DIRECT-1) | ✅ 拿到 Chromium URL bar Edit | ❌ 拿到 ToolbarWindow32，无 ValuePattern |
| 键盘路径（End + Backspace + 字符输入） | ✅ Chromium URL bar 接受键盘 | ❌ toolbar 不消费键盘 |
| `path_landed_in_filename` 验证 | filename_edit 没动 → 通过 | filename edit 没动 → 通过（因为根本没输入进去）|
| 发 Enter 提交 | ✅ navigation | ❌ Enter 在 toolbar 焦点上无 navigation 语义 |

H1 在 Open dialog 里 DIRECT-1 步骤直接 return false，fall through 到 H2 → H2 写 filename_edit 无效（用户实测证实）→ 路径不同步。

---

## 3. 方案决策留档

### 3.1 评估过的方案（全部否决）

| 方案 | 思路 | 否决理由 |
|---|---|---|
| A1 全文删除 H2/F3 | H1 失败就硬失败 | H1 失败时路径完全不同步，无 fallback |
| A2 调用前守卫「filename_edit 空才走 H2/F3」 | 最小改动 | 用户实测：filename_edit 写路径在 Open dialog 完全无效 |
| A3 H1 失败时阻塞重试 | 增加复杂度 | 副作用不可知 |
| A4 H2/F3 改目标到 address_band (41477) | 把 fallback 也指 address_band | address_band 在 Open dialog 无 ValuePattern（实测），新链路无证据 |
| A5 skip restore 让污染永久 | 去掉 restore_filename_verified | 比 A1 还差，破坏 v0.5.8 BUG-2 fix |
| A6 H1 失败 → filename_edit + Enter | 用户最新反馈 | 用户实测：filename_edit 写路径无效，必须走 address_band |

### 3.2 用户最终约束（2026-10-13 21:11 反馈）

- **必须走 address_band 成功切换路径**
- filename_edit 写路径无论 filename_edit 是否为空都不接受
- 与 spike 上游设计（spike 写 filename_edit）方向不同：spike 的方案对 Open dialog 也不生效，spike 没有 address_band 写路径

### 3.3 下阶段三条路径（按推荐度排序）

#### 路径 P1：COM `IFileDialog::SetFolder(BSTR)` — 正路

**思路**：传统 Open dialog 实现完整 `IFileDialog` COM 接口，有 `SetFolder(IShellItem)` 方法直接切目录。是 Microsoft 官方支持的、shell 内部路径。

**COM 链路**：
```
Open dialog hwnd
  ↓ AccessibleObjectFromWindow 拿 IAccessible
  ↓ IAccessible::QueryInterface 拿 IServiceProvider
  ↓ IServiceProvider::QueryService(SID_STopLevelBrowser) 拿 IShellBrowser
  ↓ 或者：QueryService(IID_IFileOpenDialog) 直接拿 IFileDialog（如果 dialog 暴露）
```

**实现工作量**（在 uia_inject.rs 新增 H3 fallback）：
- COM 接口声明（IFileDialog、IShellItem、IFileOpenDialog）~80 行
- SHCreateItemFromParsingName 把 `F:\books` 包成 `IShellItem` ~20 行
- SetFolder 调用 + verify navigation ~30 行
- 单测：mock COM 接口，验证 H3 调用序列

**风险**：
- COM 接口链每一步都可能失败（hr != 0）
- `SetFolder` 在 dialog 已经显示后调用是否被接受——某些 IFileDialog 实现要求 Show 之前设置
- 副作用：`SetFolder` 会清除用户的当前选择

**判据**：P1 探针先验证 `AccessibleObjectFromWindow → IServiceProvider → QueryService(IFileOpenDialog)` 链可达，拿到非 NULL ppv 就算 P1 通过。

#### 路径 P2：模拟用户操作 —— 笨但有效

**思路**：Open dialog 的 toolbar 内部其实有一个 Edit 子控件接受路径输入（用户在文件对话框里手输地址的入口），但**不通过 UIA ValuePattern 暴露**，通过 `EnumChildWindows` + `GetClassNameW` 能找到。

**流程**：
1. `EnumChildWindows(dialog_hwnd)` 找到 class='Edit' 且不在 filename 区域的子窗口
2. `SetFocus` 到那个 Edit
3. `SendMessageW WM_SETTEXT` 设路径
4. `SendMessageW WM_KEYDOWN VK_RETURN` 提交

**风险**：
- EnumChildWindows 可能找到多个 Edit（filename_edit 也是 Edit），需要按位置/父窗口区分
- shell toolbar 内的 Edit 子窗口句柄是动态的
- 真机实测能否 SetText + Enter 触发 navigation 未测过

#### 路径 P3：直接降级 —— 最稳

**思路**：检测到 Open dialog 是 classic_shell 形态时，**直接告诉用户「此 dialog 不支持 path sync，请手动 Ctrl+L」**。工程上最稳。

**实现**：
- 在 `is_classic_shell_signature` 命中且 H1 失败的 case，记 warn + 触发扩展端的 UI 提示
- 工作量：~20 行

---

## 4. P1 探针任务（接任者首要任务）

### 4.1 探针脚本

**路径**：`F:/soft/00selfmade/filemanager/_acceptance/p1-probe-ifiledialog.ps1`（已写好，8916 bytes）

**执行方式**（必须 STA）：
```powershell
powershell.exe -STA -ExecutionPolicy Bypass -File F:/soft/00selfmade/filemanager/_acceptance/p1-probe-ifiledialog.ps1
```

### 4.2 探针设计

脚本做 4 步：

1. **Step 1**: 启动 `notepad.exe` → 等 1.5 秒 → Ctrl+O 触发 Open dialog
2. **Step 2**: `EnumWindows` 找 class=`#32770` 且 title 包含 `打开/Open/Save/保存/另存为` 的窗口
3. **Step 3**: `AccessibleObjectFromWindow(dialog_hwnd, 0, IID_IServiceProvider, out ppv)` 拿 IServiceProvider
4. **Step 4**: 读 IServiceProvider vtable slot 3 = `QueryService` 函数指针 → 直接 stdcall 调 `QueryService(IID_IFileOpenDialog)` → 拿非 NULL ppv

### 4.3 退出码

| 退出码 | 含义 | 后续 |
|---|---|---|
| 0 | PASS：Open dialog 暴露 IFileOpenDialog COM 接口 | 进入 P1 实现（H3 fallback 写 uia_inject.rs）|
| 1 | 找不到 Open dialog（notepad Ctrl+O 没生效）| 重试 / 换测试程序 |
| 2 | AccessibleObjectFromWindow 失败 | 回退 P2 |
| 3 | QueryService 拿不到 IFileOpenDialog | 回退 P2 |

### 4.4 真机环境注意

- **必须 STA PowerShell**（COM apartment 要求）。`GetApartmentState()` 必须在脚本开头检查。
- `notepad.exe` 是稳定测试目标（Win11 自带，Ctrl+O 必触发 Open dialog）
- 如果 notepad 已被禁用或不在 PATH，探针会因找不到 dialog 退出 1
- 探针**不调用 SetFolder**，只验证 COM 接口可拿（避免污染 notepad 状态）

---

## 5. 关键技术细节（接任者需要知道的）

### 5.1 项目根目录

```
F:/soft/00selfmade/filemanager/
├── sigma-file-manager/                     # Tauri 项目根
│   ├── extensions/kizemo.focus-sync/       # 扩展
│   │   ├── sidecar/                        # Rust sidecar 源码
│   │   │   ├── src/
│   │   │   │   ├── uia_inject.rs          # 注入主路径（H1/H2/F3）
│   │   │   │   ├── state.rs                # should_opened_write_back (v0.5.10 形式)
│   │   │   │   ├── main.rs                 # Opened 事件处理
│   │   │   │   ├── http_server.rs          # SPIKE_VERSION = "0.5.10"
│   │   │   │   ├── writer.rs               # stale-path gate
│   │   │   │   └── reader.rs               # read_path
│   │   │   └── Cargo.toml
│   │   └── dist/index.js                    # Sigma FM 扩展（stale-path gate 是这里不 ping）
│   ├── docs/                                # handoff 文档
│   └── AGENTS.md                            # 项目硬约束
└── _acceptance/                             # 探针/验证脚本
    ├── pathwrap-original-dialog.rs          # PathWrap 上游 dialog.rs 解码
    ├── pathwrap-monitor.rs                  # PathWrap 上游 monitor.rs (jsdelivr CDN 拉)
    ├── pathwrap-window-ext.rs               # PathWrap 上游 window_ext.rs
    ├── pathwrap-explorer.rs                 # PathWrap 上游 explorer.rs
    └── p1-probe-ifiledialog.ps1             # 本任务探针
```

### 5.2 关键函数位置（uia_inject.rs）

| 函数 | 行 | 职责 |
|---|---|---|
| `try_send_path_via_sendinput` (H1) | 525 | Ctrl+L + DIRECT-1 SetValue address_band + 键盘 fallback |
| `try_h2_restore_filename` (H2) | 880 | SetValue filename_edit + 50ms + restore（v0.5.10 已有 original_filename 空守卫）|
| `inject_via_uia` | 1157 | 主路径，调用 H1 → H2 → F3 |
| F3 段（v0.5.0 baseline）| 1290-1382 | 同 H2 语义，最终 fallback |
| `compute_score_for_automation_id` | 1428 | 1148=100, 1001=90, 41477 故意排除 |
| `is_winui3_wrapped_signature` | 934 | has_filename_host && has_1001 |
| `is_classic_shell_signature` | 973 | has_1148 && has_address_band |

### 5.3 真机部署状态

- **包路径二进制**：`extensions/kizemo.focus-sync/bin/focus-sync-sidecar/focus-sync-sidecar.exe`，sha256 `36AC0104…`
- **AppData 路径二进制**：`C:\Users\Duanyi\AppData\Roaming\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe`，sha256 同上
- **计划任务**：`\KizemoFocusSync`，port 37421
- **日志路径**：`%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log`（JSON 事件） + `spike.log.YYYY-MM-DD`（tracing 格式）

### 5.4 受保护常量（绝不可改）

- Tauri `identifier = com.sigma-file-manager.app`（**带 `.app` 后缀**）
- mDNS service name
- legacy data dir name `com.sigma-file-manager.app`
- 17 个 locale 包的中文 locale code = `ch`（不是 `zh`）
- Rust 工具链 1.90.0
- 不增加新依赖

### 5.5 PathWrap 上游事实（避免重复调查）

通过 jsdelivr CDN 镜像（`https://cdn.jsdelivr.net/gh/inaku-Gyan/PathWrap@main/src/os/`）拉了全部 4 个源文件。**spike 上游没有任何 address_band 写路径**：

| 文件 | 行数 | 写路径？ |
|---|---|---|
| `dialog.rs` (177 行) | 唯一注入路径，用 `SetValue` 写 filename_edit (1148/1001) + `Invoke` 按钮 | ❌ 无 address_band |
| `monitor.rs` (399 行) | WinEvent hook + 对话框检测（`#32770` + title + 子控件结构）| ❌ 无注入 |
| `window_ext.rs` (153 行) | 窗口样式辅助（NOACTIVATE/dock/park）| ❌ 无关 |
| `explorer.rs` (57 行) | IShellWindows 枚举资源管理器 | ❌ 无关 |

**结论**：用户最初假设「spike 上游有 address_band 写路径」不成立。spike 自身在 Open dialog 上也不工作（写 filename_edit 是它的方案），我们必须自研。

### 5.6 不要做的事

- **不要发版** (`npm run release:*`) — 用户明确说「先不用发版」
- **不要改 stale-path gate** — 独立 bug，不在本任务范围
- **不要回滚 v0.5.10** — 已修复的 regression 不要重新引入
- **不要动 PathWrap 上游** — 我们是 port，不是维护者
- **不要在 dev 构建上做 UI 验收** — `tauri dev` 下所有路由页面的内容区都空白（与代码无关，dev 构建特性）。真机验证必须用 `tauri build` 打包产物
- **不要重复 PathWrap 上游调查** — 已完成
- **不要在探针脚本里调 SetFolder** — 探针只验证接口可达，副作用留给实现阶段处理
- **不要把 COM 接口声明放到 spike 源码里** — 探针是 PowerShell 验证用，实现阶段才进 Rust

---

## 6. 引用资料

### 6.1 之前 handoff

- `F:/soft/00selfmade/filemanager/sigma-file-manager/docs/handoff-2026-10-13-kill-chain-and-flicker-regression.md` — v0.5.11 dedup 闪动 regression 详细报告（309 行）
- `F:/soft/00selfmade/filemanager/sigma-file-manager/docs/handoff-2026-10-13-followup-requirements-pack.md` — 5 节需求包
- `F:/soft/00selfmade/filemanager/sigma-file-manager/AGENTS.md` — 项目硬约束

### 6.2 PathWrap 上游源（已下载到本地）

- `F:/soft/00selfmade/filemanager/_acceptance/pathwrap-original-dialog.rs`
- `F:/soft/00selfmade/filemanager/_acceptance/pathwrap-monitor.rs`
- `F:/soft/00selfmade/filemanager/_acceptance/pathwrap-window-ext.rs`
- `F:/soft/00selfmade/filemanager/_acceptance/pathwrap-explorer.rs`

上游仓库：`https://github.com/inaku-Gyan/PathWrap`
jsdelivr CDN：`https://cdn.jsdelivr.net/gh/inaku-Gyan/PathWrap@main/`
原始 GitHub raw 在本机网络不可达，必须走 jsdelivr。

### 6.3 P1 探针脚本

- `F:/soft/00selfmade/filemanager/_acceptance/p1-probe-ifiledialog.ps1`（已写好）

### 6.4 COM API 参考（实现阶段）

- `IFileDialog` GUID: `{84bccd23-5fde-4cdb-aea4-af64b83d78ab}`
- `IFileOpenDialog` GUID: `{d57c7288-d4ad-4768-be02-9d969532d960}`
- `IShellItem` GUID: `{43826d1e-e718-42ee-bc55-a1e261c37fde}`
- `IServiceProvider` GUID: `{6d5140c1-7436-11ce-8034-00aa006009fa}`
- `AccessibleObjectFromWindow` in `oleacc.dll`，签名：`(HWND hwnd, DWORD dwId, REFIID riid, void** ppvObject) → HRESULT`
- `SHCreateItemFromParsingName` in `shell32.dll`，签名：`(PCWSTR pszPath, IBindCtx* pbc, REFIID riid, void** ppv) → HRESULT`
- `IFileDialog::SetFolder(IShellItem psi) → HRESULT` — `SetFolder` 接收 `IShellItem` 不是 `BSTR`，需要 `SHCreateItemFromParsingName` 先构造
- `IFileDialog::GetFolder(IShellItem** ppsi) → HRESULT` — 实现后可调 `GetFolder` 验证是否真的切了

---

## 7. 验收判据（接任者完成 P1 探针后）

### 7.1 探针 PASS 后的下一步

如果 P1 探针拿到 `IFileOpenDialog` 接口，下一步是**实现 H3 fallback**（不是本 handoff 范围，但路线已定）：

1. 在 `uia_inject.rs` 新增 `try_h3_setfolder_com(dialog_hwnd, target_path) -> bool`
2. COM 接口声明（用 `windows` crate 的 `IFileDialog` 等接口）
3. 调用 `SHCreateItemFromParsingName(target_path)` 构造 `IShellItem`
4. 调 `IFileDialog::SetFolder(IShellItem)`
5. 调 `IFileDialog::GetFolder` verify navigation
6. 在 `inject_via_uia` 第 4 层 fallback 链里加上 H3
7. 单测 + 真机验证

### 7.2 探针 FAIL 后的回退

| 失败步骤 | 退到 P2 还是 P3 |
|---|---|
| Step 2 (找不到 dialog) | 重试确认 Ctrl+O 是否生效 |
| Step 3 (AccessibleObjectFromWindow 失败) | **回退 P2**（COM 链完全不通）|
| Step 4 (QueryService 失败) | **回退 P2**（dialog 暴露 IServiceProvider 但拒绝 IFileOpenDialog）|

P2 实现细节（不是本 handoff 范围）：
- `EnumChildWindows(dialog_hwnd)` + `GetClassNameW` 找 toolbar 内的 Edit 子窗口
- 与 filename_edit (1148/1001) 区分（按父窗口链 / 位置）
- `SetFocus` + `SendMessageW(WM_SETTEXT)` + `SendMessageW(WM_KEYDOWN VK_RETURN)`

P3 实现细节（不是本 handoff 范围）：
- 在 `is_classic_shell_signature` 命中且 H1 失败的 case，记 warn
- 触发扩展端的 UI 提示（具体通道待定：mDNS / WebSocket / 文件）

---

## 8. 总结

**本 handoff 的本质**：从 v0.5.11 regression 回滚的"修复 dedup"任务，已经升级为"理解 Windows file dialog 机制差异"+"自研 COM SetFolder fallback"的新任务。回滚是必要的，但**不够**——dedup 修复让 download 对话框恢复，但 Open 对话框因为实现栈不同，H1+H2 都不能工作，必须新加 H3（COM SetFolder）才能补齐。

**接任者首要动作**：跑 P1 探针（30 秒），根据退出码决定进 P1 实现 / P2 / P3。
