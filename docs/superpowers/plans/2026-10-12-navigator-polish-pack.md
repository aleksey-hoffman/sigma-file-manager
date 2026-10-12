# 导航器打磨包 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地六项用户需求：设置页文案、工具栏按钮位置调整、缩略图大小调整、目录树右键菜单、长按不切换置顶、全局搜索"打开所在目录"。

**Architecture:** 每个需求独立 Task，可分别验证。共享部分：ContextMenuAction 联合类型扩展（任务 4 命中 `'open-containing-directory'`，任务 6 复用）、Schema 29→30 迁移（任务 3）、17 语言包（每加 UI 字符串必加 17 份）。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Pinia、vue-i18n、Vitest、@vue/test-utils、Tauri 2

**设计依据：** `docs/superpowers/specs/2026-10-12-navigator-polish-pack-design.md`

---

## Global Constraints

- **零新依赖**。
- **面向用户的文案必须走 i18n**，17 个语言包（`src/localization/messages/*.json`），中文 locale code 是 `ch` 而非 `zh`。按既有先例：`ch` 写中文（用户原话），其余 16 个写英文译文或英文占位。
- 品牌名锁定 Alpha File Manager；受保护常量不得改动。
- 改现有文件以纯追加为主，删除/改写既有逻辑需要写明理由。
- **真机验收必须用 `tauri build` 的打包产物**。dev 构建下所有路由页内容区空白。
- **新测试必须先注入缺陷确认转红，且失败输出须精确展示预期损坏**。
- Rust 命令行必须用 1.90.0 工具链并做进程级 PATH 注入（handoff §四.1）。
- PowerShell 脚本处理 JSON/中文时用 `node -e`，不要用 `Get-Content | ConvertFrom-Json`（5.1 GBK 解析会乱码）。
- 文件删除用 `rm -- "<正斜杠路径>"`，不要用 `Remove-Item`。
- **Schemas 迁移**：`USER_SETTINGS_SCHEMA_VERSION` 从 29 → 30（任务 3 加 `navigator.thumbnailSize` 字段）。

---

## File Structure

| 文件 | 任务 | 动作 |
|---|---|---|
| `src/localization/messages/ch.json` | 1 | 改 `app.description` + `app.copyright` |
| `src/localization/messages/en.json` | 1 | 改 `app.description` + `app.copyright`（英文译文）|
| `src/localization/messages/{de,es,fa,fr,he,hi,hy,it,ja,pt,ru,sl,tr,ur,vi}.json` | 1 | 改 `app.description` + `app.copyright`（英文占位，与 en.json 一致）|
| `src/modules/settings/ui/header.vue` | 1 | 不改（沿用 app.name + app.description + app.copyright 三 key）|
| `src-tauri/Cargo.toml` 与 `package.json` | — | **本轮不动版本号**（按规则 P，release 阶段才升）|
| `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue` | 2 | 删除 :443-471 布局切换按钮块 |
| `src/modules/navigator/components/file-browser/file-browser-toolbar-nav-buttons.vue` | 2 | refresh 后追加布局切换按钮 |
| `src/modules/navigator/components/file-browser/file-browser-toolbar.vue` | 2 | 转发 `currentLayout` + `setLayout` props 到 nav-buttons |
| `src/modules/navigator/components/file-browser/file-browser.vue` | 2 | 用 `useNavigatorFolderSettings()` 派生 currentLayout + setLayout，传给 toolbar |
| `src/types/user-settings.ts` | 3 | `UserSettingsNavigator` 加 `thumbnailSize: 'small' \| 'medium' \| 'large'` |
| `src/stores/storage/user-settings.ts` | 3 | 默认值 `thumbnailSize: 'medium'` |
| `src/stores/schemas/user-settings.ts` | 3 | 常量 29→30 + 迁移步 + 新增 `setDefaultEnumIfMissing` helper（若不存在）|
| `src/stores/schemas/__tests__/user-settings.test.ts` | 3 | 迁移测试两条 |
| `src/modules/navigator/components/file-browser/composables/use-file-browser-virtual-layout.ts` | 3 | LIST_ENTRY_HEIGHT 改为 dynamic |
| `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue` | 3 | size 默认值改为根据 setting 计算 |
| `src/modules/navigator/components/file-browser/file-browser-grid-card.vue` | 3 | 根据 setting 调整 grid 卡片缩略图尺寸 |
| `src/modules/navigator/components/file-browser/file-browser-thumbnail-size-dialog.vue` | 3 | 新建弹窗组件 |
| `src/modules/navigator/components/file-browser/__tests__/file-browser-thumbnail-size-dialog.test.ts` | 3 | 新建测试 |
| `src/types/user-settings.ts`（fixture 同步） | 3 | grep `UserSettingsNavigator` 全字段引用，加 thumbnailSize |
| `src/modules/navigator/components/file-browser/file-browser-tree-view.vue` | 4 | 加 `@contextmenu` 事件 + context menu 挂载 |
| `src/modules/navigator/components/file-browser/file-tree-context-menu.vue` | 4 | 新建 |
| `src/modules/navigator/components/file-browser/__tests__/file-tree-context-menu.test.ts` | 4 | 新建测试 |
| `src/modules/navigator/components/file-browser/types.ts` | 4, 6 | ContextMenuAction 加 `'open-containing-directory'` |
| `src/modules/navigator/components/file-browser/utils/context-menu-action-visibility.ts` | 4, 6 | visibility 规则：仅 file 可见 |
| `src/modules/navigator/components/file-browser/composables/use-file-browser-actions.ts` | 4, 6 | handler 加 `openInExplorer` |
| `src/utils/open-in-explorer.ts` | 4, 6 | 新建（调 `explorer.exe /select,<path>`）|
| `src/localization/messages/{17 包}.json` | 3, 4 | 新增 key（详见各 Task）|
| `src/modules/navigator/components/file-browser/file-browser-toolbar-nav-buttons.vue` | 3 | refresh 按钮后追加缩略图大小按钮（紧跟布局切换按钮）|
| `src-tauri/capabilities/*.json` | 4, 6 | 若新用 tauri-plugin-shell 需加权限（详查）|

**明确不改**：`file-browser-actions-menu.vue`（4 项菜单是 tree 独立菜单，不复用 file-browser 菜单）；`use-file-browser-selection.ts` 等选择逻辑。

---

## Task 1: 设置页文案改动

**Files:**
- Modify: `src/localization/messages/ch.json` (3-6 行)
- Modify: 16 个其他语言包（同上结构）

**Interfaces:**
- Produces: 17 个语言包的 `app.description` 与 `app.copyright` 全部更新

- [ ] **Step 1: 改 ch.json**

打开 `src/localization/messages/ch.json`，定位到 `app` 块（第 2-6 行）：

```json
"app": {
  "name": "Alpha File Manager",
  "description": "\"Alpha File Manager\" 在 \"Sigma File Manage\" 基础上开发，添加了目录树、弹窗路径聚焦、批量重命名等功能，是一款更好用的文件管理器应用程序。",
  "copyright": "鸣谢 Aleksey Hoffman"
}
```

> **注意**：保留用户原话中的 "Sigma File Manage" 拼写（少一个 r）。如验收时希望统一为 "Sigma File Manager"，改这一处即可。

- [ ] **Step 2: 改 en.json + 15 个其他语言包**

打开 `src/localization/messages/en.json`：

```json
"app": {
  "name": "Alpha File Manager",
  "description": "\"Alpha File Manager\" is developed on top of \"Sigma File Manager\", with added features like directory tree, popup path focus, batch rename and more — a better file manager application.",
  "copyright": "Credits to Aleksey Hoffman"
}
```

对其余 15 个语言包（de/es/fa/fr/he/hi/hy/it/ja/pt/ru/sl/tr/ur/vi）应用**同样的英文译文**（按既有先例，非中文包统一英文占位）。

- [ ] **Step 3: 跑 i18n key 对齐测试**

```bash
cd 'F:\soft\00selfmade\filemanager\sigma-file-manager'
npx vitest run src/localization/__tests__/messages-key-alignment.test.ts
```

Expected: PASS。key 对齐测试会拦截漏改某个包。

- [ ] **Step 4: 跑 vue-tsc + 设置页相关 vitest**

```bash
npm run ts
npx vitest run src/modules/settings src/localization
```

Expected: exit 0 / 全绿。

- [ ] **Step 5: 提交**

```bash
git add src/localization/messages/*.json
git commit -m "docs(localization): 改写设置页顶部介绍（基于 Sigma File Manager 分叉，添加目录树等）"
```

---

## Task 2: 工具栏布局按钮位置调整

**Files:**
- Modify: `navigator-toolbar-actions.vue:443-471`（删除布局切换按钮块）
- Modify: `file-browser-toolbar-nav-buttons.vue`（refresh 后追加布局切换按钮）
- Modify: `file-browser-toolbar.vue`（转发 props）
- Modify: `file-browser.vue`（派生 currentLayout + setLayout）
- Test: `file-browser-toolbar-nav-buttons.test.ts`（若不存在则新建）

**Interfaces:**
- Produces: 布局切换按钮位于 `file-browser-toolbar-nav-buttons` 的 refresh 按钮之后

- [ ] **Step 1: 在 file-browser-toolbar-nav-buttons.vue 写失败测试**

打开 `src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts`（若无则新建）。

测试断言 nav-buttons 在 `:refresh 事件传入后` 还含一个按钮，aria-label = `t('list')` 或 `t('grid')`（取决于当前 layout）。

```ts
it('renders a layout toggle button after refresh', async () => {
  const wrapper = mount(FileBrowserToolbarNavButtons, {
    props: { canGoBack: false, canGoForward: false, canGoUp: false, isLoading: false,
             isFilterOpen: false, focusFilterInput: false, currentLayout: 'list',
             refresh: () => {} },
  });
  const buttons = wrapper.findAllComponents({ name: 'Button' });
  // 至少有 5 个: back, forward, up, home, refresh + layout-toggle
  expect(buttons.length).toBeGreaterThanOrEqual(6);
});
```

跑测试，预期 FAIL（按钮还没接入）。

- [ ] **Step 2: file-browser-toolbar-nav-buttons.vue 加按钮**

在 refresh 按钮（:140-158）后追加：

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button
      variant="ghost"
      size="icon"
      :aria-label="t(nextLayoutLabelKey)"
      @click="emit('toggle-layout')"
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

新增 props:
```ts
defineProps<{
  // ...existing
  currentLayout: 'list' | 'grid';
}>();

const emit = defineEmits<{
  // ...existing
  'toggle-layout': [];
}>();

const isGridLayout = computed(() => props.currentLayout === 'grid');
const nextLayoutLabelKey = computed(() => isGridLayout.value ? 'list' : 'grid');
```

- [ ] **Step 3: file-browser-toolbar.vue 转发**

新增 prop:
```ts
currentLayout: 'list' | 'grid';
```

emit:
```ts
'toggle-layout': [];
```

- [ ] **Step 4: file-browser.vue 派生**

引入 `useNavigatorFolderSettings`（已在 navigator-toolbar-actions 用过），派生 currentLayout + setLayout，传给 toolbar。

```ts
const { applied, persistForScope } = useNavigatorFolderSettings(...);
const currentLayout = computed(() => applied.value.layout);
const isGlobalScope = ref(true); // 简化：toolbar 上下文默认全局
function setLayout(name) { return persistForScope(isGlobalScope.value ? 'global' : 'folder', { layout: name }); }
```

传给 `<FileBrowserToolbar :current-layout="currentLayout" @toggle-layout="setLayout(isGridLayout ? 'list' : 'grid')" />`。

- [ ] **Step 5: navigator-toolbar-actions.vue 删除布局切换按钮**

删除 :443-471（ListIcon / LayoutGridIcon 按钮块）。`setLayout` 函数本身保留（仍是公共逻辑入口），`LayoutGridIcon` / `ListIcon` import 也保留（其他文件可能用）。

- [ ] **Step 6: 跑测试**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts
```

Expected: PASS（按钮接入了，emit toggle-layout）。

- [ ] **Step 7: 判别性探针 A：注入「emit 名字拼错」**

把 `emit('toggle-layout')` 改成 `emit('toggleLayout')`。

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts
```

Expected: FAIL（输出精确显示 "expected 'toggle-layout' to be 'toggleLayout'" 或对应 vitest 格式）。失败信息确认后**恢复**。

- [ ] **Step 8: 判别性探针 B：注入「layout 计算错了」**

把 `isGridLayout` 改成 `!isGridLayout`。

Expected: FAIL（输出精确显示 "list" 与 "grid" 颠倒）。失败信息确认后**恢复**。

- [ ] **Step 9: 类型门禁 + navigator vitest**

```bash
npm run ts
npx vitest run src/modules/navigator
```

Expected: exit 0 / 全绿。

- [ ] **Step 10: 提交**

```bash
git add src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue src/modules/navigator/components/file-browser/file-browser-toolbar.vue src/modules/navigator/components/file-browser/file-browser-toolbar-nav-buttons.vue src/modules/navigator/components/file-browser/file-browser.vue src/modules/navigator/components/file-browser/__tests__/file-browser-toolbar-nav-buttons.test.ts
git commit -m "refactor(toolbar): 把布局切换按钮从窗口工具栏移到选项卡工具栏 refresh 旁"
```

---

## Task 3: 缩略图大小调整按钮 + 弹窗

**Files:**
- Modify: `src/types/user-settings.ts`（加 thumbnailSize 字段）
- Modify: `src/stores/storage/user-settings.ts`（默认值）
- Modify: `src/stores/schemas/user-settings.ts`（常量 30 + 迁移）
- Modify: `src/stores/schemas/__tests__/user-settings.test.ts`（迁移测试）
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-virtual-layout.ts`（LIST_ENTRY_HEIGHT 动态化）
- Modify: `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue`
- Modify: `src/modules/navigator/components/file-browser/file-browser-grid-card.vue`
- Create: `src/modules/navigator/components/file-browser/file-browser-thumbnail-size-dialog.vue`
- Create: `src/modules/navigator/components/file-browser/__tests__/file-browser-thumbnail-size-dialog.test.ts`
- Modify: `src/modules/navigator/components/file-browser/file-browser-toolbar-nav-buttons.vue`（缩略图按钮）
- Modify: 17 个语言包（新增 6 个 key）

- [ ] **Step 1: schema 29→30 迁移测试**

打开 `src/stores/schemas/__tests__/user-settings.test.ts`，追加：

```ts
describe('migrateUserSettingsStorage 29->30 thumbnailSize', () => {
  function createStorage(initial: Record<string, unknown>) { /* 同既有 helper */ }

  it('writes thumbnailSize medium when key is absent', async () => {
    const storage = createStorage({ [USER_SETTINGS_SCHEMA_VERSION_KEY]: 29 });
    await migrateUserSettingsStorage(storage);
    expect(storage.values.get('navigator.thumbnailSize')).toBe('medium');
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(30);
  });

  it('does not overwrite existing thumbnailSize', async () => {
    const storage = createStorage({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 29,
      'navigator.thumbnailSize': 'large',
    });
    await migrateUserSettingsStorage(storage);
    expect(storage.values.get('navigator.thumbnailSize')).toBe('large');
  });
});
```

跑测试，预期 FAIL。

- [ ] **Step 2: schema 常量 29→30 + 迁移步 + 新增 `setDefaultEnumIfMissing`**

`src/stores/schemas/user-settings.ts:19` 改为 `export const USER_SETTINGS_SCHEMA_VERSION = 30;`

现有 `if (fromVersion === 28 && toVersion === 29)` 之后追加：

```ts
if (fromVersion === 29 && toVersion === 30) {
  await setDefaultEnumIfMissing(storage, 'navigator.thumbnailSize', 'medium', ['small', 'medium', 'large']);
}
```

若 `setDefaultEnumIfMissing` 不存在，新建（同 `setDefaultBooleanIfMissing` 风格）。

跑测试，预期 PASS。

- [ ] **Step 3: 类型 + 默认值**

`src/types/user-settings.ts` 加字段：

```ts
thumbnailSize: 'small' | 'medium' | 'large';
```

`src/stores/storage/user-settings.ts` 加默认值：

```ts
thumbnailSize: 'medium',
```

- [ ] **Step 4: 类型门禁**

```bash
npm run ts
```

若有 TS2322 报错（fixture 缺字段），按既有 `enableBoxSelection` 同构处理，加到所有 `UserSettingsNavigator` fixture。

- [ ] **Step 5: 判别性探针**

把 `setDefaultEnumIfMissing` 换成覆盖写 `await storage.set('navigator.thumbnailSize', 'medium');`

跑测试，预期「不覆盖现有值」那条 FAIL。恢复实现。

- [ ] **Step 6: LIST_ENTRY_HEIGHT 动态化**

`use-file-browser-virtual-layout.ts` 引入：

```ts
import { useUserSettingsStore } from '@/stores/storage/user-settings';
const userSettingsStore = useUserSettingsStore();
const listEntryHeight = computed(() => {
  const size = userSettingsStore.userSettings.navigator.thumbnailSize;
  return size === 'large' ? 64 : 42;
});
// 替换 LIST_ENTRY_HEIGHT 常量引用为 listEntryHeight.value
```

注意：所有 LIST_ENTRY_HEIGHT 的引用都要改。grep 确认范围。

- [ ] **Step 7: 列表缩略图组件接入**

`file-browser-list-entry-thumbnail.vue` 默认 size 改为：

```ts
const userSettingsStore = useUserSettingsStore();
const effectiveSize = computed(() => {
  const size = userSettingsStore.userSettings.navigator.thumbnailSize;
  return size === 'small' ? 24 : size === 'large' ? 48 : 32;
});

withDefaults(defineProps<...>(), {
  size: undefined as unknown as number, // 让 computed 接管
});
// 渲染时 :width="effectiveSize" :height="effectiveSize"
```

- [ ] **Step 8: 网格卡片接入**

`file-browser-grid-card.vue` 类似处理：根据 thumbnailSize 调整卡片缩略图尺寸。**注意**：grid 卡片缩略图与列表是同一组件还是分离？若是同一组件（list-entry-thumbnail 复用），任务 7 已覆盖。若是独立组件（file-browser-grid-card.vue 自己的缩略图），需要单独改。

读 `file-browser-grid-card.vue` 后再定。

- [ ] **Step 9: 缩略图大小弹窗**

新建 `file-browser-thumbnail-size-dialog.vue`：

- 使用项目内 `<Dialog>` 组件（`@/components/ui/dialog`）
- 3 个 radio 选项（small / medium / large），文案走 i18n
- 选完后立即更新 setting
- 提供 props：`open: boolean`、`modelValue: 'small' | 'medium' | 'large'`
- emit `update:modelValue`、`update:open`

测试：

```ts
it('updates setting when radio changed', async () => {
  const wrapper = mount(FileBrowserThumbnailSizeDialog, {
    props: { open: true, modelValue: 'medium' },
  });
  await wrapper.find('[data-test="thumbnail-size-large"]').trigger('click');
  expect(wrapper.emitted('update:modelValue')).toEqual([['large']]);
});
```

- [ ] **Step 10: 弹窗入口**

`file-browser-toolbar-nav-buttons.vue` 在布局切换按钮后追加：

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button variant="ghost" size="icon" :aria-label="t('settings.general.fileView.thumbnailSizeTitle')"
            @click="showThumbnailSizeDialog = true">
      <ImageIcon :size="16" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>{{ t('settings.general.fileView.thumbnailSizeTitle') }}</TooltipContent>
</Tooltip>

<FileBrowserThumbnailSizeDialog v-model:open="showThumbnailSizeDialog"
                                 v-model="currentThumbnailSize" />
```

- [ ] **Step 11: 17 语言包新增 key**

每个包加：
- `settings.general.fileView.thumbnailSizeTitle`
- `settings.general.fileView.thumbnailSizeDescription`
- `settings.general.fileView.thumbnailSizeSmall`
- `settings.general.fileView.thumbnailSizeMedium`
- `settings.general.fileView.thumbnailSizeLarge`

`ch.json` 中文：缩略图大小 / 调整文件视图中缩略图的尺寸 / 小 / 中 / 大

`en.json` 等英文：Thumbnail size / Adjust the size of thumbnails in the file view / Small / Medium / Large

- [ ] **Step 12: 门禁**

```bash
npm run ts
npx vitest run src/modules/settings src/modules/navigator src/localization
```

Expected: 全绿。

- [ ] **Step 13: 提交**

```bash
git add <files>
git commit -m "feat(thumbnail): 新增缩略图大小调整按钮 + 弹窗（schema 30）"
```

---

## Task 4: 目录树右键菜单

**Files:**
- Modify: `src/modules/navigator/components/file-browser/types.ts`（加 `'open-containing-directory'`）
- Modify: `src/modules/navigator/components/file-browser/utils/context-menu-action-visibility.ts`（加规则）
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-actions.ts`（handler）
- Create: `src/utils/open-in-explorer.ts`（调 explorer.exe /select,<path>）
- Create: `src/modules/navigator/components/file-browser/file-tree-context-menu.vue`
- Modify: `src/modules/navigator/components/file-browser/file-browser-tree-view.vue`（@contextmenu 事件 + 挂载）
- Create: `src/modules/navigator/components/file-browser/__tests__/file-tree-context-menu.test.ts`
- Modify: 17 个语言包（加 `openContainingDirectory` key）

- [ ] **Step 1: ContextMenuAction 加成员 + visibility 规则**

`types.ts:39` 加：

```ts
export type ContextMenuAction = ... | 'open-containing-directory';
```

`context-menu-action-visibility.ts` 加规则：仅 file 类型可见（reference `entryTypes: ['file']`）。

- [ ] **Step 2: openInExplorer 工具**

`src/utils/open-in-explorer.ts`：

```ts
import { invoke } from '@tauri-apps/api/core';

export async function openInExplorer(path: string): Promise<void> {
  // explorer.exe /select,<path>  —— 在 Explorer 中选中目标
  await invoke('plugin:shell|open', { path: `C:\\Windows\\explorer.exe`, with: ['/select,', path] });
}
```

> **TBD**: 实际 Tauri 命令与权限。读 `src-tauri/capabilities/*.json` 后确认。
>
> 若 Tauri 2.x 不允许直接调 explorer.exe，可改用 `tauri-plugin-opener`（`openPath(path)`，但 explorer.exe /select 不是 open 的能力）。备选：通过 Rust 侧 std::process::Command 新建 command。
>
> **最简方案**：在 Rust 侧 `src-tauri/src/lib.rs` 加一个 `#[tauri::command]` `reveal_in_explorer(path: String)`，调 `Command::new("explorer.exe").arg(format!("/select,{}", path)).spawn()`。注册到 invoke handler。

确定方案后写代码。

- [ ] **Step 3: file-tree-context-menu.vue**

新建：

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import type { DirEntry } from '@/types/dir-entry';
import { CopyIcon, ClipboardPasteIcon, InfoIcon, FolderOpenIcon } from '@lucide/vue';

const props = defineProps<{ entry: DirEntry }>();
const emit = defineEmits<{ action: [name: string]; close: [] }>();
const { t } = useI18n();
const ctx = useFileBrowserContext();
const clipboardStore = useClipboardStore();

const canPaste = computed(() => 
  props.entry.is_dir && clipboardStore.hasItems && clipboardStore.canPasteTo(props.entry.path)
);

function emitAction(name: string) {
  emit('action', name);
  emit('close');
}
</script>

<template>
  <ContextMenuContent>
    <ContextMenuItem @select="emitAction('copy-path')">
      <CopyIcon :size="14" />
      <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="canPaste" @select="emitAction('paste')">
      <ClipboardPasteIcon :size="14" />
      <span>{{ t('shortcuts.transferPreparedForCopying') }}</span>
    </ContextMenuItem>
    <ContextMenuSeparator v-if="canPaste" />
    <ContextMenuItem v-if="!entry.is_dir" @select="emitAction('open-containing-directory')">
      <FolderOpenIcon :size="14" />
      <span>{{ t('fileBrowser.actions.openContainingDirectory') }}</span>
    </ContextMenuItem>
    <ContextMenuItem @select="emitAction('properties')">
      <InfoIcon :size="14" />
      <span>{{ t('fileBrowser.actions.properties') }}</span>
    </ContextMenuItem>
  </ContextMenuContent>
</template>
```

- [ ] **Step 4: 写失败测试**

新建 `__tests__/file-tree-context-menu.test.ts`：

```ts
it('shows 3 items for a file (no paste target, plus open-containing-directory)', () => {
  const wrapper = mount(FileTreeContextMenu, {
    props: { entry: { path: 'C:/file.txt', is_dir: false, name: 'file.txt', ext: 'txt' } },
  });
  expect(wrapper.findAllComponents(ContextMenuItem).length).toBe(3);
});

it('shows 3 items for a directory (no open-containing-directory)', () => {
  const wrapper = mount(FileTreeContextMenu, {
    props: { entry: { path: 'C:/dir', is_dir: true, name: 'dir', ext: '' } },
  });
  expect(wrapper.findAllComponents(ContextMenuItem).length).toBe(3);
});

it('shows 4 items for a directory when clipboard has items', () => {
  clipboardStore.items = [{ path: 'C:/foo', operation: 'copy' }];
  const wrapper = mount(...);
  expect(wrapper.findAllComponents(ContextMenuItem).length).toBe(4);
});
```

跑测试，预期 FAIL（组件未建）。

- [ ] **Step 5: 接入 file-browser-tree-view.vue**

```vue
<div v-for="row in rows" :key="row.path"
     ...
     @contextmenu.prevent="handleContextMenu(row, $event)">

<ContextMenu v-if="contextMenuState.open">
  <FileTreeContextMenu :entry="contextMenuState.entry"
                       @action="handleContextAction"
                       @close="closeContextMenu" />
</ContextMenu>
```

`handleContextMenu` / `handleContextAction` / `closeContextMenu` 在 `<script setup>` 中定义：
- handleContextMenu: 写入 contextMenuState（entry + position + open=true）
- handleContextAction: switch case 调 fileBrowserActions（emit 给父级）
- closeContextMenu: open=false

- [ ] **Step 6: 17 语言包加 key**

`fileBrowser.actions.openContainingDirectory` —— ch: 「打开文件所在目录」，en: "Open containing directory"，其他 15 个英文占位。

- [ ] **Step 7: 门禁**

```bash
npm run ts
npx vitest run src/modules/navigator
```

Expected: 全绿。

- [ ] **Step 8: 判别性探针**

把 `emitAction('open-containing-directory')` 改成 `emitAction('openContainingDirectory')`。

跑测试，预期 FAIL（handler 名字不符）。恢复实现。

- [ ] **Step 9: 提交**

```bash
git add <files>
git commit -m "feat(tree): 目录树右键菜单（复制路径 / 粘贴 / 属性 / 打开所在目录）"
```

---

## Task 5: 长按不切换 alpha 置顶

**Files:**
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-drag-session.ts`（视需要）
- Modify: `src-tauri/capabilities/*.json`（视需要）

**Interfaces:**
- Produces: 长按拖拽期间 alpha 窗口不抢焦点（与 OS 默认 drag 行为一致）

- [ ] **Step 1: 调研 tauri-plugin-drag API**

读 `@crabnebula/tauri-plugin-drag` 文档（在线或在 node_modules）。看 `startDrag` 第三参数 options 是否有 `bringToFront` / `disableFocus` / 之类配置。

- [ ] **Step 2: 真机复现**

按 docs/handoff-2026-10-12-3.0.2-released-next-steps.md §六 的真机验收步骤：

1. `tauri build` 构建 release
2. 启动 alpha（前台可见）
4. 选一个文件 → 按住左键不放 → 拖出窗口外
5. 期间观察 alpha 是否失焦
6. 重复 5-10 次

**结论分支**：

- **不复现**：记录「已验证，现状满足需求」，无需代码改动，跳到 Step 4 提交 plan 文档。
- **复现**：进入 Step 3。

- [ ] **Step 3: 修复（若复现）**

按调研结论加配置项。

- [ ] **Step 4: 记录 + 提交**

无论哪种结论，都更新 `.superpowers/sdd/2026-10-12-navigator-polish-pack/progress.md`，把验证过程与结论写入。

```bash
git add .superpowers/sdd/2026-10-12-navigator-polish-pack/progress.md
git commit -m "docs(progress): 长按拖拽不切换置顶的验证记录"
```

---

## Task 6: 全局搜索"打开文件所在目录"

**Files:**
- 无新文件 —— 全继承自任务 4（ContextMenuAction + handler + visibility + i18n key）

- [ ] **Step 1: 验证 visibility 规则**

`context-menu-action-visibility.ts` 中 `'open-containing-directory'` 已加 `entryTypes: ['file']`。全局搜索结果是 file 类型（不会有 directory 作为搜索结果在 file 模式中显示），故自动可见。

- [ ] **Step 2: 真机验收**

1. 启动 alpha
2. 打开全局搜索
3. 搜一个已知文件
4. 右键搜索结果 → 看到「打开文件所在目录」
5. 点击 → Explorer 打开并选中该文件

- [ ] **Step 3: 在 progress.md 写验收记录**

无新代码，commit 只更新 progress（如果有疑问点）。

---

## 收尾

- [ ] **Final: 跑全套门禁**

```powershell
$tc = 'C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin'
[Environment]::SetEnvironmentVariable('PATH', "$tc;$env:PATH", 'Process')

Set-Location 'F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri'
& "$tc\cargo.exe" test --lib          # 基线：317+ passed / 0 failed

Set-Location 'F:\soft\00selfmade\filemanager\sigma-file-manager'
npm run ts                             # vue-tsc --build
npx vitest run src/modules/settings src/modules/navigator src/localization
```

Expected: 全绿。

- [ ] **Final: tauri build + 真机验收（按 spec §6.3 6 项）**

```bash
npm run tauri build
```

启动构建产物（`D:\Program Files\Alpha File Manager\alpha-file-manager.exe`），按 spec §6.3 列表 6 项做真机验收。每项 UIA / PrintWindow 截图记录。

- [ ] **Final: 写 handoff 文档**

`docs/handoff-2026-10-12-navigator-polish-pack.md`：

- 每项需求的实现位置
- 已知遗留（如长按置顶是否真的解决了）
- 下一棒需读清单

---

## 不在本轮做

- 3.0.2 handoff §五 P0（19 个提交未 push） —— 按用户惯例不 push
- 3.0.2 handoff §五 P1 启动崩溃 —— 沿用搁置
- 3.0.2 handoff §五 P2 15 个非中文包英文占位 —— 本轮任务 1 再次未完整补齐
- 2.2.1 handoff §五 P2 真机验收更新流程三条 —— 不在本轮范围
- 2.2.1 handoff §五 P3 server-upload.md —— 不在本轮范围

---

## 提交策略

按任务分别 commit。**不要合一个 commit**（后续 cherry-pick 与回滚需要）。commit message 前缀：

- 任务 1: `docs(localization):`
- 任务 2: `refactor(toolbar):`
- 任务 3: `feat(thumbnail):`
- 任务 4: `feat(tree):`
- 任务 5: `docs(progress):`
- 任务 6: （无 commit）

最终 push 由用户决定。