# 交接文档：拖到别的软件界面时把目标窗口提到前面 + 外观设置的颜色自定义（2026-10-21）

## 0. 本轮范围与结论

用户提了两件事，外加验收过程中挖出一个**真 bug**：

| 编号 | 事项 | 状态 |
|---|---|---|
| 需求一 | 长按拖拽时，把鼠标悬停到的**目标应用窗口激活置顶**（拖到微信/钉钉对话窗口发附件时要看得到落点） | **已完成**，真机验收 PASS |
| 需求二 | UI 外观设置里补齐**颜色自定义** | **已完成**（根因是「本来就有、但被藏住了」），截图 + 用户手动确认 |
| 附带 | 抑制令牌的「假 disarm」导致长按抢前台 | **已完成**，根因已修，四模式全绿 |

**交付状态**：代码完成、门禁全绿、打包版装机、**真机验收四模式全过**。
**未推送**：`main` 领先 `origin/main`（用户此前明确「暂不发布」）。

---

## 1. 需求一：拖拽期间把悬停到的目标窗口提到前面

### 1.1 根因（先量后改）

Windows 的 OLE 拖放**不会**把悬停到的目标窗口提到前面。实测（旧构建）：

```
拖拽期间 32 次采样，前台全是挡板窗口（Edge）
放手那一刻，目标窗口才被激活
```

所以拖到微信/钉钉时，目标窗口一直藏在后面，用户看不到落点在哪。

### 1.2 实现

| 层 | 文件 | 做什么 |
|---|---|---|
| Rust | `src-tauri/src/drag_no_activate.rs` | `OUTBOUND_ACTIVATION_WATCH` 原子量；`begin_outbound_drag_activation_watch()` 起 80ms 轮询线程（60 秒安全网）；`activate_window_under_cursor()`；`is_activatable_drop_target()` |
| 前端 | `src/utils/drag-no-activate.ts` | `beginOutboundDragActivationWatch()` / `endOutboundDragActivationWatch()` |
| 前端 | `.../use-file-browser-drag.ts` | `triggerLongPress` 里：`captureOutboundDragTarget()` → `beginOutboundDragActivationWatch()` → 起拖拽 → `.finally()` 里 `end...` + `restoreOutboundDragForeground()` |

`activate_window_under_cursor()` 的判定链：

```
GetCursorPos → WindowFromPoint → GetAncestor(GA_ROOT) → SetForegroundWindow
                                   └─ 失败退 SwitchToThisWindow
```

`is_activatable_drop_target()` 排除：自己进程、桌面（`Progman` / `WorkerW`）、
任务栏（`Shell_TrayWnd`）、不可见窗口。

新增 2 个 Tauri 命令（本模块共 10 个）：
`begin_outbound_drag_activation_watch` / `end_outbound_drag_activation_watch`。

### 1.3 验收证据（打包版 3.2.16-beta）

脚本：`.superpowers\sdd\drag-lab.ps1 -Mode TargetActivate`
（前景先放 Edge 当挡板，资源管理器不在前台）

```
foreground samples during the drag = 20649500 ×11, 4855650 ×21
                                      ↑ Edge     ↑ 资源管理器（鼠标移过去那一刻切换）
foreground WHILE HOVERING the target = 4855650 (explorer=4855650)
foreground AFTER gesture            = 4855650     ← 放手后前台留在目标，AFM 没抢回来

应用日志：activated drop target HWND(0x4a1762)   ← 0x4a1762 = 4855650 = 资源管理器
```

**对照结论**：切点正好是「鼠标移到目标窗口上」那一刻；放手后前台留在目标程序。

---

## 2. 需求二：外观设置里的颜色自定义

### 2.1 根因：不是「没有」，是「被藏住了」

颜色选择器**在打包版里本来就有**（是任务一同步上游背景混合模式时带进来的），
在 `src/modules/settings/ui/categories/appearance/visual-effects.vue`：

- `INFUSION_BLEND_TINTS` 预设色板（8 个色块）；
- 最后一个色块是 `<input type="color">` —— **自定义取色器**。

但整块被外层条件盖住：

```vue
<div v-if="currentMixBlendMode !== 'normal'">
```

而默认值是 `DEFAULT_INFUSION_BLEND_MODE = 'normal'` →
**默认状态下整块不渲染**，用户当然找不到。

补充：上游 main 分支**也没有** accent / 主题色设置，这块是混合模式带来的副作用功能。

### 2.2 改动

去掉外层 `v-if`，「混合对象」Tabs 始终可见；选「填充颜色」即露出色板与自定义取色器。
**没有新增 i18n key**（避免动 17 个语言包）。

### 2.3 取证

- 截图：`.superpowers\sdd\settings-color-crop.png`（色板 + 自定义取色器）、
  `.superpowers\sdd\color-palette.png`（放大的色板）。
- **用户 2026-10-21 手动确认：点自定义色块能打开系统取色器**。
  （自动化点击没弹出原生弹窗，是注入点击对原生 color input 的问题，不是功能缺陷。）

---

## 3. 附带修掉的真 bug：抑制令牌的「假 disarm」

### 3.1 现象

Hold 模式（长按拖出）FAIL：长按期间 AFM 跳到前台。
日志显示按下瞬间 `armed=false` —— **抑制令牌丢了**。

### 3.2 根因

前端判断「指针是否停在可拖拽条目上」用的是**事件目标**：

```ts
if (!target.closest('[data-entry-path]')) { disarmDragNoActivate(); return; }
```

文件列表重排会换掉条目节点，浏览器随之**补发一次 `mouseleave`** →
令牌被撤掉。而指针其实还停在**同一个像素上的同一条目**上。
指针不动 → 不再有 `mouseover` → 令牌永远补不回来 →
下一次按下没有 `WS_EX_NOACTIVATE` 兜着 → **窗口被激活到前台**。

这正是需求一之前那个「长按抢前台」的投诉，只是换了个触发路径。

### 3.3 修法：按**位置**判定，不再按事件目标

```ts
// 记住指针位置（window 级 mousemove）
// 判定用 document.elementFromPoint(x, y)?.closest('[data-entry-path]')
```

三个地方都重新实测：鼠标移入（`mouseover`）、鼠标移出（`mouseleave`）、
**条目容器被换掉时**（`entriesContainerRef` 的 watcher，`flush: 'post'`）。

命令每次都发（不因「结果没变」而跳过）——两个面板可能交替 arm/disarm，
后端只有一个总开关，漏发一次就等于把抑制丢了。日志只在结果变化时打。

### 3.4 证据

| | 修复前 | 修复后 |
|---|---|---|
| Hold 前台采样（30 次 / 100ms） | 前 13 次是 **AFM** | **30 次全是目标窗口** |
| 日志 | 无轨迹 | 新增 `trace arm-sync-over-entry` → `arm (active=false hover_bg=true)` |
| 回归序列（QuickClick → Hold，指针原地不动） | FEATURE FAIL | **FEATURE PASS** |

---

## 4. 验收事故：把用户真实目录复制到了 C 盘（完整记录）

### 4.1 发生了什么

第一、二次 TargetActivate 实测时，AFM 打开的其实是用户真实目录
`E:\resource\2026-01-27_年度复训`（2084 文件 / 2,050,668,806 字节），
被**复制**（拖放插件是 `mode: 'copy'`）到了 `C:\Users\Duanyi\afm-drop-target`。

### 4.2 源目录完好

```
files=2084  bytes=2050668806
CreationTime 2026/6/4   LastWriteTime 2026/7/21   ← 一个字节都没动
```

误复制出来的副本已用 `mavis-trash` 移入回收站（**可恢复**），C 盘仍有 125.2GB 空闲。

### 4.3 根因与修复

| 环节 | 原状 | 现状 |
|---|---|---|
| 标签组定位 | `prepare-drag-lab.ps1` 硬编码 `currentTabGroupIndex=2`；**上一轮删掉了测试标签组，索引整体左移** | 一律**按路径**定位：`lab-workspaces.cjs` 重写（`find` / `set-by-path` / `remember` / `restore`），`prepare-drag-lab.ps1` 改用 `-FixturePath` |
| 拖拽前守卫 | 无 | `drag-lab.ps1` 增加**靶子守卫**：拖拽前读 workspace，断言当前标签组路径含 `afm-select-fixture` 且夹具目录 < 1MB，否则 `exit 14/15` 拒绝拖拽 |
| 夹具标签组 | 手改 JSON | 新增 `add-fixture-tab.cjs`（add / remove，按路径定位） |

修复后守卫生效：

```
current tab group = C:/Users/Duanyi/afm-select-fixture
fixture folder: 5 entries, 81 bytes
```

**教训（写进 AGENTS.md 口径）**：破坏性验收的靶子必须是自己造的；
标签组索引会因删除而移位 —— 一律按路径定位。

---

## 5. 验收脚本的三处加固（都是脚本缺陷，不是产品缺陷）

1. **`ForceForeground`**：脚本上一轮结束时把 Edge 重新最大化并留在前台，
   `SetForegroundWindow` 拉不动 Explorer → Control 模式 `exit=3`。
   现在四级降级 + 重试 5 次：
   `SetForegroundWindow` → **ALT 技巧** → `AttachThreadInput` → `SwitchToThisWindow`。
2. **落点自解析**（`Resolve-DropPoint` / `Place-Uncovered`）：
   用户的**微信**窗口（`Qt51514QWindowIcon`，1357×1796 @169,151）压住了资源管理器的落点，
   于是「被激活的」其实是微信 —— **行为其实是对的，测量对象错了**。
   现在自动挑一个真正属于落点窗口的坐标，并把落点窗口放到没被盖住的位置。
3. **指针预热**（`-PrimeX/-PrimeY`）：指针停在同一像素 → 不产生 `mousemove`
   → 不产生 `mouseover` → 令牌补不回来。

新增脚本：`probe-app-state.ps1`（UI 线程活性）、`probe-under-point.ps1`
（某点上到底是哪个窗口）、`shift-chat-windows.ps1` / `restore-chat-windows.ps1`
（把微信/钉钉挪开并**原样复原**，rect 记档）。

---

## 6. 真机验收（四模式，全绿）

判据一律读 `GetForegroundWindow()` 的句柄 + 应用日志，不靠肉眼。

| 场景 | 判据 | 结果 |
|---|---|---|
| **Control** 普通点击后台 AFM | AFM 必须跳到前台（阳性对照，证明注入到位） | **PASS** |
| **TargetActivate** 拖拽悬停目标 | 目标窗口必须在悬停期间跳到前台；放手后前台留在目标 | **PASS** |
| **QuickClick** 快速点击 | 不许误起出站拖拽；UI 线程不许卡死；窗口仍要跳到前台 | **PASS** |
| **Hold** 长按拖到资源管理器 | 手势期间前台一直是资源管理器；文件落盘；放完把前台还给目标 | **PASS** |

Hold 的落盘证据（**先清空落点夹具再跑**，因为复制会保留源文件的修改时间、
同名覆盖看不出变化，必须看 CreationTime）：

```
a-alpha.txt  16 字节  CreationTime 2026/10/21 17:03:28   ← 就是那一次拖拽
```

Hold 的日志链路：

```
trace arm-sync-over-entry          ← 位置判定生效
arm (active=false hover_bg=true)   ← 窗口在后台就已经 arm
trace dom-mousedown
trace longpress-check down=true
trace longpress-fired              ← 长按拖拽确实起了
captured outbound drag target HWND(0x4a1762)
activated drop target HWND(0x4a1762)   ← 目标窗口被提到前面
restore outbound drag foreground -> true ← 放完把前台还给目标
```

---

## 7. 门禁

| 门禁 | 结果 | 口径 |
|---|---|---|
| `cargo test --lib` | **702 passed / 0 failed** | 与基线逐字一致 |
| `npx vitest run` | **229 文件 / 2031 用例** 全绿 | 基线 2027 + 新增 4 |
| `npx eslint src` | **170 errors / 0 warnings** | 与基线逐字一致 |
| `npx vue-tsc --build` | **0** | — |

---

## 8. 产物与提交

| 项 | 值 |
|---|---|
| 安装包 | `release\Alpha File Manager_3.2.16-beta_x64-setup.exe` |
| 字节数 | 20,394,221 |
| SHA256 | `D703D957211CEA4864C8F7E6855249452CF49DFE6CF0855ED7B0322294E58531` |
| 装机后 | `D:\Program Files\Alpha File Manager\alpha-file-manager.exe` |
| 字节数 | 55,486,464（built at 2026/10/21 16:12:40） |
| SHA256 | `45AEA73B89889389F2A2439EBDB50AA309B5DD02803F9FAD8872085B35C0B591` |

| 节点 | 说明 |
|---|---|
| `a5eb188c` | 上游背景混合模式分支（任务一） |
| `9704a4a4` | 长按拖出不抢前台（任务二） |
| `81c35225` | 本轮：需求一 + 需求二 + 抑制令牌修复 |

**未推送**：沿用上一轮惯例 —— 提交保留在本地，推送等用户发话。

---

## 9. 留给后续的几件事

1. **需求二只是「取消隐藏」**。如果用户想要的是**主题色 / accent 色**
   （界面上换个主色调），上游 main 也没有这个功能，需要单独设计，
   不能靠混合填充色凑合。
2. **`WS_EX_NOACTIVATE` 挡不住 Chromium 自己的 click-to-activate**：
   按下瞬间仍会收到一次 `WM_ACTIVATE state=2`。真前台没有立刻切过去
   （实测手势期间前台一直是目标程序），但如果哪天出现「按下就跳前台」的
   回归，第一嫌疑就是这条。
3. **抑制生效时 DOM 可能收不到 `mousedown`**：Chromium 的 click-to-activate
   会吞掉这一次按下。指针**刚移过去**（有新的 mouseover）时不会；
   指针停着不动很久再按，就可能不响应。这是已知边界，不影响主流程。
4. **诊断探针保留**。`drag_no_activate_trace` 让「DOM 到底收没收到事件」
   这类问题在真机上有硬证据。发布版拿不到 webview console
   （wry 不透传 CDP），日志是唯一可用的读数来源。
5. **用户的微信/钉钉窗口在验收期间被挪到 (-4000,-4000)**，
   由 `restore-chat-windows.ps1` 按记档的 rect **原样复原**。

---

## 10. 涉及文件

**修改**

- `src-tauri/src/drag_no_activate.rs` —— 激活轮询线程、目标窗口判定
- `src-tauri/src/lib.rs` —— 注册 2 个新命令（模块共 10 个）
- `src/utils/drag-no-activate.ts` —— 2 个 watch 函数
- `src/utils/__tests__/drag-no-activate.test.ts`
- `src/modules/navigator/components/file-browser/composables/use-file-browser-drag.ts`
  —— **抑制令牌改按指针位置判定**
- `.../__tests__/use-file-browser-drag-long-press.test.ts` —— 新增「容器被换掉时
  按新 DOM 重新实测」用例
- `src/modules/settings/ui/categories/appearance/visual-effects.vue`
  —— 颜色选择器不再被隐藏
- `CHANGELOG.md` / `public/changelog/ch/changelog.md` —— 中英文更新日志

**相关文档**

- `docs/plan-2026-10-21-long-press-drag-out.md` —— 上一轮的方案与机制调研
- `docs/handoff-2026-10-21-long-press-drag-out.md` —— 上一轮的交接
- `docs/handoff-2026-10-21-outbound-target-and-color.md` —— 本文

**验收脚本（`.superpowers/sdd/`，不进版本库）**

- `drag-lab.ps1` —— 主验收脚本（Control / TargetActivate / QuickClick / Hold / Layout / ExplorerHold）
- `prepare-drag-lab.ps1` —— 验收环境准备与复原（**按路径**定位）
- `lab-workspaces.cjs` / `add-fixture-tab.cjs` / `cleanup-fixture-tab.cjs` —— 工作区与标签组
- `set-settings-tab.cjs` —— 切设置页签（截图用）
- `capture-screen.ps1` —— 屏幕 BitBlt 截图
- `probe-app-state.ps1` / `probe-under-point.ps1` —— 线程活性 / 某点归属窗口
- `shift-chat-windows.ps1` / `restore-chat-windows.ps1` —— 挪开并复原聊天窗口
