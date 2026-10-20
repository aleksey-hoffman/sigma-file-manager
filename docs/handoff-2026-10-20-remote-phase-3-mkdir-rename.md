# 交接文档：远程新建目录 + 远程重命名（阶段 3 收尾，2026-10-20）

- 日期：2026-10-20
- 分支：`main`
- 本轮提交：`6c1e4bc9`
  （`feat(remote): 远程新建目录 + 远程重命名 —— 阶段 3 收尾`，
  55 files changed / 3075 insertions / 16 deletions）
- 版本：**3.2.12-beta**（3.2.11 已公开发布，同号换内容会让「哪个包是哪个」分不清）
- 上一棒：`docs/handoff-2026-10-20-release-3.2.11.md` §11「下一棒从哪开始」
- 规格：`docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md`
- 计划：`docs/superpowers/plans/2026-10-20-remote-phase-3-mkdir-rename.md`
- 工作区状态：**干净**（本轮已全部提交）
- **对外发布没做**（上传站点 / GitHub release / push）—— 需要用户明确同意

## 0. 本轮范围

把规格里**阶段 3 剩下的两项**做掉，并在真机上（fnOS SFTP）验过：

| 能力 | 规格出处 | 状态 |
|---|---|---|
| 远程新建目录 | §5「新建目录 ✅」 | ✅ 本轮实现 + 真机验收 |
| 远程重命名 | §5「重命名 ✅」 | ✅ 本轮实现 + 真机验收 |
| 远程新建空文件 | §1 **永久非目标** | 🚫 永久屏蔽（不是「没做」） |

**没做**（明确留给后面）：远程跨目录移动、远程批量改名、远程权限的写侧扩展、FTP 的 `STOR` / SFTP 的 `CREATE`（永久不做）。

## 1. 后端（Rust）

### 1.1 路径工具

`src-tauri/src/remote/path.rs` 新增两样：

- `validate_remote_entry_name(name)` —— 拒空、拒 `.` / `..`、拒含 `/` 或 `\`、拒含控制字符。
- `join_remote_parent_and_name(parent, name)` —— 目标路径由**源路径的父目录**推导。

**为什么名字校验放在开连接之前**：名字不合法的请求根本不该去连服务器。`remote/commands.rs` 里两条新 command 都是先校验再开连接。

### 1.2 trait 新方法

`src-tauri/src/remote/provider.rs`：

```rust
fn rename_path(&self, connection_id: &str, from_path: &str, new_name: &str) -> RemoteResult<()>;
```

三个设计决定：

1. **签名用 `(from_path, new_name)`，不是 `(from_path, to_path)`。**
   改名语义是「原目录内换名字」。用完整目标路径会把「跨目录移动」混进来 ——
   前端只要把父目录算错一次，就变成一次远程移动。
2. **刻意不给默认实现。**
   沿用 `set_permissions` / `remove_path` 的既定纪律：宁可编译器逼每个 provider 表态，
   也不要一个「默认返回不支持」的桩把某个协议悄悄漏掉。
3. **目标路径由后端从源路径父目录推导**（`join_remote_parent_and_name`），
   三种协议行为一致，前端不需要知道各协议的目标路径语法。

### 1.3 四个 provider

| provider | 实现 | 说明 |
|---|---|---|
| `fake.rs` | 真改树 | 改条目名/路径；目录改名时**整棵子树换键**；文件内容表与权限表同步换键 |
| `ftp_provider.rs` | `rename_via_control()` | `CWD` 到父目录 → `RNFR 旧名`(350) → `RNTO 新名`(250) |
| `ftps_provider.rs` | 逐字复用 `super::ftp_provider::rename_via_control` | FTPS 的控制通道与 FTP 同构 |
| `sftp_provider.rs` | 标准 `SSH_FXP_RENAME` | **不用** `posix-rename@openssh.com` |

**SFTP 为什么用标准 RENAME 而不是 posix-rename 扩展**：标准版在目标已存在时**失败**，
不会静默覆盖同名文件；posix-rename 扩展会直接覆盖。宁可报错也不要悄悄吃掉一个文件。

### 1.4 两条新 command

`src-tauri/src/remote/commands.rs`：

```rust
#[tauri::command] pub async fn remote_make_dir(app: AppHandle, remote_path: String) -> RemoteResult<()>
#[tauri::command] pub async fn remote_rename_path(app: AppHandle, from_path: String, new_name: String) -> RemoteResult<()>
```

`src-tauri/src/lib.rs` 的 `generate_handler!` 注册了两条。

> ⚠️ **参数名是契约**。Rust 的 `remote_path` 在 JS 侧必须叫 `remotePath`，
> `from_path` → `fromPath`，`new_name` → `newName`。
> 两边单测全绿也测不出这个 —— 见 §3.3 的跨语言契约门禁。

## 2. 前端（Vue / TS）

### 2.1 编排层：`src/modules/remote/utils/remote-write.ts`（新文件）

`remote-transfer.ts` 是**调用层**（只有 invoke 封装），`remote-write.ts` 是**编排层**
（拼路径、映射错误、决定哪些能做哪些不能做）。产品规则只落在这一个文件里：

- `canCreateFileIn(directoryPath)` —— 远程永远不行。
- `hasRemoteTarget(directoryPaths)` —— 混选时只要有一个远程就整体不算。
- `canCreateItemIn(itemType, directoryPaths)` —— **唯一**能回答「这个新建动作可不可行」的地方。
- `buildRemoteChildPath(parentPath, name)` / `createRemoteDirectory(name, targetDir)` /
  `renameRemoteEntry(entry, newName)` / `remotePathAfterRename(entryPath, newName)`。

### 2.2 门禁：`src/utils/entry-action-policy.ts`

`REMOTE_PHASE0_BLOCKED_ACTIONS` 里：

- **移出 `rename`** —— 远程重命名已实现。
- **移入 `create-file`** —— 规格 §1 的**永久非目标**。
- `create-directory` **不在**集合里 —— 阶段 3 已实现远程新建目录。
- `batch-rename` **留在**集合里 —— 批量改名是另一件事，阶段 6/7 再议。

### 2.3 三个绕过门禁的创建类调用点（顺带修掉的老缺陷）

`dir-entry-context-menu.vue` / `file-browser-context-menu.vue` / `file-browser-status-bar.vue`
原先**直接**调 `openNewItemDialog`，没过 `isActionBlockedByEntryPolicy` ——
这正是上一棒交接 §7.1 记的「点了报 `Directory does not exist: sfm://remote/...`」的根因。
现在三者都先过中央收口的 `isActionBlockedByEntryPolicy`。

### 2.4 入口隐藏

渲染「新建文件」的**三个**地方，都要各自接门禁：

| 组件 | 入口 | 状态 |
|---|---|---|
| `file-browser-toolbar-create-button.vue` | 工具栏「＋」下拉 | ✅ `canCreateFile` prop |
| `file-browser-new-submenu.vue` | 右键「新建」子菜单 | ✅ `canCreateFile` prop |
| `file-browser-toolbar-nav-buttons.vue` | 工具栏「⋯」下拉 | ✅ `canCreateFile` prop（**真机验收时才发现漏了**，见 §9.4） |

另外：`file-browser-actions-menu.vue` 计算 `canCreateFile`；
`file-browser-toolbar.vue` 新增 `currentPath` prop 并据此计算；
`file-browser.vue` 传 `:current-path="fb.currentPath.value"`。

> **「三个地方都要各自接」不是冗余，是必须。**
> 真机验收时前两处都接了，第三处（工具栏「⋯」下拉）漏了 ——
> 远程格的下拉里明晃晃摆着一项「新建文件」。
> 靠 grep 找 `navigator.newFile` 能找到**渲染**的三个地方，
> 但「哪几个接了门禁」只能逐个看。

### 2.5 快捷键这道口子（本轮真机验收才发现的 UX 缺口）

**问题**：入口藏了，但**快捷键绕过所有菜单**。
远程格按 `Ctrl+Shift+M` 照样弹出一个「新建文件」对话框 ——
而这个对话框**注定不会成功**（远程不能新建空文件）。
原实现只在用户填完名字点「创建」之后才弹错误 toast，等于让人白填一遍。

**改法**：在 `use-file-browser-dialogs.ts` 的 `openNewItemDialog` 里加一道守卫。

选这个点的原因是它是**唯一**能拦住所有入口的地方 ——
右键菜单、工具栏、状态栏、快捷键、命令面板**全都从这里进**：

```
file-browser-context-menu.vue ─┐
file-browser-status-bar.vue   ─┤
file-browser.vue（工具栏）    ─┼→ openNewItemDialog ←── navigator.vue（快捷键）
navigator.vue（命令面板）      ─┘
```

守卫的判定用 `canCreateItemIn`（`remote-write.ts` 里的纯函数），
目标是远程 + 类型是 file → **不弹对话框**，当场给一句提示。

> **推广**：产品规则要落在**所有入口的汇合处**，不是逐个入口去挡。
> 逐个入口挡（菜单藏起来、工具栏藏起来）漏掉的正是快捷键 ——
> 快捷键不经过任何菜单。

### 2.6 本地账本不动

远程改名**不更新** `workspaces` / `userStats` / `userSettings` 三本本地账 ——
它们记的是本地路径。只让 `folderTreeStore.markTreeStale` 知道「这一层变了」。

## 3. i18n

17 个语言包（ch/de/en/es/fa/fr/he/hi/hy/it/ja/pt/ru/sl/tr/ur/vi）各加两个键：

- `remote.write.fileCreationNotSupported` —— 「远程目录不支持新建空文件。」
- `remote.write.fileCreationNotSupportedTitle` —— 「无法新建文件」

> 标题**不复用** `failedToCreateNewFile`（"创建文件失败"）——
> 那一串描述的是「尝试过但失败」，而这里是「压根不给你试」。

一次性脚本：`.superpowers/sdd/add-remote-write-label.cjs`、`add-remote-write-title.cjs`
（git-ignored，每文件只 +4 行，其余内容逐字不动）。

## 4. 测试

| 文件 | 作用 |
|---|---|
| `src/modules/remote/utils/__tests__/remote-write.test.ts` | 编排层纯函数 |
| `src/modules/remote/utils/__tests__/remote-command-contract.test.ts` | **跨语言契约门禁** |
| `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-dialogs.test.ts` | 快捷键那道守卫 |
| `src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts` | 「⋯」下拉的「新建文件」入口 |
| `src/utils/__tests__/entry-action-policy.test.ts` | 门禁集合的进出 |

### 4.1 跨语言契约门禁（为什么必须有）

Rust 侧 `remote_path` ↔ JS 侧 `remotePath` 是本项目**反复咬人**的地方。
两边单测全绿也测不出来：前端 mock 掉了 `invoke`，Rust 单测根本不经过 Tauri 的参数绑定。

做法：**不 mock 后端**，直接读 `src-tauri/src/**/*.rs` 的正则抽签名 →
snake_case 转 camelCase → 与前端实际传出去的键逐条比对。
源码一变测试立刻红，**不需要跑 Rust**。

### 4.2 注入验证（都做过）

| 注入 | 期望 | 实测 |
|---|---|---|
| 把 `remote_make_dir` 的参数从 `remotePath` 改成 `path` | 契约门禁红 | ✅ 红，报「缺少 remotePath（实际传了 path）」 |
| 把 `openNewItemDialog` 的守卫改成 `if (false && ...)` | 守卫单测红 | ✅ 3 条红，2 条阳性对照仍绿 |
| 把「⋯」下拉的 `v-if` 改成 `false && props.canCreateFile` | 阳性对照红 | ✅ 红（**但这一轮注入做错了，见下**） |
| 把「⋯」下拉的 `v-if` 改成恒真 `true`（模拟门禁不存在） | 负例红 | ✅ 红 —— **这一轮才是对的** |
| 假 provider 目录改名时只换目录不换子项自身名字 | 断言红 | ✅ 逼出了真 bug，已修 |

> **注入验证的方向要跟被测断言的方向一致。**
> 门禁的负例（「`canCreateFile=false` 时不该渲染」）要证明的是**门禁在起作用**，
> 所以注入必须让门禁**失效**（恒真），负例才转红。
> 我第一次注入改成了恒假 —— 那只证明了「这项会渲染」，
> 负例照样绿。**判绿时先问「这个用例测得到被测的那道门禁吗」。**

## 5. 门禁（逐字对照基线）

| 项 | 基线 | 本轮实测 |
|---|---|---|
| `cargo test --lib` | 651 passed | **666 passed / 0 failed**（+15） |
| `npx vitest run` | 211 文件 / 1893 用例 | **214 文件 / 1925 用例，全过**（+3 文件 / +32 用例） |
| `npx eslint src` | 170 errors / 0 warnings | **170 / 0** |
| `npx vue-tsc --build` | 0 error | **0 error** |
| `node scripts/verify-changelog.mjs` | OK | **OK** |

> eslint 口径是 **`eslint src`**，不是 `eslint .`（整仓是 186/121）。
> 混口径会凭空多出 7 个「回归」。

## 6. 版本号

`3.2.11` → **`3.2.12-beta`**。

3.2.11 已经公开发布过，**同号换内容会让「哪个包是哪个」再也分不清** ——
这是本项目在 3.2.5-beta 那次就定下的纪律。

改动落在：`package.json` + 3 个 `Cargo.toml`（`npm run sync-version`）+
`CHANGELOG.md` + `public/changelog/ch/changelog.md`。

## 7. 真机验收

环境：fnOS SFTP，`192.168.1.9:22`，用户 `duanyi`，
连接「速豹堂」connectionId `e2b24ab525544dc7adeb5cedb192179b`。
夹具目录 `/vol1/@team/study_platform/wp_root/upgrade/`（**属主是自己**）。

> ⚠️ 破坏性验收的靶子必须是自己造的夹具。
> 上一轮拿真实 WordPress `index.php` 当「删不掉」的靶子，结果**删成功了**，
> 用户站点首页从 200 变 403。见 `docs/handoff-2026-10-20-remote-delete-and-list-columns.md` §6。
> 本轮只做**新建**和**改名**，不删站点目录里的任何东西。

验收明细见 §9。

## 8. 常用命令速查

```powershell
# 门禁
npx vue-tsc --build
npx eslint src
npx vitest run
.superpowers\sdd\cargo-test-lib.cmd      # 内部已注入 MSVC + cargo 路径
node scripts/verify-changelog.mjs

# 打包（**先杀进程**，否则 pdb 被占报 os error 32）
Get-Process alpha-file-manager -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process cmd -ArgumentList '/c','.superpowers\sdd\build-acceptance.cmd > .superpowers\sdd\build.log 2>&1' -WorkingDirectory '<repo>' -WindowStyle Hidden

# 装机
& '.\.superpowers\sdd\install-artifact.ps1' -Installer '<repo>\release\Alpha File Manager_3.2.12-beta_x64-setup.exe'

# 工作区钉住 / 还原（应用必须关闭）
node .superpowers\sdd\pin-phase3-split.cjs pin 'C:\Users\Duanyi\afm-acceptance' 'sfm://remote/e2b24ab525544dc7adeb5cedb192179b/vol1/@team/study_platform/wp_root/upgrade'
node .superpowers\sdd\pin-phase3-split.cjs restore

# 取证
& '.\.superpowers\sdd\capture-screen.ps1' -Out '<abs>.png' -SettleMs 1200 -WinW 2400 -WinH 1300
& '.\.superpowers\sdd\click-webview-point.ps1' -X 1450 -Y 247 -SettleMs 2500
& '.\.superpowers\sdd\app-key.ps1' -Keys 'F2' | 'CTRL+SHIFT+N' | 'CTRL+SHIFT+M' | 'ESC'
& '.\.superpowers\sdd\paste-and-enter.ps1' -Text '<name>' -SettleMs 4000

# 远程夹具（SSH 公钥通道）
ssh -i 'E:\Users\Duanyi\.ssh\id_ed25519' -o BatchMode=yes duanyi@192.168.1.9 '<cmd>'
```

## 9. 真机验收明细

### 9.1 环境

| 项 | 值 |
|---|---|
| 装机产物 | `release\Alpha File Manager_3.2.12-beta_x64-setup.exe`（20,346,038 字节，18:12:27，SHA256 `39E92248…79D2`） |
| 装机 exe | `D:\Program Files\Alpha File Manager\alpha-file-manager.exe`（55,186,432 字节，SHA256 `15600245…5F0A`） |
| 服务器 | fnOS SFTP `192.168.1.9:22`，用户 `duanyi` |
| 连接 | 「速豹堂」connectionId `e2b24ab525544dc7adeb5cedb192179b` |
| 夹具目录 | `/vol1/@team/study_platform/wp_root/upgrade/`（**属主是自己**） |
| 窗口 | 2400×1300 物理像素，DPI 150% |

> ⚠️ 这个包是**补完第二处缺口之后重打的**。
> 第一版包（20,338,419 字节，17:54:14）验过「新建目录没被误伤」，
> 但「⋯」下拉的缺口是在那之后才发现并修的 ——
> 补完必须**重打包、重装机、重验**，不能拿旧包的结论当新包的结论。

### 9.2 验收 A：远程重命名 ✅

1. 点右格远程条目 `afm-phase3-fixture` → **选中态已确认**（阳性对照，证明点击到位）。
2. 按 `F2` → 重命名框打开，名字 `afm-phase3-fixture` 全选。
3. `Set-Clipboard` + `Ctrl+V` 粘 `afm-phase3-renamed` → Enter。
4. **SSH 独立复核**：

```
afm-phase3-renamed   存在
afm-phase3-renamed/inside.txt   子文件跟着搬过去
afm-phase3-fixture   ls 报 No such file or directory
```

界面同步显示新名。

**在最终包上又复验了一遍**（把 `afm-phase3-newdir` 改名成 `afm-phase3-dir-renamed`）：

```
drwxr-xr-x 1 duanyi Users  0 Oct 20 17:34 afm-phase3-dir-renamed
ls: cannot access '.../afm-phase3-newdir': No such file or directory
```

注意 **mtime 仍是 17:34**（创建那一刻）—— 说明这是**改名**，不是「删了重建」。

### 9.3 验收 B：远程新建目录 ✅

1. 远程格按 `Ctrl+Shift+N` → 「新建目录」对话框打开。
2. 粘 `afm-phase3-newdir` → Enter。
3. **SSH 独立复核**：远程出现 `afm-phase3-newdir`（空目录）。
4. **反向对照**：本地格 `C:\Users\Duanyi\afm-acceptance` **未被误建**
   （仍只有 `afm-upload-dir` / `afm-download-probe.txt` / `remote-delete-probe.txt`）——
   证明快捷键作用在正确的远程格。

### 9.4 验收 C：远程格没有「新建文件」入口 ✅（本轮真机才发现的缺口）

**这一项不是一开始就有的，是真机撞出来的。**

#### C-1 快捷键绕过所有菜单（第一处缺口）

| 步骤 | 期望 | 实测 |
|---|---|---|
| 本地格按 `Ctrl+Shift+M` | 弹「新建文件」对话框 | ✅ 弹了（**阳性对照**：证明快捷键确实到了应用） |
| 远程格按 `Ctrl+Shift+M` | **不弹对话框**，当场给提示 | ✅ **不弹**，toast：「无法新建文件 / 远程目录不支持新建空文件。」 |

（第一轮验收时这里是**弹了**一个注定失败的对话框 —— 这就是 §2.5 那道守卫的由来。）

#### C-2「⋯」下拉里还明晃晃摆着「新建文件」（第二处缺口）

打开远程格工具栏的「⋯」下拉，截图显示：

```
返回 / 前进 / 向上 / 位置 / 刷新 / 网络 / 缩略图大小
──────
新建目录  Ctrl+Shift+N
新建文件  Ctrl+Shift+M     ← 远程格里这一项不该在
```

**根因**：渲染「新建文件」的**三个**地方，我只接了门禁的两个 ——
`file-browser-toolbar-nav-buttons.vue` 的「⋯」下拉**漏了**。
（三个地方：工具栏「＋」下拉、右键「新建」子菜单、「⋯」下拉。）

**改法**：给 `file-browser-toolbar-nav-buttons.vue` 加 `canCreateFile` prop，
由 `file-browser-toolbar.vue` 传下去（它已经在算这个值了）。

**重打包后在最终包上复验**：

| 面板 | 「⋯」下拉里有没有「新建文件」 | 实测 |
|---|---|---|
| **远程格** | 应该没有 | ✅ 没有，只到「新建目录 Ctrl+Shift+N」 |
| **本地格**（阳性对照） | 应该有 | ✅ 有：「新建目录 Ctrl+Shift+N」+「新建文件 Ctrl+Shift+M」 |

**注入验证**（两轮，方向不同）：

| 注入 | 期望转红的用例 | 实测 |
|---|---|---|
| `v-if="false && props.canCreateFile"` | 阳性对照（`canCreateFile=true` 时该项应在） | ✅ 红 |
| `v-if="true"`（门禁恒真） | 负例（`canCreateFile=false` 时该项不该在） | ✅ 红 |

> **第一轮注入做错了**：把 `v-if` 改成恒假，只会让阳性对照转红，
> 负例仍然绿 —— 那证明的是「这项会渲染」，**不是**「门禁在起作用」。
> 门禁失效的注入必须是**恒真**（模拟门禁不存在），负例才转红。
> **判绿时先问「这个用例测得到门禁吗」。**

#### C-3「新建目录」没被误伤 ✅

远程格按 `Ctrl+Shift+N` → 「新建目录」对话框照常打开
（标题是「新建目录」，不是「新建文件」），粘 `afm-phase3-newdir2` → Enter。

**SSH 独立复核**：

```
drwxr-xr-x 1 duanyi Users  0 Oct 20 17:59 afm-phase3-newdir2
```

界面同步显示 `afm-phase3-newdir2`。

### 9.5 顺带复验的删除路径（上一轮的功能，本轮没改，但要确认没被带坏）

| 场景 | 期望 | 实测 |
|---|---|---|
| 删远程空目录 | 删掉 | ✅ SSH 复核目录消失 |
| 删**非空**远程目录 | 服务器拒绝，如实报错 | ✅ toast：「删除失败 / 这个远端目录不是空的，SFTP 不支持递归删除：…」 |
| 删远程文件 | 删掉 | ✅ SSH 复核文件消失（删完那个目录才变成空目录，于是能删了） |

### 9.6 ⚠️ 踩到的一条：分屏下「哪一格是活动格」由 `document.activeElement` 决定

**症状**：PostMessage 点右格的行 → 行**确实选中了**（高亮可见）→ 但按 `F2` **毫无反应**。

**根因**：`navigator.vue` 的 `getFocusedSplitPaneRef()` 靠 `document.activeElement`
判断哪一格是活动格：

```js
const activeElement = document.activeElement;
for (const pane of paneRefsMap.value.values()) {
  if (pane.rootElement?.contains(activeElement)) return pane;
}
```

而 `getActivePaneRef()` → `getNavigatorPaneRef()` → `getFocusedSplitPaneRef()`。
于是：**活动格还是左格**（我之前点开了左格的「⋯」下拉，真实鼠标点击把 DOM 焦点留在了那里），
`getActivePaneSelectedEntries()` 返回的是左格的选择 —— 左格没选中项 →
`checkItemSelected: hasSelectedItems` 为 false → **F2 被快捷键门禁直接挡掉**。

**结论**：

- **PostMessage 点击只改「选中」，不改「DOM 焦点」。**
- 想让某格成为活动格，必须用**真实鼠标点击**（`app-click.ps1`）——
  它 `SetCursorPos` + `SendInput`，DOM 焦点真的会跟着走。
- 症状是「快捷键没反应」时，先怀疑**活动格不对**，而不是「功能坏了」。

> 这一条差点变成一次假故障报告：第一次按 F2 没反应，
> 若当时直接判「远程重命名在新包上坏了」，就会去查一个根本没坏的代码路径。

### 9.7 清理

三个夹具（`afm-phase3-dir-renamed` / `afm-phase3-newdir2` / `afm-phase3-renamed`）
全部**通过应用自己的远程删除**清掉，SSH 复核 `upgrade/` 下已无 `afm-phase3*`：

```
ls /vol1/@team/study_platform/wp_root/upgrade/ | grep afm-phase3   →  (空)
```

（为什么不用 `ssh ... rm -rf`：本地安全门禁会拦下删除类命令；
而**用应用自己的删除**既清干净了，又顺带复验了删除功能 —— 一举两得。）

**本地侧**：工作区已用 `node .superpowers/sdd/pin-phase3-split.cjs restore` 还原：

```
group0 directory E:/办公文件/01学习资料/00.research
group0 directory C:/Users/Duanyi
```

（`user-workspaces.json.phase3-backup` 保留着 —— 下一轮 `pin` 会复用它，`restore` 也依赖它。）

### 9.8 证据文件

全部在 `.superpowers/sdd/`（git-ignored）：

| 文件 | 内容 |
|---|---|
| `c3-01-boot.png` | 首启「新功能」弹窗 —— 3.2.12-beta + 中文更新日志渲染正确 |
| `c3-03-local-newfile.png` | 本地格 `Ctrl+Shift+M` → 「新建文件」对话框（阳性对照） |
| `c3-05-sel-zoom.png` | 远程条目选中态（阳性对照：点击到位） |
| `c3-08-toast-zoom.png` | **远程格 `Ctrl+Shift+M` → 「无法新建文件 / 远程目录不支持新建空文件。」** |
| `c3-09-remote-newdir-dialog.png` | 远程格 `Ctrl+Shift+N` → 「新建目录」对话框（没被误伤） |
| `c3-11-newdir2-zoom.png` | 界面出现 `afm-phase3-newdir2` |
| `c3-12-actions-menu.png` | **「⋯」下拉里暴露「新建文件」的第二处缺口**（第一版包） |
| `c3-14-remote-dots-menu.png` | 修完后的**远程格**「⋯」下拉 —— 只到「新建目录」 |
| `c3-17-local-newfile-item.png` | 修完后的**本地格**「⋯」下拉 ——「新建文件」照旧在（阳性对照） |
| `c3-19-toast2-zoom.png` | 最终包上再次复验的 toast |
| `c3-24-rename3.png` | 「重命名项目」对话框（旧名全选） |
| `c3-27-list-zoom.png` | 改名后列表显示 `afm-phase3-dir-renamed` |
| `c3-34-notempty-zoom.png` | 删非空远程目录被服务器拒绝的提示 |
| `c3-38-confirm-file2-zoom.png` | 删远程文件的确认框（路径逐字正确） |

## 10. 遗留与建议

1. **对外发布没做**（上传站点 / 创建 GitHub release / push 到 `origin/main`）——
   那是**外部可见动作**，需要用户明确同意才做。
   本轮只做到「打包 + 装机 + 真机验过」，工作区**已全部提交到本地 `main`**。
2. **阶段 3 还剩的东西**：远程跨目录移动、远程批量改名。两者都**不在**本轮。
3. **FTP / FTPS 的远程写操作没有真机验过** —— 真机只有 SFTP。
   FTP 那条走的是控制连接（`CWD` + `RNFR` + `RNTO`），有 stub server 覆盖，
   但没有对着真实 FTP 服务器跑过。
4. **远程写操作断线不自动重放**（规格 §6.2）。这是有意的：
   重试分不清「服务器压根没收到」和「服务器做了、只是回执丢了」，
   而建出两个同名目录 / 把同一个东西改两次名，比给一句错误提示糟糕得多。
5. **`cargo test --lib` 的隐形红线**（AGENTS.md 已记）：
   任何被测试链接到的代码都不能碰到 `tauri::AppHandle` 或 `tauri::async_runtime::*`。
   本轮新增的 Rust 代码只在 command 层碰 `AppHandle`，业务层不碰。

## 11. 踩到的坑（都已在 AGENTS.md / 记忆里有同源条目）

- **分屏下「哪一格是活动格」由 `document.activeElement` 决定** ——
  PostMessage 点击只改「选中」不改「焦点」，快捷键会落到另一格去。
  要让某格成为活动格必须**真实鼠标点击**。详见 §9.6。
- **同一款产品规则散在三个入口上，少接一处就漏** ——
  「新建文件」在工具栏「＋」、右键「新建」子菜单、「⋯」下拉各渲染一次，
  三处都要各自接 `canCreateFile`。详见 §9.4。
- **注入验证的方向要跟被测断言的方向一致** ——
  验「门禁在起作用」就要让门禁**失效**（恒真），负例才转红。
  我第一轮注入成恒假，只证明了「这项会渲染」。详见 §9.4。
- 远程条目在文件列表里**不暴露 UIA 名字**，坐标只能从截图量取。
- 拿不到 webview console 是常态：release 包没有 devtools、wry 不透传 CDP。
  诊断信息必须**渲染进 DOM** 才能截图取读数。
- 本机 DPI 150%：物理像素 ÷1.5 = CSS 逻辑像素。
- `PrintWindow` 拍不到 hover / overlay 层（右键菜单、悬停面板）——
  这类交互只能走屏幕 DC BitBlt。
- **文件与目录的右键菜单项位置不一样** ——
  文件的菜单没有「在新标签页中打开」「新的」两项，所以「删除」往上挪了一格。
  写死的坐标会点到「添加到收藏」（本轮踩到）。
