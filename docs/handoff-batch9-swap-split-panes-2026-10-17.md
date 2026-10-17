# 批次 9：分屏「左右互换」按钮 —— 实施结果与交接

- 日期：2026-10-17
- 基线：`a7084aaa`（3.2.2-beta + 地址栏整条选中）→ 本批起点同为该提交
- 上一份交接：`docs/handoff-batch8-address-bar-partA-2026-10-17.md`
- 产物版本：**3.2.3-beta**

---

## 0. 一句话结论

分屏时，**工具栏搜索框右侧多了一个左右互换按钮**，点一下两格显示的文件夹就对调。
**批次 8 的 Part B1/B2（地址栏就地编辑、浮层改锚定）已按用户决定作废。**

---

## 1. 需求与决策

### 1.1 已放弃：地址栏 Part B1/B2

用户在 3.2.2-beta 真机验收后明确表示「当前可以满足要求」，放弃：

- ~~地址栏点击后就地变成输入框并全选~~
- ~~候选列表从居中大窗改成贴在地址栏下方的浮层~~

> **「打开时整条选中」没有跟着作废。** 它做在现有对话框的输入框上
> （`focus()` + `select()`，提交 `2aa2c02b`），不依赖 Part B 的重构，
> 因此已经保留并仍在生效。若将来复活 Part B，这个行为会跟着地址栏本体一起走。

计划文档 `docs/superpowers/plans/2026-10-17-address-bar-explorer-behavior.md`
已把 Part B 标为「已放弃」，正文保留存档，但不再作为待办。

### 1.2 本批新增：分屏左右互换

- 按钮位置：**工具栏「在此目录中搜索」按钮的右侧**（该按钮的 tooltip 是
  `fileBrowser.quickSearch`，输入框 placeholder 是 `fileBrowser.searchThisDirectory`）
- 位置是工具栏 `file-browser-toolbar__actions` 的**最后一项**
- **只在分屏时出现**，单格时不渲染 —— 没有另一格可换，摆出来只是个按了没反应的按钮
- 两格各有一个按钮，行为一致（都触发同一次互换）
- 互换的是**路径**：两格各自保留自己的窗口宽度与标签组顺序，只换文件夹

---

## 2. 实现

### 2.1 交换逻辑抽成纯函数（新增）

`src/modules/navigator/utils/swap-split-pane-paths.ts`

```ts
export function swapTabGroupPaths(tabGroup: TabGroup | null | undefined): boolean
```

**为什么不写在 store 里**：`updateTabPath` 与 `currentTabGroup` 都是模块私有的，
在单测里驱动真实 store 要拖进一整条依赖链。而这段逻辑的真正不变量
（交换、越界、同一目录、不污染别的格子）全都可以直接断言。
store 只是调用方。模式与既有的 `utils/linked-split-sync.ts` 一致。

**行为**：

| 情况 | 结果 |
|---|---|
| 两格指向不同目录 | 交换路径、清掉两格的 `dirEntries` / `selectedDirEntries` / `filterQuery`，同步刷新 `tab.name`，返回 `true` |
| 两格**指向同一目录** | 什么都不做，返回 `false` |
| 只有一格 / 没有标签组 | 什么都不做，返回 `false` |

**为什么同一目录时拒绝**：交换两个一模一样的文件夹本就没有意义，
让面板闪一个你看不见的变化反而更让人困惑。

### 2.2 store 只做转发（新增）

`src/stores/storage/workspaces.ts` 的 `swapSplitPanePaths()` 就是
`return swapTabGroupPaths(currentTabGroup.value)`。

**只改 `tab.path` 就够了**，两个机制各自接手：

- `useFileBrowserLifecycle` 盯着 `{ id, path }`，路径一变各面板自己 `readDir`
- workspaces 上的 `deep: true` watch 会把改动落盘

刻意**不**调 `loadCurrentTabGroup()` —— 那会把整组标签页重开一遍。
刻意**不**写 `currentTabPathNavigationRequest` —— 互换不是一次用户导航，
不该被塞进后退历史里（按「后退」时不该莫名冒出一次换向）。

### 2.3 按钮与接线（新增 + 修改）

| 文件 | 改动 |
|---|---|
| `file-browser-toolbar-swap-panes-button.vue` **（新增）** | 图标按钮 + tooltip + `aria-label`，带 `data-e2e-root="toolbar-swap-panes"` |
| `file-browser-toolbar.vue` | import 新组件；`v-if="isSplitView"`；新增 `swap-panes` emit |
| `file-browser.vue` | 新增 `swapPanes` emit 并转发 |
| `navigator.vue` | 新增 `handleSwapSplitPanePaths()`，两个分屏模板块各接一个 `@swap-panes` |

`handleSwapSplitPanePaths` 里有一条守卫：全局搜索开着时不换 ——
搜索面板正在用那两个路径，换了会让搜索结果对不上。

### 2.4 i18n

17 个语言包新增 `fileBrowser.swapPanes`：`ch` = 「左右互换」，其余 16 个落英文。

---

## 3. 门禁

| 项 | 基线（`a7084aaa`） | 本批 | 判定 |
|---|---|---|---|
| `npx vue-tsc --build` | 0 error | **0 error** | ✅ |
| `npx eslint src` | 179 errors / **59 warnings** | **179 errors / 0 warnings** | ✅ error 与基线一致，**warning 清零** |
| `npx vitest run` | 183 文件 / 1446 用例 | **186 文件 / 1460 用例** | ✅ +3 文件 +14 用例 |
| `node scripts/verify-changelog.mjs` | 退出码 0 | **退出码 0** | ✅ |
| `cargo test --lib` | 386 passed | **未重跑** | 本批零 Rust 改动 |

### 3.1 eslint warning 为什么从 59 变成 0

全仓那 59 条 warning **全部来自 `navigator.vue` 的分屏模板块**（1573–1632 行）——
该块从 `<template v-if="... isSplitView">` 到收尾的 `</ResizablePanel>`
整体比正确嵌套少 4 个空格，是**存量缺陷**。

本批在这个块里加了一行 `@swap-panes`，于是 inherits 了同一条
`vue/html-indent` warning，让 warning 变成 60、门禁基线对不上。

**处理**：把那 60 行统一加 4 格缩进。纯空白、零行为风险。
`git diff -w` 确认忽略空白后只剩 10 行新增（1 个函数 + 2 个属性绑定），
说明这确实是纯格式化，不是夹带改动。

---

## 4. 本批踩的坑

### 4.1 单测当场抓出别名 bug —— 两格都被设成同一个路径

第一版写成：

```ts
applyPathToTab(leftTab, rightTab.path);   // leftTab.path 已经被改成 rightTab.path
applyPathToTab(rightTab, leftTab.path);   // 读到的就是改过之后的值
```

结果是**两格都指向右边那个目录**。必须先把两个路径取出来再写：

```ts
const leftPath = leftTab.path;
const rightPath = rightTab.path;
applyPathToTab(leftTab, rightPath);
applyPathToTab(rightTab, leftPath);
```

这是典型的别名坑，靠肉眼看代码很难发现，是 `exchange` / `renames` / `inverse`
三条断言把它逼出来的。

### 4.2 i18n 脚本第一版把中文写成了英文，而且**全程没报错**

```js
for (const locale of fs.readdirSync(MESSAGES_DIR)) {  // locale 是 'ch.json'，不是 'ch'
  ...
  fileBrowser.swapPanes = TRANSLATIONS[locale] ?? FALLBACK;  // TRANSLATIONS['ch.json'] → undefined
}
```

查表落空 → 静默走英文兜底 → 中文文案丢失，脚本却正常退出、编码自检也通过。

**教训**：批量写多语言时，**兜底分支必须计数并显式报告**，
不能把「查表没命中」和「这个语种本来就要落英文」当成同一件事。
修法是 `path.basename(fileName, '.json')` 取真正的 locale code，
并在结尾核对 `ch` 的实际值。

### 4.3 写占位测试差点交上去

第一版给 store 写了个 stub 测试，断言是
`expect(typeof swapSplitPanePaths).toBe('function')` —— 同义反复，
换成任何实现都绿，没有判别力。删掉重写成 9 条纯函数断言
（含「自己的逆运算」「拒绝时不污染 per-pane 状态」这类边界）。

### 4.4 `rm --` 的路径要用正斜杠

删占位测试时，`rm -- "F:\soft\...\file.ts"` 被运行时拼成了
`<workspace root>` + 去掉反斜杠的路径，直接判为危险目标。
改成 `"F:/soft/.../file.ts"` 一次通过。

---

## 5. 未完成 / 未验证

| 项 | 状态 |
|---|---|
| **分屏互换的真机验收** | ❌ **未做**。代码层与单测已验证，像素层未验证（见 §6） |
| **linked 联动模式下的行为** | ⚠️ **未验证**。`splitViewMode === 'linked'` 时右格会跟随左格的选中项走（`utils/linked-split-sync.ts`）。互换后这种联动是否还按预期工作，本次没测 |
| **单格时不显示按钮** | ✅ 代码层断言（`file-browser-toolbar-swap-panes.test.ts`），像素层未验 |
| **两格同目录时点按钮无反应** | ✅ 代码层断言（`swap-split-pane-paths.test.ts`），像素层未验。**注意这是刻意的无反馈操作** —— 如果用户反馈「按了没反应」，先确认两格是否真的在同一目录 |
| **13 个非中英文语言包的 changelog 停在 3.1.3** | 既有状态，非本批引入 |

---

## 6. 真机验收清单（未执行）

- [ ] 开分屏，两格分别进不同目录
- [ ] 两格工具栏搜索框**右侧**都能看到左右互换按钮
- [ ] 关掉分屏 → 按钮消失
- [ ] 点任一格的互换按钮 → 两格文件夹对调，窗口宽度不变
- [ ] 再点一次 → 换回原样
- [ ] 两格进**同一目录**后点按钮 → 面板无变化（不是卡死）
- [ ] 打开全局搜索面板时点按钮 → 无反应（守卫生效）
- [ ] 互换后重启应用 → 两格的目录保持对调后的状态（已落盘）
- [ ] 悬停按钮 → tooltip 显示「左右互换」
- [ ] 语言切到中文 → 按钮 aria-label 与 tooltip 均为中文

---

## 7. 产物

| 项 | 值 |
|---|---|
| 安装包 | `Alpha File Manager_3.2.3-beta_x64-setup.exe` |
| 路径 | `src-tauri/target/release/bundle/nsis/` |
| 字节 | `19155079`（18.27 MiB） |
| SHA-256 | `42192A5DA499253B46BAB147CB94F55DA86D20E50F71081074A2578952B27817` |
| 构建时间 | 2026-10-17 21:28:57 |

**未上传站点、未创建 GitHub release。**

> **这一版刻意升到了 3.2.3-beta，没有沿用 3.2.2-beta。**
> 3.2.2-beta 用户已经装过并验收过；继续用同一个版本号换内容，
> 会让「哪个包是哪个」再也分不清。下一次测试版就该是新版本号。

---

## 8. 关键路径

```
仓库根        F:\soft\00selfmade\filemanager\sigma-file-manager

交换纯函数    src/modules/navigator/utils/swap-split-pane-paths.ts
store 转发    src/stores/storage/workspaces.ts  → swapSplitPanePaths()
按钮组件      src/modules/navigator/components/file-browser/file-browser-toolbar-swap-panes-button.vue
工具栏接线    file-browser-toolbar.vue → file-browser.vue → pages/navigator.vue
文案          src/localization/messages/*.json  → fileBrowser.swapPanes

单测          utils/__tests__/swap-split-pane-paths.test.ts（9 条）
              components/file-browser/__tests__/file-browser-toolbar-swap-panes.test.ts（3 条）
              components/file-browser/__tests__/file-browser-toolbar-swap-panes-button.test.ts（2 条）

版本号脚本    .superpowers/sdd/bump-323-beta.cjs（幂等，四处同步）
i18n 脚本     .superpowers/sdd/add-swap-panes-i18n.cjs
缩进修补脚本  .superpowers/sdd/fix-navigator-pane-indent.cjs
打包脚本      .superpowers/sdd/build-fb4.cmd
```

---

## 9. 下一步

1. **跑 §6 的真机验收清单**，特别是 linked 联动模式那条。
2. **发版**：先把新包复制进 `release/`，再走 `scripts/release-publish.mjs` 的四步流水线。
3. **MCP 配置自愈**（批次 7 §8 待办第 1 项）—— 端口漂移导致一键部署产物重启后失效，独立于地址栏这条线，可并行推进。
4. **README.zh-CN.md** 仍缺 3.1.1 / 3.1.2 / 3.1.3 三节（批次 7 结转的既有欠账）。
