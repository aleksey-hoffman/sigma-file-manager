# 第一批设计：导航器「小房子」按钮 + 设置页品牌化外链

日期：2026-10-14
状态：待用户评审
所属系列：六项需求分批推进 · 第一批（按风险从低到高）

---

## 1. 背景

2026-10-14 收到六项产品需求，经评估为六个独立子系统，按风险从低到高分五批推进。
本批只做其中两项**改动面最小、无存储格式变更**的需求，作为后续四批的稳定起点。

开发前已在代码仓建立可回滚基线：

```
tag    rollback/3.1.1-baseline-20261014-212843  →  4968a4ad
分支   rollback/3.1.1-baseline                 →  4968a4ad
```

---

## 2. 范围

### 本批要做

| 编号 | 需求 | 一句话 |
|---|---|---|
| 3.1 | 导航器「小房子」按钮 | 改为跳到「此电脑」（列出所有磁盘） |
| 3.5 | 设置页外链菜单 | 全部换成自有品牌链接，删除「讨论」，新增「段燚的学习笔记」 |

### 本批明确不做

- **错误页的「主页」按钮不改**。见 §3.2 的理由。
- 需求 3.2（收藏分类）、3.3（标记新建）、3.4（搜索重做）、3.6（缩略图）全部不在本批。
- 不动扩展市场 / 扩展开发 wiki 的上游链接（`sigma-hub/*`）。它们不属于「设置页外链菜单」，
  虽同样是品牌化欠账，但不在用户本次点名的范围内，需另行确认后再处理。
- 不改 `package.json` 版本号，不触发发版流程。

---

## 3. 需求 3.1 设计：小房子按钮跳到「此电脑」

### 3.1 现状与根因

按钮链路是完整的，**不存在失效**：

```
file-browser-toolbar-nav-buttons.vue:155   @click="emit('goHome')"
  → file-browser-toolbar.vue:69           @go-home="emit('goHome')"
    → file-browser.vue:262                @go-home="fb.navigateToHome"
      → use-file-browser-navigation.ts:757  navigateToHome()
        → userPathsStore.userPaths.homeDir  即 C:\Users\<用户名>
```

根因是**语义不符**而非功能损坏：按钮跳的是「用户个人主目录」。当人已经位于该目录时
（最常见的场景），`readDir` 读到相同路径，界面无任何变化，用户观感就是「点击没有反应」。

### 3.2 方案选择

`navigateToHome()` 有**两个**调用方：

| 调用点 | 控件 | 本批处置 |
|---|---|---|
| `file-browser.vue:262` | 工具栏小房子按钮 | **改为跳 locations** |
| `file-browser-content-body.vue:38` | 目录读取失败时的错误页「主页」按钮 | **保持原样** |

考虑过三个方案：

- **A — 直接改 `navigateToHome()` 的语义**：代码最少，但错误页按钮会**连带改变**，
  属于用户未要求的隐式改动。
- **B — 新增 `navigateToLocations()`，只让工具栏按钮调用**（**采纳**）：两处语义各自独立，
  错误页维持原有行为。
- **C — 两处都改成 locations**：体验统一，但同样动了未被要求的地方。

采纳 B。错误页场景（目录读不出来）回个人目录未必能恢复，这个担忧是合理的，
但它是一个**独立问题**，不应混在本次改动里悄悄改掉。

### 3.3 实现

**复用已有的虚拟路径机制，不新增任何概念。**

`sfm://locations`（显示所有磁盘的「此电脑」视图）在项目里已经存在且已发布：

- 常量：`src/utils/virtual-path-constants.ts:5` `LOCATIONS_VIRTUAL_PATH = 'sfm://locations'`
- 已在用：设置项「默认目录 → 位置」走 `resolveDefaultDirectory` 返回该路径，
  再经 `navigateToResolvedPath` → `readDir` 打开。**这条路径是现网跑通的代码。**
- 分叉版已为其加上按盘符排序与磁盘余量显示（`drive-info.ts:27-33`、`drive-icon.ts:11-14`）。

改动清单：

| 文件 | 改动 |
|---|---|
| `use-file-browser-navigation.ts` | 新增 `navigateToLocations()`，内部调 `navigateToResolvedPath(LOCATIONS_VIRTUAL_PATH)`；加入返回值导出 |
| `use-file-browser-context.ts` | 补 `navigateToLocations` 的类型声明与透传 |
| `use-file-browser.ts` | 在 composable 聚合处透传（与 `navigateToHome` 同处，文件内 3 个分支：主实现 + 无内容回退 + 聚合导出） |
| `file-browser.vue:262` | `@go-home="fb.navigateToHome"` → `@go-home="fb.navigateToLocations"` |

**关于回退分支**：`use-file-browser.ts` 里有一份「无内容」回退对象（约 246–261 行），
其中 `navigateToHome: async () => {}` 是空实现。新增的 `navigateToLocations` 必须同步补上，
否则该分支下的调用会拿到 `undefined`。

### 3.4 文案

小房子按钮的 tooltip 与折叠态 ⋮ 菜单项当前用的是 `fileBrowser.goHome`（「主页」/「Go home」）。

改为复用**已存在**的顶层 `locations` 键（`en` = "Locations" / `ch` = "位置"，17 个语言包均已存在），
**不新增 i18n key**。

`fileBrowser.goHome` 键**保留不删** —— 错误页按钮仍在用它。

---

## 4. 需求 3.5 设计：设置页外链品牌化

### 4.1 菜单最终形态

| 菜单项 | 目标 | 说明 |
|---|---|---|
| 项目页面 | `https://github.com/kizemo/alpha-file-manager` | 原为上游 `aleksey-hoffman/sigma-file-manager` |
| 报告问题 | `https://github.com/kizemo/alpha-file-manager/issues` | 原同上上游仓 |
| ~~讨论~~ | — | **删除**。该仓 Discussions 未开启，链接必然 404 |
| 更新日志 | `https://www.aiec.fun/alpha-file-manager/` | 按用户要求 |
| 所有版本 | `https://www.aiec.fun/alpha-file-manager/` | 原本就指向此处，保持不变 |
| 段燚的学习笔记 | `http://www.aiec.fun` | **新增** |

「更新日志」与「所有版本」两项指向同一页面，是用户明确选择的结果（保留两个入口）。

### 4.2 前置条件：必须先开 Issues

已用 `gh api` 核实 `kizemo/alpha-file-manager` 当前状态：

```json
{"full_name":"kizemo/alpha-file-manager","has_discussions":false,"has_issues":false,
 "archived":false,"private":false}
```

**Issues 处于关闭状态**，`/issues` 链接点进去是 404。用户已授权开启 Issues，
本批执行时用 `gh api -X PATCH repos/kizemo/alpha-file-manager -f has_issues=true` 打开。

Discussions **不开**，对应菜单项一并删除——不做「留一个死链」的中间态。

### 4.3 改动面已核实

`src/data/external-links.ts` 的 GitHub 系列常量**仅被** `modules/settings/ui/actions.vue` 使用。
该文件里的 `extensionsRegistryUrl` / `extensionsDevelopmentWikiUrl` / `updateChannelSiteUrl`
是各自独立的常量，**不会被本次改动牵连**。

### 4.4 实现

| 文件 | 改动 |
|---|---|
| `src/data/external-links.ts` | `githubUser` / `githubRepo` 改为 `kizemo` / `alpha-file-manager`；新增 `learningNotesUrl = 'http://www.aiec.fun'` |
| `modules/settings/ui/actions.vue` | 删除「讨论」菜单项与 `openDiscussionsPage()`；新增 `openLearningNotes()` 与对应 `DropdownMenuItem` |

> `external-links.ts` 里由 `githubRepoLink` 派生出的 `githubLicenseLink` / `githubAllReleases` /
> `githubLatestRelease` 会随之一起指向自有仓。已 grep 确认这三个键在 `src/` 内**无任何消费方**，
> 改动无副作用。

---

## 5. i18n 影响（本批唯一的新增 key）

`src/localization/index.ts` 的 `createI18n` **没有配置 `fallbackLocale`**。
漏改语言包不会报错，只会让该语言界面**直接显示 key 原文**。
项目为此专门设了门禁 `src/localization/__tests__/messages-key-alignment.test.ts`：
判定基准是 `en.json`，每个语言包的叶子 key 集合必须与其**完全相等，缺失与多余都算失败**。

因此本批的 i18n 动作是：

| 动作 | key | 涉及语言包 |
|---|---|---|
| 新增 | `settings.actions.learningNotes` | 全部 17 个 |
| 删除 | `projectGithubButtons.discussions` | 全部 17 个（该 key 仅被 `actions.vue:192` 一处消费，已确认） |
| 保留 | `fileBrowser.goHome` | 不动，错误页仍在用 |

**「段燚的学习笔记」的取值**：这是人名 + 自定义标题，属专有名词，
**17 个语言包统一写同一个字符串**，不做英译。译成 "Duanyi's Learning Notes" 反而丢失了身份标识。

---

## 6. 测试与验收

### 6.1 自动化

- `messages-key-alignment.test.ts` —— 验证 17 个语言包 key 对齐，是本批 i18n 的主要门禁。
- 为 `navigateToLocations` 补一条单元测试：断言它调用 `readDir(LOCATIONS_VIRTUAL_PATH)`
  （对齐既有 `resolve-default-directory` 的测试写法）。
- `npm run lint:eslint` 现状有 188 个既有欠账（`navigator.vue` 独占 126），
  本批**要求不新增**，不做清理。

### 6.2 真机验收

遵守 `AGENTS.md` 硬约束：

- **必须用 `tauri build` 的打包产物验收，不能用 `tauri dev`**
  （dev 构建下所有路由页内容区空白，与代码无关，dev 上的界面结论一律作废）。
- 判定标准：
  - 3.1 — 在任意深层目录点小房子，应看到「此电脑」的磁盘列表；再点一次仍稳定，不闪、不空白。
  - 3.5 — 五个菜单项逐个点开，确认落到 aiec / 自有 GitHub 仓，且**无 404**。

### 6.3 发版

本批**不单独发版**。合入 `main` 后随下一批或用户指定的版本一起走发版流程
（`release:prepare` 四步详见 `docs/operations/release-workflow.md`）。

---

## 7. 回滚

本批开工前工作区干净、HEAD 为 `4968a4ad`，已建 tag 与分支双保险。

- 只回滚本批：`git revert <commit>`（保留历史，不影响后续提交）
- 整体回到发版基线：`git reset --hard rollback/3.1.1-baseline`

⚠️ 该仓库有大量历史分支与未跟踪文件属历史沉淀，**禁止** `git clean` 或其他暴力清理。

---

## 8. 需要授权 / 未决事项

| # | 事项 | 状态 |
|---|---|---|
| 1 | 开启 `kizemo/alpha-file-manager` 的 Issues 功能 | ✅ 用户已授权，本批执行时做 |
| 2 | 修改该仓 description（现为上游原文 `"Sigma File Manager" is a free, open-source...`） | ⏸ **未答复**，默认**不改**。属公开仓库元数据变更，需另行点头 |
| 3 | 扩展市场 / 扩展开发 wiki 仍指向上游 `sigma-hub/*` | ⏸ 本批不做，仅记录为品牌化欠账 |
| 4 | 文档仓 `kizemo/focus-sync` 未推送 | ⏸ 沿用上一轮结论，需用户明确授权 |

---

## 9. 工期

| 事项 | 预估 |
|---|---|
| 3.1 实现 + 测试 | 1–1.5 小时 |
| 3.5 实现 + 开 Issues + 测试 | 1–1.5 小时 |
| `tauri build` 打包 + 真机验收 | 1 小时 |
| **合计** | **3–4 小时** |

不含需求澄清与评审往返。真机问题不计入该预估——上一轮 Focus Sync 的教训是
真机故障远比预估贵，真出现异常会单独汇报。