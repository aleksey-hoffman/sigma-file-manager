# 批次 4：收藏分类选择 + 目录内搜索选项统一

> 本文档只记录「这一批做到哪、为什么这么做、下一步做什么」。

- 文档生成时间：2026-10-16（批次 3 收尾之后的同一个会话）
- 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`
- 起点：`main` @ `6b85e2b7`（已发版 **3.1.2**）
- 交付形式：**3.1.3-beta.1 安装包**，只交付路径，不发布到 GitHub / aiec.fun

---

## 0. 一句话现状

用户反馈的两项优化都已实现、过门禁、判别性验证闭环；**beta 安装包已打包**，
等用户实测后再决定是否发正式版 3.1.3。

---

## 1. 右键「添加到收藏」增加分类选择步骤

### 做了什么

右键 → 添加到收藏，现在会先弹一个分类对话框：路径已知，所以**不需要路径输入框**，
只让用户做一件事 —— 挑分类。下拉里选已有的，或者在下方当场填一个新分类名。

### 关键决策

| 决策 | 理由 |
|---|---|
| **收藏时永远弹框**，哪怕一个分类都没有 | 否则用户永远无法从右键菜单创建第一个分类（分类只能从仪表盘建） |
| **取消收藏不弹框** | 取消不需要挑分类，多弹一次只会让人以为还有别的事没做完 |
| **新分类名优先于下拉选择** | 用户填了名字就是要新分类，忽略等于把显式输入当没看见 |
| **`createFavoriteCategory` 重名返回 null 时落到「未分类」而不是中断** | 这一批条目是用户明确点了「收藏」的，卡住不写比写进未分类更糟 |
| 逐条跳过已收藏 | 重复写同一路径会让收藏列表出现重复项 |

### 结构：为什么抽成纯函数

`utils/file-browser-favorites.ts` 里两个函数承载**全部决策逻辑**：

- `shouldOpenFavoriteCategoryDialog(entries, isFavorite)`
- `resolveFavoriteCategorySelection(entries, selectedCategoryId, newCategoryName, deps)`

其余（`use-file-browser-selection.ts` / `file-browser.vue`）只做接线。

抽出来的理由有两条，第二条更要紧：

1. 原先的写法里，「加收藏走对话框 / 取消收藏直接做」这个分支和十二个 store 的
   初始化写在同一个函数里，要测它就得把整个 `FileBrowser` mount 起来；
2. 「重名落回未分类」是一条**静默降级** —— 不报错、不提示，条目照样进了收藏
   但分类是「未分类」。这类分支必须能直接断言。

### 未覆盖范围

`toggle-favorite` 另有一处全局实现：`src/composables/use-dir-entry-actions.ts:374`，
被 `file-browser-tree-view.vue`、`dir-entry-interactive.vue`、`dir-entry-context-menu.vue` 使用。
**本轮只改了文件列表右键菜单**（用户截图所示的那条路径），这一处未动。

---

## 2. 目录内搜索与全局搜索统一

### 先纠正一个前提

两套搜索**本来就复用同一个 `FileBrowser` 渲染**：

- 全局搜索：`global-search-view.vue:564-575` 传 `:external-entries` + `layout="list"`
- 目录内搜索：`use-file-browser-entries.ts:94-103` 把递归命中并入同一份 `entries`

所以「不统一」**不是渲染不统一，是选项不统一** —— 全局搜索有四个选项，
目录内搜索一个都没有。同一个开关在两个界面有两种行为，这才是用户看到的差别。

### 搬过来的四个选项

| 选项 | 设置键 | 目录内怎么落地 |
|---|---|---|
| 显示文件 | `globalSearch.includeFiles` | 合并递归命中项**之后**过滤 |
| 显示目录 | `globalSearch.includeDirectories` | 同上 |
| 精确匹配 | `globalSearch.exactMatch` | 只对**裸词**生效 |
| 结果条数上限 | `globalSearch.resultLimit` | 替换递归通道硬编码的 500，且在**排序之后**截断 |

四个键本来就在 `userSettings.globalSearch.*` 里且已持久化，
**不需要改 settings schema**，也不存在两处各存一份互相漂移的风险。

### 三个「为什么这么放」

- **类型过滤放在合并之后，不放进 matcher**：这两个开关管的是「结果集里有哪类条目」，
  与查询语义无关。混进 matcher 会让「精确匹配 + 只看文件」变成一段读不懂的布尔表达式。
- **条数上限放在排序之后**：上限说的是「最多显示多少条」，被保留的就该是排序后的
  前 N 条，而不是原始顺序的前 N 条。
- **递归通道的 limit 每次请求时读，不在 setup 时读一次**：否则用户在结果还开着的时候
  把上限调小，下一次按键不会按新上限走，旋钮会「时灵时不灵」。

### 刻意不搬的：容错（typoTolerance）

目录内搜索的粗筛在 Rust 侧按**文件名子串**做。要支持模糊匹配就得把粗筛一起放宽 ——
一次 Rust 改动加一批假阳性，代价与收益不成比例。

**所以没有放一个不生效的开关。** 「精确匹配」能真实成立所以搬了，容错搬不了所以不放。
假开关比缺开关更糟：用户会以为是自己设置错了。

### 未改动

`file-browser.vue:89` 的 `effectiveLayout` 优先级
（`pendingForceListLayout > props.layout`）**保持原样** —— 它服务的是「打开所属目录」
的两格布局，动了会破坏那个功能。

---

## 3. 门禁与判别性验证

| 项 | 结果 |
|---|---|
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **300 problems (179 errors, 121 warnings)**，与基线逐字相同 |
| 全量单测 | 全绿 |
| 17 个语言包叶子键对齐 | 由 `localization/__tests__/messages-key-alignment.test.ts` 覆盖，全绿 |

新增 3 个测试文件、40 条断言。

### 判别性验证：12 条注入缺陷全部转红

逐条注入 → 跑测试 → 必须红 → 还原。覆盖：

截断失效 / 夹取失效 / 两个开关都关时把结果清空 / 精确匹配失效 /
精确匹配被错误地作用到结构化谓词上 / 收藏分支只看第一个条目 /
重名新分类时中断写入 / 新分类名不再优先于下拉选择 / 不再跳过已收藏条目 /
resultLimit 写侧不再夹取 / 写侧把 indeterminate 当 false 落盘 / 写侧写到了错误的设置键。

### 本轮在探针上踩的两个坑（都是探针自己的错，不是代码也不是测试）

1. **还原脚本的参数歧义**。第一版把「不带参数」解释成「注入全部」，
   于是**还原动作本身把 12 条缺陷全灌进了 4 个新文件**（untracked，git 还原不了），
   还测出一串假的 GREEN。改成 `snapshot / inject / restore` 三条显式命令。
2. **PowerShell 把数组 join 成字符串再传给原生命令**。
   `& npx vitest run $tests` 中 `$tests` 是 `-join` 出来的字符串，被当成单个过滤参数，
   vitest 根本没找到测试文件 —— 输出里没有 `FAIL`，于是被我读成「测试抓不到缺陷」。
   改成数组后第一条立刻转红。

**推广**：判「探针有没有生效」时，先看**它有没有真的找到被测对象**。
「没报错」和「没测到」在输出里长得很像。

---

## 4. 待办

- [ ] 用户实测 beta 包
- [ ] 实测通过后发正式版 3.1.3（走 `scripts/release-publish.mjs`）
- [ ] 目录树视图等三处的「添加到收藏」是否也要加分类步骤，待确认

---

## 5. 复用提示

- 判别性验证脚本：`.superpowers/sdd/inject-search-defects.cjs`
  （`snapshot` / `inject <子串>` / `restore` / `list`）
- 备份目录：`.superpowers/sdd/inject-backup/`（`snapshot` 时写入，`restore` 从这里读）
- 本批提交信息：`.superpowers/sdd/commit-msg-batch4.txt`
