# 第一批：小房子按钮 + 设置页外链品牌化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让导航器工具栏的「小房子」按钮跳到「此电脑」（列出所有磁盘），并把设置页外链菜单全部换成自有品牌链接。

**Architecture:** 3.1 复用项目里**已经存在并在用**的虚拟路径 `sfm://locations`（设置项「默认目录 → 位置」走同一条 `readDir` 路径），新增一个 `navigateToLocations()` 与现有 `navigateToHome()` 并存，不改后者的语义。3.5 只改一个数据文件（`external-links.ts`）和一个菜单组件（`actions.vue`），其余外链常量互不牵连。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript、Pinia、vue-i18n（17 个语言包）、Vitest + `@vue/test-utils`、Tauri v2。

## Global Constraints

- **面向用户的输出一律使用简体中文**（`AGENTS.md` §1）。代码标识符、文件路径、命令保持原样。
- **真机验收必须用 `tauri build` 的打包产物，不能用 `tauri dev`**（`AGENTS.md` §2）。dev 构建下所有路由页内容区空白，是构建形态特有现象，与代码无关。
- `src/localization/index.ts` 的 `createI18n` **没有配 `fallbackLocale`**。漏改语言包不会报错，只会让该语言界面显示 key 原文。门禁 `src/localization/__tests__/messages-key-alignment.test.ts` 要求每个语言包的叶子 key 集合与 `en.json` **完全相等，缺失与多余都算失败**。
- **JSON 文件一律用 Node `writeFileSync(..., 'utf8')` 写入**。PowerShell 的 `Set-Content -Encoding UTF8` 会写 BOM，`JSON.parse` 会炸。
- **提交信息一律写文件后 `git commit -F`**。PowerShell 会把 markdown 里的反引号当转义符。
- `npm run lint:eslint` 现状有 **188 个既有欠账**（`navigator.vue` 独占 126）。本批**要求不新增**，不做清理。
  ⚠️ **`lint:eslint` 带 `--fix`，会直接改文件**。想「只量不改」必须用 `npx eslint .`（不带 `--fix`），
  对比改动前后的 `✖ N problems` 行。误跑 `--fix` 会把 188 个欠账全修掉并污染提交。
- Rust 工具链固定 `1.90.0`；npm 必须经 `cmd.exe /d /c` 调。本批不涉及 Rust，但打包命令需要注入 PATH。
- **禁止** `git clean` 或其他暴力清理；该仓库有大量历史分支与未跟踪文件属历史沉淀。
- 品牌名统一 **Alpha File Manager**，不重新讨论命名。

## 起始状态

```
分支：docs/batch1-design（HEAD 7368eede，仅含设计文档）
回滚基线：rollback/3.1.1-baseline-20261014-212843 → 4968a4ad
```

---

### Task 1: 导航器「小房子」按钮跳到「此电脑」

**Files:**
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-navigation.ts`（导入区约 42-45 行后；`navigateToHome` 在 757-761 行；返回对象在 890-905 行）
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser.ts`（类型声明 94 行；主实现返回 186 行；无内容回退 249 行；external 模式返回 583 行）
- Modify: `src/modules/navigator/components/file-browser/file-browser.vue:262`
- Modify: `src/modules/navigator/components/file-browser/file-browser-toolbar-nav-buttons.vue:152-161`（展开态按钮）、`:275-278`（折叠态菜单项）
- Test: `src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts`

**Interfaces:**
- Consumes: `LOCATIONS_VIRTUAL_PATH`（已存在，`src/utils/virtual-path-constants.ts:5`，值 `'sfm://locations'`）；同文件已有的 `navigateToResolvedPath(path: string): Promise<void>`（740 行）。
- Produces: `navigateToLocations: () => Promise<void>`，由 `useFileBrowser()` 暴露为 `fb.navigateToLocations`。`navigateToHome` **保持原样**，仍由错误页消费。

> **注意：本任务不碰 `use-file-browser-context.ts`，也不碰 `file-browser.vue` 的 `provideFileBrowserContext({...})` 对象。**
> 该 context 里的 `navigateToHome`（`file-browser.vue:193`）只服务于错误页的「主页」按钮
> （`file-browser-content-body.vue:38`），新函数没有消费方，不需要进 context。
> 设计文档 §3.3 曾把该文件列入改动清单，是错的，本计划予以更正。

- [ ] **Step 1: 写失败的测试**

在 `__tests__/file-browser-toolbar-nav-buttons.test.ts` 末尾追加。文件已有完整的 `vi.mock` 脚手架（`vue-i18n` 的 `t` 是 `key => key`，即渲染出来的文本就是 key 本身），并已有 `mountNavButtons()` 辅助函数。

```ts
describe('file-browser-toolbar-nav-buttons · home button goes to locations', () => {
  it('labels the home button with the locations key instead of goHome', () => {
    const wrapper = mountNavButtons();
    expect(wrapper.text()).toContain('locations');
    expect(wrapper.text()).not.toContain('fileBrowser.goHome');
  });

  it('emits goHome once when the home button is clicked', async () => {
    const wrapper = mountNavButtons();
    await wrapper.find('[data-test="go-locations-button"]').trigger('click');
    expect(wrapper.emitted('goHome')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd "F:\soft\00selfmade\filemanager\sigma-file-manager"
cmd.exe /d /c "npm.cmd run test:unit:run -- src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts"
```

Expected: 两个用例都 FAIL —— 第一个因为文本里仍是 `fileBrowser.goHome`；第二个因为 `data-test="go-locations-button"` 不存在（`find()` 返回不存在的元素，`trigger` 抛错或断言拿到 `undefined`）。

- [ ] **Step 3: 给小房子按钮加 `data-test` 并改用 `locations` 文案**

在 `file-browser-toolbar-nav-buttons.vue` 的展开态小房子按钮上，`class` 行之后插入 `data-test`：

```vue
        <Button
          variant="ghost"
          size="icon"
          class="file-browser-toolbar-nav-buttons__button"
          data-test="go-locations-button"
          @click="emit('goHome')"
        >
          <HomeIcon class="file-browser-toolbar-nav-buttons__icon" />
        </Button>
```

把它的 tooltip（第 160 行）改为：

```vue
      <TooltipContent>{{ t('locations') }}</TooltipContent>
```

折叠态 ⋮ 菜单里那一项（第 277 行）同样改：

```vue
        <DropdownMenuItem @click="emit('goHome')">
          <HomeIcon :size="14" />
          {{ t('locations') }}
        </DropdownMenuItem>
```

> `locations` 是**已存在的顶层 i18n key**（`en.json` = "Locations"，`ch.json` = "位置"，17 个语言包都有），复用它不新增 key，也不触发语言包门禁。
> `fileBrowser.goHome` **保留不删**，错误页仍在用它。

- [ ] **Step 4: 运行测试确认通过**

同 Step 2 的命令。

Expected: 全部 PASS（原有 5 个 layout toggle 用例 + 新增 2 个）。

- [ ] **Step 5: 新增 `navigateToLocations()`**

在 `use-file-browser-navigation.ts` 的导入区末尾（第 45 行 `} from '@/utils/resolve-default-directory';` 之后）加一行：

```ts
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
```

在 `navigateToHome` 函数之后（761 行之后）新增：

```ts
  // FORK-MODIFICATION 2026-10-14：工具栏「小房子」按钮改为跳「此电脑」。
  //
  // 原实现跳 userPaths.homeDir。人已经在该目录时 readDir 读到同一个路径，界面无任何变化，
  // 观感就是「点击没有反应」—— 不是按钮坏了，是目的地选错了。
  //
  // LOCATIONS_VIRTUAL_PATH 不是新造概念：设置项「默认目录 → 位置」经
  // resolveDefaultDirectory 返回的就是它，再走同一条 navigateToResolvedPath → readDir。
  //
  // 刻意不动 navigateToHome：目录读取失败时错误页的「主页」按钮仍调它
  // （file-browser-content-body.vue:38），那是独立场景，不在本次改动范围内。
  async function navigateToLocations() {
    await navigateToResolvedPath(LOCATIONS_VIRTUAL_PATH);
  }
```

在返回对象里，紧跟 `navigateToHome,`（898 行）之后加一行：

```ts
    navigateToLocations,
```

- [ ] **Step 6: 在 `use-fileBrowser` 的四个位置透传**

`use-file-browser.ts` 共四处必须同步，**漏掉任何一处 `vue-tsc` 都会红**：

1. 类型声明（94 行 `navigateToHome: () => Promise<void>;` 之后）：
   ```ts
     navigateToLocations: () => Promise<void>;
   ```
2. 主实现返回（186 行 `navigateToHome: navigation.navigateToHome,` 之后）：
   ```ts
     navigateToLocations: navigation.navigateToLocations,
   ```
3. 无内容回退分支（249 行 `navigateToHome: async () => {},` 之后）：
   ```ts
     navigateToLocations: async () => {},
   ```
4. external 模式返回（583 行 `navigateToHome: dataSource.navigateToHome,` 之后）：
   ```ts
     navigateToLocations: dataSource.navigateToLocations,
   ```

- [ ] **Step 7: 把工具栏按钮接到新函数上**

`file-browser.vue:262`：

```diff
-      @go-home="fb.navigateToHome"
+      @go-home="fb.navigateToLocations"
```

`file-browser.vue` 的 `provideFileBrowserContext({...})`（152-199 行）**保持不动**。

- [ ] **Step 8: 跑类型门禁与单测**

```bash
cd "F:\soft\00selfmade\filemanager\sigma-file-manager"
cmd.exe /d /c "npm.cmd run ts"
cmd.exe /d /c "npm.cmd run test:unit:run"
```

Expected: `vue-tsc --build` 0 error；全部单测通过。

> 脚本名以 `package.json` 实际为准（已核实）：类型检查是 **`ts`**（`vue-tsc --build`），
> 单次跑测试是 **`test:unit:run`**（`test:unit` 是 watch 版，会挂住不退出）。
> `test:unit:run` 经 `scripts/vitest-run.mjs` 把参数透传给 vitest，故 `-- <路径>` 过滤有效。

- [ ] **Step 9: 提交**

```bash
cd "F:\soft\00selfmade\filemanager\sigma-file-manager"
node -e "require('fs').writeFileSync(process.argv[1], process.argv[2], 'utf8')" "$env:TEMP\afm-t1.txt" "fix(navigator): 小房子按钮跳「此电脑」而非用户主目录

原实现跳 userPaths.homeDir，人已在该目录时 readDir 读到同一路径、界面无变化，
观感为「点击没有反应」。新增 navigateToLocations 复用已有的 sfm://locations 虚拟路径
（设置项「默认目录 → 位置」已在走同一条 readDir 路径）。

刻意不改 navigateToHome：错误页的「主页」按钮仍调它，属独立场景。

Co-Authored-By: MiniMax Code <noreply@minimax.io>"
git add src/modules/navigator/components/file-browser
git commit -F "$env:TEMP\afm-t1.txt"
```

---

### Task 2: 设置页外链品牌化

**Files:**
- Modify: `src/data/external-links.ts:5-9`（GitHub 常量）、新增一条 `learningNotesUrl`
- Modify: `src/modules/settings/ui/actions.vue:78-89`（删 `openDiscussionsPage`、加 `openLearningNotes`）、`:170-210`（菜单项）
- Modify: 全部 17 个 `src/localization/messages/*.json`

**Interfaces:**
- Consumes: 无新增依赖。
- Produces: `externalLinks.learningNotesUrl: string`（值 `'http://www.aiec.fun'`）；`actions.vue` 中 `openLearningNotes(): void`。

> **改动面已核实**：`external-links.ts` 的 GitHub 系列常量**仅被** `settings/ui/actions.vue` 使用。
> 同文件的 `extensionsRegistryUrl` / `extensionsDevelopmentWikiUrl` / `updateChannelSiteUrl`
> 是各自独立的常量，不会被本次改动牵连。
> `githubLicenseLink` / `githubAllReleases` / `githubLatestRelease` 由 `githubRepoLink` 派生，
> 会随之指向自有仓；已 grep 确认这三个键在 `src/` 内**无任何消费方**，无副作用。

- [ ] **Step 1: 打开仓库的 Issues 功能**

自有仓 `kizemo/alpha-file-manager` 当前 `has_issues=false`，`/issues` 是 404。用户已授权开启。

```bash
gh api -X PATCH repos/kizemo/alpha-file-manager -F has_issues=true
gh api repos/kizemo/alpha-file-manager --jq .has_issues
```

Expected: 第一条返回仓库对象，第二条输出 `true`。

**Discussions 保持关闭**，「讨论」菜单项直接删除，不留死链。

- [ ] **Step 2: 改 `external-links.ts`**

第 5-9 行：

```ts
const githubMainBranch = 'main';
const githubUser = 'kizemo';
const githubRepo = 'alpha-file-manager';
```

在 `const updateChannelSiteUrl = 'https://www.aiec.fun/alpha-file-manager';` 之后新增：

```ts
// 「段燚的学习笔记」入口。人名 + 自定义标题，属专有名词，不做英译。
const learningNotesUrl = 'http://www.aiec.fun';
```

在导出的对象里，`updateChannelSiteUrl,` 之后加一行 `learningNotesUrl,`。

- [ ] **Step 3: 改 `actions.vue` 的脚本区**

删除整个 `openDiscussionsPage` 函数（78-80 行）及其上方若有的空行整理。保留 `openChangelogPage`，但把它的实现从 `externalLinks.githubChangelogLink` 改为 `externalLinks.updateChannelSiteUrl`（按需求「更新日志的链接设置为 aiec 上的下载页」）。

新增：

```ts
function openLearningNotes() {
  openUrl(externalLinks.learningNotesUrl);
}
```

- [ ] **Step 4: 改 `actions.vue` 的菜单区**

- 删除「讨论」那个 `DropdownMenuItem`（184-193 行区间，含 `discussions` 文案）。
- 把「更新日志」项（195-201 行）的点击改为 `@click="openReleasesPage"`（两者现指向同一页，避免新增一个同义函数）。
- 在「所有版本」项之后、`</DropdownMenuContent>` 之前新增：

```vue
          <DropdownMenuItem @click="openLearningNotes">
            <ExternalLinkIcon
              :size="16"
              class="settings-actions__links-menu-icon"
            />
            {{ t('settings.actions.learningNotes') }}
          </DropdownMenuItem>
```

- [ ] **Step 5: 同步 17 个语言包**

新增 key `settings.actions.learningNotes`，删除 key `projectGithubButtons.discussions`。

**必须用 Node 脚本批量改**（PowerShell 的 `Set-Content -Encoding UTF8` 会写 BOM，导致 `JSON.parse` 失败）：

```bash
cd "F:\soft\00selfmade\filemanager\sigma-file-manager"
node -e "
const fs=require('fs'),path=require('path');
const dir='src/localization/messages';
let n=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const p=path.join(dir,f);
  const raw=fs.readFileSync(p,'utf8');
  const j=JSON.parse(raw);
  // 新增：专有名词，17 个语言包统一写同一个字符串
  j.settings.actions.learningNotes='段燚的学习笔记';
  // 删除：该 key 仅被 actions.vue 一处消费，已随「讨论」菜单项一起删掉
  if(j.projectGithubButtons) delete j.projectGithubButtons.discussions;
  fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n','utf8');
  n++;
}
console.log('patched',n,'locale packs');
"
```

Expected: 输出 `patched 17 locale packs`。

- [ ] **Step 6: 跑门禁与单测**

```bash
cmd.exe /d /c "npm.cmd run test:unit:run -- src/localization"
cmd.exe /d /c "npm.cmd run ts"
npx eslint . 2>&1 | Select-String "problems"
```

Expected:
- `messages-key-alignment.test.ts` PASS（17 个语言包 key 仍与 `en.json` 完全对齐）
- `messages-json.test.ts` PASS（无 BOM、JSON 可解析）
- `vue-tsc --build` 0 error
- eslint 的 `✖ N problems` 中 **N ≤ 188**（**不新增**）。若超过 188，说明本批引入了新问题，必须清掉。

> 用 `npx eslint .` 而**不是** `npm run lint:eslint`：后者带 `--fix`，会把 188 个既有欠账
> 自动改掉，导致提交里混进 28 个无关文件的改动。

- [ ] **Step 7: 提交**

```bash
node -e "require('fs').writeFileSync(process.argv[1], process.argv[2], 'utf8')" "$env:TEMP\afm-t2.txt" "feat(settings): 外链菜单品牌化，删除失效的「讨论」入口

- 项目页面 / 报告问题 改指自有仓 kizemo/alpha-file-manager
- 报告问题依赖 Issues 功能，本提交前已用 gh api 打开（用户授权）
- 「讨论」菜单项删除：该仓 Discussions 从未开启，链接必然 404
- 更新日志 / 所有版本 均指 aiec 下载页（按需求）
- 新增「段燚的学习笔记」→ http://www.aiec.fun
- i18n：createI18n 无 fallbackLocale，门禁要求 17 个语言包 key 与 en.json 完全相等，
  故新增 learningNotes、删除 discussions 均同步全部语言包；专有名词不做英译

Co-Authored-By: MiniMax Code <noreply@minimax.io>"
git add src/data/external-links.ts src/modules/settings/ui/actions.vue src/localization/messages
git commit -F "$env:TEMP\afm-t2.txt"
```

---

### Task 3: 打包与真机验收

**Files:** 无源码改动。

**Interfaces:**
- Consumes: Task 1、Task 2 的全部提交。
- Produces: 验收结论 + 安装包。

> 这一批**不单独发版**：不升版本号、不跑 `release:prepare`、不上传站点、不建 GitHub release。
> 验收通过即合入，等后续批次或你指定的版本一起发。

- [ ] **Step 1: 注入工具链并打包**

```powershell
$env:PATH = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin;C:\Users\Duanyi\.cargo\bin;$env:PATH"
Set-Location "F:\soft\00selfmade\filemanager\sigma-file-manager"
cmd.exe /d /c "npm.cmd run tauri:build"
```

Expected: 构建成功，产出安装包。记录其 sha256 与大小。

- [ ] **Step 2: 安装并验证 3.1**

安装打包产物后，在**任意深层目录**（例如 `F:\soft\00selfmade\filemanager\sigma-file-manager\src`）点工具栏小房子：

- 期望：立刻看到「此电脑」的磁盘列表（不是留在原目录，也不是跳个人主目录）。
- 再点一次：仍稳定显示磁盘列表，不闪、不空白、不重复加载。

**对照组（必须做）**：故意制造一次目录读取失败（如断开的网络路径），确认错误页的「主页」按钮**仍然回个人主目录**，没有被本批顺带改掉。

- [ ] **Step 3: 验证 3.5**

设置页 → 链接图标菜单，逐项点开并记录落地页：

| 菜单项 | 期望落地 |
|---|---|
| 项目页面 | `github.com/kizemo/alpha-file-manager` |
| 报告问题 | `github.com/kizemo/alpha-file-manager/issues`（**不得 404**） |
| 更新日志 | `www.aiec.fun/alpha-file-manager/` |
| 所有版本 | `www.aiec.fun/alpha-file-manager/` |
| 段燚的学习笔记 | `www.aiec.fun` |
| （讨论） | **菜单里不应存在这一项** |

- [ ] **Step 4: 记录结论并汇报**

如实汇报：打包是否成功、真机两项是否达标、是否出现计划外问题。
**不得**用 `tauri dev` 的界面表现作为验收依据（`AGENTS.md` 硬约束）。

---

## 自查

**规格覆盖**：3.1 → Task 1；3.5 → Task 2；打包与真机验收 → Task 3。设计文档 §2 明确排除的四项（错误页按钮、扩展市场链接、版本号与发版）在本计划中确实没有对应任务，符合预期。

**占位符扫描**：无 TBD / TODO / 「类似 Task N」。每一步都给出了可直接粘贴的代码或可直接执行的命令。

**类型一致性**：`navigateToLocations: () => Promise<void>` 在 `use-file-browser.ts` 的类型声明、三个返回分支、以及 `use-file-browser-navigation.ts` 的实现签名（`async function` 返回 `Promise<void>`）四处一致。事件名沿用既有的 `goHome`（组件 emit 不改，只改 `file-browser.vue` 的绑定目标），与 `@go-home` 绑定匹配。

**对设计文档的更正**：设计文档 §3.3 的改动清单里列了 `use-file-browser-context.ts`，实际不需要——新函数没有消费方，进 context 是多余的。已在 Task 1 的 Interfaces 段落显式标注该更正。