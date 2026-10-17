# 地址栏改成 Windows 资源管理器那样 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让导航器地址栏的三件事符合直觉：点一下就地变成可编辑并全选；粘路径回车直接进那个路径；下面的浮层贴着地址栏显示「目标目录 + 它的子目录和文件」，目录与文件缩进区分，默认选中目标目录。

**Architecture:** 行为和形态分开做。Part A 只改「回车进哪里、列表长什么样」，不动布局，风险低、可单独发版。Part B 才把居中模态改成贴在地址栏下的浮层、把输入框搬进地址栏本身。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Vitest + @vue/test-utils、reka-ui（`PopoverRoot` / `PopoverAnchor` / `PopoverContent`）、现有 `src/components/ui/**`。

---

## 一、用大白话说，改完之后是什么样

1. **点地址栏 = 直接能改字。** 不再弹出一个大对话框。地址栏那一行原地变成一个输入框，里面的路径**整个被选中**，你直接打字或粘贴就行。右边那个「编辑地址」的小按钮也是同一个效果。点路径上的某一段仍然跳到那一级（这个行为不变）。
2. **粘一条路径进去按回车 = 直接进那个目录。** 不管你粘的路径末尾有没有斜杠，也不管列表刷新得完不完 —— 回车就以你输入框里的文字为准。
3. **下面那个浮层贴着地址栏展开**（不是一个居中的大窗），里面从上到下是：
   - 第一行：**目标目录本身**（就是你输入框里那个路径），**顶格、字重加一档**，默认选中，回车进入它；
   - 下面**统一缩进一格**的：**子目录**和**文件**彼此齐平。左侧有一根**竖线**贯穿整个列表，每行接一条**短横线**指向图标，最后一行用「└」收尾，形成树形图效果；
   - 目录排在文件前面，各自按名称排序；目录与文件靠**图标和颜色**区分，不靠多缩一格；
   - 上下方向键在目标目录、子目录、文件之间移动，回车进入目录 / 打开文件。

> **缩进方案已定稿（2026-10-17，用户拍板）：目录与文件各自缩进一格、彼此齐平 + 左侧竖线与短横线形成树形视觉。**
> 本文初稿写的是三级缩进（目录缩进一格、文件缩进两格），Task A3 已按定稿方案实施，
> 相关步骤与断言同步改过 —— 详见下面 Task A3 与第七节的「实施结果」。

## 1.5 实施状态（2026-10-17）

| 任务 | 状态 | 提交 |
|---|---|---|
| Task A1 无结尾斜杠路径 | ✅ 已实施 | `4102a53f` |
| Task A2 回车以输入框为准 | ✅ 已实施 | `a6ef3942` |
| Task A3 目标目录行 + 树形导线 | ✅ 已实施 | `d49977cb` |
| 追加：打开时整条选中 | ✅ 已实施 | `2aa2c02b` |
| Task B1 地址栏就地编辑 | ⛔ **已放弃**（用户 2026-10-17 决定：当前形态已满足要求） | — |
| Task B2 浮层改锚定 | ⛔ **已放弃**（同上） | — |
| Task B3 打包验收 | ⛔ 已放弃（Part A 已单独打包并由用户验收） | — |

> **Part B 于 2026-10-17 作废。** 用户在 3.2.2-beta 真机验收后明确表示
> 「当前可以满足要求」，放弃地址栏就地编辑与浮层改锚定。
> 下面 Task B1 / B2 / B3 的内容**保留为存档**，但不再执行，也不该被后续会话当成待办。
> 需要复活时，先确认这个决定是否仍然成立。

**Part A 已全部实施完毕。**

---

## 二、根因（都定位到行了，不是猜测）

| # | 现象 | 根因 | 位置 |
|---|---|---|---|
| RC1 | 粘 `F:/a/b/nsis`（无斜杠）只出一条「结果」 | `addressBarQueryMeansBrowseInsideDirectory()` **只在字符串以 `/` 结尾时为真**。无斜杠的绝对路径被当成搜索词，于是「列父目录 + 按 `nsis` 过滤」 | `address-bar-editor-utils.ts:364-366`、`430-465` |
| RC2 | 回车不跳转 | `watch(query)` 立刻把选中项清成 `-1`，之后要等 120ms 防抖 + 两次异步 IO 才恢复选中。粘贴后立刻按回车 → `getActiveEntry()` 拿到 `exactEntry`（搜索分支下是 `null`）→ 静默 return | `address-bar-editor-dialog.vue:699-708`、`788-800`、`908-923` |
| RC3 | 回车语义不认输入框 | 回车只作用于「列表选中项」，输入框里打了什么完全不影响 | 同上 `1057-1068` |
| RC4 | 看不到「目标目录」这一行 | `kind === 'directory'` 时 `exactEntry` **已经被填好了**，但模板只渲染 `groups`，这行数据从来没显示过 | `address-bar-editor-utils.ts:406` vs `address-bar-editor-dialog.vue:1274-1287` |
| RC5 | 浮层是居中大窗 | `CommandDialog` + CSS 强制 `width: 65vw; height: 86vh` | `address-bar-editor-dialog.vue:1335-1351` |
| RC6 | 点地址栏不是就地编辑 | 面包屑是 `<button>`，点击只触发「打开模态」 | `address-bar.vue:233`、`139-141` |

**顺带发现一个潜在崩溃点**（Part A 顺手修）：`resolveAddressBarDirectoryListingOrExactOrSearch` 的兜底分支里，`getDirEntry` 若返回 `undefined`（而不是抛错），下一行 `exactEntry.is_dir` 会抛 `TypeError`。生产代码里 `getDirEntry` 总是抛错所以被掩盖了，但测试里 `vi.fn()` 默认返回 `undefined`，一改就会炸。

---

## 三、Global Constraints

- **面向用户的文案一律简体中文**；新增文案要进 17 个语言包 `src/localization/messages/*.json`（中文的 locale code 是 `ch`，不是 `zh`）。
- **门禁基线（逐字对照，HEAD `ece6fd61`）**：`cargo test --lib` 386 passed ｜ `npx vue-tsc --build` 0 error ｜ `npx eslint src` **179 errors / 59 warnings** ｜ `npx vitest run` 183 文件 / 1434 用例 ｜ `node scripts/verify-changelog.mjs` 退出码 0。
- **eslint 口径必须是 `npx eslint src`**，不是 `eslint .`（整仓是 186/121，混口径会凭空多出 7 个「回归」）。
- **`$ErrorActionPreference='Stop'` 前后调 `npm`/`npx` 必须显式切回 `Continue`**，否则原生命令的 stderr 会被当成终止错误。
- **真机验收只能用 `tauri build` 产物**。`tauri dev` 下路由页内容区是空白，结论一律作废。
- 改仓库文件**一律用编辑工具或 node `fs` + `'utf8'`**，绝不用 PowerShell `Get-Content -Raw` / `Set-Content`。
- 受保护常量（mDNS 服务名、legacy 数据目录名、Tauri `identifier`）不动。
- 新增测试必须带**阳性对照**：不能只测「不报错」，要测「新行为确实发生了」。

---

## 四、File Structure

**Part A（改，不新增文件）**

| 文件 | 职责变化 |
|---|---|
| `src/modules/navigator/components/file-browser/address-bar-editor-utils.ts` | 新增：无斜杠绝对路径识别、输入框目标解析、目录/文件排序与深度分层、「目标目录」分组 |
| `src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue` | Enter 分支改道；空标签的分组标题不再占位；把 `depth` 透传给行组件 |
| `src/modules/navigator/components/file-browser/address-bar-editor-suggestion-row.vue` | 新增 `depth` prop，按层级缩进 |
| `src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts` | 新增 4 条用例 |
| `src/modules/navigator/components/file-browser/__tests__/address-bar-editor-dialog.test.ts` | 新增 2 条用例 |

**Part B（新增 2 个文件，删除 1 个）**

| 文件 | 职责 |
|---|---|
| `…/composables/use-address-bar-editor.ts` **（新建）** | 从 dialog 里原样搬出的状态机：query、mode、suggestionState、选中项、导航历史、refresh、键盘语义 |
| `…/address-bar-editor-dropdown.vue` **（新建）** | 纯展示：列表 + 底部快捷键条。无输入框（path 模式）、无内部状态 |
| `…/address-bar-editor-dialog.vue` **（删除）** | 被上面两个取代 |
| `…/address-bar.vue` **（改）** | 新增就地编辑状态 + `<input>` |
| `…/file-browser-toolbar-address-bar.vue` **（改）** | 挂 `PopoverRoot` + `PopoverAnchor` |

---

# Part A —— 行为（可独立发版）

## Task A1：路径不再要求结尾斜杠

**Files:**
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-utils.ts:364-366`（新增函数）、`430-465`（接线）
- Test: `src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts`

**Interfaces:**
- Consumes: 现有 `resolveAddressBarDirectoryListingOrExactOrSearch(options, pathForReadDir, fallbackNormalizedQuery)`、`addressBarTrimmedQueryLooksLikeFilesystemPath()`
- Produces: 内部函数 `resolveAddressBarUnseparatedDirectoryBrowsePath(normalizedQuery: string): string | null`（模块私有，不导出）

- [ ] **Step 1: 写失败的测试**

追加到 `address-bar-editor-utils.test.ts`（helper `entry()` / `dirContents()` / `searchMatcher()` 已在该文件顶部定义，直接用）：

```ts
  it('browses a typed absolute directory path without a trailing separator', async () => {
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === 'F:/soft/00selfmade/filemanager/sigma-file-manager') {
        return dirContents('F:/soft/00selfmade/filemanager/sigma-file-manager', [
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/src'),
        ]);
      }

      throw new Error('unexpected readDir path');
    });

    const state = await resolveAddressBarSuggestions({
      query: 'F:/soft/00selfmade/filemanager/sigma-file-manager',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('directory');
    expect(readDir).toHaveBeenCalledWith('F:/soft/00selfmade/filemanager/sigma-file-manager');
    expect(state.directoryPath).toBe('F:/soft/00selfmade/filemanager/sigma-file-manager');
  });

  it('keeps a bare name as a search term rather than a directory path', async () => {
    const state = await resolveAddressBarSuggestions({
      query: 'nsis',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn().mockRejectedValue(new Error('missing')),
        getDirEntry: vi.fn().mockRejectedValue(new Error('missing')),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
  });

  it('survives a lookup that resolves to undefined instead of throwing', async () => {
    const state = await resolveAddressBarSuggestions({
      query: '/workspace/gone',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn().mockRejectedValue(new Error('missing')),
        getDirEntry: vi.fn().mockResolvedValue(undefined),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
  });
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts
```
预期：第 1 条 FAIL（当前会得到 `kind === 'search'`）；第 3 条 FAIL（当前会在 `exactEntry.is_dir` 上抛 `TypeError`）。

- [ ] **Step 3: 最小实现**

在 `address-bar-editor-utils.ts` 中，`getImplicitAddressBarAbsoluteDirectoryBrowsePath` 函数**下方**新增：

```ts
/**
 * 无结尾斜杠的绝对路径同样按「浏览这个目录」处理。
 *
 * 早先这条规则只覆盖了 UNC 路径，导致粘贴 `F:/a/b/nsis` 被当成搜索词：
 * 先列父目录再按 `nsis` 过滤，弹窗里只剩一条叫 nsis 的结果（用户截图 2）。
 * 这里把同一条规则补到所有「看起来像路径」的输入上。
 *
 * 裸词（如 `nsis`）不含斜杠也不带盘符，交给 addressBarTrimmedQueryLooksLikeFilesystemPath 挡掉，
 * 保持「按名字搜」的既有行为不变。
 */
function resolveAddressBarUnseparatedDirectoryBrowsePath(normalizedQuery: string): string | null {
  const trimmed = canonicalizePath(normalizedQuery);

  if (!trimmed || trimmed.endsWith('/')) {
    return null;
  }

  // 裸盘符（`C:`）不是目录路径，交给既有分支处理。
  if (trimmed.endsWith(':')) {
    return null;
  }

  if (!addressBarTrimmedQueryLooksLikeFilesystemPath(trimmed)) {
    return null;
  }

  return trimmed;
}
```

把 `resolveAddressBarSuggestions` 里的这段：

```ts
  const implicitBrowsePath = getImplicitAddressBarAbsoluteDirectoryBrowsePath(normalizedQuery);
```

改成：

```ts
  const implicitBrowsePath = getImplicitAddressBarAbsoluteDirectoryBrowsePath(normalizedQuery)
    ?? resolveAddressBarUnseparatedDirectoryBrowsePath(normalizedQuery);
```

再把兜底分支里的一行改成容错的（`resolveAddressBarDirectoryListingOrExactOrSearch`，`catch` 的第一层）：

```ts
    try {
      let exactPath = canonicalizePath(pathForReadDir);
      exactPath = isWindowsDriveRootPath(exactPath)
        ? `${exactPath}/`
        : exactPath;
      const exactEntry = await options.lookup.getDirEntry(exactPath);

      if (!exactEntry) {
        return resolveSearchSuggestions(options, fallbackNormalizedQuery);
      }

      return {
        kind: 'exact',
        groups: [createDirectorySuggestionGroup([exactEntry], options.exactGroupLabel, 'exact')],
        exactEntry,
        directoryPath: exactEntry.is_dir ? exactEntry.path : null,
      };
    }
```

- [ ] **Step 4: 跑测试，确认全绿**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts
```
预期：全部 PASS。

**已核对过这三条既有用例不受影响**（断言逐条对过，不要盲改）：
- `'lists a WSL UNC directory when the path has no trailing separator'` —— 走 UNC 专用分支，优先级更高，不变。
- `'does not substitute current directory listings when a UNC parent listing fails'` —— 兜底修正后仍落到 search，不变。
- `'filters parent entries when the typed path matches a directory name without a trailing separator'` —— 新分支 `readDir('/workspace/test')` 失败 → `getDirEntry` 返回 undefined → 被兜底修正拦下 → 回落搜索，`kind` 仍是 `search`，两条断言原样成立。
- `'filters to a concrete file entry when its full path is typed without a trailing separator'` —— 同上，仍是 `search`，断言原样成立。

若实际跑下来有红的，**先读报错再改断言**，不要为了让测试变绿去改期望值。

- [ ] **Step 5: 提交**

```bash
git add src/modules/navigator/components/file-browser/address-bar-editor-utils.ts src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts
git commit -m "fix(address-bar): 无结尾斜杠的绝对路径也按浏览目录处理"
```

---

## Task A2：回车以输入框内容为准

**Files:**
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-utils.ts`（文件末尾新增导出）
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue:146-149`（新增 flag）、`638-646`、`802-827`、`908-923`、`1057-1068`
- Test: `src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts`

**Interfaces:**
- Consumes: Task A1 产出的行为
- Produces:
  - `AddressBarTypedTarget = { kind: 'directory'; path: string } | { kind: 'file'; path: string } | { kind: 'none' }`
  - `resolveAddressBarTypedTarget(rawQuery: string, lookup: AddressBarSuggestionLookup): Promise<AddressBarTypedTarget>`

- [ ] **Step 1: 写失败的测试**

追加到 `address-bar-editor-utils.test.ts`（同时把新符号加进文件顶部第 8-18 行的 import 列表）：

```ts
  it('resolves a typed directory path into a navigate target', async () => {
    const target = await resolveAddressBarTypedTarget(
      'F:/soft/00selfmade/filemanager/sigma-file-manager/src/',
      {
        readDir: vi.fn(),
        getDirEntry: vi.fn().mockResolvedValue(
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/src'),
        ),
      },
    );

    expect(target).toEqual({
      kind: 'directory',
      path: 'F:/soft/00selfmade/filemanager/sigma-file-manager/src',
    });
  });

  it('resolves a typed file path into an open target', async () => {
    const target = await resolveAddressBarTypedTarget(
      'F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md',
      {
        readDir: vi.fn(),
        getDirEntry: vi.fn().mockResolvedValue(
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md', {
            isFile: true,
            name: 'readme.md',
          }),
        ),
      },
    );

    expect(target).toEqual({
      kind: 'file',
      path: 'F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md',
    });
  });

  it('reports no target for an empty or unresolvable query', async () => {
    await expect(resolveAddressBarTypedTarget('', {
      readDir: vi.fn(),
      getDirEntry: vi.fn(),
    })).resolves.toEqual({ kind: 'none' });

    await expect(resolveAddressBarTypedTarget('F:/nowhere', {
      readDir: vi.fn(),
      getDirEntry: vi.fn().mockRejectedValue(new Error('missing')),
    })).resolves.toEqual({ kind: 'none' });
  });
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts
```
预期：FAIL，`resolveAddressBarTypedTarget` 未导出（import 阶段报错）。

- [ ] **Step 3: 最小实现**

在 `address-bar-editor-utils.ts` **文件末尾**追加：

```ts
export type AddressBarTypedTarget =
  | { kind: 'directory'; path: string }
  | { kind: 'file'; path: string }
  | { kind: 'none' };

/**
 * 把输入框里的文字直接解析成一个可执行目标。
 *
 * 回车不能只依赖「列表选中项」：粘贴之后选中项要等防抖 + 两次异步 IO 才恢复，
 * 那一小段窗口里按回车会静默什么都不做（用户截图 2 的另一半原因）。
 * 这个函数不碰选中项，只看文字，因此不受时序影响。
 */
export async function resolveAddressBarTypedTarget(
  rawQuery: string,
  lookup: AddressBarSuggestionLookup,
): Promise<AddressBarTypedTarget> {
  const trimmed = canonicalizePath(normalizePath(rawQuery).trim());

  if (!trimmed || trimmed.endsWith(':')) {
    return { kind: 'none' };
  }

  try {
    const dirEntry = await lookup.getDirEntry(trimmed);

    if (!dirEntry) {
      return { kind: 'none' };
    }

    return dirEntry.is_dir
      ? { kind: 'directory', path: dirEntry.path }
      : { kind: 'file', path: dirEntry.path };
  }
  catch {
    return { kind: 'none' };
  }
}
```

- [ ] **Step 4: 跑测试，确认全绿**

同 Step 2 的命令。预期：全部 PASS。

- [ ] **Step 5: 接进 dialog —— 加「用户动过选中项」标记**

在 `address-bar-editor-dialog.vue` 的 `const selectedIndex = ref(-1);`（第 149 行）**下一行**加：

```ts
// 用户有没有主动用方向键移动过选中项。为 false 时回车以输入框文字为准，
// 为 true 时回车以选中项为准 —— 否则「打开列表后按 ↓ 选文件再回车」会被输入框内容劫持。
const userMovedSelection = ref(false);
```

在 `moveSelection()`（第 802 行）里，`const rowTotal = flatNavigableRowCount.value;` **下一行**加：

```ts
  userMovedSelection.value = true;
```

在 `selectCollapsibleGroupHeader()`（第 839 行）里，`const group = ...` 之后、`selectedIndex.value = group.headerIndex;` **上一行**加：

```ts
  userMovedSelection.value = true;
```

在 `watch(query, ...)`（第 699 行）的 `selectedIndex.value = -1;` **下一行**加：

```ts
  userMovedSelection.value = false;
```

- [ ] **Step 6: 接进 dialog —— 改 Enter 分支**

在 `address-bar-editor-dialog.vue` 中，`openActiveEntry()` 函数（第 908 行）**上方**插入：

```ts
async function handleEnter(): Promise<void> {
  if (!userMovedSelection.value) {
    const typedTarget = await resolveAddressBarTypedTarget(query.value, {
      readDir,
      getDirEntry,
    });

    if (typedTarget.kind === 'directory') {
      isOpen.value = false;
      emit('openDirectory', typedTarget.path);
      return;
    }

    if (typedTarget.kind === 'file') {
      isOpen.value = false;
      emit('openFile', typedTarget.path);
      return;
    }
  }

  await openActiveEntry();
}
```

把 `handleInputKeydown` 里的 Enter 分支（第 1057-1068 行）替换为：

```ts
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      revealActiveEntry();
      return;
    }

    await handleEnter();
    return;
  }
```

在文件顶部从 `./address-bar-editor-utils` 的 import 列表（第 58-75 行）里**补上** `resolveAddressBarTypedTarget`。

- [ ] **Step 7: 跑 dialog 单测 + 类型检查**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__
npx vue-tsc --build
```
预期：全绿，0 type error。

- [ ] **Step 8: 提交**

```bash
git add src/modules/navigator/components/file-browser/address-bar-editor-utils.ts src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue src/modules/navigator/components/file-browser/__tests__/address-bar-editor-utils.test.ts
git commit -m "fix(address-bar): 回车以输入框内容为准，不再依赖选中项刷新时序"
```

---

## Task A3：列表加「目标目录」行，目录与文件齐平缩进 + 左侧树形导线

**Files:**
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-utils.ts`（类型、`createAddressBarSuggestion`、`createDirectorySuggestionGroup`、新增 2 个函数、`resolveAddressBarDirectoryListingOrExactOrSearch`）
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue:285-318`（虚拟行生成）、`1274-1287`（透传 depth）
- Modify: `src/modules/navigator/components/file-browser/address-bar-editor-suggestion-row.vue`（`depth` prop + 缩进）
- Test: 两个既有测试文件

**Interfaces:**
- Consumes: Task A1、A2 的产出
- Produces:
  - `AddressBarSuggestionSource` 新增成员 `'target'`
  - `AddressBarSuggestion` 新增字段 `depth: number`（默认 0）。**定稿为两级**：0 = 目标目录（树的根，顶格），1 = 子目录与文件（齐平一格）。原先计划的三级（目录 1 / 文件 2）已废弃
  - `AddressBarEditorVirtualRow` 的 `suggestion` 行新增 `isLastChild: boolean`，且**只对 `depth > 0` 的行置 true** —— 目标目录是树根，不收尾任何分支
  - `createTargetDirectorySuggestionGroup(directoryPath: string): AddressBarSuggestionGroup`（group id `'targetDirectory'`，`label` 为空串）
  - `orderDirectoryEntriesForSuggestionList(entries: DirEntry[]): DirEntry[]`（子目录在前、文件在后，各自按名称）

- [ ] **Step 1: 写失败的测试**

追加到 `address-bar-editor-utils.test.ts`（import 补 `createTargetDirectorySuggestionGroup`、`orderDirectoryEntriesForSuggestionList`）：

```ts
  it('puts the target directory first, then subdirectories, then files', async () => {
    const readDir = vi.fn().mockResolvedValue(dirContents('F:/target', [
      entry('F:/target/zeta.txt', { isFile: true, name: 'zeta.txt' }),
      entry('F:/target/beta'),
      entry('F:/target/alpha'),
      entry('F:/target/beta.txt', { isFile: true, name: 'beta.txt' }),
    ]));

    const state = await resolveAddressBarSuggestions({
      query: 'F:/target/',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.groups[0].id).toBe('targetDirectory');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['F:/target']);
    expect(state.groups[0].items[0].depth).toBe(0);

    expect(state.groups[1].items.map(item => item.path)).toEqual([
      'F:/target/alpha',
      'F:/target/beta',
      'F:/target/zeta.txt',
      'F:/target/beta.txt',
    ]);
    expect(state.groups[1].items.map(item => item.depth)).toEqual([1, 1, 1, 1]);
  });

  it('builds a target group that holds exactly the directory itself', () => {
    const group = createTargetDirectorySuggestionGroup('F:/target');

    expect(group.id).toBe('targetDirectory');
    expect(group.label).toBe('');
    expect(group.collapsible).toBe(false);
    expect(group.items).toHaveLength(1);
    expect(group.items[0].path).toBe('F:/target');
    expect(group.items[0].isDirectory).toBe(true);
  });

  it('orders subdirectories before files and sorts each bucket by name', () => {
    const ordered = orderDirectoryEntriesForSuggestionList([
      entry('F:/target/b.txt', { isFile: true, name: 'b.txt' }),
      entry('F:/target/z'),
      entry('F:/target/a'),
      entry('F:/target/a.txt', { isFile: true, name: 'a.txt' }),
    ]);

    expect(ordered.map(item => item.name)).toEqual(['a', 'z', 'a.txt', 'b.txt']);
  });
```

- [ ] **Step 2: 跑测试，确认失败**

同 Task A1 Step 2 的命令。预期：FAIL，`createTargetDirectorySuggestionGroup` 未导出。

- [ ] **Step 3: 实现 —— 类型与构造函数**

`address-bar-editor-utils.ts` 第 23 行，类型联合体改为：

```ts
export type AddressBarSuggestionSource
  = 'directory' | 'recent' | 'tagged' | 'exact' | 'userDirectory' | 'systemDrive' | 'target';
```

`AddressBarSuggestion` 接口（第 25-36 行）在 `historyOpenedAt?: number;` **上一行**插入：

```ts
  /** 列表缩进层级：0 = 目标目录，1 = 子目录，2 = 文件。 */
  depth: number;
```

`createAddressBarSuggestion`（第 122 行）改为：

```ts
export function createAddressBarSuggestion(
  entry: DirEntry,
  source: AddressBarSuggestionSource,
  tag?: ItemTag,
  depth = 0,
): AddressBarSuggestion {
  return {
    id: tag ? `${source}:${tag.id}:${entry.path}` : `${source}:${entry.path}`,
    path: normalizePath(entry.path),
    name: entry.name || getPathDisplayName(entry.path) || entry.path,
    isFile: entry.is_file,
    isDirectory: entry.is_dir,
    isSymlink: entry.is_symlink,
    source,
    entry,
    tag,
    depth,
  };
}
```

`createDirectorySuggestionGroup`（第 140 行）改为：

```ts
export function createDirectorySuggestionGroup(
  entries: DirEntry[],
  label: string,
  source: AddressBarSuggestionSource,
  collapsible = false,
): AddressBarSuggestionGroup {
  return {
    id: source === 'exact' ? 'exact' : `directory:${label}`,
    label,
    collapsible,
    items: entries.map(entry => createAddressBarSuggestion(
      entry,
      source,
      undefined,
      // 精确命中只有一项，是整个列表的主角，不缩进。
      // 目录 / 搜索结果里，子目录与文件齐平缩进一格，区分靠图标与颜色。
      source === 'exact' ? 0 : 1,
    )),
  };
}
```

- [ ] **Step 4: 实现 —— 新增两个函数**

在 `createDirectorySuggestionGroup` **下方**插入：

```ts
/**
 * 「目标目录」自己独占第一行。
 *
 * 早先 `kind === 'directory'` 时 exactEntry 已经被填好了，但模板只渲染 groups，
 * 这行数据从来没显示过 —— 用户看不到自己正指向哪个目录，也无法「回车进入它」。
 * label 留空，模板据此不渲染分组标题，省掉 17 个语言包的文案。
 */
export function createTargetDirectorySuggestionGroup(directoryPath: string): AddressBarSuggestionGroup {
  return {
    id: 'targetDirectory',
    label: '',
    collapsible: false,
    items: [
      createAddressBarSuggestion(
        createAddressBarFallbackEntry(directoryPath, false),
        'target',
        undefined,
        0,
      ),
    ],
  };
}

/** 子目录在前、文件在后，各自按名称排序 —— 弹窗靠缩进分层，顺序必须稳定。 */
export function orderDirectoryEntriesForSuggestionList(entries: DirEntry[]): DirEntry[] {
  const byName = (left: DirEntry, right: DirEntry) => left.name.localeCompare(right.name);

  return [
    ...entries.filter(entryItem => entryItem.is_dir).sort(byName),
    ...entries.filter(entryItem => !entryItem.is_dir).sort(byName),
  ];
}
```

- [ ] **Step 5: 实现 —— 让目录分支吐出目标分组**

`resolveAddressBarDirectoryListingOrExactOrSearch`（第 390 行）的 `directory` 分支改为：

```ts
    const directoryContents = await options.lookup.readDir(pathForReadDir);

    return {
      kind: 'directory',
      groups: [
        createTargetDirectorySuggestionGroup(directoryContents.path),
        createDirectorySuggestionGroup(
          orderDirectoryEntriesForSuggestionList(directoryContents.entries),
          options.directoryGroupLabel,
          'directory',
        ),
      ],
      exactEntry: createAddressBarFallbackEntry(directoryContents.path, false),
      directoryPath: directoryContents.path,
    };
```

- [ ] **Step 6: 跑 utils 测试，确认全绿**

同 Task A1 Step 2 的命令。

**注意**：`'returns directory entries when the path ends with a directory separator'`（既有，第 195 行）**会 FAIL**，因为它断言 `state.groups[0].items` 是子项，而子项现在挪到了 `groups[1]`。这是预期内的行为变更，把断言改成：

```ts
    expect(state.groups[0].items.map(item => item.path)).toEqual(['/workspace']);
    expect(state.groups[1].items.map(item => item.path)).toEqual([
      '/workspace/src',
      '/workspace/readme.md',
    ]);
```

同时检查另外两条断言搜索结果的用例（`'quick-searches parent directory entries when the typed path does not exist'` 等）：搜索分支**不**加目标分组，所以 `groups[0]` 仍是结果组，**不需要改**。

- [ ] **Step 7: 实现 —— 空标签的分组标题不占位**

`address-bar-editor-dialog.vue` 的 `suggestionVirtualRows`（第 279 行）里，把：

```ts
    else if (group.items.length > 0) {
```

改成：

```ts
    else if (group.items.length > 0 && group.label) {
```

（不加这条的话，目标分组会白白占掉 28px 高度——虚拟列表已经按 `size` 预留了空间，不渲染就会出现一条空白带。）

- [ ] **Step 8: 实现 —— 把 depth 透传到行组件**

`address-bar-editor-dialog.vue` 模板里 `<AddressBarSuggestionRow`（第 1274 行）加上：

```html
        :depth="virtualRow.item.suggestion.depth"
```

- [ ] **Step 9: 实现 —— 行组件缩进**

`address-bar-editor-suggestion-row.vue`：

`defineProps`（第 11-17 行）改为：

```ts
defineProps<{
  itemIndex: number;
  selected: boolean;
  showsPathBesideName: boolean;
  suggestion: AddressBarSuggestion;
  recentEntryRemoveLabel?: string;
  depth?: number;
}>();
```

模板里 `<div class="address-bar-editor-suggestion-row__name">`（第 59 行）改为：

```html
    <div
      class="address-bar-editor-suggestion-row__name"
      :style="{ paddingInlineStart: `${(depth ?? 0) * 16}px` }"
    >
```

- [ ] **Step 10: 实现 —— dialog 层测试：默认选中目标行**

追加到 `address-bar-editor-dialog.test.ts`。该文件已有 `mountAddressBarEditor()`、`createCurrentDirContents()`、`SuggestionRowStub`：

```ts
  it('selects the target directory row first when a directory path is typed', async () => {
    const wrapper = mountAddressBarEditor();

    wrapper.vm.open('path');
    await flushPromises();

    const selectedRows = wrapper.findAll('[data-selected="true"]');
    expect(selectedRows.length).toBeGreaterThan(0);
    expect(selectedRows[0].attributes('data-address-bar-editor-index')).toBe('0');
  });
```

若 `SuggestionRowStub` 没有透传 `data-selected`，先读该 stub 的定义（第 23-196 行之间）并补上 `:selected="selected"` 与 `:depth="depth"` 两个透传，再跑。

- [ ] **Step 11: 跑全量前端门禁**

```bash
npx vue-tsc --build
npx eslint src
npx vitest run
```
预期：`vue-tsc` 0 error；`eslint src` **179 errors / 59 warnings**（与基线逐字相同）；`vitest` **184 文件 / 1441 用例**以上（基线 183 / 1434，本任务净增 ≥7 条）。

**注意**：vitest 与 eslint **不要并发跑**，`lucide-icons.test.ts` 会假报 1 个失败。分开跑。

- [ ] **Step 12: 提交**

```bash
git add src/modules/navigator/components/file-browser/address-bar-editor-utils.ts src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue src/modules/navigator/components/file-browser/address-bar-editor-suggestion-row.vue src/modules/navigator/components/file-browser/__tests__
git commit -m "feat(address-bar): 列表加目标目录行，子目录与文件缩进分层"
```

- [ ] **Step 13: Part A 打包验收（必须）**

```bash
cmd /c ".superpowers\sdd\build-fb4.cmd"
```
（该脚本内部会自己 `call vcvars64.bat` 并注入 Rust 工具链；`cargo` 不在 PATH，不要绕过脚本直接调。）

装包后逐条核对：

- [ ] 打开导航器 → 点地址栏空白处 → **回车直接进当前目录**（不弹大窗，这一条 Part A 不改形态，只验行为）
- [ ] 点「编辑地址」图标 → 输入框出现 → 回车 → 进当前目录
- [ ] 粘 `F:/soft/00selfmade/filemanager/sigma-file-manager/src-tauri/target/release/bundle/nsis`（**不带结尾斜杠**）→ 列表顶部出现「nsis」这一行并选中 → **立刻按回车** → 进去
- [ ] 同一路径**末尾加斜杠** → 行为一致
- [ ] 输入框里是 `nsis`（裸词）→ 仍然走按名字搜，不跳目录
- [ ] 打开列表 → 按 ↓ 移到某个文件 → 回车 → 打开的是**那个文件**，不是输入框里的目录
- [ ] 列表里子目录缩进一格、文件缩进两格，目录排在文件前面
- [ ] Ctrl+Enter 仍然定位（reveal）到父目录并选中该条目

---

# Part B —— 形态（大改，需重新打包验收）

> Part A 发版稳定后再启动。Part B 会**删除** `address-bar-editor-dialog.vue`，属于本仓库里改动面最大的一块，单独设评审关卡。

## Task B1：地址栏就地编辑

**Files:**
- Modify: `src/modules/navigator/components/file-browser/address-bar.vue`

**Interfaces:**
- Produces: `AddressBar` 新增 prop `modelValue: string` 与 emit `update:modelValue`、`commit: [path: string]`、`cancel: []`；对外暴露的 `isEditing` 只读

- [ ] **Step 1: 写失败的测试**

新建 `src/modules/navigator/components/file-browser/__tests__/address-bar-inline-edit.test.ts`，先只写一条最小用例（该文件不存在，需新建；stub 清单照抄 `address-bar-editor-dialog.test.ts` 里用到的那几个 `EmptyStub`）：

```ts
// 先只验最核心的一条：点面包屑容器进入编辑态
it('enters inline editing when the breadcrumb container is clicked', async () => {
  const wrapper = mount(AddressBar, { props: { currentPath: 'C:/Folder', modelValue: 'C:/Folder' } });

  await wrapper.find('[data-e2e-root="address-bar-breadcrumbs"]').trigger('click');
  await nextTick();

  expect(wrapper.find('[data-e2e-root="address-bar-inline-input"]').exists()).toBe(true);
  expect((wrapper.find('[data-e2e-root="address-bar-inline-input"]').element as HTMLInputElement).value)
    .toBe('C:/Folder');
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-inline-edit.test.ts
```
预期：FAIL，找不到 `address-bar-inline-input`。

- [ ] **Step 3: 实现编辑态**

`address-bar.vue` 的 `<script setup>` 里，`const breadcrumbsContainerRef = ref<HTMLElement | null>(null);` **下一行**加：

```ts
const isEditingAddress = ref(false);
const addressDraft = ref('');
const addressInputRef = ref<HTMLInputElement | null>(null);

function startEditingAddress() {
  addressDraft.value = props.currentPath;
  isEditingAddress.value = true;
  emit('update:modelValue', props.currentPath);
  emit('edit');
}

function cancelEditingAddress() {
  isEditingAddress.value = false;
}

function commitAddressDraft() {
  const trimmed = normalizePath(addressDraft.value).trim();
  isEditingAddress.value = false;

  if (!trimmed || canonicalizePath(trimmed) === canonicalizePath(props.currentPath)) {
    return;
  }

  emit('commit', trimmed);
}

watch(isEditingAddress, async (editing) => {
  if (!editing) {
    return;
  }

  await nextTick();
  addressInputRef.value?.select();
});
```

`props` 改为接收 `modelValue`（保留 `currentPath`），并把 `openEditor()`（第 139 行）改名 `startEditingAddress`，两处调用点（`@click="openEditor"` 在第 233 行与第 318 行）同步改名。

补两个 import：`normalizePath, { canonicalizePath }`（`@/utils/normalize-path` 里已有 `getPathDisplayName`，在同一行补上即可）。

- [ ] **Step 4: 实现模板**

把 `address-bar.vue` 模板里 `.address-bar__breadcrumbs` 的内容改成二选一：

```html
    <div
      ref="breadcrumbsContainerRef"
      class="address-bar__breadcrumbs"
      data-e2e-root="address-bar-breadcrumbs"
      :data-e2e-current-path="props.currentPath ?? ''"
      @wheel="handleBreadcrumbsWheel"
      @click="isEditingAddress ? undefined : startEditingAddress()"
    >
      <div
        v-if="isEditingAddress"
        class="address-bar__edit-host"
      >
        <input
          ref="addressInputRef"
          v-model="addressDraft"
          class="address-bar__input"
          data-e2e-root="address-bar-inline-input"
          spellcheck="false"
          autocomplete="off"
          @keydown.enter.prevent="commitAddressDraft"
          @keydown.esc.prevent="cancelEditingAddress"
          @blur="cancelEditingAddress"
        >
      </div>
      <div
        v-else
        class="address-bar__breadcrumbs-inner"
      >
        <template v-for="(part, index) in addressParts" :key="index">
          <!-- 原封不动保留第 237-308 行内容 -->
        </template>
      </div>
    </div>
```

样式块里追加：

```css
.address-bar__edit-host {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  padding: 0 2px;
}

.address-bar__input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
}
```

- [ ] **Step 5: 跑测试 + 类型检查**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-inline-edit.test.ts
npx vue-tsc --build
```

- [ ] **Step 6: 提交**

```bash
git add src/modules/navigator/components/file-browser/address-bar.vue src/modules/navigator/components/file-browser/__tests__/address-bar-inline-edit.test.ts
git commit -m "feat(address-bar): 点击地址栏就地进入编辑态并全选"
```

## Task B2：浮层贴在地址栏下方

**Files:**
- Create: `src/modules/navigator/components/file-browser/composables/use-address-bar-editor.ts`
- Create: `src/modules/navigator/components/file-browser/address-bar-editor-dropdown.vue`
- Modify: `src/modules/navigator/components/file-browser/file-browser-toolbar-address-bar.vue`
- Delete: `src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue`
- Modify: `src/modules/navigator/components/file-browser/file-browser.vue`（改用新组件，事件名不变）
- Modify: `src/modules/navigator/components/file-browser/__tests__/address-bar-editor-dialog.test.ts`（改名为 `address-bar-editor-dropdown.test.ts`）

**Interfaces:**
- Consumes: Task A1–A3 的全部产出（`resolveAddressBarSuggestions`、`resolveAddressBarTypedTarget`、`depth` 等）
- Produces:
  - `useAddressBarEditor(options)` → `{ isOpen, mode, query, suggestionState, selectedIndex, flatNavigableRowCount, suggestionVirtualRows, visibleSuggestionVirtualRows, suggestionVirtualSpacerStyle, suggestionVirtualWindowStyle, suggestionVirtualViewportHeight, isGroupOpen, open, close, handleInputKeydown, … }`
  - `AddressBarEditorDropdown` props：`query`、`mode`、`selectedIndex`、`…`；emits：`open-directory`、`open-file`、`reveal`

- [ ] **Step 1: 抽出状态机（纯搬运，不改逻辑）**

把 `address-bar-editor-dialog.vue` 的 `<script setup>` 中第 146-1184 行的**全部**逻辑原样搬进 `use-address-bar-editor.ts`，包成 composable：

```ts
export function useAddressBarEditor(options: {
  currentPath: () => string;
  currentDirContents: () => DirContents | null | undefined;
  entryModeGroups: () => AddressBarSuggestionGroup[];
}) {
  // …上面搬过来的 ref / computed / watch / 函数 …
  return {
    isOpen, mode, query, selectedIndex, suggestionState,
    visibleSuggestionGroups, renderedGroups, flatNavigableRowCount,
    suggestionVirtualRows, visibleSuggestionVirtualRows,
    suggestionVirtualSpacerStyle, suggestionVirtualWindowStyle,
    suggestionVirtualViewportHeight,
    isGroupOpen, setGroupOpen, selectCollapsibleGroupHeader,
    handleInputKeydown, removeRecentHistoryRow,
    open, close,
  };
}
```

**搬运期间不许改任何逻辑**。`props.currentPath` → `options.currentPath()`，`props.currentDirContents` → `options.currentDirContents()`，`entryModeGroups` 原本是组件内 computed，改为由参数传入。

- [ ] **Step 2: 跑测试确认搬运没改坏行为**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/address-bar-editor-dialog.test.ts
npx vue-tsc --build
```
此时组件文件还没动，测试应原样通过（composable 尚未被使用）。

- [ ] **Step 3: 新建 dropdown 组件**

`address-bar-editor-dropdown.vue` 的模板照抄旧 dialog 模板的 `<ScrollAreaRoot>` 到 `</div>` 那一段（第 1204-1295 行）与底部的 hints 段（第 1297-1330 行），外层换成：

```html
<PopoverContent
  class="address-bar-editor-dropdown"
  :side="'bottom'"
  :align="'start'"
  :side-offset="4"
  :collision-padding="12"
>
  <!-- 列表 + hints -->
</PopoverContent>
```

从第 1341-1355 行的 `<style>` 里**删掉**这三段居中模态的强制尺寸：

```css
/* 以下三段整段删除 */
/* .sigma-ui-command-dialog:has(.address-bar-editor__scroll-root) { width: 90vw; max-width: 860px; height: 86vh; } */
/* @media (width >= 900px) { ... width: 65vw; } */
/* .sigma-ui-command-dialog:has(...) .sigma-ui-command-dialog__command { min-height: 0; } */
```

以及第 1335-1339 行那段把 overlay 变透明的 `:has(+ .sigma-ui-command-dialog …)` 规则也一并删除（不再有遮罩）。

新增尺寸：

```css
.address-bar-editor-dropdown {
  width: var(--reka-popover-content-trigger-width);
  min-width: 28rem;
  max-width: min(52rem, calc(100vw - 2rem));
  max-height: min(60vh, 34rem);
  padding: 0;
  overflow: hidden;
}
```

- [ ] **Step 4: 挂 PopoverRoot 与锚点**

`file-browser-toolbar-address-bar.vue` 改为：

```html
<script setup lang="ts">
import { PopoverAnchor } from 'reka-ui';
import { Popover } from '@/components/ui/popover';
// …
</script>

<template>
  <Popover
    :open="isEditorOpen"
    :modal="false"
    @update:open="handleEditorOpenChange"
  >
    <PopoverAnchor as-child>
      <AddressBar
        v-model="addressQuery"
        class="file-browser-toolbar-address-bar"
        :current-path="currentPath"
        @navigate="emit('navigate', $event)"
        @open-file="emit('openFile', $event)"
        @commit="emit('navigate', $event)"
        @edit="openEditor('path')"
      />
    </PopoverAnchor>
    <AddressBarEditorDropdown
      v-if="isEditorOpen"
      v-model:open="isEditorOpen"
      :current-path="currentPath"
      :current-dir-contents="currentDirContents"
      @open-directory="emit('navigate', $event)"
      @open-file="emit('openFile', $event)"
      @reveal="(parent, entry) => emit('reveal', parent, entry)"
    />
  </Popover>
</template>
```

- [ ] **Step 5: 处理 entry 模式**

`openEntry` 快捷键（`navigator.vue:1212`）走的是 `mode='entry'`，此时**没有地址栏输入框**可用。因此 dropdown 里 **仅在 entry 模式**渲染自带输入框：

```html
  <CommandInput
    v-if="mode === 'entry'"
    v-model="query"
    :placeholder="inputPlaceholder"
    @keydown="handleInputKeydown"
  />
```

path 模式下不渲染，输入由地址栏的 `<input>` 通过 `@keydown="handleInputKeydown"` 转发上来。

- [ ] **Step 6: 接线到 file-browser.vue**

`file-browser.vue` 第 360-366 行的 `<AddressBarEditorDialog …>` 换成 `<AddressBarEditorDropdown …>`，props / emits 名称保持不变（`current-path`、`current-dir-contents`、`open-directory`、`open-file`、`reveal`），`ref` 上调 `open` / `close` 保持可用（`navigator.vue` 的快捷键依赖它）。

- [ ] **Step 7: 删除旧文件并改名测试**

```bash
git rm src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue
git mv src/modules/navigator/components/file-browser/__tests__/address-bar-editor-dialog.test.ts src/modules/navigator/components/file-browser/__tests__/address-bar-editor-dropdown.test.ts
```
测试文件里把 `import AddressBarEditorDialog from '../address-bar-editor-dialog.vue';` 改成新组件路径，stub 清单里删掉 `CommandDialog` / `CommandInput` 相关 stub（若 entry 分支仍用到则保留），其余用例断言原样保留。

- [ ] **Step 8: 跑全量门禁**

```bash
npx vue-tsc --build
npx eslint src
npx vitest run
```
预期：0 type error；eslint **179 / 59**；vitest 用例数不低于 Part A 结束时的数字。

- [ ] **Step 9: 提交**

```bash
git add -A src/modules/navigator/components/file-browser
git commit -m "refactor(address-bar): 弹窗改为贴在地址栏下方的浮层，输入框移入地址栏"
```

## Task B3：Part B 打包验收

```bash
cmd /c ".superpowers\sdd\build-fb4.cmd"
```

逐条核对（**全部在打包版上做**）：

- [ ] 点地址栏空白处 → 就地变成输入框 → **整条路径被选中**（截图存证）
- [ ] 直接粘贴路径 → 浮层紧贴地址栏下方展开 → 顶行是目标目录且默认选中
- [ ] 回车 → 进入目标目录
- [ ] 上下方向键依次走过：目标目录 → 各子目录 → 各文件
- [ ] 子目录缩进一格、文件缩进两格
- [ ] 点面包屑的某一段 → 跳到那一级（**不**进入编辑态）
- [ ] 点「编辑地址」图标 → 同样进入编辑态
- [ ] Esc 取消编辑，地址栏恢复面包屑显示
- [ ] 浮层里滚不动时阴影/高度正常；长列表滚动流畅
- [ ] `openEntry` 快捷键（entry 模式）仍能打开并搜索
- [ ] 分屏两个窗格各自独立编辑，互不串扰

---

## 五、明确不做（避免范围膨胀）

- **不做**「点地址栏的某一段只选中该段」——资源管理器有，但本次需求没提，且会与「全选」冲突。
- **不做**地址栏独立的历史下拉分组——复用现有 entry 模式的「最近 / 用户目录 / 盘符 / 标签」分组。
- **不改** `openCopiedPath` 快捷键与拖放到地址栏的行为。
- **不引入**任何新的 UI 依赖 —— `@/components/ui/popover` 已在项目里被 11 个文件使用（`file-browser-toolbar-filter.vue` 就在隔壁），照它的写法即可。
- **不碰** Rust 侧任何代码。

## 六、自查记录

- **需求覆盖**：要求 1 → Task B1（就地编辑 + 全选）；要求 2 → Task A2（回车以输入框为准）；要求 3 → Task A3（目标目录行 + 缩进 + 默认选中 + 方向键）+ Task B2（浮层位置）。
- **根因覆盖**：RC1 → A1；RC2/RC3 → A2；RC4 → A3；RC5 → B2；RC6 → B1。
- **口径核对**：门禁基线取自批次 7 交接第 3 节，命令与当时逐字一致（`npx eslint src`，非 `eslint .`）。
- **已识别会失败的既有测试**：只有 `'returns directory entries when the path ends with a directory separator'` 一条，其改法写在 Task A3 Step 6。
