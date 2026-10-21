# 交接文档：长按拖出时不把窗口拉到最前层（2026-10-21）

## 0. 本轮范围

**需求**：长按 AFM 里的文件/目录时，不要把 AFM 激活到最前层，
这样才能把文件拖到微信/钉钉/浏览器里去。

**用户补充建议**（不改变方向）：研究 Windows 资源管理器、Directory Opus
等其他文件管理器的「长按不激活前台」是怎么实现的，看能不能降低开发难度。

**结论**：研究做了（§2），**但结论是公共 API 复制不了** —— 资源管理器
根本没有 `WS_EX_NOACTIVATE`，它靠 shell 私有实现。我们能用的公共手段
只有 `WS_EX_NOACTIVATE` + 自己做激活管理，复杂度降不下来。

**交付状态**：代码完成、门禁全绿、打包版装机、**真机验收三个场景全过**。

---

## 1. 最终实现

| 层 | 文件 | 做什么 |
|---|---|---|
| Rust | `src-tauri/src/drag_no_activate.rs` | 顶层窗口子类；按需挂/摘 `WS_EX_NOACTIVATE`；自管激活；左键状态查询；拖拽目标捕获/前台归还；诊断探针 |
| 前端 | `src/utils/drag-no-activate.ts` | 申请/撤销抑制；补焦点；左键状态查询；长按判定策略；拖拽目标捕获/前台归还；诊断探针 |
| 前端 | `.../use-file-browser-drag.ts` | 长按计时器 + 到点复核 + 抬手看门狗 + 出站拖拽触发 + 抑制申请 |
| 前端 | `src/composables/use-init.ts` | 装 window 级抬手补焦点兜底（只装主窗口） |

新增的 6 个 Tauri 命令：

| 命令 | 作用 |
|---|---|
| `set_drag_no_activate` / `clear_drag_no_activate` | 申请 / 撤销抑制 |
| `focus_main_window` | 把主窗口拉到前台（回读 `GetForegroundWindow` 验证） |
| `drag_no_activate_status` | 探针：抑制机制当前状态 |
| `left_mouse_button_down` | 左键现在还按着吗（`GetAsyncKeyState`） |
| `drag_no_activate_trace` | 诊断探针：把前端事件写进应用日志 |
| `capture_outbound_drag_target` / `restore_outbound_drag_foreground` | 拖拽前记下目标窗口 / 拖拽后把前台还给目标 |

---

## 2. 机制调研（全部真机实测，不是推测）

### 2.1 第一版实现物理上不可能生效

第一版按「子类化 WebView2 渲染窗口 + 拦 `WM_MOUSEACTIVATE`」设计。
**实测证明这条路走不通**：

- `WindowFromPoint` 实测：光标落在文件行上，命中的窗口是
  `Chrome_RenderWidgetHostHWND`，它属于 **`msedgewebview2.exe`（另一个进程）**；
- 跨进程改窗口过程：`SetWindowLongPtrW(render, GWLP_WNDPROC, cls)`
  返回 0，`lasterror = 5 (ERROR_ACCESS_DENIED)` —— **被系统拒绝**；
- 旧代码里 `install_subclass` 的 `previous == 0` 分支把它**静默跳过了**，
  钩子从来没装上，所以抑制从未生效。

顺带纠正一个假探针：`GetWindowLongPtr(GWLP_WNDPROC)` 对**所有**窗口都返回 0
（`GCLP_WNDPROC` 才能正常读），**读不出来不代表没装**。

### 2.2 激活决策看的是顶层窗口

MSDN（`WM_MOUSEACTIVATE`）：`wParam` 是「**要激活的窗口的顶级父窗口句柄**」。
命中窗口在别的进程够不着，但顶层窗口是我们自己的。

逐层实测（同一份已装版本上直接改各层样式，再点后台的 AFM）：

| `WS_EX_NOACTIVATE` 挂在哪 | 手势期间的前台窗口 | 结论 |
|---|---|---|
| 不挂（基线） | AFM | 抢前台 |
| 命中窗口 `Chrome_RenderWidgetHostHWND` | AFM | **无效** |
| `Chrome_WidgetWin_1`（浏览器进程） | AFM | **无效** |
| `Chrome_WidgetWin_0`（本进程） | AFM | **无效** |
| `WRY_WEBVIEW`（本进程） | AFM | **无效** |
| **Tauri 顶层窗口** | 资源管理器 | **有效** |

同时也证明 `WM_MOUSEACTIVATE` **不从 Chromium 那一层向上传递**，
所以「在顶层窗口的窗口过程里返回 `MA_NOACTIVATE`」同样走不通。

### 2.3 参照物：资源管理器怎么做的（用户建议项）

本机资源管理器（`explorer.exe` / `CabinetWClass`）实测：

- 顶层窗口 exstyle = `0x100`（`WS_EX_ACCEPTFILES`），**没有** `WS_EX_NOACTIVATE`；
- 文件列表 `DirectUIHWND` exstyle = `0x0`，也没有；
- 但按住文件行时前台**始终不是**资源管理器（8 次采样全为 0），抬手后才轮到它。

**结论**：资源管理器确实做到了「按住不抢前台」，但用的是 shell 私有实现，
公共 Win32 API 复制不了。我们能用的公共手段就是
`WS_EX_NOACTIVATE` + 自管激活，**这条路已经是成本最低的**。

### 2.4 抑制激活的代价：抬手可能被吞

挂上 `WS_EX_NOACTIVATE` 之后抑制确实生效，但**代价是 DOM 可能收不到抬手**
（Chromium 对未激活窗口有 click-to-activate，抬手被浏览器进程吃掉）。
一旦收不到，两件事会悬空：

| 现象 | 后果 |
|---|---|
| DOM 收不到 `mouseup` | 长按计时器（400ms）没人取消 → **误起一次系统级出站拖拽** |
| 同上 | 「鼠标还按着」的脏状态留着 → 下次移动鼠标**拖出幽灵的内建拖拽会话** |
| 同上 | 抬手补焦点的兜底监听器不触发 → 普通点击拿不回键盘焦点 |

第一个后果最危险：误起的那次拖拽，抬手早已落在别的应用上，
`DoDragDrop` 拿着**已经松开的鼠标**干等，界面会被卡住。

**而且这件事没法靠日志判断。** 原先 `focus_main_window` 在「已经是前台」时
**静默早返回**，于是日志里一条 `focus_main_window` 都没有，既可能是
「DOM 根本没收到抬手」，也可能是「收到了，只是那时窗口已被 Chromium 自己激活」——
两种情况长得一模一样。现在补了 `already foreground` 日志，这条歧义才消除。

**解法：绕开 DOM，直接问系统「左键还按着吗」。**
`GetAsyncKeyState(VK_LBUTTON)` 的高位就是按键当前状态，不受 Chromium 那层行为影响。

- **抬手看门狗**：按下后每 30ms 问一次，发现按钮已松开就收状态；
- **到点复核**：400ms 到点时**再问一次**，按钮已松开就判定为普通点击，不起拖拽。
  问不到（命令不可用）时按「还按着」处理 —— 宁可保持旧行为，也不要让长按拖不出去。

### 2.5 OLE 拖拽结束会激活拖拽源窗口

长按手势本身完全达标（连续 30 次采样、每次 100ms，全程前台都是目标程序），
但**松手的那一刻**前台变成了 AFM：

```
抬手前：13699544, 13699544, ... （30 个采样全是资源管理器）
抬手后：42600852, 42600852, ... （20 个采样全是 AFM）
```

原因是 OLE 的收尾行为：**拖拽结束时系统会把拖拽源窗口激活**。
这意味着「文件是拖进去了，但刚放下的那个程序又被 AFM 盖住了」——
正是这个功能要消灭的那件事，只是延后到了放下之后。

**解法**：拖拽开始时记下当时的前台窗口（那就是拖拽目标），
拖拽结束后检查——**只有当自己确实占了前台时**才把前台还回去。

- 用户拖完已经切走 → 前台不是我们 → 什么都不做，绝不抢；
- 拖拽被 Esc 取消 → 前台还是目标程序 → 本来就没事；
- 正常放下 → 系统激活了我们 → 还给目标程序。

还原由后端一个短命线程完成（复查 6 次、每次间隔 50ms）：
激活落地的时刻比拖拽结束略晚，只查一次会漏掉。

---

## 3. 真机验收（打包版 3.2.16-beta）

**产物**：`release\Alpha File Manager_3.2.16-beta_x64-setup.exe`
20,380,132 字节，SHA256 `7C93C80794A0FC11EF59562CA9F81BE3A0BC66CC7CC005548E3F975F7F43C338`
装机后 `D:\Program Files\Alpha File Manager\alpha-file-manager.exe`
55,333,888 字节，SHA256 `A911BB03762B4B131835B59D6E5FFD4C43399370F7D8168E73849675AF2D0341`

**验收脚本**：`.superpowers\sdd\drag-lab.ps1`
（`-Mode Control|Hold|QuickClick|Layout|ExplorerHold`）
判据一律读 `GetForegroundWindow()` 的句柄 + 应用日志，不靠截图肉眼。

| 场景 | 判据 | 结果 |
|---|---|---|
| **Control** 普通点击后台 AFM | AFM 必须跳到前台（阳性对照，证明注入到位） | **PASS** |
| **QuickClick** 快速点击 | 不许误起出站拖拽；UI 线程不许卡死；窗口仍要跳到前台 | **PASS** |
| **Hold** 长按拖到资源管理器 | 手势期间前台一直是资源管理器；文件落盘；放完把前台还给目标 | **PASS** |

**Control 的日志**（普通点击，行为不变）：

```
06:26:14 trace dom-mousedown
06:26:14 focus_main_window ok (plain)      ← 我们自己把窗口拉回前台
06:26:14 trace dom-mouseup
（无 longpress-fired）
```

**QuickClick 的日志**（关键新增判据）：

```
06:26:36 trace dom-mousedown
06:26:36 trace dom-mouseup
06:26:36 focus_main_window ok (plain)
UI thread responsive       = True          ← SendMessageTimeout(WM_NULL) 有应答
（无 longpress-fired；落盘目录仍为空）
```

**Hold 的日志**（长按拖出）：

```
06:25:40 trace dom-mousedown
06:25:41 trace longpress-check down=true
06:25:41 trace longpress-fired            ← 长按拖拽确实起了
06:25:41 captured outbound drag target HWND(0xf60216)
06:25:44 restore outbound drag foreground -> true   ← 放完把前台还给目标
06:25:44 WM_ACTIVATE state=0              ← AFM 退回后台
```

前台采样：拖拽全程 30 次（间隔 100ms）**全是资源管理器**；
落盘证据：目标目录里出现 `a-alpha.txt`（16 字节）。

**用户手工验证**：用户 2026-10-21 自行手动测试，确认
「拖动不激活管理器到前台，已经成功」。

### 3.1 验收过程中修掉的两个**脚本**缺陷（不是产品缺陷）

1. **截图耗时超过 400ms**：原先 `Save-Shot` 在抬手之前，全屏 3840×2160
   抓图 + 存 PNG 要 1 秒多，鼠标一直按着 → 「普通点击」被当成了长按
   （日志里出现 `longpress-fired`）。改成**抬手之后再截图**。
2. **采样有缺口**：原先只采手势的前 900ms，移动和等待阶段没采，
   正好把「激活落在哪一刻」这件事盖住了。改成**全程连续采样**。

### 3.2 验收环境的清理

- `user-workspaces.json` 的 `currentTabGroupIndex` 已复原为原值；
- 上一轮验收留下的测试标签组（指向 `C:/Users/Duanyi/afm-select-fixture`）
  已删除，标签组回到用户真实的 4 个；
- 三个测试夹具目录（`afm-select-fixture` / `afm-drag-src` / `afm-drop-target`）
  已移入回收站（可恢复）。

---

## 4. 门禁

| 门禁 | 结果 | 口径 |
|---|---|---|
| `cargo test --lib` | **702 passed / 0 failed** | 基线 700 + 新增 2 |
| `npx vitest run` | **229 文件 / 2027 用例** 全绿 | 基线 2016 + 新增 11 |
| `npx eslint src` | **170 errors / 0 warnings** | 与基线**逐字**一致 |
| `npx vue-tsc --build` | **0** | — |

新增单测：

- `src/utils/__tests__/drag-no-activate.test.ts`（7 例）
  —— 补焦点兜底、按键状态查询、诊断探针、长按判定策略、拖拽目标捕获/归还；
- `.../__tests__/use-file-browser-drag-long-press.test.ts`（15 例）
  —— 长按起拖拽、指针动过不算长按、内建拖拽回归、
  **「DOM 收不到抬手」这组**（不误起拖拽 / 不拖出幽灵会话 / 仍然补焦点 /
  DOM 收到抬手时不重复补焦点）、出站拖拽收尾（记目标 → 拖完还前台）。

### 4.1 `cargo test --lib` 的隐形红线（这次踩到了但没踩坏）

AGENTS.md 记着：测试二进制链接到的代码不能碰 `tauri::AppHandle` /
`tauri::async_runtime::*`，否则会把 tao 拖进来、测试二进制在**加载阶段**
以 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉。

本轮新增的后台还原线程用的是 `std::thread::spawn` + 原子量 + user32，
**不碰 Tauri 运行时**。实测 `cargo test --lib` 702 全过，测试二进制正常加载。

---

## 5. 提交与回退

| 节点 | 说明 |
|---|---|
| `a5eb188c` | 上一轮：上游背景混合模式分支（任务一） |
| 本轮提交 | 任务二的全部改动（见 §1） |
| 回退 | `git revert <本轮提交>` 或 `git reset --hard a5eb188c` |

**未推送**：`main` 领先 `origin/main` 两个提交。用户此前明确选择「暂不发布」，
沿用同一惯例 —— 提交保留在本地，推送等用户发话。

---

## 6. 留给后续的几件事

1. **诊断探针可以保留**。`drag_no_activate_trace` 让「DOM 到底收没收到抬手」
   这类问题在真机上有硬证据，不必再靠猜。发布版拿不到 webview console
   （wry 不透传 CDP），日志是唯一可用的读数来源。
2. **`left_mouse_button_down` 走的是系统按键状态**，理论上比 DOM 更可靠，
   但它是**物理状态**：如果用户按住左键的同时点了别处，判定会认为「还按着」。
   当前只在长按窗口（400ms）内使用，影响面很小。
3. **拖拽结束的前台归还是尽力而为**。OLE 的激活落地时刻比拖拽结束略晚，
   还原线程复查 6 次 × 50ms。如果某些环境下激活落地更晚，可能还回不去 ——
   表现是「放下后 AFM 短暂盖住目标程序」，不影响拖拽本身。
4. **抑制只挂在顶层窗口**，而顶层窗口的 `WS_EX_NOACTIVATE` 挡不住
   Chromium 自己的 click-to-activate（按下瞬间仍会收到 `WM_ACTIVATE state=2`）。
   真前台并没有立刻切过去（实测手势期间前台一直是目标程序），所以不影响效果；
   但如果哪天出现「按下就跳前台」的回归，第一嫌疑就是这条。

---

## 7. 涉及文件

**新增**

- `src-tauri/src/drag_no_activate.rs`
- `src/utils/drag-no-activate.ts`
- `src/utils/__tests__/drag-no-activate.test.ts`
- `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-drag-long-press.test.ts`
- `docs/plan-2026-10-21-long-press-drag-out.md`（方案与机制调研）
- `docs/handoff-2026-10-21-long-press-drag-out.md`（本文）

**修改**

- `src-tauri/src/lib.rs` —— 注册模块、启动时安装子类、注册 8 个命令
- `src/modules/navigator/components/file-browser/composables/use-file-browser-drag.ts`
- `src/modules/navigator/components/file-browser/composables/use-file-browser-drag-session.ts`
- `src/composables/use-init.ts`
- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` /
  `src-tauri/default-file-manager-common/Cargo.toml` /
  `src-tauri/default-file-manager-launcher/Cargo.toml` —— 版本 3.2.16-beta
- `CHANGELOG.md` / `public/changelog/ch/changelog.md` —— 中英文更新日志

**验收脚本（`.superpowers/sdd/`，不进版本库）**

- `drag-lab.ps1` —— 主验收脚本（Control / Hold / QuickClick / Layout / ExplorerHold）
- `prepare-drag-lab.ps1` —— 验收环境准备与复原
- `probe-window-chain.ps1` / `probe-xproc-style.ps1` —— 窗口链与跨进程可行性取证
- `probe-foreground-ways.ps1` / `probe-foreground-timeline.ps1` —— 前台切换手段实测
- `cleanup-fixture-tab.cjs` —— 清掉验收留下的测试标签组
