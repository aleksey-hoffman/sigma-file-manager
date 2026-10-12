# 列表缩略图与工具栏布局切换 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 列表视图为图片/视频行显示真实缩略图（可开关、默认开启），并把列表/网格切换从 ⋮ 菜单提升为工具栏按钮。

**Architecture:** 新增一个独立的行内缩略图组件，自带 IntersectionObserver 与回退逻辑，复用既有的 `ctx.getImageThumbnail` / `ctx.getVideoThumbnail` 与 `isFileBrowserImageEntry` / `isFileBrowserVideoEntry`。网格视图代码一行不改。工具栏按钮复用现有 `setLayout()`，保持 per-folder 作用域行为。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Pinia、vue-i18n、Vitest、@vue/test-utils、Tauri 2

**设计依据：** `docs/superpowers/specs/2026-10-12-list-thumbnails-toolbar-layout-design.md`（commit `af86ba60`）

---

## Global Constraints

- **零新依赖**：不得引入任何新的 npm 或 cargo 依赖。
- **面向用户的文案必须走 i18n**，17 个语言包（`src/localization/messages/*.json`），中文 locale code 是 `ch` 而非 `zh`。按既有先例：`ch` 写中文，其余 16 个写英文占位。
- 品牌名锁定 Alpha File Manager；受保护常量（mDNS 服务名、legacy 数据目录名、Tauri identifier `com.sigma-file-manager.app`）不得改动。
- 改现有文件以纯追加为主，删除/改写既有逻辑需要写明理由。
- **真机验收必须用 `tauri build` 的打包产物**。`tauri dev` 构建下所有路由页内容区空白（外壳正常、RouterView 挂载但不渲染子组件），已在 `AGENTS.md` 记为硬约束。dev 构建上的任何界面结论一律作废。
- **新测试必须先注入缺陷确认转红，且失败输出须精确展示预期损坏**。只红不算数；等价变换的探针（缺陷注入点在该场景下根本不会被执行到）无效，必须重设计。
- Rust 命令行必须用 1.90.0 工具链并做进程级 PATH 注入：
  ```powershell
  $tc = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin"
  [Environment]::SetEnvironmentVariable('PATH', ($tc + ';' + $env:PATH), 'Process')
  ```
- PowerShell 脚本处理 JSON/中文时用 Node，不要用 `Get-Content | ConvertFrom-Json`（5.1 按 GBK 读 UTF-8 会乱码并解析失败）。本计划所有 JSON 操作用 `node -e`。
- 文件删除用 `rm -- "<正斜杠路径>"`，不要用 `Remove-Item`。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/types/user-settings.ts` | 改 | `navigator` 块新增 `showListThumbnails: boolean` |
| `src/stores/storage/user-settings.ts` | 改 | 默认值 `true` |
| `src/stores/schemas/user-settings.ts` | 改 | schema 常量 28→29，新增迁移步 28→29 |
| `src/stores/schemas/__tests__/user-settings.test.ts` | 改 | 迁移测试（两条，成对） |
| `src/modules/settings/ui/categories/general/file-view.vue` | 改 | 「文件视图」分组新增第 5 个开关 |
| `src/modules/settings/ui/categories/general/__tests__/file-view.test.ts` | 建 | 设置项渲染与写回测试 |
| `src/localization/messages/*.json` | 改（17 个） | 新增 2 个 key |
| `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue` | 建 | 行内缩略图组件 |
| `src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts` | 建 | 组件测试 |
| `src/modules/navigator/components/file-browser/file-browser-list-view.vue` | 改 | 图标位置接入新组件 |
| `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue` | 改 | 加布局按钮、删菜单布局组 |

**明确不改**：`file-browser-grid-card.vue`、`use-file-browser-virtual-layout.ts`、`createDisplayRow` / `memoKey` 逻辑、`use-file-browser-entry-groups.ts`。

---

## Task 1: 设置项与 schema 28→29 迁移

**Files:**
- Modify: `src/types/user-settings.ts:380` 附近
- Modify: `src/stores/storage/user-settings.ts:165` 附近
- Modify: `src/stores/schemas/user-settings.ts:19`（常量）与 `:493` 附近（迁移步）
- Test: `src/stores/schemas/__tests__/user-settings.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `userSettings.navigator.showListThumbnails: boolean`（必填，默认 `true`）；`USER_SETTINGS_SCHEMA_VERSION = 29`；迁移步 `fromVersion === 28 && toVersion === 29` 调用 `setDefaultBooleanIfMissing(storage, 'navigator.showListThumbnails', true)`

- [ ] **Step 1: 写两条迁移测试（必须成对）**

打开 `src/stores/schemas/__tests__/user-settings.test.ts`，在文件末尾的 `describe` 内追加：

```ts
describe('migrateUserSettingsStorage 28->29 showListThumbnails', () => {
  function createStorage(initial: Record<string, unknown>) {
    const values = new Map<string, unknown>(Object.entries(initial));

    return {
      values,
      get: async <T>(key: string) => values.get(key) as T | undefined,
      set: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      save: async () => {},
    };
  }

  it('writes showListThumbnails true when the key is absent', async () => {
    const storage = createStorage({ [USER_SETTINGS_SCHEMA_VERSION_KEY]: 28 });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.showListThumbnails')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(29);
  });

  it('does not overwrite an existing false value', async () => {
    const storage = createStorage({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 28,
      'navigator.showListThumbnails': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.showListThumbnails')).toBe(false);
  });
});
```

确认该文件已 import `migrateUserSettingsStorage` 与 `USER_SETTINGS_SCHEMA_VERSION_KEY`。若 `createStorage` 形式的辅助函数在该文件里已存在，**复用它**，不要新建第二个。

- [ ] **Step 2: 运行测试确认转红**

```bash
npx vitest run src/stores/schemas/__tests__/user-settings.test.ts
```

Expected: FAIL —— 第一条报 `expected undefined to be true`，第二条 PASS（因为当前实现根本没动过这个 key，`false` 原样保留）。

- [ ] **Step 3: 加类型字段**

`src/types/user-settings.ts`，在 `enableBoxSelection: boolean;`（第 380 行）之后插入：

```ts
  // FORK-MODIFICATION: 列表视图缩略图开关（上游 #231）
  showListThumbnails: boolean;
```

- [ ] **Step 4: 加默认值**

`src/stores/storage/user-settings.ts`，在 `enableBoxSelection: true,`（第 165 行）之后插入：

```ts
      // FORK-MODIFICATION: 列表视图缩略图默认开启（上游 #231）
      showListThumbnails: true,
```

- [ ] **Step 5: 加 schema 常量与迁移步**

`src/stores/schemas/user-settings.ts`：

第 19 行改为：

```ts
export const USER_SETTINGS_SCHEMA_VERSION = 29;
```

在现有 `if (fromVersion === 27 && toVersion === 28) { ... }` 块之后追加：

```ts
  // FORK-MODIFICATION: 列表视图缩略图（上游 #231）。
  // 用「缺失才写」而非覆盖写：缩略图是全新功能，用户此前没有这个选项，
  // 不存在「此前的选择」被覆盖的问题。覆盖写会让用户日后主动关掉后，
  // 每升一次版又被强行打开。
  if (fromVersion === 28 && toVersion === 29) {
    await setDefaultBooleanIfMissing(storage, 'navigator.showListThumbnails', true);
  }
```

- [ ] **Step 6: 运行测试确认转绿**

```bash
npx vitest run src/stores/schemas/__tests__/user-settings.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 7: 类型门禁**

```bash
npm run ts
```

Expected: exit 0。

- [ ] **Step 8: 判别性验证 —— 两条必须分别注入**

**探针 A（验证「缺失才写」而非「总是写」）**：把 Step 5 里的 `setDefaultBooleanIfMissing` 换成 `await storage.set('navigator.showListThumbnails', true);`

```bash
npx vitest run src/stores/schemas/__tests__/user-settings.test.ts
```

Expected: **第二条** FAIL，输出必须精确显示 `expected false to be true`。若只有第一条失败或两条都通过，探针无效，重新设计。

**探针 B（验证迁移步真的可达）**：把整个 `if (fromVersion === 28 && toVersion === 29)` 块注释掉。

Expected: **第一条** FAIL，输出显示 `expected undefined to be true`。

两次探针结束后**必须恢复实现**，并重跑确认全绿。

- [ ] **Step 9: 提交**

```bash
git add src/types/user-settings.ts src/stores/storage/user-settings.ts src/stores/schemas/user-settings.ts src/stores/schemas/__tests__/user-settings.test.ts
git commit -m "feat(settings): 新增列表缩略图开关（上游 #231）"
```

---

## Task 2: 行内缩略图组件

**Files:**
- Create: `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue`
- Test: `src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `userSettings.navigator.showListThumbnails`（本 Task 不直接读，由 Task 3 决定是否渲染本组件）
- Produces: 组件 `file-browser-list-entry-thumbnail.vue`，props `{ entry: DirEntry; size?: number }`（`size` 默认 32）；渲染结果为 `<img class="file-browser-list-entry-thumbnail__image">` 或回退的 `FileBrowserEntryIcon`

- [ ] **Step 1: 写失败的组件测试**

新建 `src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts`：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import FileBrowserListEntryThumbnail from '../file-browser-list-entry-thumbnail.vue';
import type { DirEntry } from '@/types/dir-entry';

const getImageThumbnail = vi.fn();
const getVideoThumbnail = vi.fn();
const cancelImageThumbnail = vi.fn();
const cancelVideoThumbnail = vi.fn();

vi.mock('../composables/use-file-browser-context', () => ({
  useFileBrowserContext: () => ({
    getImageThumbnail,
    getVideoThumbnail,
    cancelImageThumbnail,
    cancelVideoThumbnail,
  }),
}));

vi.mock('../file-browser-entry-icon.vue', () => ({
  default: {
    name: 'FileBrowserEntryIcon',
    props: ['entry', 'size'],
    template: '<i class="entry-icon-fallback" />',
  },
}));

let intersectionCallback: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;
const observedTargets: Element[] = [];
let disconnected = false;

class FakeIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
    intersectionCallback = callback;
  }
  observe(target: Element) {
    observedTargets.push(target);
  }
  disconnect() {
    disconnected = true;
  }
  unobserve() {}
}

function createEntry(overrides: Partial<DirEntry> & Pick<DirEntry, 'path'>): DirEntry {
  return {
    name: 'item',
    is_dir: false,
    ext: '',
    ...overrides,
  } as DirEntry;
}

function enterViewport() {
  intersectionCallback?.(
    observedTargets.map(target => ({ isIntersecting: true, target })) as never,
  );
}

beforeEach(() => {
  getImageThumbnail.mockReset();
  getVideoThumbnail.mockReset();
  cancelImageThumbnail.mockReset();
  cancelVideoThumbnail.mockReset();
  intersectionCallback = null;
  observedTargets.length = 0;
  disconnected = false;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

describe('file-browser-list-entry-thumbnail', () => {
  it('renders the plain icon and creates no observer for a non-media entry', () => {
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/notes.txt', ext: 'txt' }) },
      global: { stubs: { Teleport: true } },
    });

    expect(wrapper.find('.file-browser-list-entry-thumbnail__image').exists()).toBe(false);
    expect(wrapper.find('.entry-icon-fallback').exists()).toBe(true);
    expect(observedTargets).toHaveLength(0);
    expect(getImageThumbnail).not.toHaveBeenCalled();
    expect(getVideoThumbnail).not.toHaveBeenCalled();
  });

  it('requests an image thumbnail only after the row enters the load range', async () => {
    const entry = createEntry({ path: 'C:/photo.jpg', ext: 'jpg' });
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    expect(getImageThumbnail).not.toHaveBeenCalled();

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(getImageThumbnail).toHaveBeenCalledWith(entry, 32);
  });

  it('swaps to the thumbnail image once the source resolves', async () => {
    getImageThumbnail.mockReturnValue('asset://thumb.jpg');
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/photo.jpg', ext: 'jpg' }) },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    const image = wrapper.find('img.file-browser-list-entry-thumbnail__image');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toBe('asset://thumb.jpg');
  });

  it('falls back to the icon when the thumbnail never resolves', async () => {
    getImageThumbnail.mockReturnValue(undefined);
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry: createEntry({ path: 'C:/broken.jpg', ext: 'jpg' }) },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('img.file-browser-list-entry-thumbnail__image').exists()).toBe(false);
    expect(wrapper.find('.entry-icon-fallback').exists()).toBe(true);
  });

  it('requests a video thumbnail for video entries', async () => {
    const entry = createEntry({ path: 'C:/clip.mp4', ext: 'mp4' });
    getVideoThumbnail.mockReturnValue('asset://video.jpg');
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();

    expect(getVideoThumbnail).toHaveBeenCalledWith(entry);
    expect(getImageThumbnail).not.toHaveBeenCalled();
  });

  it('cancels the request and disconnects the observer on unmount', async () => {
    const entry = createEntry({ path: 'C:/photo.jpg', ext: 'jpg' });
    const wrapper = mount(FileBrowserListEntryThumbnail, {
      props: { entry },
      global: { stubs: { Teleport: true } },
    });

    enterViewport();
    await wrapper.vm.$nextTick();
    wrapper.unmount();

    expect(disconnected).toBe(true);
    expect(cancelImageThumbnail).toHaveBeenCalledWith(entry, 32);
    expect(cancelVideoThumbnail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认转红**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
```

Expected: FAIL —— 组件文件不存在（import 报错）。这是预期的第一步失败。

- [ ] **Step 3: 实现组件**

新建 `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue`：

```vue
<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import {
  isFileBrowserImageEntry,
  isFileBrowserVideoEntry,
} from './file-browser-entry-groups';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { resolveImageDisplaySrc } from '@/modules/navigator/utils/resolve-image-display-src';
import { getImageSrc } from './utils';

const props = withDefaults(defineProps<{
  entry: DirEntry;
  size?: number;
}>(), {
  size: 32,
});

const ctx = useFileBrowserContext();

const containerRef = ref<HTMLElement | null>(null);
const isInLoadRange = ref(false);
let intersectionObserver: IntersectionObserver | null = null;

const isImage = computed(() => isFileBrowserImageEntry(props.entry));
const isVideo = computed(() => isFileBrowserVideoEntry(props.entry));
const isMedia = computed(() => isImage.value || isVideo.value);

const imageThumbnailSrc = computed(() => {
  if (!isImage.value || !isInLoadRange.value) {
    return undefined;
  }

  return resolveImageDisplaySrc({
    entry: props.entry,
    preferOriginal: false,
    originalSrc: getImageSrc(props.entry),
    maxDimension: props.size,
    getThumbnail: (entry, maxDimension) => ctx.getImageThumbnail(entry, maxDimension),
  });
});

const videoThumbnailSrc = computed(() => {
  if (!isVideo.value || !isInLoadRange.value) {
    return undefined;
  }

  return ctx.getVideoThumbnail(props.entry);
});

const thumbnailSrc = computed(() => imageThumbnailSrc.value ?? videoThumbnailSrc.value);

function cancelThumbnail(): void {
  if (isImage.value) {
    ctx.cancelImageThumbnail(props.entry, props.size);
  }

  if (isVideo.value) {
    ctx.cancelVideoThumbnail(props.entry);
  }
}

function handleIntersection(entries: IntersectionObserverEntry[]): void {
  if (entries.some(entry => entry.isIntersecting)) {
    isInLoadRange.value = true;
    return;
  }

  isInLoadRange.value = false;
  cancelThumbnail();
}

onMounted(() => {
  if (!isMedia.value) {
    return;
  }

  if (typeof IntersectionObserver === 'undefined' || !containerRef.value) {
    isInLoadRange.value = true;
    return;
  }

  intersectionObserver = new IntersectionObserver(handleIntersection, {
    rootMargin: '800px 0px',
    threshold: 0,
  });
  intersectionObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  cancelThumbnail();
});
</script>

<template>
  <span ref="containerRef" class="file-browser-list-entry-thumbnail">
    <img
      v-if="thumbnailSrc"
      class="file-browser-list-entry-thumbnail__image"
      :src="thumbnailSrc"
      :width="props.size"
      :height="props.size"
      :alt="''"
      draggable="false"
    >
    <FileBrowserEntryIcon
      v-else
      :entry="props.entry"
      :size="18"
    />
  </span>
</template>

<style scoped>
.file-browser-list-entry-thumbnail {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.file-browser-list-entry-thumbnail__image {
  display: block;
  border-radius: 3px;
  object-fit: cover;
}
</style>
```

**实现要点（不要改动）**：
- `thumbnailSrc` 只存在组件内部的 computed，**绝不能**写回 `row` 或 `memoKey`。列表行用了 `v-memo="[row.memoKey]"`，一旦把状态提升到行上，缩略图永远刷不出来且不报错。
- 非媒体条目在 `onMounted` 直接 return，不创建 IntersectionObserver，不发任何请求。
- 回退渲染的是 `FileBrowserEntryIcon`（`:size="18"`），保持与今天完全一致的观感。
- `rootMargin: '800px 0px'` 与 `file-browser-grid-card.vue:281` 保持一致。

- [ ] **Step 4: 运行测试确认转绿**

```bash
npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
```

Expected: 6 passed。

若 `getImageSrc` 的实际导出名不是 `getImageSrc`（见 `./utils`），先打开 `src/modules/navigator/components/file-browser/utils/index.ts` 确认后再改导入。

- [ ] **Step 5: 判别性验证 —— 逐个注入**

**探针 A：让组件对所有行都建 IO**（把 `onMounted` 里的 `if (!isMedia.value) { return; }` 删掉）

Expected: 第 1 条 FAIL，输出必须显示 `observedTargets` 期望 0 实际为 1。若该条仍通过，探针无效。

**探针 B：把 `rootMargin` 改成 `'0px'`**，同时把测试里的 `enterViewport()` 改成手动触发 `isIntersecting: false`

Expected: 第 2 条 FAIL，输出显示「已请求」断言失败。

**探针 C：让回退分支失效**（把 `v-else` 的 `FileBrowserEntryIcon` 换成 `<span />`）

Expected: 第 4 条 FAIL，且失败点落在「`.entry-icon-fallback` 应存在」上。

三次探针结束后**恢复实现**并重跑确认全绿。

- [ ] **Step 6: 类型门禁**

```bash
npm run ts
```

Expected: exit 0。

- [ ] **Step 7: 提交**

```bash
git add src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
git commit -m "feat(navigator): 列表行内缩略图组件（上游 #231）"
```

---

## Task 3: 列表视图接入

**Files:**
- Modify: `src/modules/navigator/components/file-browser/file-browser-list-view.vue:19`（import）、`:466-472`（模板图标位）

**Interfaces:**
- Consumes: Task 1 的 `userSettings.navigator.showListThumbnails`；Task 2 的组件 `file-browser-list-entry-thumbnail.vue`
- Produces: 无（末端行为产出）

- [ ] **Step 1: 加 import**

在 `import FileBrowserEntryIcon from './file-browser-entry-icon.vue';`（第 19 行）之后插入：

```ts
import FileBrowserListEntryThumbnail from './file-browser-list-entry-thumbnail.vue';
```

- [ ] **Step 2: 加 computed**

在 `const showModifiedColumn = computed(...)`（第 128 行）之前插入：

```ts
const showListThumbnails = computed(
  () => userSettingsStore.userSettings.navigator.showListThumbnails,
);
```

- [ ] **Step 3: 改模板图标位**

把 `file-browser-list-view.vue:466-472` 这一段：

```html
          <div class="file-browser-list-view__entry-name">
            <FileBrowserEntryIcon
              :entry="row.entry"
              :size="18"
              class="file-browser-list-view__entry-icon"
              :class="{ 'file-browser-list-view__entry-icon--folder': row.entry.is_dir }"
            />
```

替换为：

```html
          <div class="file-browser-list-view__entry-name">
            <FileBrowserListEntryThumbnail
              v-if="showListThumbnails"
              :entry="row.entry"
            />
            <FileBrowserEntryIcon
              v-else
              :entry="row.entry"
              :size="18"
              class="file-browser-list-view__entry-icon"
              :class="{ 'file-browser-list-view__entry-icon--folder': row.entry.is_dir }"
            />
```

**不要动** `createDisplayRow` 与 `memoKey`。缩略图状态不经过 row，`v-memo` 不会吞掉它。

- [ ] **Step 4: 确认行高与样式**

现有 `LIST_ENTRY_HEIGHT = 42`（`use-file-browser-virtual-layout.ts:40`）**不得修改**。32px 缩略图在 42px 行内居中即可。

检查 `file-browser-list-view.vue` 的样式段中 `.file-browser-list-view__entry-name` 是否有 `align-items`。若无，在该规则里补 `align-items: center;`。

- [ ] **Step 5: 门禁**

```bash
npm run ts
npx vitest run src/modules/navigator/components/file-browser
```

Expected: exit 0，全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/modules/navigator/components/file-browser/file-browser-list-view.vue
git commit -m "feat(navigator): 列表视图接入缩略图（上游 #231）"
```

---

## Task 4: 工具栏布局切换按钮

**Files:**
- Modify: `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue`

**Interfaces:**
- Consumes: 无（复用该文件已有的 `setLayout()`、`ListIcon`、`LayoutGridIcon`、`t()`）
- Produces: 无

- [ ] **Step 1: 确认现有可复用件**

本 Task 全部依赖该文件**已有**的实现，动手前先确认它们仍在（行号基于 `af86ba60`）：

| 已有件 | 位置 | 内容 |
|---|---|---|
| `currentLayout` | `:92` | `computed(() => scopedSettings.value.layout)`，已按 settingsScope 解析 folder/global |
| `setLayout(layoutName: LayoutType)` | `:129-131` | `async`，走 `persistScopedPatch({ layout })` |
| `LayoutType` | `:50` | `type LayoutType = 'list' \| 'grid'` |
| `ListIcon` / `LayoutGridIcon` | import 段 | 已 import，直接用 |

**不要重新定义 `currentLayout`**。它已经是作用域感知的，直接用。

- [ ] **Step 2: 加 nextLayoutLabelKey computed**

在 `setLayout`（`:129-131`）之后插入：

```ts
const nextLayoutLabelKey = computed(() => (isGridLayout.value ? 'list' : 'grid'));
const isGridLayout = computed(() => currentLayout.value === 'grid');
```

**注意 key 路径**：菜单里现有按钮用的是顶层 `t('list')` / `t('grid')`（`:285`、`:294`），**不是** `settings.navigator.list`。已核实这两个顶层 key 在 17 个语言包中全部存在（`ch` 为「列表」/「网格」）。照抄现有用法，不要自造 `settings.navigator.*` 路径——那 17 个包里并不存在，会在界面上显示成原始 key 字符串。

- [ ] **Step 3: 加按钮**

在「信息面板开关」按钮（`PanelRightOpenIcon`）之后、`</div>` 之前插入。结构与相邻按钮保持一致：

```html
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :aria-label="t(nextLayoutLabelKey)"
            @click="setLayout(isGridLayout ? 'list' : 'grid')"
          >
            <LayoutGridIcon
              v-if="isGridLayout"
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
            <ListIcon
              v-else
              :size="16"
              class="navigator-toolbar-actions__icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          :side="'bottom'"
          class="navigator-toolbar-actions__tooltip"
        >
          <div class="navigator-toolbar-actions__tooltip-row">
            {{ t(nextLayoutLabelKey) }}
          </div>
        </TooltipContent>
      </Tooltip>
```

图标语义是**显示当前所在视图**：当前网格显示网格图标，点击后切到列表。

因为 `currentLayout` 走 `scopedSettings`，点击会自动写入当前作用域（folder 或 global），这正是设计要求的「删除菜单布局组后仍能按文件夹设置」。

- [ ] **Step 4: 删除菜单里的「导航视图布局」整组**

删除该文件约 `:270-297` 的整段，包含其标题行 `t('settings.navigator.navigatorViewLayout')`、两个 `DropdownMenuItem`（列表/网格），**以及其后的那个分隔符**（约 `:298`）。

保留：`:205-268` 的「设置作用域」、`:299-311` 的「排序」、`:313-377` 的「显示」、`:378-413` 的「分屏模式」。

删除后确认 `setLayout` 仍被 Step 3 的按钮引用——**不要删掉它**，工具栏按钮要用。

- [ ] **Step 5: 清理孤儿 i18n key**

已核实：`settings.navigator.navigatorViewLayout` **仅**被布局组标题使用（`navigator-toolbar-actions.vue:275`），删组后即成孤儿。用 `node` 从 17 个语言包中删除该 key：

```bash
node -e "
const fs=require('fs');const d='src/localization/messages';
for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.json'))){
  const p=d+'/'+f;const j=JSON.parse(fs.readFileSync(p,'utf8'));
  const nav=j.settings&&j.settings.navigator;
  if(nav&&nav.navigatorViewLayout){ delete nav.navigatorViewLayout; fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n','utf8'); }
}
"
```

顶层 `t('list')` / `t('grid')` **保留**（工具栏按钮要用，已核实 17 包齐全）。本 Task 不新增 key。

- [ ] **Step 6: 门禁**

```bash
npm run ts
npx vitest run src/modules/navigator src/localization
```

Expected: exit 0，全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue src/localization
git commit -m "feat(navigator): 列表/网格切换提升为工具栏按钮（上游 #383）"
```

---

## Task 5: 真机验收与性能基准

**前置：必须用 `tauri build` 打包产物。**

- [ ] **Step 1: 构建打包版**

```powershell
cd F:\soft\00selfmade\filemanager\sigma-file-manager
$tc = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin"
[Environment]::SetEnvironmentVariable('PATH', ($tc + ';' + $env:PATH), 'Process')
npx tauri build
```

用 `src-tauri\target\release\alpha-file-manager.exe` 做验收，**不要**用 `npm run tauri:build`（它会顺带覆盖 `release/` 发布目录）。

- [ ] **Step 2: 备份用户设置**

```
$ud = "$env:APPDATA\com.sigma-file-manager.app\user-data"
Copy-Item "$ud\user-settings.json" "$ud\.user-settings.before-acceptance.json" -Force
```

验收结束后用它恢复。

- [ ] **Step 3: 逐条验收（每条记录实际观察到的现象与证据来源）**

1. 列表视图：图片行、视频行显示缩略图；`.txt`、文件夹、PDF 仍显示 18px 原图标
2. 关闭开关：**不重启**，列表立即全部回到原图标
3. 打开开关：不重启，缩略图立即出现
4. 工具栏按钮：点击切换列表/网格，图标随当前视图变化
5. ⋮ 菜单里「导航视图布局」整组消失，其余 4 组（设置作用域 / 排序 / 显示 / 分屏模式）完好
6. per-folder：开菜单切到「仅此文件夹」→ 关菜单 → 点工具栏按钮 → 切到另一文件夹，其布局仍是自己的
7. 升级路径：用 `node -e` 把设置文件改成 `__schemaVersion: 28` 并删掉 `navigator.showListThumbnails`，启动后该项应为 `true`
8. 行高未变：缩略图行与普通行的行距一致，滚动无跳动

任何一条无法验证，**如实记为「不可验证」并写清原因**，不得用单测结果冒充。

- [ ] **Step 4: 性能基准**

造一个 1000 张图片的目录（文件名 `bench-0001.jpg` …），记录：

| 指标 | 记录方式 |
|---|---|
| 进目录到缩略图铺满耗时 | 打包版下计时，重复 3 次取中位数 |
| 快速滚动帧率 | 记录是否有可感知的卡顿 |
| 列表/网格切换响应 | 计时 |
| 常驻内存增量 | 任务管理器观察 |

同时用同一目录在**网格视图**下取一组对照数字。全部写入验收记录。

若内存或帧率不可接受，**不要当场改实现**，先记录数据并报告。

- [ ] **Step 5: 恢复用户设置并清理**

```powershell
$ud = "$env:APPDATA\com.sigma-file-manager.app\user-data"
Move-Item "$ud\.user-settings.before-acceptance.json" "$ud\user-settings.json" -Force
```

删除基准目录。确认 `git status` 只有 `_notes.md` 未入库。

- [ ] **Step 6: 全量门禁**

```powershell
npm run ts
npx vitest run
Set-Location src-tauri
& "$tc\cargo.exe" test --lib
```

Expected: 类型检查 exit 0；全量 vitest 中 `use-navigator-item-icon`、`use-init` 有既有 flaky（干净树同样复现，5000ms 超时），需单跑排除后再判定；cargo 全绿。

- [ ] **Step 7: 写入验收记录**

在 `.superpowers/sdd/<日期>-list-thumbnails/progress.md` 记录逐条验收结果、性能数字、判别性探针三轮结果。

---

## 计划自查

1. **Spec 覆盖**：§5.A → Task 2+3；§5.B（接入）→ Task 3；§5.C → Task 1+3 的设置项；§5.D（工具栏）→ Task 4；§6 测试 → 各 Task 的判别性验证步骤；§7 真机验收 → Task 5 Step 3；§8 性能基准 → Task 5 Step 4；§2 排除项 → 无 Task（已确认为「不做」）。无缺口。
2. **占位符扫描**：无 TBD/TODO/「类似 Task N」/「补充错误处理」。所有代码步骤均给出完整可粘贴内容。
3. **类型一致性**：
   - 设置字段名 `showListThumbnails` 在 Task 1 的类型、默认值、迁移、测试中出现四次，Task 3 的 computed 与 Task 4 不涉及 —— 拼写一致。
   - 组件名 `file-browser-list-entry-thumbnail.vue` 在 Task 2 创建、Task 3 引入 —— 一致。
   - 组件 class `file-browser-list-entry-thumbnail__image` 在 Task 2 的模板与测试中断言 —— 一致。
   - Task 4 的 `nextLayoutLabelKey` 返回 `'list'` / `'grid'` 两个**顶层** key，与菜单现有 `:285`/`:294` 的用法一致，已核实 17 包存在。

4. **计划自查抓到的三处事实错误（写计划时靠读源码发现，不是猜的）**：
   - `currentLayout` 在 `navigator-toolbar-actions.vue:92` **已存在**且已作用域感知，初稿让实施者新定义会造成重复声明。已改为直接复用。
   - 布局按钮的 i18n key 是**顶层** `t('list')`/`t('grid')`，不是 `settings.navigator.list`——后者在 17 个包里全都不存在，用了会在界面上显示原始 key 字符串。
   - `settings.navigator.navigatorViewLayout` 删除布局组后成为孤儿 key，已排入 Task 4 Step 5 的清理动作。