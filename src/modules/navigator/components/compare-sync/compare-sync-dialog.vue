<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  CircleAlertIcon,
  FolderIcon,
  Loader2Icon,
} from '@lucide/vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toReadableBytes from '@/utils/to-readable-bytes';
import {
  compareLocationLabel,
  defaultCompareCriteria,
  filterCompareNodes,
  parseExcludePatterns,
  toCompareLocation,
} from '@/modules/navigator/utils/compare-sync';
import type {
  CompareCriteria,
  CompareNode,
  ComparePlanResponse,
  CompareProgressPayload,
  CompareResponse,
  CompareStatus,
  CompareSyncAction,
  CompareSyncJobFinishedPayload,
  CompareSyncJobProgressPayload,
  CompareSyncRunReport,
  CompareTree,
} from '@/types/compare-sync';

/**
 * 「比较并同步」对话框。
 *
 * 三步：**设置 → 结果 → 预览与执行**。
 *
 * 为什么是三步而不是一页：准则是会改变结果的（时间优先于大小），
 * 排除规则会让整棵子树从比较里消失。这两样一旦边看结果边改，
 * 用户就分不清「这个差异是真的」还是「我刚改的准则造成的」。
 * 所以先把准则定死，再看结果，最后才允许动手。
 */
const props = defineProps<{
  open: boolean;
  /** 左侧窗格当前路径（本地或 `sfm://remote/...`）。 */
  leftPath?: string;
  /** 右侧窗格当前路径。 */
  rightPath?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

type CompareStep = 'settings' | 'results' | 'preview';
type CompareFilter = 'all' | 'differences' | CompareStatus;

const { t } = useI18n();

const step = ref<CompareStep>('settings');
const leftPathInput = ref('');
const rightPathInput = ref('');
const criteria = ref<CompareCriteria>(defaultCompareCriteria());
const excludeText = ref('');

const tree = ref<CompareTree | null>(null);
const plan = ref<ComparePlanResponse | null>(null);

const isComparing = ref(false);
const isPreviewing = ref(false);
const isExecuting = ref(false);
const errorMessage = ref<string | null>(null);

/**
 * 后台任务是否**真的**已经在跑了。
 *
 * `isExecuting` 在调用 `start_compare_sync_job` **之前**就置位（为了让按钮立刻
 * 变成「取消」），但那一次 IPC 还没回来时，Rust 侧的任务还没进注册表 ——
 * 这时候点「取消」必然得到「没有正在跑的比较同步任务」。
 *
 * 2026-10-22 真机验收实测到了这个窗口：点了「开始同步」之后 6 毫秒就点「取消」，
 * 取消失败、任务照跑完 3000 个文件，错误信息被埋在报告下面很难注意到。
 *
 * 所以「取消」按钮在 `start_compare_sync_job` 返回之前是禁用状态 ——
 * 那一次 IPC 返回时，Rust 侧已经注册好了任务，取消必然有效。
 */
const jobStarted = ref(false);

const filter = ref<CompareFilter>('differences');

/**
 * 比较阶段的进度（收集 → 判定）。
 *
 * 收集大树的时候后端要问文件系统几十万次，没有进度指示的话
 * 界面看上去就是「卡住了」—— 用户根本不知道它是在干活还是死了。
 */
const compareProgress = ref<CompareProgressPayload | null>(null);

/** 本次比较的任务 id。进度事件按它对号入座。 */
const compareJobId = ref('');

const progress = ref<CompareSyncJobProgressPayload | null>(null);
const report = ref<CompareSyncRunReport | null>(null);
const jobId = ref('');

let progressUnlisten: UnlistenFn | null = null;
let finishedUnlisten: UnlistenFn | null = null;
let compareProgressUnlisten: UnlistenFn | null = null;

/** 打开时把两侧的当前路径带进来。 */
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    return;
  }

  leftPathInput.value = props.leftPath ?? '';
  rightPathInput.value = props.rightPath ?? '';
  step.value = 'settings';
  tree.value = null;
  plan.value = null;
  errorMessage.value = null;
  progress.value = null;
  report.value = null;
  jobStarted.value = false;
  filter.value = 'differences';
});

const leftLocation = computed(() => toCompareLocation(leftPathInput.value));
const rightLocation = computed(() => toCompareLocation(rightPathInput.value));

const canCompare = computed(() => (
  Boolean(leftLocation.value) && Boolean(rightLocation.value) && !isComparing.value
));

const hasResults = computed(() => Boolean(tree.value));

function matchesFilter(node: CompareNode): boolean {
  if (filter.value === 'all') {
    return true;
  }

  if (filter.value === 'differences') {
    return node.status !== 'same';
  }

  return node.status === filter.value;
}

/** 差异树摊平成带深度的行，渲染时不用递归组件。 */
const allRows = computed(() => {
  const source = tree.value?.nodes ?? [];
  const filtered = filterCompareNodes(source, matchesFilter);
  const rows: {
    node: CompareNode;
    depth: number;
  }[] = [];

  function walk(nodes: CompareNode[], depth: number) {
    for (const node of nodes) {
      rows.push({
        node,
        depth,
      });
      walk(node.children ?? [], depth + 1);
    }
  }

  walk(filtered, 0);

  return rows;
});

/**
 * 一次最多渲染多少行。
 *
 * 一棵十万个条目的树会摊平成十万行 —— 全渲染出去，
 * 浏览器的 DOM 会胀到操作不动，载荷本身也有几十兆。
 * 所以这里**只渲染前面一段**，剩下的用「再显示一批」慢慢放出来，
 * 并且**明说一共多少条**，不让用户以为那就是全部。
 */
const RENDER_PAGE = 2000;

const renderLimit = ref(RENDER_PAGE);

/** 真正进 DOM 的行。 */
const visibleRows = computed(() => allRows.value.slice(0, renderLimit.value));

/** 摊平后的总行数。 */
const totalRowCount = computed(() => allRows.value.length);

/** 还有没有没显示的行。 */
const hasMoreRows = computed(() => totalRowCount.value > visibleRows.value.length);

function showMoreRows() {
  renderLimit.value += RENDER_PAGE;
}

// 换了筛选条件，行的集合全变了 —— 渲染上限要跟着回到起点。
watch(filter, () => {
  renderLimit.value = RENDER_PAGE;
});

const filterOptions = computed<{
  value: CompareFilter;
  label: string;
}[]>(() => [
  {
    value: 'differences',
    label: t('compareSync.filterDifferences'),
  },
  {
    value: 'all',
    label: t('compareSync.filterAll'),
  },
  {
    value: 'only_left',
    label: t('compareSync.statusOnlyLeft'),
  },
  {
    value: 'only_right',
    label: t('compareSync.statusOnlyRight'),
  },
  {
    value: 'newer',
    label: t('compareSync.statusNewer'),
  },
  {
    value: 'older',
    label: t('compareSync.statusOlder'),
  },
  {
    value: 'size_diff',
    label: t('compareSync.statusSizeDiff'),
  },
  {
    value: 'content_diff',
    label: t('compareSync.statusContentDiff'),
  },
  {
    value: 'kind_diff',
    label: t('compareSync.statusKindDiff'),
  },
  {
    value: 'indeterminate',
    label: t('compareSync.statusIndeterminate'),
  },
]);

function statusLabel(status: CompareStatus): string {
  switch (status) {
    case 'same': return t('compareSync.statusSame');
    case 'only_left': return t('compareSync.statusOnlyLeft');
    case 'only_right': return t('compareSync.statusOnlyRight');
    case 'newer': return t('compareSync.statusNewer');
    case 'older': return t('compareSync.statusOlder');
    case 'size_diff': return t('compareSync.statusSizeDiff');
    case 'content_diff': return t('compareSync.statusContentDiff');
    case 'kind_diff': return t('compareSync.statusKindDiff');
    case 'indeterminate': return t('compareSync.statusIndeterminate');
  }
}

function directionLabel(node: CompareNode): string {
  switch (node.direction) {
    case 'to_right': return t('compareSync.directionToRight');
    case 'to_left': return t('compareSync.directionToLeft');
    case 'indeterminate': return t('compareSync.directionIndeterminate');
    case 'none': return t('compareSync.directionNone');
  }
}

function formatSize(size: number): string {
  return toReadableBytes(size);
}

/** 两侧都在时显示「左 → 右」的大小。 */
function sizeSummary(node: CompareNode): string {
  const left = node.left;
  const right = node.right;

  if (left && right) {
    return `${formatSize(left.size)} → ${formatSize(right.size)}`;
  }

  if (left) {
    return formatSize(left.size);
  }

  return '';
}

/** 传输动作显示「来源 → 目标」。 */
function transferSummary(action: CompareSyncAction): string {
  if (action.action !== 'transfer_file') {
    return '';
  }

  return `${compareLocationLabel(action.source)} → ${compareLocationLabel(action.target)}`;
}

function buildRequest() {
  const left = leftLocation.value;
  const right = rightLocation.value;

  if (!left || !right) {
    return null;
  }

  return {
    left,
    right,
    criteria: {
      ...criteria.value,
      excludePatterns: parseExcludePatterns(excludeText.value),
    },
  };
}

async function runCompare() {
  const request = buildRequest();

  if (!request) {
    errorMessage.value = t('compareSync.invalidPath');
    return;
  }

  isComparing.value = true;
  errorMessage.value = null;
  compareProgress.value = null;
  compareJobId.value = `compare-${Date.now()}`;

  await ensureCompareProgressListener();

  try {
    const response = await invoke<CompareResponse>('compare_directories', {
      request: {
        ...request,
        jobId: compareJobId.value,
      },
    });

    tree.value = response.tree;
    step.value = 'results';
  }
  catch (compareError) {
    errorMessage.value = String(compareError);
  }
  finally {
    isComparing.value = false;
    compareProgress.value = null;
  }
}

async function runPreview() {
  const request = buildRequest();

  if (!request) {
    errorMessage.value = t('compareSync.invalidPath');
    return;
  }

  isPreviewing.value = true;
  errorMessage.value = null;
  compareProgress.value = null;
  compareJobId.value = `compare-preview-${Date.now()}`;

  await ensureCompareProgressListener();

  try {
    const response = await invoke<ComparePlanResponse>('preview_compare_sync', {
      request: {
        ...request,
        jobId: compareJobId.value,
      },
    });

    plan.value = response;
    step.value = 'preview';
  }
  catch (previewError) {
    errorMessage.value = String(previewError);
  }
  finally {
    isPreviewing.value = false;
    compareProgress.value = null;
  }
}

/** 订阅比较进度事件。只订一次。 */
async function ensureCompareProgressListener() {
  if (compareProgressUnlisten) {
    return;
  }

  compareProgressUnlisten = await listen<CompareProgressPayload>(
    'compare-progress',
    (event) => {
      if (event.payload.jobId !== compareJobId.value) {
        return;
      }

      compareProgress.value = event.payload;
    },
  );
}

/** 进度条上那句「正在干什么」。 */
const compareProgressLabel = computed(() => {
  const current = compareProgress.value;

  if (!current) {
    return t('compareSync.progressPreparing');
  }

  if (current.phase === 'comparing') {
    return t('compareSync.progressComparing');
  }

  if (current.phase === 'done') {
    return t('compareSync.progressDone');
  }

  return current.side === 'right'
    ? t('compareSync.progressScanningRight')
    : t('compareSync.progressScanningLeft');
});

/** 进度条下面那行数字。 */
const compareProgressDetail = computed(() => {
  const current = compareProgress.value;

  if (!current) {
    return '';
  }

  if (current.phase === 'comparing' && current.total > 0) {
    return t('compareSync.progressCompared', {
      count: current.scanned,
      total: current.total,
    });
  }

  if (current.phase === 'scanning') {
    return t('compareSync.progressScanned', { count: current.scanned });
  }

  return '';
});

async function ensureJobListeners() {
  if (progressUnlisten && finishedUnlisten) {
    return;
  }

  progressUnlisten = await listen<CompareSyncJobProgressPayload>(
    'compare-sync-job-progress',
    (event) => {
      if (event.payload.jobId !== jobId.value) {
        return;
      }

      progress.value = event.payload;
    },
  );

  finishedUnlisten = await listen<CompareSyncJobFinishedPayload>(
    'compare-sync-job-finished',
    (event) => {
      if (event.payload.jobId !== jobId.value) {
        return;
      }

      report.value = event.payload.report;
      isExecuting.value = false;
      jobStarted.value = false;

      if (event.payload.error) {
        errorMessage.value = event.payload.error;
      }
    },
  );
}

async function runExecute() {
  const request = buildRequest();

  if (!request) {
    errorMessage.value = t('compareSync.invalidPath');
    return;
  }

  isExecuting.value = true;
  errorMessage.value = null;
  progress.value = null;
  report.value = null;
  jobStarted.value = false;
  jobId.value = `compare-sync-${Date.now()}`;

  await ensureJobListeners();

  try {
    await invoke('start_compare_sync_job', {
      request: {
        ...request,
        jobId: jobId.value,
      },
    });

    // 这一次 IPC 返回时，Rust 侧的任务已经在注册表里了 ——
    // 从这一刻起「取消」才真的能取消（见 jobStarted 的注释）。
    jobStarted.value = true;
  }
  catch (executeError) {
    errorMessage.value = String(executeError);
    isExecuting.value = false;
  }
}

async function cancelExecute() {
  if (!jobId.value) {
    return;
  }

  try {
    await invoke('cancel_compare_sync_job', { jobId: jobId.value });
  }
  catch (cancelError) {
    errorMessage.value = String(cancelError);
  }
}

function goBack() {
  if (step.value === 'preview') {
    step.value = 'results';
    return;
  }

  if (step.value === 'results') {
    step.value = 'settings';
  }
}

onBeforeUnmount(() => {
  progressUnlisten?.();
  finishedUnlisten?.();
  compareProgressUnlisten?.();
  progressUnlisten = null;
  finishedUnlisten = null;
  compareProgressUnlisten = null;
});
</script>

<template>
  <Dialog
    :open="props.open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="compare-sync-dialog">
      <DialogHeader class="compare-sync-dialog__header">
        <DialogTitle>{{ t('compareSync.title') }}</DialogTitle>
        <DialogDescription>{{ t('compareSync.description') }}</DialogDescription>
        <div class="compare-sync-dialog__steps">
          <button
            v-for="(item, index) in (['settings', 'results', 'preview'] as CompareStep[])"
            :key="item"
            type="button"
            class="compare-sync-dialog__step"
            :class="{
              'compare-sync-dialog__step--active': step === item,
              'compare-sync-dialog__step--done': (['settings', 'results', 'preview'] as CompareStep[]).indexOf(step) > index,
            }"
            :disabled="item === 'results' && !hasResults"
            @click="step = item"
          >
            <span class="compare-sync-dialog__step-index">{{ index + 1 }}</span>
            <span>{{ t(`compareSync.step${item.charAt(0).toUpperCase()}${item.slice(1)}`) }}</span>
          </button>
        </div>
      </DialogHeader>

      <!-- 第一步：设置 -->
      <div
        v-if="step === 'settings'"
        class="compare-sync-dialog__body compare-sync-dialog__body--settings"
      >
        <div class="compare-sync-dialog__paths">
          <label class="compare-sync-dialog__field">
            <span class="compare-sync-dialog__label">{{ t('compareSync.leftDirectory') }}</span>
            <Input
              v-model="leftPathInput"
              class="compare-sync-dialog__input"
              :placeholder="t('compareSync.leftDirectoryHint')"
            />
          </label>

          <label class="compare-sync-dialog__field">
            <span class="compare-sync-dialog__label">{{ t('compareSync.rightDirectory') }}</span>
            <Input
              v-model="rightPathInput"
              class="compare-sync-dialog__input"
              :placeholder="t('compareSync.rightDirectoryHint')"
            />
          </label>
        </div>

        <Tabs
          default-value="criteria"
          class="compare-sync-dialog__tabs"
        >
          <TabsList class="compare-sync-dialog__tabs-list">
            <TabsTrigger value="criteria">
              {{ t('compareSync.tabCriteria') }}
            </TabsTrigger>
            <TabsTrigger value="exclude">
              {{ t('compareSync.tabExclude') }}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criteria">
            <div class="compare-sync-dialog__criteria">
              <div class="compare-sync-dialog__toggle-row">
                <span>{{ t('compareSync.criteriaByTime') }}</span>
                <Switch
                  :model-value="criteria.byTime"
                  @update:model-value="criteria.byTime = $event"
                />
              </div>
              <div class="compare-sync-dialog__toggle-row">
                <span>{{ t('compareSync.criteriaBySize') }}</span>
                <Switch
                  :model-value="criteria.bySize"
                  @update:model-value="criteria.bySize = $event"
                />
              </div>
              <div class="compare-sync-dialog__toggle-row">
                <span>
                  {{ t('compareSync.criteriaByChecksum') }}
                  <em class="compare-sync-dialog__hint">{{ t('compareSync.criteriaByChecksumHint') }}</em>
                </span>
                <Switch
                  :model-value="criteria.byChecksum"
                  @update:model-value="criteria.byChecksum = $event"
                />
              </div>
              <div class="compare-sync-dialog__toggle-row">
                <span>{{ t('compareSync.criteriaCaseSensitive') }}</span>
                <Switch
                  :model-value="criteria.caseSensitive"
                  @update:model-value="criteria.caseSensitive = $event"
                />
              </div>
              <div class="compare-sync-dialog__toggle-row">
                <span>{{ t('compareSync.criteriaRecursive') }}</span>
                <Switch
                  :model-value="criteria.recursive"
                  @update:model-value="criteria.recursive = $event"
                />
              </div>

              <label class="compare-sync-dialog__field">
                <span class="compare-sync-dialog__label">{{ t('compareSync.criteriaMaxDepth') }}</span>
                <Input
                  :model-value="criteria.maxDepth === null ? '' : String(criteria.maxDepth)"
                  class="compare-sync-dialog__input compare-sync-dialog__input--narrow"
                  :placeholder="t('compareSync.criteriaMaxDepthUnlimited')"
                  @update:model-value="(value: string | number | undefined) => {
                    const parsed = Number.parseInt(String(value), 10);
                    criteria.maxDepth = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
                  }"
                />
              </label>

              <label class="compare-sync-dialog__field">
                <span class="compare-sync-dialog__label">{{ t('compareSync.criteriaRemoteTimeOffset') }}</span>
                <Input
                  :model-value="String(criteria.remoteTimeOffsetSeconds)"
                  class="compare-sync-dialog__input compare-sync-dialog__input--narrow"
                  @update:model-value="(value: string | number | undefined) => {
                    const parsed = Number.parseInt(String(value), 10);
                    criteria.remoteTimeOffsetSeconds = Number.isFinite(parsed) ? parsed : 0;
                  }"
                />
                <em class="compare-sync-dialog__hint">{{ t('compareSync.criteriaRemoteTimeOffsetHint') }}</em>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="exclude">
            <div class="compare-sync-dialog__exclude">
              <span class="compare-sync-dialog__label">{{ t('compareSync.excludePatterns') }}</span>
              <textarea
                v-model="excludeText"
                class="compare-sync-dialog__textarea"
                rows="6"
                spellcheck="false"
              />
              <em class="compare-sync-dialog__hint">{{ t('compareSync.excludePatternsHint') }}</em>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- 第二步：结果 -->
      <div
        v-else-if="step === 'results'"
        class="compare-sync-dialog__body"
      >
        <div class="compare-sync-dialog__stats">
          <span>{{ t('compareSync.statsTotal') }} {{ tree?.stats.total ?? 0 }}</span>
          <span>{{ t('compareSync.statsSame') }} {{ tree?.stats.same ?? 0 }}</span>
          <span>{{ t('compareSync.statsDifferences') }} {{ (tree?.stats.total ?? 0) - (tree?.stats.same ?? 0) }}</span>
          <span :class="{ 'compare-sync-dialog__stat--warn': (tree?.stats.sizeDiff ?? 0) + (tree?.stats.contentDiff ?? 0) + (tree?.stats.kindDiff ?? 0) + (tree?.stats.indeterminate ?? 0) > 0 }">
            {{ t('compareSync.statsNeedsReview') }}
            {{ (tree?.stats.sizeDiff ?? 0) + (tree?.stats.contentDiff ?? 0) + (tree?.stats.kindDiff ?? 0) + (tree?.stats.indeterminate ?? 0) }}
          </span>
          <span
            v-if="(tree?.stats.unreadable ?? 0) > 0"
            class="compare-sync-dialog__stat--warn"
          >
            {{ t('compareSync.statsUnreadable') }} {{ tree?.stats.unreadable ?? 0 }}
          </span>
        </div>

        <div class="compare-sync-dialog__filters">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="compare-sync-dialog__filter"
            :class="{ 'compare-sync-dialog__filter--active': filter === option.value }"
            @click="filter = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <ScrollArea class="compare-sync-dialog__tree">
          <div class="compare-sync-dialog__tree-content">
            <div
              v-if="visibleRows.length === 0"
              class="compare-sync-dialog__empty"
            >
              {{ t('compareSync.noDifferences') }}
            </div>

            <div
              v-for="row in visibleRows"
              :key="row.node.relPath"
              class="compare-sync-dialog__row"
              :style="{ paddingLeft: `${row.depth * 16 + 8}px` }"
            >
              <FolderIcon
                v-if="row.node.kind === 'directory'"
                :size="14"
                class="compare-sync-dialog__row-icon"
              />
              <span class="compare-sync-dialog__row-name">{{ row.node.name }}</span>
              <span
                class="compare-sync-dialog__badge"
                :class="`compare-sync-dialog__badge--${row.node.status}`"
              >
                {{ statusLabel(row.node.status) }}
              </span>
              <span class="compare-sync-dialog__row-direction">{{ directionLabel(row.node) }}</span>
              <span class="compare-sync-dialog__row-size">
                <template v-if="row.node.left && row.node.right">
                  {{ sizeSummary(row.node) }}
                </template>
                <template v-else-if="row.node.left">
                  {{ formatSize(row.node.left.size) }}
                </template>
              </span>
            </div>
          </div>
        </ScrollArea>

        <!--
          条目太多时只渲染前面一段，剩下的按批次放出来。
          **必须明说一共多少条**，否则用户会以为那就是全部。
        -->
        <div
          v-if="hasMoreRows"
          class="compare-sync-dialog__rows-note"
        >
          <span>{{ t('compareSync.rowsTruncated', {
            shown: visibleRows.length,
            total: totalRowCount,
          }) }}</span>
          <Button
            variant="ghost"
            @click="showMoreRows"
          >
            {{ t('compareSync.showMore', { count: 2000 }) }}
          </Button>
        </div>
      </div>

      <!-- 第三步：预览与执行 -->
      <div
        v-else
        class="compare-sync-dialog__body"
      >
        <p class="compare-sync-dialog__summary">
          {{ t('compareSync.planSummary', {
            dirs: plan?.plan.stats.createDirs ?? 0,
            files: plan?.plan.stats.transferFiles ?? 0,
            skipped: plan?.plan.stats.skipped ?? 0,
          }) }}
        </p>

        <ScrollArea class="compare-sync-dialog__tree">
          <div class="compare-sync-dialog__tree-content">
            <div
              v-for="(action, index) in plan?.plan.actions ?? []"
              :key="`${action.action}-${action.relPath}-${index}`"
              class="compare-sync-dialog__row compare-sync-dialog__row--action"
            >
              <span
                class="compare-sync-dialog__badge"
                :class="`compare-sync-dialog__badge--${action.action}`"
              >
                {{ action.action === 'create_dir'
                  ? t('compareSync.actionCreateDir')
                  : action.action === 'transfer_file'
                    ? t('compareSync.actionTransferFile')
                    : t('compareSync.actionSkip') }}
              </span>
              <span class="compare-sync-dialog__row-name">{{ action.relPath }}</span>
              <span
                v-if="action.action === 'transfer_file'"
                class="compare-sync-dialog__row-direction"
              >
                {{ transferSummary(action) }}
              </span>
            </div>
          </div>
        </ScrollArea>

        <div
          v-if="progress || isExecuting"
          class="compare-sync-dialog__progress"
        >
          <div class="compare-sync-dialog__progress-bar">
            <div
              class="compare-sync-dialog__progress-fill"
              :style="{ width: `${progress?.percent ?? 0}%` }"
            />
          </div>
          <span class="compare-sync-dialog__progress-detail">
            {{ progress?.detail ?? t('compareSync.executing') }}
          </span>
        </div>

        <div
          v-if="report"
          class="compare-sync-dialog__report"
        >
          <span>{{ t('compareSync.reportTransferred') }} {{ report.transferredFiles }}</span>
          <span>{{ t('compareSync.reportCreatedDirs') }} {{ report.createdDirs }}</span>
          <span>{{ t('compareSync.reportSkipped') }} {{ report.skipped }}</span>
          <span :class="{ 'compare-sync-dialog__stat--warn': report.failed > 0 }">
            {{ t('compareSync.reportFailed') }} {{ report.failed }}
          </span>
          <span
            v-if="report.cancelled"
            class="compare-sync-dialog__stat--warn"
          >
            {{ t('compareSync.reportCancelled') }}
          </span>
        </div>

        <ul
          v-if="report && report.failures.length > 0"
          class="compare-sync-dialog__failures"
        >
          <li
            v-for="failure in report.failures"
            :key="failure.relPath"
          >
            <CircleAlertIcon :size="13" />
            <span>{{ failure.relPath }}</span>
            <em>{{ failure.message }}</em>
          </li>
        </ul>
      </div>

      <!--
        比较进度。收集一棵大树要向文件系统问几十万次，
        没有进度指示的话界面看上去就是「卡住了」——
        用户分不清它是在干活还是死了。
      -->
      <div
        v-if="isComparing || isPreviewing"
        class="compare-sync-dialog__compare-progress"
      >
        <div class="compare-sync-dialog__compare-progress-head">
          <Loader2Icon
            :size="14"
            class="compare-sync-dialog__spinner"
          />
          <span>{{ compareProgressLabel }}</span>
        </div>

        <div
          v-if="compareProgressDetail"
          class="compare-sync-dialog__compare-progress-detail"
        >
          {{ compareProgressDetail }}
        </div>

        <div class="compare-sync-dialog__progress-track">
          <div
            class="compare-sync-dialog__progress-bar"
            :style="{ width: `${compareProgress?.percent ?? 4}%` }"
          />
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="compare-sync-dialog__error"
      >
        <CircleAlertIcon :size="14" />
        <span>{{ errorMessage }}</span>
      </div>

      <DialogFooter class="compare-sync-dialog__footer">
        <Button
          v-if="step !== 'settings'"
          variant="ghost"
          :disabled="isExecuting"
          @click="goBack"
        >
          {{ t('compareSync.back') }}
        </Button>

        <div class="compare-sync-dialog__footer-spacer" />

        <Button
          v-if="step === 'settings'"
          :disabled="!canCompare"
          @click="runCompare"
        >
          <Loader2Icon
            v-if="isComparing"
            :size="14"
            class="compare-sync-dialog__spinner"
          />
          {{ isComparing ? t('compareSync.comparing') : t('compareSync.compare') }}
        </Button>

        <Button
          v-else-if="step === 'results'"
          :disabled="isPreviewing"
          @click="runPreview"
        >
          <Loader2Icon
            v-if="isPreviewing"
            :size="14"
            class="compare-sync-dialog__spinner"
          />
          {{ t('compareSync.preview') }}
        </Button>

        <template v-else>
          <Button
            v-if="isExecuting"
            variant="outline"
            :disabled="!jobStarted"
            @click="cancelExecute"
          >
            {{ t('compareSync.cancel') }}
          </Button>
          <Button
            v-else
            :disabled="(plan?.plan.actions.length ?? 0) === 0"
            @click="runExecute"
          >
            {{ t('compareSync.execute') }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.compare-sync-dialog {
  width: min(56rem, 92vw);
  max-width: min(56rem, 92vw);
}

.compare-sync-dialog__header {
  gap: 0.5rem;
}

.compare-sync-dialog__steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.compare-sync-dialog__step {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.8125rem;
}

.compare-sync-dialog__step:disabled {
  cursor: default;
  opacity: 0.5;
}

.compare-sync-dialog__step--active {
  border-color: hsl(var(--border));
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.compare-sync-dialog__step--done {
  color: hsl(var(--foreground));
}

.compare-sync-dialog__step-index {
  display: inline-flex;
  width: 1.125rem;
  height: 1.125rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: hsl(var(--muted));
  font-size: 0.6875rem;
}

.compare-sync-dialog__body {
  display: flex;
  min-height: 18rem;
  flex-direction: column;
  gap: 0.75rem;
}

.compare-sync-dialog__body--settings {
  gap: 1rem;
}

.compare-sync-dialog__paths {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.compare-sync-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.compare-sync-dialog__label {
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 500;
}

.compare-sync-dialog__hint {
  display: block;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-style: normal;
  line-height: 1.4;
}

.compare-sync-dialog__input--narrow {
  max-width: 10rem;
}

.compare-sync-dialog__tabs-list {
  width: 100%;
}

.compare-sync-dialog__criteria {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding-top: 0.75rem;
}

.compare-sync-dialog__toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}

.compare-sync-dialog__exclude {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 0.75rem;
}

.compare-sync-dialog__textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
}

.compare-sync-dialog__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.compare-sync-dialog__stat--warn {
  color: hsl(var(--destructive));
}

.compare-sync-dialog__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.compare-sync-dialog__filter {
  padding: 0.1875rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.75rem;
}

.compare-sync-dialog__filter--active {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
  color: hsl(var(--foreground));
}

.compare-sync-dialog__tree {
  max-height: 20rem;
  flex: 1;
}

.compare-sync-dialog__tree-content {
  display: flex;
  flex-direction: column;
}

.compare-sync-dialog__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid hsl(var(--border) / 40%);
  font-size: 0.8125rem;
}

.compare-sync-dialog__row-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.compare-sync-dialog__row-name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-sync-dialog__row-direction {
  overflow: hidden;
  max-width: 22rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-sync-dialog__row-size {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  white-space: nowrap;
}

.compare-sync-dialog__badge {
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  white-space: nowrap;
}

.compare-sync-dialog__badge--only_left,
.compare-sync-dialog__badge--only_right,
.compare-sync-dialog__badge--create_dir {
  background-color: hsl(38 92% 50% / 18%);
  color: hsl(38 92% 35%);
}

.compare-sync-dialog__badge--newer,
.compare-sync-dialog__badge--older,
.compare-sync-dialog__badge--transfer_file {
  background-color: hsl(142 71% 45% / 18%);
  color: hsl(142 71% 28%);
}

.compare-sync-dialog__badge--size_diff,
.compare-sync-dialog__badge--content_diff,
.compare-sync-dialog__badge--kind_diff,
.compare-sync-dialog__badge--indeterminate,
.compare-sync-dialog__badge--skip {
  background-color: hsl(0 84% 60% / 18%);
  color: hsl(0 84% 45%);
}

.compare-sync-dialog__empty {
  padding: 1.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  text-align: center;
}

.compare-sync-dialog__summary {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.compare-sync-dialog__progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.compare-sync-dialog__progress-bar {
  overflow: hidden;
  height: 0.375rem;
  border-radius: 999px;
  background-color: hsl(var(--muted));
}

.compare-sync-dialog__progress-fill {
  height: 100%;
  border-radius: 999px;
  background-color: hsl(var(--primary));
  transition: width 0.2s ease-out;
}

.compare-sync-dialog__progress-detail {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.compare-sync-dialog__report {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.compare-sync-dialog__failures {
  display: flex;
  max-height: 8rem;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.compare-sync-dialog__failures li {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: hsl(var(--destructive));
  font-size: 0.75rem;
}

.compare-sync-dialog__failures em {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-sync-dialog__error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: hsl(var(--destructive));
  font-size: 0.8125rem;
}

.compare-sync-dialog__compare-progress {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.5rem;
  background: hsl(var(--muted) / 40%);
}

.compare-sync-dialog__compare-progress-head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.compare-sync-dialog__compare-progress-detail {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.compare-sync-dialog__progress-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: hsl(var(--border) / 70%);
}

.compare-sync-dialog__progress-bar {
  height: 100%;
  border-radius: 999px;
  background: hsl(var(--primary));
  transition: width 160ms ease-out;
}

.compare-sync-dialog__rows-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.compare-sync-dialog__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.compare-sync-dialog__footer-spacer {
  flex: 1;
}

.compare-sync-dialog__spinner {
  animation: compare-sync-dialog-spin 1s linear infinite;
}

@keyframes compare-sync-dialog-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
