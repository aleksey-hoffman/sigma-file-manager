# 远程阶段 3 收尾：远程新建目录 + 远程重命名

> 写入时间：2026-10-20
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
> 基线：`cc62d28b`（3.2.11 正式版发布提交）
> 上游约束：`F:\soft\00selfmade\filemanager\AGENTS.md`
> 规格：`docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md` §5 / §6 / §8

---

## 0. 这一轮做什么，为什么是它

规格 §8.1 把远程空间拆成 0–7 共八个阶段。上一轮（3.2.11）把**阶段 3 的「删除」**做完了，
**阶段 3 还剩两项**：「新建目录」与「重命名」。

交接文档 `docs/handoff-2026-10-20-release-3.2.11.md` §7.2 明确建议：

> 下一阶段建议做「阶段 3 剩余两项：远程新建目录 + 远程重命名」。理由：
> 阶段 6/7 的抽象依赖阶段 3 的写操作先落地（`RemoteProvider` trait 已有 `remove_path`，
> 再加 `create_dir` / `rename_path` 是同构的）。

本计划就是执行这一条。**不扩范围**：阶段 6（传输队列化）与阶段 7（跨边界拖拽）不动。

### 0.1 顺带修掉的既有缺陷

交接文档 §7.1 记了一条**未修**的缺陷：

> 远程目录里的「新建文件 / 新建目录」会失败 —— 报 `Directory does not exist: sfm://remote/...`。
> 根因：`create-file` / `create-directory` **根本不经过** `isActionBlockedByEntryPolicy()` 门禁，
> 三个调用点都直接 `emit` / `return`。

本轮做「远程新建目录」，**必须**把这条一起收掉：创建类动作要过门禁，
且「新建文件」在远程侧**永久屏蔽**（规格 §1：新建空文件是永久非目标）。

---

## 1. 规格约束（逐条对齐）

### 1.1 门禁矩阵（规格 §5）

| 动作 | 远程条目上 | 远程目录内 | 本轮结论 |
|---|---|---|---|
| 新建目录 | ❌（不作用于条目本身） | ✅ | **本轮实现** |
| 新建文件 | ❌ | ❌ | **永久屏蔽**（规格 §1） |
| 重命名 | ✅ | ✅ | **本轮实现** |
| 删除 | ✅ | ✅ | 上一轮已完成 |

「远程条目上」这一列对「新建目录」为 ❌，指的是「新建目录不是施加在选中条目上的动作」；
实际语义是「在选中的**远程目录**里面建一个新目录」—— 这是 ✅ 那一列。

### 1.2 破坏性操作（规格 §6）

- **重命名不自动重放**（§6.2）：断线后写操作失败即停，把控制权交回用户。
  后端不做重试，前端不重试。
- **重命名要如实报错**：目标已存在、权限不足、源不存在，都要落到
  `RemoteErrorKind` 的对应类别，不能笼统成「重命名失败」。

### 1.3 永久非目标

- **远程「新建空文件」**（规格 §1）：SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件。
  远程侧**永远不提供**这个入口，不是「暂时没做」。

---

## 2. 后端设计

### 2.1 trait 扩展：`RemoteProvider::rename_path`

`src-tauri/src/remote/provider.rs` 新增一个方法：

```rust
async fn rename_path(
    &self,
    connection_id: &str,
    from_path: &str,
    new_name: &str,
) -> Result<(), RemoteError>;
```

三个设计决定：

1. **不给默认实现。** 理由与既有的 `set_permissions` / `remove_path` 完全一样：
   有默认实现的话，新加一个 provider 时「忘了写」会变成编译通过、用户点了没反应、
   报告还显示成功。宁可让编译器逼每个实现方表态。
2. **签名是 `(from_path, new_name)` 而不是 `(from_path, to_path)`。**
   「改名」在语义上就是**在原目录内换个名字**，不是「移动」。
   让调用方传完整目标路径，等于把「跨目录移动」这个**后果更重的操作**
   混进一个改名动作里 —— 前端算错父目录就会变成一次远程移动。
   后端从 `from_path` 自己取父目录，三种协议行为一致。
3. **`make_dir` 已有**，不用加。`RemoteProvider` 早就有 `make_dir`（阶段 3 的传输部分用），
   本轮只是把它**接到命令层**。

### 2.2 四家实现

| 实现 | 文件 | 做法 |
|---|---|---|
| 假 provider | `fake.rs` | 真的改名（改树节点的键），不能只返回 `Ok` |
| FTP | `ftp_provider.rs` | `RNFR <旧名>` + `RNTO <新名>`（先 `CWD` 到父目录） |
| FTPS | `ftps_provider.rs` | **与明文 FTP 逐字共用**控制通道语义 |
| SFTP | `sftp_provider.rs` | `sftp.rename(from, 父目录/新名)` |

> FTPS 的协议部分与明文 FTP 共用是既定做法（`ftps_provider.rs` 里已有注释：
> 「复制一份的后果是明文 FTP 修好了、FTPS 还留着同一个 bug」）。本轮沿用。

### 2.3 命令层

`src-tauri/src/remote/commands.rs` 新增两条 command：

```rust
#[tauri::command]
pub async fn remote_make_dir(app: tauri::AppHandle, remote_path: String) -> Result<(), RemoteError>;

#[tauri::command]
pub async fn remote_rename_path(app: tauri::AppHandle, from_path: String, new_name: String) -> Result<(), RemoteError>;
```

⚠️ **Tauri 参数名契约**（AGENTS.md 已记，是本项目反复咬人的地方）：

| Rust 参数名 | JS 必须传的键 |
|---|---|
| `remote_path` | `remotePath` |
| `from_path` | `fromPath` |
| `new_name` | `newName` |

Tauri 按「Rust 参数名的 camelCase 形式」匹配。传 `path` 给 `remote_path` 会报
「unknown field」——**两边单测全绿也测不出来**，只有真机能炸。所以要有一道跨语言门禁。

### 2.4 名字校验

新名字必须是**单个路径段**：

- 非空
- 不含 `/`（会变成子目录）与 `\`（Windows 上是分隔符）
- 不是 `.` 也不是 `..`（词法逃逸）
- 不含控制字符（FTP 是行文本协议，`\r\n` 会变成第二条命令）

校验放在 `src-tauri/src/remote/path.rs`，**在开连接之前**做 ——
路径不合法是本地判定，一秒都不该花在网络上。

---

## 3. 前端设计

### 3.1 门禁表（`src/utils/entry-action-policy.ts`）

`REMOTE_PHASE0_BLOCKED_ACTIONS` 改名并调整内容：

| 动作 | 变化 | 理由 |
|---|---|---|
| `rename` | **移出** | 阶段 3 已实现远程重命名 |
| `create-file` | **移入** | 规格 §1：永久非目标 |
| `create-directory` | 不动（**不在**屏蔽集合里） | 阶段 3 已实现远程新建目录 |
| 其余 | 不动 | 阶段 6/7 再逐条移出 |

**同时**要把三个绕过门禁的调用点改成**先过门禁**：

- `src/components/dir-entry-interactive/dir-entry-context-menu.vue`
- `src/modules/navigator/components/file-browser/file-browser-context-menu.vue`
- `src/modules/navigator/components/file-browser/file-browser-status-bar.vue`

### 3.2 「新建文件」入口的可见性

远程侧不能出现「新建文件」入口（规格 §1）。三处：

| 位置 | 处理 |
|---|---|
| 工具栏「+」下拉（`file-browser-toolbar-create-button.vue`） | 远程目录时**只显示「新建目录」** |
| 右键菜单「新建」子菜单（`file-browser-new-submenu.vue`） | 同上 |
| 键盘快捷键 / 命令面板 | 点了要**明确报错**，不能静默无反应 |

> 键盘快捷键那条不能靠「隐藏按钮」解决：快捷键是全局的，远程目录里按了快捷键
> 必须得到一句「远程不支持新建空文件」，而不是**什么都不发生**。

### 3.3 编排层

新建 `src/modules/remote/utils/remote-write.ts`：

- `createRemoteDirectory(name, targetDirPath)` → 在远程目录里建目录
- `renameRemoteEntry(entry, newName)` → 改远程条目的名字

两条都**不抛错**，失败原因走 `describeRemoteError()`（后端 `RemoteError`
是普通对象，`String(error)` 会得到 `[object Object]`）。

### 3.4 与本地流程的合流点

| 流程 | 入口 | 远程分支 |
|---|---|---|
| 新建 | `use-file-browser-selection.ts` 的 `createNewItem` | 目标目录是远程 → 走 `remote_make_dir` |
| 改名 | `use-file-browser-selection.ts` 的 `confirmRename` | 条目是远程 → 走 `remote_rename_path` |
| 新建（树视图） | `use-dir-entry-actions.ts` 的 `createNewItem` | 同上 |

---

## 4. 门禁与验收

### 4.1 单测门禁（基线逐字对照）

| 项 | 基线（HEAD = `cc62d28b`） |
|---|---|
| `cargo test --lib` | 651 passed / 0 failed |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **170 errors / 0 warnings** |
| `npx vitest run` | 211 文件 / 1893 用例 |
| `node scripts/verify-changelog.mjs` | exit 0 |

> ⚠️ eslint 口径必须是 `npx eslint src`，不是项目脚本 `eslint .`（整仓是 186/121）。
> 混口径会凭空多出 16 个「回归」。

### 4.2 测试纪律（规格 §9.2）

- **阳性对照**：每条断言要证明「新行为确实发生」。
- **注入验证**：至少挑一处判定**故意改坏**，确认对应测试转红。
- **探针要带阳性对照**。
- **跨语言契约门禁**：Rust 侧 command 的参数名 ↔ 前端实际传的键，逐条比对。
  这是本项目**反复咬人**的地方（AGENTS.md 已记），必须有一道自动门禁。

### 4.3 真机验收（AGENTS.md 硬约束）

**必须用 `tauri build` 的打包产物**，`tauri dev` 的界面结论一律作废。

真机环境（上一轮沿用）：

| 项 | 值 |
|---|---|
| 服务器 | fnOS NAS `192.168.1.9`（SFTP，连接名「速豹堂」） |
| SSH 公钥通道 | `ssh -i 'E:\Users\Duanyi\.ssh\id_ed25519' duanyi@192.168.1.9` |
| 夹具目录 | `/vol1/@team/study_platform/wp_root/upgrade/`（属主 `duanyi`） |

> ⚠️ **破坏性验收的靶子必须是自己造的夹具**（AGENTS.md / 上一轮 §6 复盘）。
> 本轮只**新建**与**改名**，不删任何东西；夹具建在 `upgrade/` 下，
> 改名后**改名回去**（或删掉自己建的那个），**不碰站点目录里的任何文件**。

验收清单：

1. 远程目录里点「新建 → 目录」→ 目录**真的出现**在远程列表里（SSH 独立复核）。
2. 远程文件右键 → 「重命名」菜单项**在**（没被屏蔽）。
3. 改完名 → 远程列表显示新名字（SSH 独立复核旧名已消失、新名已存在）。
4. 远程目录里**没有**「新建文件」入口（工具栏 + 右键菜单）。
5. 远程目录里点「新建文件」（若从快捷键进入）→ 给出**明确提示**，不是静默无反应。

---

## 5. 风险与已知限制

| 风险 | 说明 | 处置 |
|---|---|---|
| FTP 无真机服务器 | FTP / FTPS 的 `RNFR`/`RNTO` 只能靠单测 | 写进交接文档的遗留，不假装验过 |
| fnOS SFTP 以特权身份运行 | 权限相关的判断不能靠 SSH 推断 | 本轮不依赖权限分支做验收 |
| 重命名与本地同名 | 远端已有同名时的行为各服务器不同 | 后端如实报错，不静默覆盖 |
| 跨目录移动 | 本轮**不支持**，也不应被误触发 | 签名层面杜绝（§2.1） |

---

## 6. 执行顺序

1. 后端：`path.rs` 校验 → `provider.rs` trait → 四家实现 → `commands.rs` + `lib.rs` 注册
2. 前端：`remote-transfer.ts` → `remote-write.ts` → 门禁表 → 三个调用点 → 可见性
3. i18n：17 个语言包
4. 单测（Rust + Vitest）+ 注入验证
5. 全量门禁逐字对照
6. 打包 → 装机 → 真机验收
7. 交接文档
