# 交接文档：Alpha File Manager 远程浏览阶段 3（上传/下载 + 权限设置 + 两处缺陷修复）

- 日期：2026-10-19
- 分支：`feat/remote-phase-1-connections-transport`
- 起点提交：`7bce70c5`
- 上一轮交接：[handoff-2026-10-18-remote-phase-2-ftp.md](handoff-2026-10-18-remote-phase-2-ftp.md)

> ⚠️ 本轮的全部改动**仍未提交**。工作区里叠着上一轮（§11–§15）的 52 个已跟踪文件改动
> （5299 insertions / 308 deletions）与 12 个未跟踪路径，本轮的新增继续叠在上面。
> 提交前请先 `git status` 看清全貌，**不要**只 `git add` 本轮那几个文件。

---

## 0. 本轮范围

用户装机实测后报了 4 条：

| # | 现象 | 性质 | 状态 |
|---|---|---|---|
| 1 | 远程面板右键没有「下载」「权限」 | 新功能 | ✅ 前端 + 后端 + 单测完成 |
| 2 | 本地面板右键没有「上传」子菜单 | 新功能 | ✅ 前端 + 后端 + 单测完成 |
| 3 | 激活远程后目录树只显示根目录名，不展开 | 缺陷 | ✅ 第一轮已修（§1.1–§1.5）；用户 2026-10-19 19:47 反馈「仍然不正常」后**第二轮又挖出 3 个独立根因**（§1.6） |
| 4 | 一次安装跑起 6 个安装器进程，装完又启动一次安装 | 缺陷 | ✅ 证据链闭合 + 单实例守卫已实施（**未真机验证**） |
| 5 | 目录树「不会定位到当前打开的目录」 | 缺陷 | ✅ 第二轮已修（§1.6 根因 C）。**真凶是 reka-ui 的 `as-child` 删掉子节点模板 ref** —— 定位功能此前一次都没真正执行过 |

**本轮（第二轮）仍没有真机验收。** 全部结论来自单测、注入验证与 NSIS 编译。
#4 的守卫尤其需要一次真机安装才能确认（见 §2.4）。

---

## 1. #3 目录树不展开：根因与修复

### 1.1 根因（**覆盖上一轮 §15.1 的判定**）

上一轮判定为「`loadedSet` 没清干净」。实际根因是**更靠后一层**：

`use-file-tree.ts` 的 `rebuildRoots` 造出一个**全新空根节点**后，只清了 `loadedSet` 记账，
**却没有让读取重新发生**。而 `ensureLoaded` 的唯一自动触发器是 `expandedPaths` 的 watch。

「切回远程格」这个动作**通常不改变 `expandedPaths`** —— 用户只是换回活动面板，
没有导航，就没有新的 `setSelectedPath`，watch 不触发 → 空根永远没人读 →
表现就是「根那行标签正确、展开箭头在、下面没有子节点」。

**类别**：修了障碍（清 `loadedSet`），但没让事情发生（重新读取）。

### 1.2 改动（`src/modules/navigator/composables/use-file-tree.ts`）

- 新增 `const inFlight = new Map<string, Promise<void>>()`，**声明在所有 watcher 之前**。
- `ensureLoaded` 改为去重包装，`ensureLoadedInner` 为真正读目录的入口。
- `ensureLoadedInner` 外层包 `try/finally`，`finally` 里 `inFlight.delete(path)`，
  **与「读取落地」同步**清理。
- `rebuildRoots` 末尾新增：对 `recreated` 中仍在 `expandedPaths` 里的根主动 `void ensureLoaded(p)`。
- `invalidate` 改为绕过在途去重、直接 `await ensureLoadedInner(p)`。

### 1.3 新测试

`src/modules/navigator/composables/__tests__/use-file-tree.test.ts` 新增用例
「切回远程格时 expandedPaths 没变 —— 重建出来的根也必须重新读」：

`rootPaths` 在 `['C:/']` ↔ `[ROOT]` 之间换两轮，而 `expanded` **全程是同一个 Set、
一个元素都不动**，断言子节点重新出现且 `readDir` 恰好被调 2 次。

> 这条正是真机行为。上一轮那条既有测试每次切换都顺手换了新的 `expanded`，
> 于是 watch 每次都触发、读取总有人发起，**测试是绿的但真机复现不出来**。

### 1.4 注入验证

把重建补读的守卫改成 `if (expanded.has(p) && false as boolean)` 后，**恰好 1 条转红**，
输出为 `expected [ '速豹堂' ] to deeply equal [ '速豹堂', 'wp-admin', 'wp-content' ]`
—— 与用户截图「只有根、没有子节点」逐字吻合；其余 21 条仍绿。验证后已恢复。

### 1.5 ⚠️ 本轮在这条上踩的两个坑

1. **`inFlight` 声明在 watcher 后面 → TDZ。**
   `expandedPaths` 的 watch 带 `immediate: true`，会在 `watch()` 调用**当场**同步执行
   getter 与回调。声明在后面就是 `ReferenceError: Cannot access 'inFlight' before initialization`，
   而 `ReferenceError` 会被 `callWithErrorHandling` 吞成一条警告 —— 表现是
   「某个回调从来没生效」。22 条测试里 7 条红。
   **规则**：新增的 watcher 依赖必须声明在**所有** watcher 之前（同 §13.1）。

2. **`promise.finally()` 清理比读取落地晚一个微任务。**
   于是两条既有 `invalidate` 测试拿到一个**早已 resolve 的旧 promise**、重读被跳过
   （`readDir` 只调 1 次、`children` 没被替换）。
   **规则**：去重表的清理必须与「读取落地」同一刻，不能靠 `finally` 链。

3. **`invalidate` 必须绕过在途去重。**
   它的语义是「强制再读一次」，拿到一次旧读取的 promise 等于没重读。

### 1.6 第二轮（用户 2026-10-19 19:47 反馈「仍然不正常、不会定位」）

上一轮（§1.1–§1.5）修的是「切回远程格时重建的根没人重读」。用户再次反馈后逐条追下去，
发现**三个互相独立的缺陷叠在一起**，上一轮那一条只是最表层的一个：

> 用户原话：「远程目录树仍然不正常，默认只显示根目录名称，不展开。点击可以展开，
> 但不会定位到当前打开的目录。」

#### 根因 A：祖先回溯只补「最上面那一层」→ 当前目录被立成**并列的根**

`ensureLoadedInner` 找不到节点时沿父链上溯，命中**树上已有的那个祖先**就 `break`，
只把那一层读出来。中间隔着的层没人读。

当前目录在树里**第三层**时（`wp_root/wp-content/themes`，远程里再往里点一层就会到），
`wp-content` 那一刻还没被读出来 → 上溯到根 → 等根读完再回来 → `themes` 仍不在树上
→ 落到 `addRoot`，把当前目录立成**并列的第二个根**。

实测（`remote-tree-reveal.test.ts` 的深层用例）修复前树上有**三根**：

```
sfm://remote/<id>/.../wp_root
sfm://remote/<id>/.../wp_root/wp-content/themes
sfm://remote/<id>/.../wp_root/wp-content/themes/twentytwenty
```

**症状与用户最早报的一模一样**：树上冒出好几根、当前目录不在根的那条链里。

修复：上溯时把**中间缺失的层**记下来，交给新函数 `loadChain(anchor, missing)`
逐层补读；每层读完后**重新 findNode**（`loadChildren` 会把子节点整批换成新对象，
拿旧引用就写进了没人渲染的 detached 节点）。

#### 根因 B：切回远程格时，**已展开的后代**是空壳

`rebuildRoots` 只清了**根自己**的 `loadedSet` 记账。根下面那些**已展开的后代**
随着重建一起没了（节点是全新的空壳），但它们的记账还在 ——
`ensureLoaded` 开头是 `if (loadedSet.has(path)) return;`，
于是「节点是空的」与「已经读过了」同时成立，永远不被重读。

修复：记账跟着**节点集合**一起变 —— 根被**移除**或**重建**时，
清掉它**整棵子树**的记账；重读时按**父先子后**、**一个读完再读下一个**，
把重建出来的根**和它下面已展开的后代**一并补读（`collectRereadChain` + `pathDepth`）。

#### 根因 C（**「定位」从来没生效过的真正原因**）：reka-ui 的 `as-child` 会删掉子节点的模板 ref

上一轮把 `ref="treeViewport"` 挂在 `<ContextMenuTrigger as-child>` 的**直接子元素**上。
而 reka-ui 的 `as-child` 走 `Primitive/Slot.js`，那里有一行：

```js
delete firstNonCommentChildren.props?.ref;
```

—— 它会**主动删掉**子节点上的模板 ref。于是 `treeViewport` **永远是 null**，
`revealSelectedRow()` 第一行就 `return`，
**滚动定位从来没有生效过，而且不报任何错**，看起来像「功能没做」。

> 这是本轮最值钱的一条：**功能看上去实现了、代码看上去没问题、单测也覆盖了，
> 但一次都没真正执行过。** 判据是「值真的到了目标吗」，不是「代码写了吗」。

修复：滚动容器往里再套一层 —— trigger 的直接子元素是 `.file-tree-view`，
真正带 ref 的是它里面的 `.file-tree-view__scroll`（**不是** trigger 的直接子元素，
ref 才活得下来），滚动容器也因此不再挂着 `display: contents`，
`overflow-y: auto` 一定生效。

#### 本轮的新测试

- `src/modules/navigator/composables/__tests__/remote-tree-reveal.test.ts`（7 条）
  —— 打通 store → `useFileTree` 的真实链路，用用户真机数据
  （连接「速豹堂」，root `…/wp_root`，cwd `…/wp_root/wp-content`）；
  含**第三层**用例（根因 A）与「切回远程格」用例（根因 B）。
- `src/modules/navigator/components/file-browser/__tests__/file-browser-tree-view.test.ts`（+3 条）
  —— 组件层：当前目录被高亮、落在可视区外时**滚到刚好露出它**、
  已经在可视区里时**不滚**（不冲掉用户手动展开的位置）。
- `src/modules/navigator/utils/__tests__/tree-reveal.test.ts`（7 条，上一轮新增）——
  滚动量本身是纯函数 `computeRevealScrollTop`，单独钉住。

#### 注入验证（4 条，每条恰好 1 条转红）

| 注入 | 转红的用例 |
|---|---|
| `loadChain(anchor, missing)` → `loadChain(anchor, [])` | 「当前目录在第三层时不会被立成并列的根」 |
| 清账只清根自己（`vanished.has(p)`） | 「切回远程格（树根重建、expandedPaths 不变）后当前目录仍然是展开的」 |
| ref 挪回 trigger 的直接子元素 | 「当前目录落在可视区之外时，滚动容器被滚到刚好露出它」 |
| 算出滚动量但不赋值 | 同上 |

第 3 条的失败输出是 `expected +0 to be 124` —— 与真机症状逐字吻合。

#### ⚠️ 本轮在这条上踩的坑

1. **测试自己没建状态。**
   `remote-tree-reveal.test.ts` 里有条用例名义上验「store 的祖先链能让远程根展开」，
   却**忘了调 `store.setSelectedPath()`** —— 展开集合是空的，
   `expandedPaths` 的 watch 自然什么都不触发，**一次 `readDir` 都没发出去**。
   表现是「等待加载落地超时」。
   独立的调试脚本能收敛、同样的数据在测试文件里却永远超时 ——
   **看起来像代码时灵时不灵，其实是测试没建状态**。
   **规则**：验「某条链路通不通」之前，先确认**链路的输入真的被造出来了**。

2. **`getBoundingClientRect` 在 jsdom 里全 0。**
   滚动量是纯函数（`computeRevealScrollTop`）好测，但**接线**（找没找对行、
   滚没滚对容器）只能靠给 DOM 造坐标来测：
   `vi.spyOn(Element.prototype, 'getBoundingClientRect')` 按行序号造坐标，
   并在元素**上**挂一个自己的 `scrollTop` 属性记录赋值
   （jsdom 自己的 `scrollTop` 写进去能读回，但不能记录「谁写过」）。

---

## 2. #4 安装器多次启动：证据链与单实例守卫

### 2.1 证据链（已闭合）

**kill 日志** `%TEMP%\alpha-file-manager-kill.log`（893 行，15:54:24 最后更新）：

```
15:47 – 15:54   至少 6 个安装器进程先后跑 PREINSTALL
15:54:24.085   同时活着 3 个 setup.exe
                 15:53:42.565  caller=228564
                 15:54:06.423  caller=234628 → SKIP PID=228564
                 15:54:23.748  caller=227856 → SKIP PID=228564、234628
```

**应用日志**（UTC 时间戳，07:xx = 本地 15:xx）：

```
[07:49:59] setup_handler: app started, version=3.2.11-beta
[07:54:48] setup_handler: app started, version=3.2.11-beta
```

**进程父子关系**：活着的 `alpha-file-manager.exe`（PID 247600）的
`ParentProcessId = 228564`（setup.exe）—— 这是 NSIS `MUI_FINISHPAGE_RUN` →
`nsis_tauri_utils::RunAsUser` 的正常行为。**下一次安装的 PREINSTALL 又把这个应用杀掉**，
于是用户看到应用反复重启。

### 2.2 已逐条排除的仓库内触发源（都是否定结论，**不要重复排查**）

- 应用侧没有任何 `setup.exe` / 本地安装包的 spawn 或引用（全仓定向搜索无命中）。
- 自更新 `use-app-updater.ts`：**只弹 toast**，`downloadReleaseInstaller` 只由 toast 的按钮触发，
  不自动运行安装包。
  ⚠️ 本轮又核了一次 Rust 侧的版本比较 `parse_version_to_number`
  （`src-tauri/src/app_updater.rs:201`）：`3.2.11-beta` → `300201120000`，
  站点 `3.2.4` → `300200499999`，**预发布号被正确比较**，不会误报「有更新」。
  站点 `https://www.aiec.fun/alpha-file-manager/version.json` 当前 `version = 3.2.4`。
  **自更新回环假设已彻底排除。**
- NSIS 生成脚本 `src-tauri/target/release/nsis/x64/installer.nsi`：
  `.onInit`（469–516）与 `Section Install`（630–…）里没有自重启动；
  两处 `ExecWait '$R1' $0`（349/356）是 Tauri 的「卸载/重装」选择页跑卸载器；
  `Section WebView2`（538）里的 `ExecWait` 跑的是 WebView2 安装器。
- HKCU/HKLM `Run`/`RunOnce` 与 Startup 文件夹里**没有** Alpha/setup.exe 的自启动项。
- `focus-sync-sidecar` 源码只 `taskkill` 自己，不拉起安装器；
  计划任务 `KizemoFocusSync` 动作为 `focus-sync-sidecar.exe --service`、触发器 `AtLogOn`。
- `.superpowers/sdd/` 下无任何脚本引用 setup.exe / `_x64-setup` / `Start-Process.*setup`。
- 无进程创建审计（Security 4688 无事件、无 Sysmon），**无法直接取得父进程链**。

**结论**：没有任何仓库内代码会拉起安装器；同一份
`Alpha File Manager_3.2.11-beta_x64-setup.exe` 被启动了至少 6 次。
**触发源在仓库之外**，但产品必须扛得住它 —— 这就是守卫要解决的问题。

### 2.3 修复：安装器单实例守卫

**规则：最低 PID 当选。** 同一份 setup 可执行文件同时活着多个副本时，
PID 最小的那个继续安装，其余的**立刻退出**。

- 重复实例在 **PREINSTALL 的最前面**就退出 → **不杀应用、不再装一遍**。
- 「最低 PID 当选」是确定性的：无论两个安装器怎么交错，**恰好一个**会继续。
  「谁先到谁当选」是竞态 —— 两个同时到 PREINSTALL 可能互相都看不到对方，于是两个都装。

**新增文件**：

| 文件 | 作用 |
|---|---|
| `src-tauri/installer/check-single-instance.ps1` | 判定逻辑（**纯 ASCII**） |
| `src-tauri/installer/_acceptance/test-single-instance-guard.ps1` | 判定表的验收脚本（**纯 ASCII**） |
| `src-tauri/installer/__tests__/single-instance-guard.test.ts` | 接线断言 + 判别力测试 |

**改动**：`src-tauri/installer/hooks.nsh`
- 三个新 `Var`：`AlphaSingleInstanceDuplicate` / `AlphaSilentMode` / `AlphaTempOption`。
- 新函数 `AlphaCheckSingleInstance`：`File` 内嵌脚本 → 清理残留标记 → `nsExec::ExecToLog` 跑它 →
  `IfFileExists` 看标记文件。
- `NSIS_HOOK_PREINSTALL` **最前面**插入 `Call AlphaCheckSingleInstance`，
  判为重复就 `DetailPrint` + （非静默时）`MessageBox` + `Quit`。

**为什么用标记文件而不是读 nsExec 的退出码**：
`nsExec::ExecToLog` 不回传退出码；`ExecToStack` 的压栈顺序（先压返回值还是先压输出）
不值得赌。标记文件是确定性的。

**静默模式**：`/S` 下没有界面，弹模态框会把安装**永远卡住**（没人点它）。
所以 `MessageBox` 被 `AlphaSilentMode` 保护。

**守卫坏了不能变成「谁都装不上」**：脚本跑不成时标记文件不存在 → 守卫按「放行」处理。

### 2.4 验证（做过的）

| 验证 | 手段 | 结果 |
|---|---|---|
| 判定表 5 例 | `_acceptance/test-single-instance-guard.ps1` | 全绿（exit 0） |
| 判别力 | 把选举判据改成 `... -and $false` | **恰好 2 条转红**，harness 正确报 `FAILED: 2` 且 exit 1 |
| NSIS 语法 | `makensis installer.nsi` | **编译通过**（exit 0） |
| 脚本真的进了包 | `makensis /V4` | `File: "check-single-instance.ps1"->"$PLUGINSDIR\check-single-instance.ps1" 9576 bytes` |
| NSIS 指令真的读源文件 | 把 `File` 路径改成不存在的文件 | 编译失败并精确指向 `hooks.nsh:216` |
| 接线顺序 | vitest 断言 `Call AlphaCheckSingleInstance` 的位置 < `Call AlphaTerminateAppProcesses` | 绿 |

### 2.5 ⚠️ 残留风险（**必须在下轮处理或明确告知用户**）

1. **守卫跑在向导页之后。**
   Tauri 2.x 的 NSIS 模板**只有 4 个钩子**（`NSIS_HOOK_PREINSTALL` / `POSTINSTALL` /
   `PREUNINSTALL` / `POSTUNINSTALL`）—— 已在 tauri CLI 二进制里搜过这 4 个常量，
   `.onInit` 是模板自己的、**无法覆盖**（NSIS 不允许重名函数）。
   于是「重装 / 卸载选择页」可能**先于**守卫执行：重复安装器仍可能触发一次卸载。
   守卫能保证的是「不重装、不杀应用」，**保证不了「不卸载」**。

2. **重复的向导窗口仍会出现。** 守卫在 PREINSTALL，用户可能已经看到多个向导。

3. **没有真机验证。** 需要一次真机安装（故意连开几个安装包）来确认：
   - 标记文件判定在真实进程枚举下工作；
   - `MessageBox` 在真实交互下不卡死；
   - 静默模式（`/S`）下不弹框。

4. **守卫日志**：`%TEMP%\alpha-file-manager-installer-guard.log`（与 kill 日志分开）。

---

## 3. #1/#2 上传/下载 + 远程权限设置

### 3.1 后端（Rust，worker 交付，本会话独立复核）

4 个新 command（`src-tauri/src/remote/commands.rs`）：

```rust
remote_upload_path(app, local_path: String, remote_dir: String) -> Result<RemoteTransferReport, RemoteError>
remote_download_path(app, remote_path: String, local_dir: String) -> Result<RemoteTransferReport, RemoteError>
remote_chmod(app, remote_path: String, mode: u32, recursive: bool) -> Result<RemoteChmodReport, RemoteError>
remote_get_permissions(app, path: String) -> Result<Option<u32>, RemoteError>
```

- 新文件 `src-tauri/src/remote/transfer.rs`：报告结构 + 递归编排（对 `&dyn RemoteProvider` 泛型化，
  三协议共用一套规则，单测用 `fake.rs` 跑完整棵树）。
- `provider.rs` 的 trait 新增 5 个方法，**刻意不给默认实现**。
- 报告结构体**不加** `#[serde(rename_all = "camelCase")]` → 字段是 snake_case。

**协议支持矩阵**：

| 协议 | 上传 | 下载 | 递归 | chmod | 读权限位 |
|---|---|---|---|---|---|
| SFTP | ✅ | ✅ | ✅ | ✅ | ✅ `Some(low 12)` |
| FTP | ✅ | ✅ | ✅ | ❌ `Protocol` 错误 | `Ok(None)` |
| FTPS | ✅ | ✅ | ✅ | ❌ `Protocol` 错误 | `Ok(None)` |

**红线复核**（去注释后逐行扫）：`src-tauri/src/remote/` 下**只有 `commands.rs`** 引用
`tauri::`（`tauri::Manager` / `tauri::AppHandle` / `tauri::command` / `tauri::async_runtime::spawn_blocking`）。
`cargo test --lib` 的测试二进制**正常加载**（无 `STATUS_ENTRYPOINT_NOT_FOUND` 0xC0000139）。

**独立复核**：`cargo test --lib` 本会话复跑 = **645 passed / 0 failed**（基线 600，+45）。

### 3.2 前端（`src/modules/remote/`）

| 文件 | 作用 |
|---|---|
| `utils/remote-permissions.ts` | 八进制 ↔ rwx 三元组换算（纯函数） |
| `utils/remote-transfer-targets.ts` | 模块级登记表：对面那一格的本地/远程路径 |
| `utils/remote-transfer.ts` | invoke 封装 + TS 类型 |
| `utils/remote-context-menu-visibility.ts` | 三个菜单项的可见性判定 |
| `utils/remote-permissions-dialog-state.ts` | 权限对话框的模块级状态 |
| `components/remote-permissions-dialog.vue` | 权限设置对话框 |

**改动**：`types.ts`（`ContextMenuAction` 加三个动作）、`use-context-menu-items.ts`、
`file-browser-actions-menu.vue`（三个菜单项）、`use-file-browser-actions.ts`（分派 + 顺序执行）、
`navigator.vue`（登记目标 + 渲染**唯一一个**对话框）。

**传输目标是「对面那一格当前路径」**，不弹文件夹选择器（与上一轮 §15.3 一致）。

**i18n**：17 个语言包新增顶层 `remote.transfer` + `remote.permissions` 段。
只有 `ch.json` 给真实译文，其余 16 个用英文占位（本项目既有做法）。
生成脚本 `.superpowers/sdd/add-remote-transfer-i18n.cjs`（幂等，含逐键回读校验）。

### 3.3 ⚠️ 本轮抓到的真 bug：`remote_get_permissions` 的参数名

Tauri v2 按「**Rust 参数名的 camelCase 形式**」匹配 JS 传进来的键。
这个换算只有**下划线**这一处会咬人：

```
Rust `remote_path`  ->  JS `remotePath`   ✅
Rust `path`          ->  JS `path`         ✅
Rust `path`          ->  JS `remotePath`   ❌  换算成 remote_path，对不上
```

后端 `remote_get_permissions` 的参数叫 `path`，前端传了 `remotePath` ——
**真机上会炸成「unknown field remote_path」**。
两边各自单测都绿（前端 mock 掉了 invoke，Rust 单测根本不经过 Tauri 的参数绑定）。

**已修**（前端改成 `{ path: remotePath }`），并补了一道**跨语言契约测试**：
`src/modules/remote/utils/__tests__/remote-transfer.test.ts` 直接读
`src-tauri/src/remote/commands.rs` 抠出参数名，与前端实际传的键逐条比对。

> 注入验证：把 `path` 改回 `remotePath` → **恰好 1 条转红**，
> 报 `expected [ 'remotePath' ] to deeply equal [ 'path' ]`。

### 3.4 本轮顺手收紧的一条语义

「权限设置」菜单项**改为只对单选开放**。后端 `remote_chmod` 收的是**一个**路径，
多选时前端只能挑第一个去改 —— 菜单项还显示着，用户却以为选中的那几个都被改了。
宁可不显示，也不做「改了一半」的事。（目录内部的整棵子树由对话框里的
「同时应用到子目录」负责，不需要多选。）

---

## 4. 门禁

| 项 | 结果 |
|---|---|
| `cargo test --lib` | **645 通过 / 0 失败**（基线 600，+45） |
| `npx vitest run` | **202 文件 / 1777 用例全过**（基线 198 / 1713） |
| `npx vue-tsc --build` | **0 error** |
| `npx eslint src` | **170**（= 上一轮基线 170） |
| 新增/改动文件的 eslint | **0 违规** |
| `makensis installer.nsi` | **编译通过** |

> **eslint 口径**：上一轮基线是 170，本轮中途一度到 178。
> 逐文件核对后确认**多出来的 8 条全在本轮新写的测试用例里**
> （`use-file-tree.test.ts` 的 DirEntry 字面量写成单行，触发
> `@stylistic/object-property-newline`）—— 已改成多行。
> 后来新增 `remote-transfer.test.ts` 时又带来 4 条（同样是单行对象字面量），
> 也已修掉。最终回到 **170**，本轮**新代码自身 0 违规**。

> **vitest 口径**：`202 文件 / 1777 用例`这一轮跑完之后又新增了
> `remote-transfer.test.ts`（5 条）与「多选不显示权限设置」1 条用例，
> 最终数字见 §6。

---

## 5. 踩坑记录（本轮新增，供下轮直接复用）

### 5.1 PowerShell 变量名**不区分大小写**

```powershell
param([int[]]$SiblingPids = @())
...
$siblingPids = @()          # ← 这一行把参数覆盖成空数组！
if ($SiblingPids.Count -gt 0) { ... }   # 永远为假
```

结果：测试专用分支永远进不去，脚本一直在枚举真实进程。
**症状**：参数传了却「像是没传」，而且没有任何报错。

**规则**：PowerShell 里 `$Foo` 与 `$foo` 是**同一个变量**。局部变量名不要只是
参数名的大小写变体。

### 5.2 `powershell -File` 的数组参数绑定

`powershell -File s.ps1 -Ids 100,300` 传给 `[int[]]` 参数时，
"100,300" 被当成**一个数** `100300`（不是两个 id）。
**规则**：跨进程传数组用**逗号分隔的字符串**参数，在脚本里 `-split ','` 解析。

### 5.3 PowerShell 函数里的 `$failures++` 是**假绿**

函数体在**子作用域**执行，`$failures++` 改的是副本，脚本最后仍然报「OK」。
**规则**：函数里要改脚本级变量，用 `$script:failures++`。
（这正是本项目反复强调的「判绿时必须先问『探针真的跑到被测对象了吗』」的 PowerShell 版。）

### 5.4 `.cmd` 文件必须**纯 ASCII**

第一版 `test-lib.cmd` 写了中文注释。cmd.exe 按系统 ANSI 代码页（GBK）读 `.cmd`，
UTF-8 的中文变成乱码，**乱码里的字符被当成命令执行**，脚本最后报
`vcvars64 failed` —— 看起来像 MSVC 环境坏了，实际是编码问题。
**规则**：`.cmd` / `.ps1` 一律纯 ASCII，中文说明写在 `.md` 或 `.nsh` 里。
（同 `installer/kill-app-tree.ps1` 的既有约束。）

### 5.5 `nsExec` 的退出码不取，判定走标记文件

`nsExec::ExecToLog` 不回传退出码；`ExecToStack` 的压栈顺序不值得赌。
**规则**：NSIS 侧需要知道子进程结论时，让子进程**落一个标记文件**，
NSIS 用 `IfFileExists` 读。

### 5.6 eslint 的 `object-property-newline` 与 DirEntry 字面量

测试里造 `DirEntry` 时，单行写多个属性会触发
`@stylistic/object-property-newline`（本项目 170 条基线里的大头就是这个）。
**规则**：新测试文件里的对象字面量一律多行。

### 5.7 `func-style` 与死代码

`const toTriple = (v) => ({...})` 触发 `@stylistic/func-style`（要函数声明）；
写了但没用的 `isPermissionTriplet` 触发 `no-unused-vars`。
**规则**：纯函数文件里的内部辅助一律用函数声明；写完立刻单独 eslint 一次这个文件。

### 5.8 ⚠️ `as-child` 会删掉子节点的模板 ref（框架级陷阱，影响面比想象的大）

reka-ui 的 `as-child` 走 `node_modules/reka-ui/dist/Primitive/Slot.js`，
那里有一行 `delete firstNonCommentChildren.props?.ref;` ——
**直接子元素上的模板 ref 会被主动删掉**，而且**不报任何错**。

本项目里 `<ContextMenuTrigger as-child>` 用在文件浏览器树、文件浏览器、空白状态等多处。
**凡是要在 trigger 的直接子元素上挂 ref（做滚动定位、量尺寸、聚焦），都会静默失败。**

**规则**：

- 要 ref 的元素**往里再套一层**，别放在 trigger 的直接子元素上；
  或者干脆不要 ref，改用 `querySelector` 之类的其它拿法。
- 写完「要操作某个 DOM 元素」的代码，**加一条断言证明那个元素真的被找到了** ——
  本轮的定位功能写了、测试也覆盖了，却一次都没真正执行过，
  就是因为没有任何一条断言检查过 `ref` 到底是不是 null。

> 这条的通用教训与 §1.6 根因 C 相同：**「代码写了」不等于「值到了」**。
> 判据只能是「目标状态真的变了吗」，不是「实现看起来对吗」。

---

## 6. 最终门禁数字

> 下表是**第二轮（目录树定位）做完并重新打包后**的数字。
> 第一轮的 202 文件 / 1777 用例那组数字见 git 历史与本文件 §1.6 之前的内容。

| 项 | 结果 |
|---|---|
| `cargo test --lib` | **645 通过 / 0 失败**（Rust 侧本轮无改动，与第一轮同） |
| `npx vitest run` | **204 文件 / 1795 用例全过**（第一轮 202 / 1777） |
| `npx vue-tsc --build` | **0 error** |
| `npx eslint src` | **170**（= 基线；本轮新增 8 条 → 已全部修掉，**没有把基线存量一起改掉**） |
| 本轮新增/改动文件的 eslint 增量 | **0**（只修自己新写的代码，存量违规一行没动） |
| `makensis installer.nsi` | **编译通过**（exit 0，第一轮） |

> 本轮新增/改动的单测：
> - `src/modules/navigator/composables/__tests__/remote-tree-reveal.test.ts`（7 条）
>   —— store → `useFileTree` 真实链路；含第三层深层树与「切回远程格」两条关键用例。
> - `src/modules/navigator/components/file-browser/__tests__/file-browser-tree-view.test.ts`（+3 条）
>   —— 组件层的高亮 + 滚动定位。
> - `src/modules/navigator/utils/__tests__/tree-reveal.test.ts`（7 条）——
>   `computeRevealScrollTop` 的纯算术。

> ⚠️ **eslint 的 170 是怎么守住的**（本轮踩过的坑，见 §5.6）：
> 第一轮结束时 `eslint src` 是 170；本轮一度涨到 **178**。
> 定位办法是**逐文件数**，不是看总数：
> - `use-file-tree.ts` +2（新写的两处缺空行）
> - `file-browser-tree-view.vue` +1（模板多套一层，属性挤在一行）
> - `file-browser-tree-view.test.ts` +4（新测试块的对象字面量 / 缺空行）
>
> **只修自己新写的 8 条**，不碰基线存量 —— `eslint src --fix` 会把存量一起修掉，
> 总数就掉到 170 以下，**下轮就没法拿同一个数字对照了**（见 AGENTS.md 的门禁口径约定）。

---

## 7. 还没做的

1. **本轮全部功能没有真机验收。**
   下一轮必须用 `tauri build` 的**打包产物**装机（`tauri dev` 的路由页内容区是空白的，
   界面结论一律作废），逐条验：
   - 本地面板右键「上传」→ 传到对面远程格；
   - 远程面板右键「下载」→ 存到对面本地格；
   - 远程面板右键「权限设置」→ 读出当前权限、改完生效；
   - 目录树激活远程后**真的展开**到当前目录；
   - **当前目录那一行高亮、并且被滚到可见处**（远程路径深，本地只有两三层，
     这个缺陷在本地几乎看不出来）；
   - **当前目录在第三层**（远程里再往里点一层）时，树里**不能冒出并列的根**；
   - 故意连开几个安装包 → 只有一个装、只启动一次。

2. **#4 的守卫没有真机验证**（见 §2.5）。

3. **后端没做的**（worker 明确列出）：
   断点续传、大文件流式（全量进内存）、权限保持（uid/gid/mtime）、
   符号链接（不跟随、不传输，进 `failures`）、会话复用（每个条目一次建连 + DPAPI 解密）。

4. **SFTP 端到端无真服务端测试** —— 仓库没有假 SFTP 夹具，
   SFTP 侧只测到「开 socket 之前」这一层，叶子动作靠假 provider 覆盖。

5. **交接文档本身没写完的部分**：`docs/handoff-2026-10-18-remote-phase-2-ftp.md`
   本轮被继续修改（追加了本轮内容？—— 提交前请确认它与本文件的关系，不要两份打架）。

6. **未提交。** 提交前请：
   - `git status` 看清全部已跟踪 + 未跟踪路径的全貌；
   - 提交信息用 `write` 工具落盘再 `git commit -F`（**不要**用 `node -e` 内联生成，
     PowerShell 会先于 node 解析引号）；
   - 提交信息文件放在 `.superpowers/sdd/` 这类 git-ignored 路径，不要放 `.git/`。
