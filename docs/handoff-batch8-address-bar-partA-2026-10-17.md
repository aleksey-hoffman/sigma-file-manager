# 批次 8：地址栏 Explorer 化 Part A —— 实施结果与交接

- 日期：2026-10-17
- 基线：`ece6fd61`（批次 7 交接 + beta 预发布修复）→ 本批起点同为该提交
- 上一份交接：`docs/handoff-batch7-mcp-client-deploy-2026-10-17.md`
- 实施计划：`docs/superpowers/plans/2026-10-17-address-bar-explorer-behavior.md`
- 产物版本：**3.2.2-beta**

---

## 0. 一句话结论

用户报的三条地址栏问题，**Part A 全部解决并已打包**：
粘路径回车现在直接跳、列表第一行是目标目录且默认选中、子目录与文件齐平缩进一格并带树形导线。
**Part B（就地编辑 + 浮层改锚定）未启动** —— 见 §4。

---

## 1. 根因（都定位到行，不是猜测）

| # | 现象 | 根因 |
|---|---|---|
| RC1 | 粘 `F:/a/b/nsis`（无斜杠）只出一条「结果」 | `addressBarQueryMeansBrowseInsideDirectory()` **只在字符串以 `/` 结尾时为真**。无斜杠的绝对路径被当成搜索词，走「列父目录 + 按末段名过滤」。该豁免早先只给了 UNC 路径，普通盘符漏了 |
| RC2 | 回车不跳转 | `watch(query)` 立刻把 `selectedIndex` 清成 `-1`，之后要等 120ms 防抖 + 两次异步 IO 才恢复。粘贴后立刻按回车 → `getActiveEntry()` 拿到 `exactEntry`（搜索分支下是 `null`）→ 静默 return。**更糟的变体**：若此时 `suggestionState` 还是上一次的陈旧结果，回车会跳到**上一个目录** |
| RC3 | 回车语义不认输入框 | 回车只作用于列表选中项，输入框内容与之无关 |
| RC4 | 看不到「目标目录」这一行 | `kind === 'directory'` 时 `exactEntry` **早就被算好了**，但模板只渲染 `groups`，这行数据从来没显示过 |
| RC5 | 浮层是居中大窗 | `CommandDialog` + CSS 强制 `width: 65vw; height: 86vh`（**本批未改，属 Part B**） |
| RC6 | 点地址栏不是就地编辑 | 面包屑是 `<button>`，点击只触发打开模态（**本批未改，属 Part B**） |

**顺带修掉一个潜在崩溃点**：`resolveAddressBarDirectoryListingOrExactOrSearch` 的兜底分支里，
`getDirEntry` 若返回 `undefined`（而非抛错），下一行 `exactEntry.is_dir` 会抛 `TypeError`。
生产代码总是抛错所以被掩盖，测试里 `vi.fn()` 默认返回 `undefined`，一改路径规则就会炸。

---

## 2. 交付内容

| 提交 | 内容 |
|---|---|
| `4102a53f` | A1：无结尾斜杠的绝对路径也按浏览目录处理 + `getDirEntry` 返回 undefined 的兜底 |
| `a6ef3942` | A2：回车以输入框内容为准，不再依赖选中项刷新时序 |
| `d49977cb` | A3：列表加目标目录行 + 齐平缩进 + 树形导线 |
| `4d4053c4` | chore(release)：3.2.2-beta 版本号四处同步 + 中英文 changelog |

### 2.1 关键设计决策

1. **路径识别的判据是「看起来像路径」而不是「带不带斜杠」。**
   复用既有的 `addressBarTrimmedQueryLooksLikeFilesystemPath()`（含 `/` 或盘符即真）。
   **裸词（如 `nsis`）不含斜杠也不带盘符，仍然走按名字搜** —— 已有单测锁死，
   防止后续被改回去。裸盘符（`C:`）显式排除。

2. **回车新增一个「用户动过选中项」标记。**
   `userMovedSelection` 为 false 时回车以输入框文字为准；用户按过方向键则为 true，
   回车以选中项为准。**没有这个标记会引入回归** —— 打开列表后按 ↓ 选文件再回车，
   会被输入框里的目录劫持去导航。

3. **回车的探测只在「文件系统路径语境」下做。**
   `entry` 模式是按名字找条目，拿 `down` 这种词去当路径解析既无意义又是一次白跑的 IO。

4. **缩进定稿为两级（用户 2026-10-17 拍板）。**
   目标目录 `depth=0`（顶格、字重加一档，是树根）；子目录与文件 `depth=1`，**彼此齐平**，
   区分靠图标与颜色。左侧竖线 + 短横线形成树形导线，末行用 `└` 收尾。
   初版计划写的三级缩进（目录 1 / 文件 2）已废弃。

5. **`isLastChild` 只对 `depth > 0` 的行置 true。**
   目标目录虽然是自己分组的唯一项，但它是**树根**，不收尾任何分支，
   且导线根本不画（`depth=0`）。这条在测试里锁住。

6. **目标目录分组的 `label` 留空，模板据此不渲染分组标题。**
   省掉 17 个语言包各一条文案 —— 空标题若仍渲染，虚拟列表已按 28px 预留高度，
   会出现一条空白带，所以是在**生成虚拟行时就跳过**，不是渲染时隐藏。

7. **子目录在前、文件在后，各自按名称排序。**
   顺序稳定，缩进才有意义。`localeCompare` 排序（`beta.txt` 排在 `zeta.txt` 前）。

---

## 3. 门禁（与基线逐字对照）

| 项 | 基线（`ece6fd61`） | 本批 | 判定 |
|---|---|---|---|
| `cargo test --lib` | 386 passed | **386 passed / 0 failed** | ✅ 未变（本批零 Rust 改动） |
| `npx vue-tsc --build` | 0 error | **0 error** | ✅ |
| `npx eslint src` | 179 errors / 59 warnings | **179 / 59** | ✅ 逐字相同 |
| `npx vitest run` | 183 文件 / 1434 用例 | **183 文件 / 1445 用例** | ✅ +11 |
| `node scripts/verify-changelog.mjs` | 退出码 0 | **退出码 0** | ✅ |

> eslint 中途一度涨到 **193 errors**，全部来自本批新增代码的风格问题
> （`@stylistic/object-property-newline`、`func-style`、`indent`）。
> 已逐处手工修正到 179，**没有跑 `--fix` 全目录** —— 那会连带修掉基线本就存在的违规，
> 反而对不上基线数字。

---

## 4. 未完成 / 未验证

| 项 | 状态 |
|---|---|
| **打包产物真机验收** | ❌ **未做**。安装包已生成，但**尚未在真机上逐条跑过**验收清单（见 §6）。AGENTS.md 要求界面结论只能来自 `tauri build` 产物 —— **本批所有界面结论目前都是「代码层已验证、像素层未验证」** |
| **Part B1 地址栏就地编辑** | 未启动。要求 1（点一下变输入框并全选）**尚未实现** |
| **Part B2 浮层改锚定** | 未启动。要求 3 的「浮层位置参考资源管理器」**尚未实现**，弹窗仍是居中大窗 |
| **13 个非中英文语言包的 changelog 停在 3.1.3** | 既有状态。`use-changelog.ts` 回退英文条目，`verify-changelog.mjs` 自己也提示了，不是本批引入 |
| **MCP 配置自愈**（批次 7 §8 待办） | 未启动。端口漂移导致一键部署的产物重启后失效的问题仍在 |

---

## 5. 产物

| 项 | 值 |
|---|---|
| 安装包 | `Alpha File Manager_3.2.2-beta_x64-setup.exe` |
| 路径 | `src-tauri/target/release/bundle/nsis/` |
| 字节 | `19157727`（18.27 MiB） |
| SHA-256 | `08527E41FFF6FEF215DFBEBF7FAA79C206EF40FE846950D32C7D69D424BE94A6` |
| 构建时间 | 2026-10-17 19:47:53 |

**未上传站点、未创建 GitHub release** —— 发版流水线（`scripts/release-publish.mjs`）未执行。
按批次 7 §6 的经验，`prepare` 之前**必须先把新包复制进 `release/`**，
否则 `latestInstaller()` 会按 mtime 取到旧的 3.2.1-beta。

---

## 6. 真机验收清单（未执行，需在打包版上跑）

- [ ] 打开导航器 → 点「编辑地址」图标 → 回车 → 进当前目录
- [ ] 粘 `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\target\release\bundle\nsis`（**不带结尾斜杠**）→ 列表顶部出现「nsis」并选中 → **立刻按回车** → 进去
- [ ] 同一路径**末尾加斜杠** → 行为一致
- [ ] 输入 `nsis`（裸词）→ 仍然走按名字搜，不跳目录
- [ ] 打开列表 → 按 ↓ 移到某个文件 → 回车 → 打开的是**那个文件**，不是输入框里的目录
- [ ] 列表第一行顶格且默认选中；子目录与文件齐平缩进一格；左侧竖线贯通、末行收尾
- [ ] 目录排在文件前面
- [ ] Ctrl+Enter 仍然定位（reveal）到父目录并选中该条目

---

## 7. 本批踩的坑

### 7.1 计划里预测会通过的用例，实际红了

计划 Task A1 Step 4 断言「`'filters to a concrete file entry when its full path is typed without a trailing separator'`
不受影响」。实际它红了 —— 因为其中一条断言是
`expect(getDirEntry).not.toHaveBeenCalled()`，而新逻辑**必然会先探测一次「这是不是目录」**。
改法不是改期望值糊过去，而是把断言改成记录新顺序
（`expect(getDirEntry).toHaveBeenCalledWith('/workspace/readme.md')`），
因为「先问一次是目录还是文件」本身就是新行为的正确组成部分。

### 7.2 测试里的排序期望自己写错了

新测试写期望时把 `zeta.txt` 排在 `beta.txt` 前面。测试直接报出
「expected [...] to deeply equal [...]」（两边打印出来一模一样）。
实际顺序由 `localeCompare` 决定：`beta.txt < zeta.txt`。**是测试写错，不是实现写错**。

### 7.3 联合类型的多行缩进对不齐 eslint

把 `AddressBarTypedTarget` 写成多行内联对象联合类型后，`@stylistic/indent`
与 `@stylistic/indent-binary-ops` 连续报 9 个错，怎么排都不对。
**改用三个 interface + 单行联合类型**，一次过 —— 而且更贴合本文件既有写法
（`AddressBarSuggestionState` 等都是 interface）。

### 7.4 `cmd /c` 里带 `(x86)` 的路径会被 PowerShell 先吃掉

`cmd /c "call \"C:\Program Files (x86)\...\vcvars64.bat\" && ..."`
在 PowerShell 里会先把 `(x86)` 当成表达式解析，报 `无法将"x86"项识别为 cmdlet`。
**结论：MSVC/Rust 工具链的引导必须整体写进 `.cmd` 文件**再调用，
已新增 `.superpowers/sdd/cargo-test.cmd`，与既有的 `build-fb4.cmd` 同一模式。

### 7.5 类型上「最后一组的一项」不等于「树的末行」

`isLastChild` 一开始按 `itemOffset === group.items.length - 1` 算，
结果目标目录行（自己分组的唯一项）也被标成收尾。虽然它 `depth=0` 不画导线、视觉无影响，
但语义是错的 —— 树根不收尾任何分支。收紧成 `suggestion.depth > 0 && …` 才对。

---

## 8. 关键路径

```
仓库根            F:\soft\00selfmade\filemanager\sigma-file-manager
计划文档          docs/superpowers/plans/2026-10-17-address-bar-explorer-behavior.md

路径与建议解析    src/modules/navigator/components/file-browser/address-bar-editor-utils.ts
编辑弹窗          src/modules/navigator/components/file-browser/address-bar-editor-dialog.vue
列表行 + 树形导线  src/modules/navigator/components/file-browser/address-bar-editor-suggestion-row.vue
面包屑            src/modules/navigator/components/file-browser/address-bar.vue
包装层            src/modules/navigator/components/file-browser/file-browser-toolbar-address-bar.vue

单测              __tests__/address-bar-editor-utils.test.ts（27 条）
                  __tests__/address-bar-editor-dialog.test.ts（4 条）

版本号升级脚本    .superpowers/sdd/bump-322-beta.cjs（幂等，四处同步）
Rust 门禁脚本      .superpowers/sdd/cargo-test.cmd
打包脚本          .superpowers/sdd/build-fb4.cmd
```

---

## 9. 下一步（建议顺序）

1. **跑 §6 的真机验收清单。** 在打包版上逐条打勾；有问题先别改代码，先复现。
2. **Part B1（地址栏就地编辑）** —— 要求 1 未实现，依赖 §6 第 1、2 条的验收结论。
3. **Part B2（浮层改锚定）** —— 改动面最大：抽出 `use-address-bar-editor.ts` 状态机、
   新建 `address-bar-editor-dropdown.vue`、删除 `address-bar-editor-dialog.vue`。
   单独设评审关卡，不要和别的改动混在一起。
4. **发版 3.2.2-beta** —— 先把新包复制进 `release/`，再走
   `prepare --bump none --skip-build --notes-file _notes.md` 起的四步流水线。
5. **MCP 配置自愈**（批次 7 §8 待办第 1 项）—— 端口漂移问题，独立于本批，可并行推进。
