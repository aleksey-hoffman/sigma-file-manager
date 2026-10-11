<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  HistoryIcon,
  PlusIcon,
  Trash2Icon,
} from '@lucide/vue';
import { toast } from '@/components/ui/toaster';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { DirEntry } from '@/types/dir-entry';
import type {
  BatchRenameCaseMode,
  BatchRenameRule,
  BatchRenameRuleType,
  BatchRenameSortMode,
} from '@/types/batch-rename';
import {
  executeBatchRename,
  useBatchRenamePreview,
  type PreviewRowForExecution,
} from '@/composables/use-batch-rename';
import BatchRenameHistoryPanel from './file-browser-batch-rename-history-panel.vue';

const props = defineProps<{
  directory: string;
  entries: DirEntry[];
}>();

const emit = defineEmits<{
  /** 落盘成功后抛出，父组件据此刷新目录列表。 */
  applied: [];
  cancel: [];
}>();

const isOpen = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

/**
 * 模板变量名与日期格式码是**语法**，不是文案，不该进语言包。
 *
 * 而且 vue-i18n 会把 `{name}` 当成插值占位符 —— 写进语言包的话，
 * 界面会渲染成空白或直接抛警告。在代码里拼就能绕开这个坑，
 * 顺带也不用为「补一种语言」去改 17 个包。
 */
const TEMPLATE_VARIABLES = ['{name}', '{ext}', '{parent}', '{size}', '{date}', '{n}'];
const DATE_FORMAT_CODES = ['YYYY', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss'];

// 拼好的字符串在模板里用。留成模板里的字面量会撞上两个问题：
// 一是 vue-i18n 把 `{...}` 当插值占位符，二是 i18n 的 lint 规则
// 会把模板里的裸文本判成「没走翻译」。
const TEMPLATE_VARIABLES_TEXT = TEMPLATE_VARIABLES.join('  ');
const DATE_FORMAT_EXAMPLE = `{date:${DATE_FORMAT_CODES.join('|')}}`;

const RULE_TYPES: BatchRenameRuleType[] = [
  'findReplace',
  'caseTransform',
  'template',
  'sequence',
  'extension',
];

const CASE_MODES: BatchRenameCaseMode[] = ['upper', 'lower', 'title', 'camel', 'snake', 'kebab'];

const SORT_MODES: BatchRenameSortMode[] = [
  'selection',
  'nameAsc',
  'nameDesc',
  'modifiedAsc',
  'modifiedDesc',
  'sizeAsc',
  'sizeDesc',
];

interface RuleItem {
  /** 稳定 id。规则可以增删和重排，用下标当 key 会让输入框内容串位。 */
  uid: number;
  rule: BatchRenameRule;
}

let uidCounter = 0;

function createRule(type: BatchRenameRuleType): BatchRenameRule {
  switch (type) {
    case 'findReplace':
      return {
        type,
        find: '',
        replace: '',
        caseSensitive: false,
        includeExtension: false,
      };
    case 'caseTransform':
      return {
        type,
        mode: 'lower',
        includeExtension: false,
      };
    case 'template':
      // 留空会渲染出空文件名，直接被判非法。默认给一个能看懂的组合：
      // 序号 + 原名，正是「按序号改名」最常见的意图。
      return {
        type,
        pattern: '{n}-{name}',
      };
    case 'sequence':
      return {
        type,
        start: 1,
        step: 1,
        pad: 0,
      };
    case 'extension':
      return {
        type,
        newExtension: '',
      };
  }
}

const ruleItems = ref<RuleItem[]>([]);
const sortMode = ref<BatchRenameSortMode>('selection');
const activeTab = ref<'rename' | 'history'>('rename');
const isExecuting = ref(false);

/** 只把 `rule` 剥给预览命令，uid 不参与 IPC。 */
const rules = computed<BatchRenameRule[]>(() => ruleItems.value.map(item => item.rule));

const directoryRef = computed(() => props.directory);
const entriesRef = computed(() => props.entries);
const sortRef = computed(() => sortMode.value);

const { preview, isPreviewing, previewError, refresh, cancelScheduledRefresh } = useBatchRenamePreview({
  directory: directoryRef,
  entries: entriesRef,
  rules,
  sort: sortRef,
});

function resetState(): void {
  ruleItems.value = [{
    uid: ++uidCounter,
    rule: createRule('findReplace'),
  }];
  sortMode.value = 'selection';
  activeTab.value = 'rename';
  isExecuting.value = false;
}

// 每次打开都是干净状态。上一批的规则如果留着，用户很容易在没注意的情况下
// 把上次的规则套到这一批文件上。
watch(isOpen, (open) => {
  if (open) {
    resetState();
  }
  else {
    cancelScheduledRefresh();
  }
});

watch(isOpen, (open) => {
  if (!open) {
    emit('cancel');
  }
});

const rows = computed(() => preview.value?.rows ?? []);
const changedRows = computed(() => rows.value.filter(row => row.changed));

const conflictRowIndices = computed(() => {
  const report = preview.value?.report;
  const indices = new Set<number>();

  for (const conflict of report?.conflicts ?? []) {
    for (const index of conflict.entryIndices) {
      indices.add(index);
    }
  }

  for (const invalid of report?.invalidNames ?? []) {
    indices.add(invalid.entryIndex);
  }

  return indices;
});

function isRowConflicted(index: number): boolean {
  return conflictRowIndices.value.has(index);
}

function conflictKindOf(index: number): string | null {
  const report = preview.value?.report;
  const conflict = report?.conflicts.find(item => item.entryIndices.includes(index));

  if (conflict) {
    return t(`batchRename.conflicts.${conflict.kind}`);
  }

  const invalid = report?.invalidNames.find(item => item.entryIndex === index);

  return invalid ? t(`batchRename.conflicts.invalid.${invalid.reason}`) : null;
}

/**
 * 「能点执行」的条件：预览已算完、没有阻断冲突、确实有东西要改。
 *
 * 没有要改时禁用按钮，是为了让用户明白「这次什么都没发生」，
 * 而不是点下去才发现没反应。
 */
const canExecute = computed(() => {
  if (isExecuting.value || isPreviewing.value) {
    return false;
  }

  if (!preview.value?.executable) {
    return false;
  }

  return changedRows.value.length > 0;
});

function addRule(): void {
  ruleItems.value = [
    ...ruleItems.value,
    {
      uid: ++uidCounter,
      rule: createRule('findReplace'),
    },
  ];
}

function removeRule(uid: number): void {
  ruleItems.value = ruleItems.value.filter(item => item.uid !== uid);
}

/**
 * 在末尾补一条模板规则，让「序号」立刻能用。
 *
 * 序号规则自身不产生改名，这是设计如此：用户说「按序号改名」时，
 * 绝大多数想要的其实是 `序号-原名`，而不是把原名整个丢掉变成 `1.jpg`。
 * 默认模板因此带上了 `{name}`。
 */
function addTemplateRuleForSequence(): void {
  ruleItems.value = [
    ...ruleItems.value,
    {
      uid: ++uidCounter,
      rule: createRule('template'),
    },
  ];
}

/** 按 +1 / -1 移动规则。规则是按声明顺序求值的，顺序会改变结果。 */
function moveRule(uid: number, offset: -1 | 1): void {
  const index = ruleItems.value.findIndex(item => item.uid === uid);
  const target = index + offset;

  if (index < 0 || target < 0 || target >= ruleItems.value.length) {
    return;
  }

  const next = [...ruleItems.value];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  ruleItems.value = next;
}

function isFirst(uid: number): boolean {
  return ruleItems.value.findIndex(item => item.uid === uid) === 0;
}

function isLast(uid: number): boolean {
  return ruleItems.value.findIndex(item => item.uid === uid) === ruleItems.value.length - 1;
}

function updateRuleType(uid: number, type: BatchRenameRuleType): void {
  ruleItems.value = ruleItems.value.map(item => (
    item.uid === uid
      ? {
          uid: item.uid,
          rule: createRule(type),
        }
      : item
  ));
}

/**
 * 改写勾选框。
 *
 * 不能在模板里写 `value => { item.rule.caseSensitive = ... }`：
 * 箭头函数是新作用域，TypeScript 的控制流收窄不跨函数边界，
 * 于是 `item.rule` 退回联合类型，访问 `caseSensitive` 直接报 TS2339。
 * `v-model` 不受影响，因为它是当前作用域里的直接赋值。
 *
 * 这里再判一次 `type`，顺带挡住「uid 已失效但回调还在跑」的情况。
 */
function updateBooleanOption(
  uid: number,
  type: BatchRenameRuleType,
  key: 'caseSensitive' | 'includeExtension',
  value: boolean,
): void {
  const item = ruleItems.value.find(entry => entry.uid === uid);

  if (!item || item.rule.type !== type) {
    return;
  }

  // 必须按类型分开赋值：收窄到 `findReplace | caseTransform` 之后，
  // 用联合类型的 key 去索引仍然不安全 —— caseSensitive 在 caseTransform 上不存在。
  if (item.rule.type === 'findReplace') {
    if (key === 'caseSensitive' || key === 'includeExtension') {
      item.rule[key] = value;
    }

    return;
  }

  if (item.rule.type === 'caseTransform' && key === 'includeExtension') {
    item.rule.includeExtension = value;
  }
}

async function handleApply(): Promise<void> {
  if (!canExecute.value || !preview.value) {
    return;
  }

  isExecuting.value = true;

  // 只把执行需要的字段传下去。多传的东西会让 Rust 侧的反序列化
  // 依赖「忽略未知字段」，那是 serde 的默认行为，但不该依赖。
  const planned: PreviewRowForExecution[] = preview.value.rows.map(row => ({
    path: row.path,
    oldName: row.oldName,
    newName: row.newName,
    unchanged: row.unchanged,
  }));

  try {
    const report = await executeBatchRename({
      directory: preview.value.directory,
      entries: planned,
    });

    if (report.fullySuccessful) {
      toast.success(t('batchRename.result.success', { count: report.succeeded.length }));
    }
    else {
      toast.error(t('batchRename.result.partial'));

      if (report.rollback.attempted) {
        const message = report.rollback.succeeded
          ? t('batchRename.result.rollbackOk')
          : t('batchRename.result.rollbackFailed');

        if (report.rollback.succeeded) {
          toast.success(message);
        }
        else {
          toast.error(message);
        }
      }
    }

    if (report.historyError) {
      // 改完了但没进历史 = 撤不回来。这条必须说，不能吞掉。
      toast.error(t('batchRename.result.noUndo'));
    }

    isOpen.value = false;
    emit('applied');
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    isExecuting.value = false;
    await refresh();
  }
}

function handleCancel(): void {
  isOpen.value = false;
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="file-browser-batch-rename-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('batchRename.dialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('batchRename.dialog.summaryChanged', { count: changedRows.length }) }}
        </DialogDescription>
      </DialogHeader>

      <Tabs
        v-model="activeTab"
        class="file-browser-batch-rename-dialog__tabs"
      >
        <TabsList class="file-browser-batch-rename-dialog__tabs-list">
          <TabsTrigger
            value="rename"
            class="file-browser-batch-rename-dialog__tab-trigger"
          >
            {{ t('batchRename.dialog.tabRename') }}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            class="file-browser-batch-rename-dialog__tab-trigger"
          >
            <HistoryIcon :size="14" />
            {{ t('batchRename.dialog.tabHistory') }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="rename"
          class="file-browser-batch-rename-dialog__tab-content"
        >
          <div class="file-browser-batch-rename-dialog__rules">
            <div class="file-browser-batch-rename-dialog__rules-header">
              <span class="file-browser-batch-rename-dialog__section-title">
                {{ t('batchRename.rules.title') }}
              </span>
              <Button
                variant="outline"
                size="xs"
                :disabled="ruleItems.length === 0"
                @click="addRule"
              >
                <PlusIcon :size="14" />
                {{ t('batchRename.rules.add') }}
              </Button>
            </div>

            <p
              v-if="ruleItems.length === 0"
              class="file-browser-batch-rename-dialog__empty-hint"
            >
              {{ t('batchRename.rules.empty') }}
            </p>

            <div
              v-for="item in ruleItems"
              :key="item.uid"
              class="file-browser-batch-rename-dialog__rule-card"
            >
              <div class="file-browser-batch-rename-dialog__rule-header">
                <Select
                  :model-value="item.rule.type"
                  @update:model-value="value => updateRuleType(item.uid, value as BatchRenameRuleType)"
                >
                  <SelectTrigger class="file-browser-batch-rename-dialog__rule-type-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="type in RULE_TYPES"
                      :key="type"
                      :value="type"
                    >
                      {{ t(`batchRename.rules.type.${type}`) }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div class="file-browser-batch-rename-dialog__rule-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    :disabled="isFirst(item.uid)"
                    :title="t('batchRename.rules.moveUp')"
                    @click="moveRule(item.uid, -1)"
                  >
                    <ArrowUpIcon :size="14" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    :disabled="isLast(item.uid)"
                    :title="t('batchRename.rules.moveDown')"
                    @click="moveRule(item.uid, 1)"
                  >
                    <ArrowDownIcon :size="14" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    :title="t('batchRename.rules.remove')"
                    @click="removeRule(item.uid)"
                  >
                    <Trash2Icon :size="14" />
                  </Button>
                </div>
              </div>

              <template v-if="item.rule.type === 'findReplace'">
                <div class="file-browser-batch-rename-dialog__field-row">
                  <div class="file-browser-batch-rename-dialog__field">
                    <Label
                      :for="`batch-fr-find-${item.uid}`"
                      class="file-browser-batch-rename-dialog__label"
                    >
                      {{ t('batchRename.rules.findReplace.find') }}
                    </Label>
                    <Input
                      :id="`batch-fr-find-${item.uid}`"
                      v-model="item.rule.find"
                    />
                  </div>
                  <div class="file-browser-batch-rename-dialog__field">
                    <Label
                      :for="`batch-fr-replace-${item.uid}`"
                      class="file-browser-batch-rename-dialog__label"
                    >
                      {{ t('batchRename.rules.findReplace.replace') }}
                    </Label>
                    <Input
                      :id="`batch-fr-replace-${item.uid}`"
                      v-model="item.rule.replace"
                    />
                  </div>
                </div>
                <div class="file-browser-batch-rename-dialog__checkbox-row">
                  <Checkbox
                    :id="`batch-fr-case-${item.uid}`"
                    :model-value="item.rule.caseSensitive"
                    @update:model-value="value => updateBooleanOption(item.uid, 'findReplace', 'caseSensitive', Boolean(value))"
                  />
                  <Label
                    :for="`batch-fr-case-${item.uid}`"
                    class="file-browser-batch-rename-dialog__checkbox-label"
                  >
                    {{ t('batchRename.rules.findReplace.caseSensitive') }}
                  </Label>
                </div>
                <div class="file-browser-batch-rename-dialog__checkbox-row">
                  <Checkbox
                    :id="`batch-fr-ext-${item.uid}`"
                    :model-value="item.rule.includeExtension"
                    @update:model-value="value => updateBooleanOption(item.uid, 'findReplace', 'includeExtension', Boolean(value))"
                  />
                  <Label
                    :for="`batch-fr-ext-${item.uid}`"
                    class="file-browser-batch-rename-dialog__checkbox-label"
                  >
                    {{ t('batchRename.rules.findReplace.includeExtension') }}
                  </Label>
                </div>
              </template>

              <template v-else-if="item.rule.type === 'caseTransform'">
                <div class="file-browser-batch-rename-dialog__field">
                  <span class="file-browser-batch-rename-dialog__label">
                    {{ t('batchRename.rules.caseTransform.mode') }}
                  </span>
                  <Select v-model="item.rule.mode">
                    <SelectTrigger class="file-browser-batch-rename-dialog__field-control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="mode in CASE_MODES"
                        :key="mode"
                        :value="mode"
                      >
                        {{ t(`batchRename.rules.case.${mode}`) }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="file-browser-batch-rename-dialog__checkbox-row">
                  <Checkbox
                    :id="`batch-case-ext-${item.uid}`"
                    :model-value="item.rule.includeExtension"
                    @update:model-value="value => updateBooleanOption(item.uid, 'caseTransform', 'includeExtension', Boolean(value))"
                  />
                  <Label
                    :for="`batch-case-ext-${item.uid}`"
                    class="file-browser-batch-rename-dialog__checkbox-label"
                  >
                    {{ t('batchRename.rules.caseTransform.includeExtension') }}
                  </Label>
                </div>
              </template>

              <template v-else-if="item.rule.type === 'template'">
                <div class="file-browser-batch-rename-dialog__field">
                  <Label
                    :for="`batch-template-${item.uid}`"
                    class="file-browser-batch-rename-dialog__label"
                  >
                    {{ t('batchRename.rules.template.pattern') }}
                  </Label>
                  <Input
                    :id="`batch-template-${item.uid}`"
                    v-model="item.rule.pattern"
                  />
                </div>
                <p class="file-browser-batch-rename-dialog__hint">
                  {{ t('batchRename.rules.template.variables') }}:
                  <span class="file-browser-batch-rename-dialog__syntax">{{ TEMPLATE_VARIABLES_TEXT }}</span>
                </p>
                <p class="file-browser-batch-rename-dialog__hint">
                  {{ t('batchRename.rules.template.dateFormat') }}:
                  <span class="file-browser-batch-rename-dialog__syntax">{{ DATE_FORMAT_EXAMPLE }}</span>
                </p>
              </template>

              <template v-else-if="item.rule.type === 'sequence'">
                <div class="file-browser-batch-rename-dialog__field-row">
                  <div class="file-browser-batch-rename-dialog__field">
                    <Label
                      :for="`batch-seq-start-${item.uid}`"
                      class="file-browser-batch-rename-dialog__label"
                    >
                      {{ t('batchRename.rules.sequence.start') }}
                    </Label>
                    <Input
                      :id="`batch-seq-start-${item.uid}`"
                      v-model.number="item.rule.start"
                      type="number"
                    />
                  </div>
                  <div class="file-browser-batch-rename-dialog__field">
                    <Label
                      :for="`batch-seq-step-${item.uid}`"
                      class="file-browser-batch-rename-dialog__label"
                    >
                      {{ t('batchRename.rules.sequence.step') }}
                    </Label>
                    <Input
                      :id="`batch-seq-step-${item.uid}`"
                      v-model.number="item.rule.step"
                      type="number"
                    />
                  </div>
                  <div class="file-browser-batch-rename-dialog__field">
                    <Label
                      :for="`batch-seq-pad-${item.uid}`"
                      class="file-browser-batch-rename-dialog__label"
                    >
                      {{ t('batchRename.rules.sequence.pad') }}
                    </Label>
                    <Input
                      :id="`batch-seq-pad-${item.uid}`"
                      v-model.number="item.rule.pad"
                      type="number"
                      min="0"
                    />
                  </div>
                </div>
                <p class="file-browser-batch-rename-dialog__hint">
                  {{ t('batchRename.rules.sequence.hint') }}
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  @click="addTemplateRuleForSequence()"
                >
                  <PlusIcon :size="14" />
                  {{ t('batchRename.rules.sequence.addTemplate') }}
                </Button>
              </template>

              <template v-else-if="item.rule.type === 'extension'">
                <div class="file-browser-batch-rename-dialog__field">
                  <Label
                    :for="`batch-ext-${item.uid}`"
                    class="file-browser-batch-rename-dialog__label"
                  >
                    {{ t('batchRename.rules.extension.newExtension') }}
                  </Label>
                  <Input
                    :id="`batch-ext-${item.uid}`"
                    v-model="item.rule.newExtension"
                  />
                </div>
                <p class="file-browser-batch-rename-dialog__hint">
                  {{ t('batchRename.rules.extension.newExtensionHint') }}
                </p>
              </template>
            </div>

            <div class="file-browser-batch-rename-dialog__field">
              <span class="file-browser-batch-rename-dialog__label">
                {{ t('batchRename.rules.sortLabel') }}
              </span>
              <Select v-model="sortMode">
                <SelectTrigger class="file-browser-batch-rename-dialog__field-control">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="mode in SORT_MODES"
                    :key="mode"
                    :value="mode"
                  >
                    {{ t(`batchRename.sort.${mode}`) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="file-browser-batch-rename-dialog__preview">
            <div class="file-browser-batch-rename-dialog__preview-header">
              <span class="file-browser-batch-rename-dialog__section-title">
                {{ t('batchRename.preview.title') }}
              </span>
              <span class="file-browser-batch-rename-dialog__preview-summary">
                {{ t('batchRename.dialog.summaryUnchanged', {
                  count: rows.length - changedRows.length,
                }) }}
              </span>
            </div>

            <p
              v-if="previewError"
              class="file-browser-batch-rename-dialog__error-hint"
            >
              {{ previewError }}
            </p>

            <p
              v-else-if="ruleItems.length === 0"
              class="file-browser-batch-rename-dialog__empty-hint"
            >
              {{ t('batchRename.dialog.noRules') }}
            </p>

            <p
              v-else-if="rows.length === 0"
              class="file-browser-batch-rename-dialog__empty-hint"
            >
              {{ t('batchRename.preview.empty') }}
            </p>

            <div
              v-else
              class="file-browser-batch-rename-dialog__preview-table-wrapper"
            >
              <div class="file-browser-batch-rename-dialog__preview-table-header">
                <span class="file-browser-batch-rename-dialog__preview-col">
                  {{ t('batchRename.preview.oldName') }}
                </span>
                <span class="file-browser-batch-rename-dialog__preview-col">
                  {{ t('batchRename.preview.newName') }}
                </span>
              </div>
              <div class="file-browser-batch-rename-dialog__preview-table-body">
                <div
                  v-for="row in rows"
                  :key="row.path + row.index"
                  class="file-browser-batch-rename-dialog__preview-row"
                  :class="{
                    'file-browser-batch-rename-dialog__preview-row--unchanged': !row.changed,
                    'file-browser-batch-rename-dialog__preview-row--conflict': isRowConflicted(row.index),
                  }"
                >
                  <span class="file-browser-batch-rename-dialog__preview-name">
                    {{ row.oldName }}
                  </span>
                  <span class="file-browser-batch-rename-dialog__preview-name">
                    <template v-if="row.error">
                      <span class="file-browser-batch-rename-dialog__preview-error">{{ row.error }}</span>
                    </template>
                    <template v-else-if="row.changed">
                      {{ row.newName }}
                    </template>
                    <template v-else>
                      <span class="file-browser-batch-rename-dialog__preview-unchanged">
                        {{ t('batchRename.preview.unchanged') }}
                      </span>
                    </template>
                  </span>
                  <span
                    v-if="isRowConflicted(row.index)"
                    class="file-browser-batch-rename-dialog__preview-reason"
                  >
                    {{ conflictKindOf(row.index) }}
                  </span>
                </div>
              </div>
            </div>

            <p
              v-if="preview && !preview.executable"
              class="file-browser-batch-rename-dialog__blocked-hint"
            >
              {{ t('batchRename.dialog.blocked') }}
            </p>
          </div>
        </TabsContent>

        <TabsContent
          value="history"
          class="file-browser-batch-rename-dialog__tab-content"
        >
          <BatchRenameHistoryPanel
            :directory="directory"
            @undone="handleCancel"
          />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isExecuting"
          @click="handleCancel"
        >
          {{ t('batchRename.dialog.close') }}
        </Button>
        <Button
          :disabled="!canExecute"
          @click="handleApply"
        >
          {{ isExecuting ? t('batchRename.dialog.loading') : t('batchRename.dialog.apply') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.file-browser-batch-rename-dialog {
  width: 720px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.file-browser-batch-rename-dialog > * {
  min-width: 0;
}

.file-browser-batch-rename-dialog__tabs {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.file-browser-batch-rename-dialog__tabs-list {
  width: 100%;
}

.file-browser-batch-rename-dialog__tab-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-batch-rename-dialog__tab-content {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.file-browser-batch-rename-dialog__rules,
.file-browser-batch-rename-dialog__preview {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.file-browser-batch-rename-dialog__rules-header,
.file-browser-batch-rename-dialog__preview-header {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-browser-batch-rename-dialog__section-title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
}

.file-browser-batch-rename-dialog__preview-summary {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.file-browser-batch-rename-dialog__rule-card {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 8px;
}

.file-browser-batch-rename-dialog__rule-header {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-browser-batch-rename-dialog__rule-type-trigger {
  min-width: 0;
}

.file-browser-batch-rename-dialog__rule-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.file-browser-batch-rename-dialog__field-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-end;
  gap: 8px;
}

.file-browser-batch-rename-dialog__field {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.file-browser-batch-rename-dialog__field-control {
  width: 100%;
  min-width: 0;
}

.file-browser-batch-rename-dialog__label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.file-browser-batch-rename-dialog__checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-browser-batch-rename-dialog__checkbox-label {
  color: hsl(var(--foreground));
  font-size: 13px;
}

.file-browser-batch-rename-dialog__hint,
.file-browser-batch-rename-dialog__empty-hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.file-browser-batch-rename-dialog__syntax {
  font-family: monospace;
}

.file-browser-batch-rename-dialog__preview-table-wrapper {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.file-browser-batch-rename-dialog__preview-table-header,
.file-browser-batch-rename-dialog__preview-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  padding: 6px 10px;
  gap: 12px;
}

.file-browser-batch-rename-dialog__preview-table-header {
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

.file-browser-batch-rename-dialog__preview-table-body {
  display: flex;
  min-width: 0;
  max-height: 240px;
  flex-direction: column;
  overflow-y: auto;
}

.file-browser-batch-rename-dialog__preview-row {
  flex-wrap: wrap;
}

.file-browser-batch-rename-dialog__preview-row--unchanged {
  opacity: 0.55;
}

.file-browser-batch-rename-dialog__preview-row--conflict {
  background-color: hsl(var(--destructive) / 12%);
}

.file-browser-batch-rename-dialog__preview-col,
.file-browser-batch-rename-dialog__preview-name {
  min-width: 0;
  flex: 1 1 0;
  overflow-wrap: break-word;
}

.file-browser-batch-rename-dialog__preview-name {
  color: hsl(var(--foreground));
  font-size: 13px;
}

.file-browser-batch-rename-dialog__preview-unchanged {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.file-browser-batch-rename-dialog__preview-error,
.file-browser-batch-rename-dialog__preview-reason,
.file-browser-batch-rename-dialog__error-hint,
.file-browser-batch-rename-dialog__blocked-hint {
  color: hsl(var(--destructive));
  font-size: 12px;
}

.file-browser-batch-rename-dialog__preview-reason {
  width: 100%;
}

.file-browser-batch-rename-dialog__blocked-hint {
  margin: 0;
  font-weight: 500;
}
</style>
