# 导航器打磨包（六项需求合并） · 设计

- 日期：2026-10-12
- 状态：用户已澄清 3 处歧义，待审阅
- 上游依据：本次为产品内部打磨，**不依赖上游 issue**

---

## 1. 为什么做这一组

用户在同一指令里列了 6 项需求，都集中在 navigator / settings / 文件树区域，且彼此独立可分别验证。统一打包是为了：

- 共享 `ContextMenuAction` 类型扩展（需求 4 命中一个新增成员 `'open-containing-directory'`，需求 6 复用同一个 action）
- 共享 17 语言包批量改动（每加一个 UI 字符串就是 17 个 key）
- 共享 schema 迁移（需求 3 加缩略图大小设置 → schema 30 一次完成即可）
- 共享真机验收（一次启动期心跳看完整交互）

### 用户澄清过的关键决策

| 决策点 | 用户选择 | 影响 |
|---|---|---|
| 设置页文案 "Sigma File Manage" typo | **按用户原话实现**（拼写保留，但本文档与代码注释中提示这是与仓库其他位置命名不一致的笔误） | 文案严格按用户给的写 |
| 「视图调整按钮」指什么 | **3.0.2 已完成的工具栏布局按钮位置不对，要移到「选项卡层级 + 刷新按钮旁」** | 反向搬运：从 `navigator-toolbar-actions.vue` 删除，转 `file-browser-toolbar-nav-buttons.vue` 的 refresh 后 |
| 目录树右键菜单范围 | **C：复制路径 + 粘贴 + 查看属性 + 打开所在目录**（4 项） | 与文件浏览器右键菜单分离，独立的轻量菜单 |

---

## 2. 范围

### 做

1. 设置页顶部文案（`app.description` + `app.copyright`）按用户原话改写，17 语言包同步
2. 工具栏布局切换按钮位置调整（从窗口工具栏 → 选项卡工具栏 refresh 旁）
3. 缩略图大小调整按钮 + 弹窗（设置项 + 弹窗组件 + list/grid 接入）
4. 目录树右键菜单（4 项：复制路径 / 粘贴 / 属性 / 打开所在目录）
5. 长按文件不切换 alpha 置顶（验证现状 + 修可改部分）
6. 全局搜索结果"打开文件所在目录"（与需求 4 共享 action）

### 不做（明确排除）

- **设置页 Logo/图标/排版** —— 只改文案不动结构（AGENTS.md §2 锁定品牌决策）
- **工具栏布局按钮的 aria / Tooltip 文案变更** —— 沿用 3.0.2 验收过的文案与图标语义
- **缩略图大小自定义数值输入** —— 只做三档（24/32/48），避免给用户太多旋钮
- **grid 视图缩略图开关** —— 与 list 缩略图对称是另一项需求，本轮不加
- **目录树的多选 + 批量右键** —— tree 多选是另一项改造
- **3.0.2 handoff §五 P3 SVG 性能观察项** —— 未做基准，本轮不引入

---

## 3. 关键事实（已核实，不是推测）

### 3.1 文案位置

| 事实 | 出处 |
|---|---|
| 设置页顶部文案模板在 `src/modules/settings/ui/header.vue:18-20` | 模板读 `app.name` / `app.description` / `app.copyright` 三个 key |
| `app.name` / `description` / `copyright` 在 **17 个语言包都有** | `src/localization/messages/*.json` 各一份 |
| 中文 locale code 是 `ch`（不是 `zh`） | AGENTS.md §1 / 各包命名一致 |
| `app.copyright` 当前是版权声明格式，不是「鸣谢」 | en.json:5 / ch.json:5 一致 |

### 3.2 工具栏布局按钮现状

| 事实 | 出处 |
|---|---|
| ListIcon ↔ LayoutGridIcon 切换按钮在窗口工具栏右侧（`window-toolbar-secondary-teleport-target`） | `navigator-toolbar-actions.vue:443-471` |
| 按钮通过 `setLayout(layoutName)` 调用 `useNavigatorFolderSettings().persistForScope` | 同上 :129-131 |
| ⋮ 菜单「导航视图布局」组**已删除**（3.0.2 决定） | handoff §二 B 阶段 |
| 选项卡工具栏 nav-buttons 含 `[back, forward, up, home, refresh]` | `file-browser-toolbar-nav-buttons.vue` |
| refresh 按钮 `:size="icon"` 在 `:disabled="isLoading"` | `file-browser-toolbar-nav-buttons.vue:140-158` |
| 窗口工具栏布局（`window-toolbar.vue:212`）保留 `secondary-teleport-target` 槽位 | 移除按钮不影响其它按钮位置 |

### 3.3 缩略图现状

| 事实 | 出处 |
|---|---|
| 列表缩略图组件硬编码 `size = 32` | `file-browser-list-entry-thumbnail.vue:411`（`withDefaults` 默认值） |
| 列表缩略图渲染时 `:width="props.size"` `:height="props.size"` | `file-browser-list-entry-thumbnail.vue:498-499` |
| 网格缩略图卡片尺寸固定 | `file-browser-grid-card.vue`（待精确核对行号） |
| 列表行高 `LIST_ENTRY_HEIGHT = 42`（逻辑像素），DPI 1.5 下 63 物理像素 | `use-file-browser-virtual-layout.ts:40`（3.0.2 验收硬证据） |
| 32px 缩略图放进 42px 行内有余量 | 3.0.2 验收结论 |
| 48px 缩略图放进 42px 行内**不够** | 数学：48 > 42，需同步调整 LIST_ENTRY_HEIGHT 或缩略图尺寸上限 |

### 3.4 目录树右键菜单现状

| 事实 | 出处 |
|---|---|
| `file-browser-tree-view.vue` **没有** `@contextmenu` 事件 | 全文未出现 |
| 行 click 只走 `onRowClick(row)`（激活）+ chevron 走 `onChevronClick`（展开折叠） | `:106-115` |
| 文件浏览器右键菜单组件 `file-browser-context-menu.vue` 已存在，但挂在 FileBrowser 的 selectedEntries 上下文 | 通过 `useFileBrowserContext` |
| ContextMenuAction 类型共 20 个成员 | `types.ts:42` |
| `ContextMenuAction` 联合类型**没有** `'open-containing-directory'` / `'reveal-in-explorer'` / `'show-item-in-folder'` | 同上 |
| 文件浏览器右键菜单的 paste action **只在 `canPasteToSelectedDirectory` 为真时显示** | `file-browser-actions-menu.vue:152-158, 317-335` |
| properties / copy-path / paste 三个 action **已存在** | `types.ts:42` |

### 3.5 拖拽现状

| 事实 | 出处 |
|---|---|
| 用 `@crabnebula/tauri-plugin-drag` 的 `startDrag as startOutboundDrag` | `use-file-browser-drag-session.ts:6, 204-210` |
| `initiateOutboundDrag` 调用 `startOutboundDrag(filePaths, iconPath)` | 同上 |
| 当前没有禁用窗口置顶的配置（待查 tauri-plugin-drag 文档） | — |

### 3.6 全局搜索现状

| 事实 | 出处 |
|---|---|
| 全局搜索结果用 `<FileBrowser>` 渲染（`layout="list"`） | `global-search-view.vue:564-575` |
| FileBrowser 复用现有右键菜单（继承） | 通过 context + emit |
| 全局搜索没有独立的 context menu 拦截 | — |
| 全局搜索的 FileBrowser 实例的 `external-entries` 是搜索结果，`base-path` 是盘根 | 同上 |

---

## 4. 用户已确认的决策

| 决策点 | 选择 |
|---|---|
| 设置页文案拼写 | 按用户原话（包含 "Sigma File Manage" 笔误），不在代码层改；但代码注释中标注「与项目其他位置的拼写不一致」 |
| 工具栏布局按钮位置 | 从 `navigator-toolbar-actions.vue` 删除，移到 `file-browser-toolbar-nav-buttons.vue` 的 refresh 按钮旁 |
| 目录树右键菜单范围 | C：复制路径 / 粘贴（仅 directory）/ 查看属性 / 打开所在目录（仅 file） |
| 缩略图大小档位 | 小（24px）/ 中（32px，默认）/ 大（48px） |
| 缩略图弹窗位置 | 选项卡工具栏，挨着布局切换按钮 |
| 工具栏按钮图标语义 | 沿用 3.0.2：显示当前所在视图，aria-label 显示将切到的视图 |
| 工具栏按钮作用域 | per-folder 作用域不变，复用 `setLayout()` |
| 长按不切换置顶的处理顺序 | 先真机复现 5-10 次长按拖拽，记下每次的实际窗口置顶情况，再决定改 vs 不改 |

---

## 5. 详细设计

### 5.1 设置页文案（需求 1）

**改 17 个语言包的两个 i18n key**：

- `app.description`：从「是一个免费、开源...GNU GPLv3 或更高版本下授权」改为「在 'Sigma File Manage' 基础上开发，添加了目录树、弹窗路径聚焦、批量重命名等功能，是一款更好用的文件管理器应用程序」
- `app.copyright`：从「Copyright © 2021 - present Aleksey Hoffman. All rights reserved.」改为「鸣谢 Aleksey Hoffman」

**ch.json（按用户原话，保留拼写）**：
```json
"app": {
  "name": "Alpha File Manager",
  "description": "\"Alpha File Manager\" 在 \"Sigma File Manage\" 基础上开发，添加了目录树、弹窗路径聚焦、批量重命名等功能，是一款更好用的文件管理器应用程序。",
  "copyright": "鸣谢 Aleksey Hoffman"
}
```

**en.json（英文译文，与项目其他位置拼写一致用 "Sigma File Manager"）**：
```json
"app": {
  "name": "Alpha File Manager",
  "description": "\"Alpha File Manager\" is developed on top of \"Sigma File Manager\", with added features like directory tree, popup path focus, batch rename and more — a better file manager application.",
  "copyright": "Credits to Aleksey Hoffman"
}
```

**其余 15 个语言包**：按既有先例写**英文占位**（参考 ch.json / en.json 的英文译文）。非中文包本来就大量英文占位（参见 3.0.2 handoff §五 P2：非中文包债务）。

> **关于拼写的取舍说明**：
>
> 按 AGENTS.md §1「技术专有名词本身（Pinia、Vitest、NSIS、sha256 等），在句子中可保留英文」—— "Sigma File Manager" 是上游项目专名，本应保持原样。
>
> 但用户在澄清中明确说「根据我的文案来改」。**尊重用户输入**。
>
> 故 ch.json 保留用户笔误 "Sigma File Manage"，en.json 与其他包按专名写 "Sigma File Manager"。
>
> 如果用户在验收时希望统一拼写，把 ch.json 改成 "Sigma File Manager" 即可，模板与其它代码无依赖。

**模板**：`header.vue:18-20` **不动**（仍读 app.name + app.description + app.copyright）。

### 5.2 工具栏布局按钮位置调整（需求 2）

**改动文件**：

| 文件 | 动作 |
|---|---|
| `navigator-toolbar-actions.vue` | 删除 :443-471（ListIcon/LayoutGridIcon 按钮块）。保留 ⋮ 菜单（其布局组已删除）。`setLayout` 函数保留（仍被文件浏览器调用），但只在内部用不到时可清理 |
| `file-browser-toolbar-nav-buttons.vue` | refresh 按钮（:140-158）后追加布局切换按钮 |
| `file-browser-toolbar.vue` | 转发 `currentLayout` + `setLayout` props |
| `file-browser.vue` | 用 `useNavigatorFolderSettings()` 派生 currentLayout + setLayout，传给 toolbar |

**新位置按钮结构**（在 file-browser-toolbar-nav-buttons 内）：

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button
      variant="ghost"
      size="icon"
      :aria-label="t(nextLayoutLabelKey)"
      @click="setLayout(isGridLayout ? 'list' : 'grid')"
    >
      <LayoutGridIcon v-if="isGridLayout" :size="16" />
      <ListIcon v-else :size="16" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {{ t(nextLayoutLabelKey) }}
  </TooltipContent>
</Tooltip>
```

`setLayout` / `isGridLayout` / `nextLayoutLabelKey` 计算沿用现有逻辑，从 navigator-toolbar-actions.vue 抽出（或在 nav-buttons 内重新声明）。

### 5.3 缩略图大小调整（需求 3）

**新增设置项**：
```ts
// src/types/user-settings.ts → UserSettingsNavigator
thumbnailSize: 'small' | 'medium' | 'large';

// src/stores/storage/user-settings.ts → 默认值
thumbnailSize: 'medium'   // = 32px
```

**Schema 迁移**：29 → 30，迁移步用 `setDefaultEnumIfMissing(storage, 'navigator.thumbnailSize', 'medium')`（类似 `setDefaultBooleanIfMissing`，需要确认仓库里是否已有；若没有就新增）。

**三档尺寸**（逻辑像素，行高同步调整）：

| 档位 | size 像素 | LIST_ENTRY_HEIGHT 调整 |
|---|---|---|
| small | 24 | 42（不变）|
| medium（默认）| 32 | 42（不变，3.0.2 验收基线）|
| large | 48 | 64（行高 + 22px，余量 8px）|

**实现要点**：

1. `use-file-browser-virtual-layout.ts:40` 的 `LIST_ENTRY_HEIGHT` 改为动态：
   ```ts
   const LIST_ENTRY_HEIGHT_BASE = 42;
   const LIST_ENTRY_HEIGHT_LARGE = 64;
   const listEntryHeight = computed(() => 
     thumbnailSize.value === 'large' ? LIST_ENTRY_HEIGHT_LARGE : LIST_ENTRY_HEIGHT_BASE
   );
   ```
   调用方需同步（搜索 `LIST_ENTRY_HEIGHT` 全部引用）。

2. `file-browser-list-entry-thumbnail.vue` 默认值从 `32` 改为根据 setting 计算：
   ```ts
   const effectiveSize = computed(() => 
     thumbnailSize.value === 'small' ? 24 :
     thumbnailSize.value === 'large' ? 48 : 32
   );
   ```
   `:width` `:height` 用 `effectiveSize`。

3. `file-browser-grid-card.vue`：根据 setting 调整 grid 缩略图尺寸（卡片整体尺寸 + 缩略图）。

4. 新增弹窗 `file-browser-thumbnail-size-dialog.vue`：
   - 3 个选项（radio）
   - 应用后立即更新设置
   - 17 语言包 4 个 key：dialog title / radio labels (3) + descriptions（可选）

5. 弹窗入口在 `file-browser-toolbar-nav-buttons.vue`：缩略图图标按钮。

**行高硬证据重测**：与 3.0.2 验收同套 UIA 读 `BoundingRectangle` 的方法，验证 small/medium/large 三档下：
- small/medium：每行 h=63 物理像素（DPI 1.5，42 逻辑像素）
- large：每行 h=96 物理像素（DPI 1.5，64 逻辑像素）
- 行距 = 行高

### 5.4 目录树右键菜单（需求 4）

**新建组件** `file-tree-context-menu.vue`：

```vue
<ContextMenuContent>
  <ContextMenuItem v-if="isActionVisible('copy-path')" @select="handleAction('copy-path')">
    <CopyIcon />
    {{ t('fileBrowser.actions.copyPath') }}
  </ContextMenuItem>
  <ContextMenuItem v-if="canPaste" @select="handleAction('paste')">
    <ClipboardPasteIcon />
    {{ t('shortcuts.transferPreparedForCopying') }}
  </ContextMenuItem>
  <ContextMenuSeparator v-if="canPaste" />
  <ContextMenuItem v-if="isActionVisible('open-containing-directory') && entry.is_file"
                   @select="handleAction('open-containing-directory')">
    <FolderOpenIcon />
    {{ t('fileBrowser.actions.openContainingDirectory') }}
  </ContextMenuItem>
  <ContextMenuItem v-if="isActionVisible('properties')" @select="handleAction('properties')">
    <InfoIcon />
    {{ t('fileBrowser.actions.properties') }}
  </ContextMenuItem>
</ContextMenuContent>
```

**ContextMenuAction 类型扩展**（`types.ts:42`）：
```ts
export type ContextMenuAction = ... | 'open-containing-directory';
```

**handler 实现**：
- 'copy-path'：复用现有 emit（tree emit 到 navigator）
- 'paste'：复用现有 emit
- 'properties'：复用现有 `openNativeProperties`
- 'open-containing-directory'：新建 `openInExplorer(entry.path)` 函数（用 `tauri-plugin-shell` 或 `tauri-plugin-opener` 调 `explorer.exe /select,<path>`）

**树视图接入**：`file-browser-tree-view.vue` 的 row div 加 `@contextmenu.prevent="handleContextMenu(row, $event)"`，弹出 `file-tree-context-menu`。

**visibility 规则扩展**（`context-menu-action-visibility.ts`）：为 `'open-containing-directory'` 加规则，仅 file 类型可见。

**17 语言包 4 个 key**：
- `fileBrowser.actions.copyPath` —— 已存在 `copy-path` key 是否复用？需核查
- `fileBrowser.actions.openContainingDirectory` —— 新增
- `settings.general.fileView.thumbnailSizeTitle` —— 新增（需求 3 共用）
- `settings.general.fileView.thumbnailSizeDescription` —— 新增
- `settings.general.fileView.thumbnailSizeSmall / Medium / Large` —— 新增 3 个

### 5.5 长按不切换置顶（需求 5）

**调研 + 真机验证步骤**（先做，不动代码）：

1. 打开 alpha，构建后启动（真机验收阶段必做）
2. 选一个文件 → 按住鼠标左键不放 → 拖出 alpha 窗口外
3. 期间观察 alpha 窗口是否被切换置顶 / 失焦
4. 重复 5-10 次（不同文件、不同起始位置、不同释放目标）

**若复现**：

- 查 `@crabnebula/tauri-plugin-drag` 文档：是否有 `bringToFront` / `preventFocus` 等配置
- 当前调用 `startOutboundDrag(filePaths, iconPath)` 的第三参数（options）若支持禁用置顶则加配置

**若不复现**：

- 当前实现已经满足需求（用户报告的现象可能是 webview 自绘层或 COM 注入的副作用，与 drag 无关）
- 报告"已验证，无可改代码"，请用户在下次再遇到时报告具体场景

**记录**：无论结论如何，把验证过程 + 结论写进 `progress.md`。

### 5.6 全局搜索"打开文件所在目录"（需求 6）

**与需求 4 完全共享**：需求 4 已加 `'open-containing-directory'` action，handler 全局可用。全局搜索结果的 FileBrowser 实例复用现有菜单 → 自动继承。

**visibility 规则**：`context-menu-action-visibility.ts` 加规则：
- `open-containing-directory` 仅 file 类型可见
- directory 上显示无意义

**真机验收**：
- 全局搜索 → 找到文件 → 右键 → 看到「打开文件所在目录」→ 点击 → Explorer 打开并选中

---

## 6. 测试策略

### 6.1 单元测试

| 测试 | 判别性探针 | 期望失败输出 |
|---|---|---|
| 设置页文案渲染（17 包 key 对齐） | `messages-key-alignment.test.ts` 已存在（`localization/__tests__`），跑全量对齐 | 缺 key 即失败 |
| 工具栏布局按钮位置（出现在 nav-buttons，不在 navigator-toolbar-actions） | 加快照测试：assert `file-browser-toolbar-nav-buttons` 渲染含 ListIcon / LayoutGridIcon；assert `navigator-toolbar-actions` 不含 | 「expected to contain ListIcon / LayoutGridIcon」 |
| 缩略图大小档位写入与默认值 | 迁移 29→30 后 `thumbnailSize === 'medium'` | 「expected 'small' to be 'medium'」 |
| 缩略图大小 large 时 LIST_ENTRY_HEIGHT = 64 | 把缩略图组件 size 改成 large，断言虚拟布局行高 = 64 | 「expected 42 to be 64」 |
| ContextMenuAction 加新成员 | TypeScript 编译（vue-tsc） | 类型错误 |
| 'open-containing-directory' handler 调 explorer.exe | mock spawn，断言参数含 `/select,<path>` | 实际调用参数不符 |
| 目录树右键触发 context menu | mount FileBrowserTreeView，触发 contextmenu event，断言 menu 内容 | 「expected 4 items to be 3」 |

### 6.2 判别性验证（硬要求）

- 每个新测试必须先注入缺陷确认**转红**
- 转红时失败输出必须**精确展示预期的那种损坏**
- 详见 superpowers:test-driven-development

### 6.3 真机验收（硬要求）

**必须用 `tauri build` 的打包产物**（AGENTS.md §2）。dev 构建所有路由页内容区空白。

| # | 验收项 | 判别手段 |
|---|---|---|
| 1 | 设置页顶部文案 17 语言包安装后均为新文案 | 切换语言 + PrintWindow 截图 |
| 2 | 工具栏布局按钮在选项卡工具栏 refresh 旁 | UIA 读 BoundingRectangle，找 refresh 后是否有 ListIcon / LayoutGridIcon |
| 3 | 缩略图大小三档切换：list 行高随档位变化 | UIA BoundingRectangle 硬证据（同 3.0.2 验收方法）|
| 4 | 目录树右键弹出 4 项菜单，目录只有 3 项（无「打开所在目录」）| UIA 枚举菜单项 |
| 5 | 长按拖拽期间 alpha 窗口置顶行为 | 手动真机观察 + 截屏 |
| 6 | 全局搜索文件右键 → 「打开文件所在目录」 → Explorer 选中该文件 | UIA 操作 + 截屏 |

---

## 7. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 缩略图 large 档位破坏 LIST_ENTRY_HEIGHT 验收基线 | 3.0.2 验收记录每行 63 物理像素 | 在 plan 中同步改虚拟布局行高，并加 UIA 硬证据重测 |
| 目录树右键菜单需要新 ContextMenuAction 成员 | 联合类型扩展，TS 全量类型门禁会暴露所有缺漏 | 在 plan 中先 grep 所有 `'./filebrowser/actions'` 处，确保新成员要么被处理要么显式忽略 |
| 长按不切换置顶可能是 tauri-plugin-drag 不可配置 | 不可改 | 真机先复现，确认后再决定改 vs 报告「不可知」|
| 文案改动涉及 17 个语言包，遗漏某包会导致 i18n 测试失败 | `messages-key-alignment.test.ts` 已守门 | 一次性改全，提交前跑 npm run ts + vitest localization |
| 工具栏按钮位置调整会破坏 3.0.2 已验收的 per-folder 作用域 | 误改 setLayout 调用链 | 复用 `useNavigatorFolderSettings` 的 persistScopedPatch，测试覆盖 per-folder 写回 |

---

## 8. 贯穿硬约束（沿用项目）

- 零新依赖
- 受保护常量不得改动：mDNS 服务名、legacy 数据目录名、Tauri identifier `com.sigma-file-manager.app`
- 品牌名锁定 Alpha File Manager
- 17 语言包同步新增/修改 key
- 中文 locale code 是 `ch`
- 面向用户的输出 / 注释 / 计划 用简体中文
- 真机验收必须用 `tauri build` 产物
- 新测试必须先注入缺陷确认转红

---

## 9. 待用户决策（如有异议请在审阅时指出）

- ch.json 的 "Sigma File Manage" 拼写是否真的保留（vs 改成 "Sigma File Manager" 与项目其他位置一致）
- 缩略图 large 档位尺寸 48px + 行高 64px 是否合理（vs 改成 56px + 行高 72px 等其他组合）
- 工具栏布局按钮旁是否同时放缩略图按钮（用户原话是「调整缩略图大小的按钮」紧跟「视图调整按钮旁」，已按此实现）