# 计划：长按文件/目录拖出时不把窗口拉到最前层

日期：2026-10-21
状态：**已实现并通过真机验收**（打包版 3.2.16-beta，验收记录见 `docs/handoff-2026-10-21-long-press-drag-out.md`）

## 1. 目标

当鼠标**长按**（按下并保持）AFM 里的文件或目录时：

- AFM 窗口**不被激活到最前层**；
- 并且能直接把文件/目录拖到微信、钉钉、浏览器等外部程序。

## 2. 现状（读码结论）

| 位置 | 现状 |
| --- | --- |
| `use-file-browser-drag.ts` | `mousedown` 记坐标；位移超过 `DRAG_ACTIVATION_THRESHOLD` → `startDragSession()`，**webview 内自绘拖拽** |
| `use-file-browser-drag-session.ts` | 已用 `@crabnebula/tauri-plugin-drag` 的 `startDrag` 做**出站 OS 拖拽**（`DoDragDrop`） |
| 出站触发点 | 只有两个：光标移出 AFM 视口；窗口失焦（blur / visibilitychange / `onFocusChanged(false)`） |

**问题根因**：Windows 在**鼠标按下的瞬间**就激活被点到的窗口。后台 AFM 里按住一个文件时，
AFM 立刻跳到前台，把目标程序（微信/钉钉）盖住 —— 此时出站拖拽根本无从触发
（窗口没失焦、光标也还没出视口），用户看到的就是「长按就把 AFM 顶到前面，什么也没发生」。

## 3. 机制调研（全部为真机实测，不是推测）

这一节是本方案的关键。第一版实现按「子类化 WebView2 渲染窗口 + 拦 `WM_MOUSEACTIVATE`」
设计，**实测证明这条路物理上走不通**，必须换机制。

### 3.1 命中窗口不在本进程

`WindowFromPoint` 实测：光标落在 AFM 的文件行上时，命中的窗口是

```
hwnd=27071888 class=Chrome_RenderWidgetHostHWND pid=15436
```

而 AFM 主进程是 `pid=611324`。这个 `Chrome_RenderWidgetHostHWND` 属于
**`msedgewebview2.exe`**（WebView2 的浏览器进程），它被 `SetParent` 挂进了我们进程的
`Chrome_WidgetWin_0` 下面，所以 `EnumChildWindows` 能枚举到它，但**它不是我们的窗口**。

跨进程改窗口过程：

```
SetWindowLongPtrW(render, GWLP_WNDPROC, cls)  ->  返回 0，lasterror=5 (ERROR_ACCESS_DENIED)
```

即**跨进程子类化被系统拒绝**。第一版实现里 `install_subclass` 的 `previous == 0` 分支
把它静默跳过了 —— 钩子从来没装上，所以抑制从未生效。
（顺带把旧探针的假结论也纠正了：`GetWindowLongPtr(GWLP_WNDPROC)` 对**所有**窗口都返回 0，
读不出来不代表没装。）

### 3.2 激活决策看的是**顶层窗口**

MSDN（`WM_MOUSEACTIVATE`）：

> Sent when the cursor is in an inactive window and the user presses a mouse button.
> **The parent window receives this message only if the child window passes it to the
> DefWindowProc function.**
>
> 参数 `wParam`：**要激活的窗口的顶级父窗口句柄**。

命中窗口在别的进程，我们够不着它的窗口过程；但顶层窗口是我们自己的。
于是「顶层窗口的 `WS_EX_NOACTIVATE`」成了唯一够得着的杠杆。

### 3.3 逐层实测：只有顶层窗口的样式有效

在同一个已装版本上，用 PowerShell 直接改各层窗口的 `WS_EX_NOACTIVATE`，
再点后台的 AFM，读 `GetForegroundWindow()`：

| `WS_EX_NOACTIVATE` 挂在哪 | 手势期间的前台窗口 | 结论 |
| --- | --- | --- |
| 不挂（基线） | AFM | 抢前台 |
| 命中窗口 `Chrome_RenderWidgetHostHWND` | AFM | **无效** |
| `Chrome_WidgetWin_1`（浏览器进程） | AFM | **无效** |
| `Chrome_WidgetWin_0`（本进程） | AFM | **无效** |
| `WRY_WEBVIEW`（本进程） | AFM | **无效** |
| **Tauri 顶层窗口** | 资源管理器 | **有效** |

同时也证明：`WM_MOUSEACTIVATE` **没有**从 Chromium 那一层向上传递（否则中间层也该有效），
所以「在顶层窗口的窗口过程里返回 `MA_NOACTIVATE`」这条路同样走不通。

### 3.4 参照物：Windows 资源管理器怎么做的

用户提到「资源管理器、Directory Opus 默认就是长按不激活」。实测本机资源管理器
（`explorer.exe`，`CabinetWClass`）：

- 顶层窗口 exstyle = `0x100`（`WS_EX_ACCEPTFILES`），**没有** `WS_EX_NOACTIVATE`；
- 文件列表 `DirectUIHWND` exstyle = `0x0`，也没有。

但按住文件行时，前台窗口**始终不是资源管理器**（抬手后才轮到它）——
也就是说资源管理器确实做到了「按住不抢前台」，而且用的是 shell 私有实现，
公共 Win32 API 复制不了。我们能用的公共手段就是 `WS_EX_NOACTIVATE` + 自己做激活管理。

### 3.5 结论

> 抑制激活 = 在**顶层窗口**上按需挂 `WS_EX_NOACTIVATE`；
> 激活补回 = 自己在抬手时把窗口拉回前台。

### 3.6 抑制激活的代价：抬手被 Chromium 吞掉

把 `WS_EX_NOACTIVATE` 挂上之后，抑制确实生效了（按住文件行时前台始终是资源管理器）。
但**代价是 DOM 收不到抬手**，这引出两个必须解决的问题。

Chromium 对未激活窗口有一套 click-to-activate：按下的瞬间浏览器进程把这次点击
当成「先激活窗口」，**抬手被浏览器进程吃掉，不发给渲染进程**。于是：

| 现象 | 后果 |
| --- | --- |
| DOM 收不到 `mouseup` | 长按计时器（400ms）没人取消 → **误起一次系统级出站拖拽** |
| DOM 收不到 `mouseup` | 「鼠标还按着」的脏状态留着 → 下次移动鼠标**拖出幽灵的内建拖拽会话** |
| DOM 收不到 `mouseup` | 抬手补焦点的兜底监听器不触发 → 普通点击拿不回键盘焦点 |

第一个后果最危险：误起的那次出站拖拽，抬手早已落在别的应用上，
`DoDragDrop` 拿着**已经松开的鼠标**干等，界面会被卡住。

而且这件事**没法靠日志判断**。原先 Rust 的 `focus_main_window` 在「已经是前台」
时静默早返回，于是日志里一条 `focus_main_window` 都没有，既可能是
「DOM 根本没收到抬手」，也可能是「收到了，只是那时窗口已被 Chromium 自己激活」——
两种情况长得一模一样。现在补了日志（`already foreground`），这条歧义才消除。

**解法：绕开 DOM，直接问系统「左键还按着吗」。**

`GetAsyncKeyState(VK_LBUTTON)` 的高位（`0x8000`）就是按键的当前按下状态，
它不受 Chromium 那层 click-to-activate 行为影响。前端据此：

- **抬手看门狗**：按下后每 30ms 问一次，发现按钮已松开就收状态
  （`isMouseDown`、计时器、窗口监听器），普通点击顺带把窗口拉回前台；
- **到点复核**：400ms 到点时**再问一次**，按钮已松开就判定为普通点击，不起拖拽。
  这是防止界面卡死的那道保险 —— 问不到（命令不可用）时按「还按着」处理，
  宁可保持旧行为，也不要让长按拖不出去。

DOM 收到抬手时走同一条收口路径（`handleButtonReleased`），
所以「收到」和「没收到」两种情况收出的状态完全一致。

### 3.7 OLE 拖拽结束会激活拖拽源窗口

长按手势本身完全达标：整个拖拽过程前台一直是目标程序（连续 30 次采样、
每次间隔 100ms，全程都是资源管理器）。但**松手的那一刻**前台变成了 AFM：

```
抬手前：13699544, 13699544, ... （30 个采样全是资源管理器）
抬手后：42600852, 42600852, ... （20 个采样全是 AFM）
```

原因是 OLE 的收尾行为：**拖拽结束时系统会把拖拽源窗口激活**。
这意味着「拖进去的文件是到位了，但刚放下的那个程序又被 AFM 盖住了」——
正是这个功能要消灭的那件事，只是延后到了放下之后。

**解法**：拖拽开始时记下当时的前台窗口（那就是拖拽目标），
拖拽结束后检查——**只有当自己确实占了前台时**才把前台还回去。

- 用户拖完已经切到别的程序去了 → 前台不是我们 → 什么都不做，绝不抢；
- 拖拽被 Esc 取消 → 前台还是目标程序 → 本来就没事，还回去也是空操作；
- 正常放下 → 系统激活了我们 → 还给目标程序。

还原动作由后端一个短命线程完成（复查 6 次、每次间隔 50ms）：
激活落地的时刻比拖拽结束略晚，只查一次会漏掉。

## 4. 方案

### 第 1 层：Rust / Win32 —— 顶层窗口的样式 + 自管激活

`src-tauri/src/drag_no_activate.rs`：

- 子类化**顶层** Tauri 窗口（本进程，可行），在窗口过程里跟踪 `WM_ACTIVATE`。
- 维护 `WS_EX_NOACTIVATE`：
  - 窗口在后台 **且** 指针停在可拖拽条目上（前端 arm）→ 挂；
  - 窗口在后台 **且** 还没确认「失焦时能不能收到 hover」（fallback）→ 挂；
  - 其余（窗口在前台）→ 不挂：本来就没有激活可抑制。
- 前端一旦在**后台** arm 过一次，就说明 hover 收得到，fallback 关闭 ——
  于是「点工具栏」这类操作恢复成普通的立即激活。
- 样式改动通过 `PostMessage` 回到 UI 线程执行（`WM_APP + 0x51`）。

### 第 2 层：前端 —— 长按起系统级出站拖拽 + 抬手补焦点

- `mousedown` 启动长按计时器（400ms）**和抬手看门狗**（30ms 轮询）。
- 计时器到点 → **先问后端「左键还按着吗」**：
  - 还按着 → 直接起**系统级出站拖拽**，并标记「正在出站拖拽」。
    关键：出站拖拽必须在「窗口仍然在后台」时启动，否则目标程序被盖住就拖不过去。
  - 已经松开 → 这是普通点击，取消计时器并把窗口拉回前台。
- 起拖拽后**立刻收掉「鼠标还按着」的状态** —— 出站拖拽由 OLE 循环接管，
  抬手不会回到 DOM；状态留着的话下一次移动鼠标会拖出幽灵的内建拖拽会话。
- 指针移动超过容差 → 清掉计时器，走原有 webview 内拖拽（行为不变）。
- **抬手补焦点**：抑制之后系统不会激活窗口，普通点击必须在抬手时自己把窗口拉回前台，
  否则「点一下后台窗口」会毫无反应。两条路径：
  - DOM 收到了抬手 → `window` 级别的 mouseup 兜底（只装主窗口）处理，
    长按拖拽的那一次抬手要跳过；
  - DOM 没收到抬手（被 Chromium 吞了）→ 抬手看门狗发现按钮已松开，顺带补焦点。
- **诊断探针**：关键节点（DOM mousedown / DOM mouseup / 到点复核结果 /
  看门狗发现抬手 / 长按起拖拽）都写进应用日志。发布版拿不到 webview console，
  页面里的 `console.log` 在真机上是看不见的，只有落进应用日志的读数才是硬证据。
- **拖拽结束后还前台**：起拖拽时记下前台窗口（= 拖拽目标），拖拽结束后
  若发现自己占了前台就还回去（见 3.7）。用户已经切走时绝不抢。

## 5. 为什么不选别的路子

| 备选 | 否决理由 |
| --- | --- |
| 纯前端拦截 | 激活决策发生在 mousedown 送达 webview **之前**，JS 拦不住 |
| 长按后再把别的窗口拉回前台 | 400ms 的闪烁；还要额外维护「上一个前台窗口句柄」 |
| 永远 `WS_EX_NOACTIVATE` | 应用再也拿不到键盘焦点；点对话框里的输入框不会获得焦点 |
| 子类化 WebView2 渲染窗口 | **实测被系统拒绝**（跨进程 `ERROR_ACCESS_DENIED`） |
| 在顶层窗口拦 `WM_MOUSEACTIVATE` | **实测消息不从 Chromium 那一层向上传递**，顶层拦不到 |
| `SetWindowPos(HWND_TOPMOST)` 技巧 | 实测不改变前台窗口（`BringWindowToTop` / `SetWindowPos(HWND_TOP)` 同样无效） |

## 6. 影响面与兜底

- 仅 Windows 生效；其它平台行为不变。
- 抑制只在「窗口处于后台」时挂上前台抑制样式，窗口在前台时行为完全不变。
- 普通点击仍会把窗口带到前台（抬手时用 `SetForegroundWindow` 显式补，
  失败再退回 `AttachThreadInput` + 重试）。
- 长按起拖拽失败时落回原有逻辑，不能把用户卡在「按住了但没反应」。
- 已知的行为变化：后台窗口被点击时，**激活时机从「按下」推迟到「抬手」**
  （与资源管理器的表现一致）。

## 7. 验收

1. 资源管理器在前台、AFM 在后台且部分可见 → 长按 AFM 里的文件 →
   读 `GetForegroundWindow()`，确认**不是 AFM**（资源管理器仍在上层）。
2. 继续拖到资源管理器窗口里松手 → 目标目录里出现该文件（落盘证据）。
3. 阳性对照：普通单击后台的 AFM → 窗口仍然会被带到前台（证明注入有效、
   且「不抢前台」不是假阴性）。
4. 回归：AFM 在前台时普通单击文件，窗口焦点与选中正常；webview 内拖拽仍可用。

判据一律用 `GetForegroundWindow()` 的句柄，不靠截图肉眼判断；截图只作留档。

## 8. 涉及文件

**新增**

- `src-tauri/src/drag_no_activate.rs` —— 顶层窗口子类 + `WS_EX_NOACTIVATE` 管理
  + 聚焦命令 + 左键状态查询 + 诊断探针
- `src/utils/drag-no-activate.ts` —— 前端侧：申请/撤销抑制、抬手补焦点兜底、
  左键状态查询、长按判定策略
- `src/utils/__tests__/drag-no-activate.test.ts`
- `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-drag-long-press.test.ts`

**修改**

- `src-tauri/src/lib.rs` —— 注册模块、启动时安装子类、注册命令
- `src/modules/navigator/components/file-browser/composables/use-file-browser-drag.ts`
  —— 长按计时器 + 到点复核 + 抬手看门狗 + 出站拖拽触发 + 申请/撤销抑制
- `src/modules/navigator/components/file-browser/composables/use-file-browser-drag-session.ts`
  —— 暴露「按给定条目起出站拖拽」的入口
- `src/composables/use-init.ts` —— 装上抬手补焦点的兜底（只装主窗口）

---

## 9. 后续追加（同日第二轮）

这一轮在同一套机制上又做了三件事，细节与证据在
`docs/handoff-2026-10-21-outbound-target-and-color.md`：

1. **拖拽期间把悬停到的目标窗口提到前面**（需求一）。
   实测 Windows 的 OLE 拖放**不会**提升悬停目标，必须自己轮询
   `GetCursorPos` → `WindowFromPoint` → `GetAncestor(GA_ROOT)` → `SetForegroundWindow`。
2. **抑制令牌改按指针的真实位置判定**，不再按事件目标。
   列表重排会换掉条目节点并让浏览器补发 `mouseleave`，
   令牌一丢，下一次按下就会把窗口激活到前台（长按抢前台的另一个触发路径）。
3. **外观设置里的颜色自定义**（需求二）——不是「没有」，
   是被 `v-if="currentMixBlendMode !== 'normal'"` 藏住了，默认整块不渲染。
