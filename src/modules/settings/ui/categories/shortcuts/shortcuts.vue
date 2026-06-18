<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onUnmounted,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, ConfirmButton } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  KeyboardIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
  SearchIcon,
  TextSearchIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  CheckCheckIcon,
  Trash2Icon,
  PencilIcon,
  XIcon,
  UserIcon,
  SettingsIcon,
  LockIcon,
  EyeIcon,
  TerminalSquareIcon,
  PlusIcon,
  MinusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CornerDownLeftIcon,
  FlipHorizontalIcon,
  AppWindowIcon,
  FullscreenIcon,
  PrinterIcon,
  InfoIcon,
  HomeIcon,
  FolderClosedIcon,
  BookmarkIcon,
} from '@lucide/vue';
import type { Component } from 'vue';
import {
  useShortcutsStore,
  formatShortcutKeys,
  formatConditionsLabel,
  formatCaptureChordLabel,
  isModifierPhysicalKeyCode,
  resolveShortcutKeyFromKeyboardEvent,
  type ShortcutDefinition,
  type ShortcutId,
  type ShortcutKeys,
} from '@/stores/runtime/shortcuts';
import {
  useGlobalShortcutsStore,
  type GlobalShortcutId,
} from '@/stores/runtime/global-shortcuts';
import { formatKeybindingKeys } from '@/modules/extensions/api';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { BlocksIcon } from '@lucide/vue';
import type { ExtensionKeybindingOverride } from '@/types/extension';
import { SettingsItem } from '@/modules/settings';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const globalShortcutsStore = useGlobalShortcutsStore();
const unassignedShortcutLabel = '—';

const shortcutIcons: Record<ShortcutId, Component> = {
  toggleGlobalSearch: SearchIcon,
  switchToHomePage: HomeIcon,
  switchToNavigatorPage: FolderClosedIcon,
  switchToDashboardPage: BookmarkIcon,
  switchToSettingsPage: SettingsIcon,
  switchToExtensionsPage: BlocksIcon,
  navigatePageBack: ArrowLeftIcon,
  navigatePageForward: ArrowRightIcon,
  toggleFilter: TextSearchIcon,
  reloadCurrentDirectory: RotateCcwIcon,
  toggleSettingsSearch: TextSearchIcon,
  toggleCommandPalette: TerminalSquareIcon,
  toggleAddressBar: TextSearchIcon,
  openEntry: SearchIcon,
  toggleSplitView: FlipHorizontalIcon,
  createNewFile: PlusIcon,
  createNewDirectory: FolderClosedIcon,
  copyCurrentDirectoryPath: CopyIcon,
  openCopiedPath: ClipboardPasteIcon,
  copy: CopyIcon,
  cut: FolderInputIcon,
  paste: ClipboardPasteIcon,
  selectAll: CheckCheckIcon,
  delete: Trash2Icon,
  deletePermanently: Trash2Icon,
  rename: PencilIcon,
  escape: XIcon,
  quickView: EyeIcon,
  print: PrinterIcon,
  properties: InfoIcon,
  openNewTab: PlusIcon,
  closeCurrentTab: XIcon,
  restoreLastClosedTab: RotateCcwIcon,
  openTerminal: TerminalSquareIcon,
  openTerminalAdmin: TerminalSquareIcon,
  navigateUp: ArrowUpIcon,
  navigateDown: ArrowDownIcon,
  navigateLeft: ArrowLeftIcon,
  navigateRight: ArrowRightIcon,
  openSelected: CornerDownLeftIcon,
  navigateHistoryBack: ArrowLeftIcon,
  navigateHistoryForward: ArrowRightIcon,
  goUpDirectory: ArrowUpIcon,
  switchToLeftPane: FlipHorizontalIcon,
  switchToRightPane: FlipHorizontalIcon,
  uiZoomIncrease: PlusIcon,
  uiZoomDecrease: MinusIcon,
  toggleFullscreen: FullscreenIcon,
};

const globalShortcutIcons: Record<GlobalShortcutId, Component> = {
  launchApp: AppWindowIcon,
};
const extensionsStorageStore = useExtensionsStorageStore();

const isDialogOpen = ref(false);
const editingAppShortcutDefinition = ref<ShortcutDefinition | null>(null);
const editingGlobalShortcutId = ref<GlobalShortcutId | null>(null);
const recordedKeys = ref<ShortcutKeys | null>(null);
const isRecording = ref(false);
const recordButtonRef = ref<HTMLButtonElement | null>(null);
const captureDisplayLabel = ref('');
const lastCaptureKeyboardEvent = ref<KeyboardEvent | null>(null);
const pressedPhysicalCodes = new Set<string>();
const globalRegisterFailed = ref(false);

let recordCaptureKeyDown: ((event: KeyboardEvent) => void) | null = null;
let recordCaptureKeyUp: ((event: KeyboardEvent) => void) | null = null;
let recordCaptureMouseDown: ((event: MouseEvent) => void) | null = null;

function shouldIgnorePhysicalCodeForCaptureTracking(code: string): boolean {
  return code === 'Tab' || code === 'Enter';
}

function updateCaptureDisplayLabel() {
  const event = lastCaptureKeyboardEvent.value;
  const nonModifierCodes = [...pressedPhysicalCodes].filter(
    code => !isModifierPhysicalKeyCode(code),
  );

  if (nonModifierCodes.length > 0) {
    if (!event) {
      captureDisplayLabel.value = recordedKeys.value
        ? formatShortcutKeys(recordedKeys.value)
        : '';
      return;
    }

    captureDisplayLabel.value = formatCaptureChordLabel(pressedPhysicalCodes, event);
    return;
  }

  if (pressedPhysicalCodes.size > 0) {
    if (!event) {
      captureDisplayLabel.value = recordedKeys.value
        ? formatShortcutKeys(recordedKeys.value)
        : '';
      return;
    }

    if (recordedKeys.value) {
      captureDisplayLabel.value = formatShortcutKeys(recordedKeys.value);
      return;
    }

    captureDisplayLabel.value = formatCaptureChordLabel(pressedPhysicalCodes, event);
    return;
  }

  if (recordedKeys.value) {
    captureDisplayLabel.value = formatShortcutKeys(recordedKeys.value);
    return;
  }

  captureDisplayLabel.value = '';
}

function resetCaptureKeyTracking() {
  pressedPhysicalCodes.clear();
  lastCaptureKeyboardEvent.value = null;
  captureDisplayLabel.value = '';
}

function refocusRecordControl() {
  nextTick(() => {
    recordButtonRef.value?.focus({ preventScroll: true });
  });
}

const MODIFIER_KEY_NAMES = new Set(['Control', 'Alt', 'Shift', 'Meta']);

function shouldStealShortcutCaptureEvent(event: KeyboardEvent): boolean {
  if (MODIFIER_KEY_NAMES.has(event.key)) {
    return true;
  }

  if (event.key === 'Tab') {
    return true;
  }

  return false;
}

function detachRecordCaptureListeners() {
  if (recordCaptureKeyDown) {
    window.removeEventListener('keydown', recordCaptureKeyDown, true);
    recordCaptureKeyDown = null;
  }

  if (recordCaptureKeyUp) {
    window.removeEventListener('keyup', recordCaptureKeyUp, true);
    recordCaptureKeyUp = null;
  }

  if (recordCaptureMouseDown) {
    window.removeEventListener('mousedown', recordCaptureMouseDown, true);
    recordCaptureMouseDown = null;
  }

  resetCaptureKeyTracking();
}

function canRecordMouseShortcut(): boolean {
  if (isEditingGlobalShortcut.value) return false;
  if (editingExtensionKeybinding.value?.scope === 'global') return false;

  return true;
}

function getMouseShortcutKey(button: number): string | null {
  if (button === 3) return 'MouseButton4';
  if (button === 4) return 'MouseButton5';

  return null;
}

function attachRecordCaptureListeners() {
  detachRecordCaptureListeners();

  recordCaptureKeyDown = (event: KeyboardEvent) => {
    if (!isDialogOpen.value || !isRecording.value) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      if (recordedKeys.value === null) {
        isDialogOpen.value = false;
      }
      else {
        isRecording.value = false;
      }

      return;
    }

    if (shouldStealShortcutCaptureEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (pressedPhysicalCodes.size === 0 && !event.repeat) {
      recordedKeys.value = null;
    }

    if (!shouldIgnorePhysicalCodeForCaptureTracking(event.code)) {
      pressedPhysicalCodes.add(event.code);
    }

    lastCaptureKeyboardEvent.value = event;
    updateCaptureDisplayLabel();
    refocusRecordControl();
  };

  recordCaptureKeyUp = (event: KeyboardEvent) => {
    if (!isDialogOpen.value || !isRecording.value) {
      return;
    }

    if (event.key === 'Escape') {
      return;
    }

    if (shouldStealShortcutCaptureEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    pressedPhysicalCodes.delete(event.code);
    lastCaptureKeyboardEvent.value = event;
    updateCaptureDisplayLabel();
    refocusRecordControl();
  };

  recordCaptureMouseDown = (event: MouseEvent) => {
    if (!isDialogOpen.value || !isRecording.value || !canRecordMouseShortcut()) {
      return;
    }

    const mainKey = getMouseShortcutKey(event.button);

    if (!mainKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    pressedPhysicalCodes.clear();
    lastCaptureKeyboardEvent.value = null;
    recordedKeys.value = {
      key: mainKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };
    captureDisplayLabel.value = formatShortcutKeys(recordedKeys.value);
    refocusRecordControl();
  };

  window.addEventListener('keydown', recordCaptureKeyDown, true);
  window.addEventListener('keyup', recordCaptureKeyUp, true);
  window.addEventListener('mousedown', recordCaptureMouseDown, true);
}

watch(
  [isDialogOpen, isRecording],
  () => {
    shortcutsStore.setShortcutCaptureActive(isDialogOpen.value && isRecording.value);

    if (isDialogOpen.value && isRecording.value) {
      attachRecordCaptureListeners();
    }
    else {
      detachRecordCaptureListeners();
    }
  },
  { flush: 'post' },
);

watch(recordedKeys, (keys) => {
  if (keys) {
    globalRegisterFailed.value = false;
  }

  updateCaptureDisplayLabel();
});

watch(isDialogOpen, (open) => {
  if (!open) {
    globalRegisterFailed.value = false;
  }
});

onUnmounted(() => {
  shortcutsStore.setShortcutCaptureActive(false);
  detachRecordCaptureListeners();
});

const isEditingGlobalShortcut = computed(() => editingGlobalShortcutId.value !== null);
const editingExtensionKeybinding = ref<{
  extensionId: string;
  commandId: string;
  commandTitle: string;
  scope: 'global' | 'local';
} | null>(null);

const isEditingExtension = computed(() => editingExtensionKeybinding.value !== null);

type ShortcutConflictRestore = () => Promise<void>;

const editingDefinition = computed(() => {
  if (editingGlobalShortcutId.value) {
    const globalDef = globalShortcutsStore.definitions.find(
      definitionItem => definitionItem.id === editingGlobalShortcutId.value,
    );

    if (globalDef) {
      return {
        id: globalDef.id,
        labelKey: globalDef.labelKey,
        isReadOnly: false,
      };
    }

    return null;
  }

  if (!editingAppShortcutDefinition.value) return null;
  return editingAppShortcutDefinition.value;
});

const currentEditingShortcutLabel = computed(() => {
  if (editingGlobalShortcutId.value) {
    return globalShortcutsStore.getShortcutLabel(editingGlobalShortcutId.value);
  }

  if (!editingAppShortcutDefinition.value) return '';
  return shortcutsStore.getShortcutBindingLabel(editingAppShortcutDefinition.value);
});

const recordedKeysLabel = computed(() => {
  if (!recordedKeys.value) return '';
  return formatShortcutKeys(recordedKeys.value);
});

function shortcutKeysMatch(firstKeys: ShortcutKeys, secondKeys: ShortcutKeys): boolean {
  return firstKeys.key.toLowerCase() === secondKeys.key.toLowerCase()
    && (firstKeys.ctrl || false) === (secondKeys.ctrl || false)
    && (firstKeys.alt || false) === (secondKeys.alt || false)
    && (firstKeys.shift || false) === (secondKeys.shift || false)
    && (firstKeys.meta || false) === (secondKeys.meta || false);
}

function createUnassignedShortcutKeys(): ShortcutKeys {
  return { key: '' };
}

async function contextUnassignShortcutBinding(definition: ShortcutDefinition): Promise<void> {
  await shortcutsStore.setShortcut(
    definition.id,
    createUnassignedShortcutKeys(),
    definition.bindingSlot ?? 0,
  );
}

async function contextAddAlternateShortcutBinding(definition: ShortcutDefinition): Promise<void> {
  await shortcutsStore.addUserAlternateChordBinding(definition.id, definition);
}

async function contextRemoveUserAlternateBinding(definition: ShortcutDefinition): Promise<void> {
  await shortcutsStore.removeUserAlternateChordBindingRow(definition.id, definition.bindingSlot ?? 0);
}

async function contextResetAppShortcutBinding(definition: ShortcutDefinition): Promise<void> {
  await shortcutsStore.resetShortcut(definition.id, definition.bindingSlot ?? 0);
}

async function contextResetGlobalShortcut(globalShortcutId: GlobalShortcutId): Promise<void> {
  await globalShortcutsStore.resetShortcut(globalShortcutId);
}

async function contextUnassignGlobalShortcut(globalShortcutId: GlobalShortcutId): Promise<void> {
  globalRegisterFailed.value = false;
  await globalShortcutsStore.unsetShortcut(globalShortcutId);
}

function shortcutKeysConflict(firstKeys: ShortcutKeys, secondKeys: ShortcutKeys): boolean {
  return Boolean(firstKeys.key && secondKeys.key) && shortcutKeysMatch(firstKeys, secondKeys);
}

function shortcutDefinitionsMatchSlot(
  firstDefinition: ShortcutDefinition,
  secondDefinition: ShortcutDefinition,
): boolean {
  return firstDefinition.id === secondDefinition.id
    && (firstDefinition.bindingSlot ?? 0) === (secondDefinition.bindingSlot ?? 0);
}

function findConflictingAppShortcuts(
  keys: ShortcutKeys,
  excludeDefinition?: ShortcutDefinition,
) {
  return shortcutsStore.definitions.filter((definition) => {
    if (excludeDefinition && shortcutDefinitionsMatchSlot(definition, excludeDefinition)) {
      return false;
    }

    return shortcutKeysConflict(shortcutsStore.resolveShortcutBindingKeys(definition), keys);
  });
}

function findConflictingGlobalAppShortcuts(
  keys: ShortcutKeys,
  excludeGlobalShortcutId?: GlobalShortcutId,
) {
  return globalShortcutsStore.definitions.filter((definition) => {
    if (definition.id === excludeGlobalShortcutId) {
      return false;
    }

    return shortcutKeysConflict(globalShortcutsStore.getShortcutKeys(definition.id), keys);
  });
}

function findConflictingExtensionKeybindings(
  keys: ShortcutKeys,
  excludeCommandId?: string,
) {
  return extensionKeybindings.value.filter((keybinding) => {
    if (keybinding.commandId === excludeCommandId) {
      return false;
    }

    return shortcutKeysConflict(keybinding.keys, keys);
  });
}

function findConflictingExtensionKeybinding(
  keys: ShortcutKeys,
  excludeCommandId?: string,
) {
  return findConflictingExtensionKeybindings(keys, excludeCommandId)[0] ?? null;
}

function findConflictingGlobalExtensionShortcuts(
  keys: ShortcutKeys,
  excludeCommandId?: string,
) {
  return globalExtensionShortcuts.value.filter((shortcut) => {
    if (shortcut.commandId === excludeCommandId) {
      return false;
    }

    return shortcutKeysConflict(shortcut.keys, keys);
  });
}

function findConflictingGlobalExtensionShortcut(
  keys: ShortcutKeys,
  excludeCommandId?: string,
) {
  return findConflictingGlobalExtensionShortcuts(keys, excludeCommandId)[0] ?? null;
}

const conflictLabel = computed(() => {
  if (!recordedKeys.value) return null;

  if (editingGlobalShortcutId.value) {
    const conflictingGlobalAppShortcut = findConflictingGlobalAppShortcuts(
      recordedKeys.value,
      editingGlobalShortcutId.value,
    )[0];

    if (conflictingGlobalAppShortcut) {
      return t(conflictingGlobalAppShortcut.labelKey);
    }

    const conflictingGlobalExtensionShortcut = findConflictingGlobalExtensionShortcut(recordedKeys.value);

    if (conflictingGlobalExtensionShortcut) {
      return `${conflictingGlobalExtensionShortcut.extensionName}: ${conflictingGlobalExtensionShortcut.commandTitle}`;
    }

    return null;
  }

  if (editingExtensionKeybinding.value?.scope === 'global') {
    const conflictingGlobalAppShortcut = findConflictingGlobalAppShortcuts(recordedKeys.value)[0];

    if (conflictingGlobalAppShortcut) {
      return t(conflictingGlobalAppShortcut.labelKey);
    }

    const conflictingGlobalExtensionShortcut = findConflictingGlobalExtensionShortcut(
      recordedKeys.value,
      editingExtensionKeybinding.value.commandId,
    );

    if (conflictingGlobalExtensionShortcut) {
      return `${conflictingGlobalExtensionShortcut.extensionName}: ${conflictingGlobalExtensionShortcut.commandTitle}`;
    }

    return null;
  }

  const conflictingAppShortcut = findConflictingAppShortcuts(
    recordedKeys.value,
    editingAppShortcutDefinition.value ?? undefined,
  )[0] ?? null;

  if (conflictingAppShortcut) {
    return t(conflictingAppShortcut.labelKey);
  }

  const conflictingExtensionKeybinding = findConflictingExtensionKeybinding(
    recordedKeys.value,
    editingExtensionKeybinding.value?.commandId,
  );

  if (conflictingExtensionKeybinding) {
    return `${conflictingExtensionKeybinding.extensionName}: ${conflictingExtensionKeybinding.commandTitle}`;
  }

  return null;
});

const hasConflict = computed(() => conflictLabel.value !== null);

function openShortcutEditor(definition: ShortcutDefinition) {
  if (definition.isReadOnly) return;

  editingAppShortcutDefinition.value = definition;
  editingExtensionKeybinding.value = null;
  editingGlobalShortcutId.value = null;
  recordedKeys.value = null;
  globalRegisterFailed.value = false;
  isRecording.value = true;
  isDialogOpen.value = true;

  nextTick(() => {
    focusRecordButton();
  });
}

function openGlobalShortcutEditor(globalShortcutId: GlobalShortcutId) {
  editingGlobalShortcutId.value = globalShortcutId;
  editingExtensionKeybinding.value = null;
  editingAppShortcutDefinition.value = null;
  recordedKeys.value = null;
  globalRegisterFailed.value = false;
  isRecording.value = true;
  isDialogOpen.value = true;

  nextTick(() => {
    focusRecordButton();
  });
}

function focusRecordButton() {
  recordButtonRef.value?.focus();
}

function startRecording() {
  isRecording.value = true;
  recordedKeys.value = null;
  globalRegisterFailed.value = false;
  resetCaptureKeyTracking();
  focusRecordButton();
}

function handleRecordKeyDown(event: KeyboardEvent) {
  const key = event.key;

  if (key === 'Escape') {
    if (isRecording.value && recordedKeys.value === null) {
      isDialogOpen.value = false;
    }
    else {
      isRecording.value = false;
    }

    return;
  }

  if (key === 'Tab') {
    return;
  }

  if (key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    return;
  }

  const mainKey = resolveShortcutKeyFromKeyboardEvent(event, {
    preferPhysicalMainKey: true,
  });

  if (mainKey === null) {
    return;
  }

  const keys: ShortcutKeys = {
    key: mainKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };

  recordedKeys.value = keys;
  lastCaptureKeyboardEvent.value = event;
  updateCaptureDisplayLabel();
}

async function saveShortcut(): Promise<boolean> {
  if (!recordedKeys.value || hasConflict.value) return false;

  if (editingGlobalShortcutId.value) {
    globalRegisterFailed.value = false;
    const registered = await globalShortcutsStore.setShortcut(
      editingGlobalShortcutId.value,
      recordedKeys.value,
    );

    if (!registered) {
      globalRegisterFailed.value = true;
      return false;
    }

    isDialogOpen.value = false;
    editingGlobalShortcutId.value = null;
    recordedKeys.value = null;
    return true;
  }

  if (!editingAppShortcutDefinition.value) return false;
  await shortcutsStore.setShortcut(
    editingAppShortcutDefinition.value.id,
    recordedKeys.value,
    editingAppShortcutDefinition.value.bindingSlot ?? 0,
  );
  isDialogOpen.value = false;
  editingAppShortcutDefinition.value = null;
  recordedKeys.value = null;
  return true;
}

async function resetAllShortcuts() {
  await shortcutsStore.resetAllShortcuts();
}

async function clearConflictingAppShortcuts(
  keys: ShortcutKeys,
  excludeDefinition?: ShortcutDefinition,
): Promise<ShortcutConflictRestore[]> {
  const conflictingShortcuts = findConflictingAppShortcuts(keys, excludeDefinition);
  const restoreActions: ShortcutConflictRestore[] = [];

  for (const shortcut of conflictingShortcuts) {
    const previousKeys = shortcutsStore.resolveShortcutBindingKeys(shortcut);
    const previousSource = shortcutsStore.getShortcutBindingSource(shortcut);
    restoreActions.push(async () => {
      if (previousSource === 'system') {
        await shortcutsStore.resetShortcut(shortcut.id, shortcut.bindingSlot ?? 0);
        return;
      }

      await shortcutsStore.setShortcut(shortcut.id, previousKeys, shortcut.bindingSlot ?? 0);
    });
    await shortcutsStore.setShortcut(
      shortcut.id,
      createUnassignedShortcutKeys(),
      shortcut.bindingSlot ?? 0,
    );
  }

  return restoreActions;
}

async function clearConflictingGlobalAppShortcuts(
  keys: ShortcutKeys,
  excludeGlobalShortcutId?: GlobalShortcutId,
): Promise<ShortcutConflictRestore[]> {
  const conflictingShortcuts = findConflictingGlobalAppShortcuts(keys, excludeGlobalShortcutId);
  const restoreActions: ShortcutConflictRestore[] = [];

  for (const shortcut of conflictingShortcuts) {
    const previousKeys = globalShortcutsStore.getShortcutKeys(shortcut.id);
    const previousSource = globalShortcutsStore.getSource(shortcut.id);
    restoreActions.push(async () => {
      if (previousSource === 'system') {
        await globalShortcutsStore.resetShortcut(shortcut.id);
        return;
      }

      await globalShortcutsStore.setShortcut(shortcut.id, previousKeys);
    });
    await globalShortcutsStore.unsetShortcut(shortcut.id);
  }

  return restoreActions;
}

async function clearConflictingLocalExtensionKeybindings(
  keys: ShortcutKeys,
  excludeCommandId?: string,
): Promise<ShortcutConflictRestore[]> {
  const conflictingKeybindings = findConflictingExtensionKeybindings(keys, excludeCommandId);
  const restoreActions: ShortcutConflictRestore[] = [];

  for (const keybinding of conflictingKeybindings) {
    const previousOverride = extensionsStorageStore.getKeybindingOverride(
      keybinding.extensionId,
      keybinding.commandId,
      'local',
    );
    restoreActions.push(async () => {
      if (previousOverride) {
        await extensionsStorageStore.setKeybindingOverride(keybinding.extensionId, previousOverride);
        extensionsStore.applyKeybindingOverride(keybinding.commandId, previousOverride.keys);
        return;
      }

      await extensionsStorageStore.removeKeybindingOverride(
        keybinding.extensionId,
        keybinding.commandId,
        'local',
      );
      extensionsStore.resetKeybindingOverride(keybinding.commandId);
    });

    const override: ExtensionKeybindingOverride = {
      commandId: keybinding.commandId,
      scope: 'local',
      keys: createUnassignedShortcutKeys(),
    };

    await extensionsStorageStore.setKeybindingOverride(keybinding.extensionId, override);
    extensionsStore.applyKeybindingOverride(keybinding.commandId, createUnassignedShortcutKeys());
  }

  return restoreActions;
}

async function clearConflictingGlobalExtensionShortcuts(
  keys: ShortcutKeys,
  excludeCommandId?: string,
): Promise<ShortcutConflictRestore[]> {
  const conflictingShortcuts = findConflictingGlobalExtensionShortcuts(keys, excludeCommandId);
  const restoreActions: ShortcutConflictRestore[] = [];

  for (const shortcut of conflictingShortcuts) {
    const previousOverride = extensionsStorageStore.getKeybindingOverride(
      shortcut.extensionId,
      shortcut.commandId,
      'global',
    );
    restoreActions.push(async () => {
      if (previousOverride) {
        await extensionsStorageStore.setKeybindingOverride(shortcut.extensionId, previousOverride);
      }
      else {
        await extensionsStorageStore.removeKeybindingOverride(
          shortcut.extensionId,
          shortcut.commandId,
          'global',
        );
      }

      await globalShortcutsStore.syncExtensionShortcuts();
    });

    const override: ExtensionKeybindingOverride = {
      commandId: shortcut.commandId,
      scope: 'global',
      keys: createUnassignedShortcutKeys(),
    };

    await extensionsStorageStore.setKeybindingOverride(shortcut.extensionId, override);
  }

  await globalShortcutsStore.syncExtensionShortcuts();
  return restoreActions;
}

async function clearConflictingShortcuts(keys: ShortcutKeys): Promise<ShortcutConflictRestore[]> {
  const restoreActions: ShortcutConflictRestore[] = [];

  if (editingGlobalShortcutId.value) {
    restoreActions.push(...await clearConflictingGlobalAppShortcuts(keys, editingGlobalShortcutId.value));
    restoreActions.push(...await clearConflictingGlobalExtensionShortcuts(keys));
    return restoreActions;
  }

  if (editingExtensionKeybinding.value?.scope === 'global') {
    restoreActions.push(...await clearConflictingGlobalAppShortcuts(keys));
    restoreActions.push(...await clearConflictingGlobalExtensionShortcuts(keys, editingExtensionKeybinding.value.commandId));
    return restoreActions;
  }

  restoreActions.push(...await clearConflictingAppShortcuts(keys, editingAppShortcutDefinition.value ?? undefined));
  restoreActions.push(...await clearConflictingLocalExtensionKeybindings(keys, editingExtensionKeybinding.value?.commandId));
  return restoreActions;
}

async function restoreClearedShortcuts(restoreActions: ShortcutConflictRestore[]): Promise<void> {
  for (const restoreAction of [...restoreActions].reverse()) {
    await restoreAction();
  }
}

async function replaceShortcut() {
  if (!recordedKeys.value || !hasConflict.value) return;

  const restoreActions = await clearConflictingShortcuts(recordedKeys.value);

  const saved = isEditingExtension.value
    ? await saveExtensionKeybinding()
    : await saveShortcut();

  if (!saved) {
    await restoreClearedShortcuts(restoreActions);
  }
}

function getConditionsLabelFromDefinition(definition: ShortcutDefinition): string {
  return formatConditionsLabel(definition.conditions);
}

function getShortcutBindingSourceLabel(definition: ShortcutDefinition): string {
  return shortcutsStore.getShortcutBindingSource(definition) === 'user'
    ? t('shortcutsUI.sourceUser')
    : t('shortcutsUI.sourceSystem');
}

function getGlobalSourceLabel(globalShortcutId: GlobalShortcutId): string {
  return globalShortcutsStore.getSource(globalShortcutId) === 'user' ? t('shortcutsUI.sourceUser') : t('shortcutsUI.sourceSystem');
}

function getShortcutBindingSourceIcon(definition: ShortcutDefinition): Component {
  return shortcutsStore.getShortcutBindingSource(definition) === 'user' ? UserIcon : SettingsIcon;
}

function isShortcutLabelAssigned(label: string): boolean {
  return label.trim().length > 0;
}

function openExtensionKeybindingEditor(extensionId: string, commandId: string, commandTitle: string) {
  editingExtensionKeybinding.value = {
    extensionId,
    commandId,
    commandTitle,
    scope: 'local',
  };
  editingAppShortcutDefinition.value = null;
  editingGlobalShortcutId.value = null;
  recordedKeys.value = null;
  globalRegisterFailed.value = false;
  isRecording.value = true;
  isDialogOpen.value = true;

  nextTick(() => {
    focusRecordButton();
  });
}

function openExtensionGlobalShortcutEditor(extensionId: string, commandId: string, commandTitle: string) {
  editingExtensionKeybinding.value = {
    extensionId,
    commandId,
    commandTitle,
    scope: 'global',
  };
  editingAppShortcutDefinition.value = null;
  editingGlobalShortcutId.value = null;
  recordedKeys.value = null;
  globalRegisterFailed.value = false;
  isRecording.value = true;
  isDialogOpen.value = true;

  nextTick(() => {
    focusRecordButton();
  });
}

async function saveExtensionKeybinding(): Promise<boolean> {
  if (!editingExtensionKeybinding.value || !recordedKeys.value || hasConflict.value) return false;

  if (editingExtensionKeybinding.value.scope === 'global') {
    globalRegisterFailed.value = false;
    const registered = await globalShortcutsStore.setExtensionShortcut(
      editingExtensionKeybinding.value.commandId,
      recordedKeys.value,
    );

    if (!registered) {
      globalRegisterFailed.value = true;
      return false;
    }
  }

  const override: ExtensionKeybindingOverride = {
    commandId: editingExtensionKeybinding.value.commandId,
    scope: editingExtensionKeybinding.value.scope,
    keys: recordedKeys.value,
  };

  await extensionsStorageStore.setKeybindingOverride(
    editingExtensionKeybinding.value.extensionId,
    override,
  );

  if (editingExtensionKeybinding.value.scope === 'local') {
    extensionsStore.applyKeybindingOverride(editingExtensionKeybinding.value.commandId, recordedKeys.value);
  }

  await globalShortcutsStore.syncExtensionShortcuts();

  isDialogOpen.value = false;
  editingExtensionKeybinding.value = null;
  recordedKeys.value = null;
  return true;
}

watch(isDialogOpen, (open) => {
  if (!open) {
    isRecording.value = false;
    recordedKeys.value = null;
    editingAppShortcutDefinition.value = null;
    editingGlobalShortcutId.value = null;
    editingExtensionKeybinding.value = null;
  }
});

watch(isDialogOpen, (open) => {
  if (open) {
    nextTick(() => {
      focusRecordButton();
    });
  }
});

const extensionsStore = useExtensionsStore();

async function resetExtensionKeybindingAt(
  extensionId: string,
  commandId: string,
  scope: 'local' | 'global',
): Promise<void> {
  await extensionsStorageStore.removeKeybindingOverride(extensionId, commandId, scope);

  if (scope === 'local') {
    extensionsStore.resetKeybindingOverride(commandId);
  }

  await globalShortcutsStore.syncExtensionShortcuts();
}

async function unassignExtensionKeybindingAt(
  extensionId: string,
  commandId: string,
  scope: 'local' | 'global',
): Promise<void> {
  const override: ExtensionKeybindingOverride = {
    commandId,
    scope,
    keys: createUnassignedShortcutKeys(),
  };
  await extensionsStorageStore.setKeybindingOverride(extensionId, override);

  if (scope === 'local') {
    extensionsStore.applyKeybindingOverride(commandId, createUnassignedShortcutKeys());
  }

  await globalShortcutsStore.syncExtensionShortcuts();
}

const extensionKeybindings = computed(() => {
  return extensionsStore.keybindings.map((keybinding) => {
    const commandIdWithoutPrefix = keybinding.commandId.replace(`${keybinding.extensionId}.`, '');

    const command = extensionsStore.commands.find(
      cmd => cmd.command.id === keybinding.commandId,
    );
    const contextMenuItem = extensionsStore.contextMenuItems.find(
      item => item.extensionId === keybinding.extensionId && item.item.id === keybinding.commandId,
    );

    const installed = extensionsStore.installedExtensions.find(
      ext => ext.id === keybinding.extensionId,
    );
    const extensionName = installed?.manifest?.name || keybinding.extensionId;

    let commandTitle = commandIdWithoutPrefix;

    if (command) {
      commandTitle = command.command.title;
    }
    else if (contextMenuItem) {
      commandTitle = contextMenuItem.item.title;
    }

    return {
      ...keybinding,
      commandTitle,
      extensionName,
      keybindingLabel: formatKeybindingKeys(keybinding.keys),
      whenLabel: keybinding.when || 'always',
    };
  });
});

const globalExtensionShortcuts = computed(() => {
  return globalShortcutsStore.extensionDefinitions.map(shortcut => ({
    ...shortcut,
    keybindingLabel: formatKeybindingKeys(shortcut.keys),
  }));
});
</script>

<template>
  <SettingsItem
    class="shortcuts-settings-item"
    :title="t('settingsTabs.shortcuts')"
    :icon="KeyboardIcon"
  >
    <template #title-suffix>
      <ConfirmButton
        variant="outline"
        size="sm"
        class="shortcuts-settings-item__reset-all"
        @click="resetAllShortcuts"
      >
        <RotateCcwIcon :size="14" />
        {{ t('resetAll') }}
      </ConfirmButton>
    </template>

    <div class="shortcuts-section">
      <div class="shortcuts-section__group">
        <div class="shortcuts-section__group-header">
          <div class="shortcuts-section__group-info">
            <h4 class="shortcuts-section__group-title">
              {{ t('shortcutsUI.globalShortcutsSystemScope') }}
            </h4>
            <p class="shortcuts-section__group-description">
              {{ t('shortcutsUI.globalShortcutsTriggerActionsWhenNotFocused') }}
            </p>
          </div>
        </div>

        <div class="shortcuts-table">
          <div class="shortcuts-table__header">
            <div class="shortcuts-table__header-cell shortcuts-table__cell--command">
              {{ t('command') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--keybinding">
              {{ t('keybinding') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--when" />
            <div class="shortcuts-table__header-cell shortcuts-table__cell--source">
              {{ t('source') }}
            </div>
          </div>

          <div class="shortcuts-table__body">
            <ContextMenu
              v-for="definition in globalShortcutsStore.definitions"
              :key="definition.id"
            >
              <ContextMenuTrigger as-child>
                <div
                  class="shortcuts-table__row"
                  @click="openGlobalShortcutEditor(definition.id)"
                >
                  <div class="shortcuts-table__cell shortcuts-table__cell--command">
                    <component
                      :is="globalShortcutIcons[definition.id]"
                      :size="14"
                      class="shortcuts-table__cell-icon"
                    />
                    <span class="shortcuts-table__cell-text">
                      {{ t(definition.labelKey) }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--keybinding">
                    <kbd
                      v-if="isShortcutLabelAssigned(globalShortcutsStore.getShortcutLabel(definition.id))"
                      class="shortcuts-table__kbd"
                    >
                      {{ globalShortcutsStore.getShortcutLabel(definition.id) }}
                    </kbd>
                    <span
                      v-else
                      class="shortcuts-keybinding-unassigned"
                    >
                      {{ unassignedShortcutLabel }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--when" />

                  <div class="shortcuts-table__cell shortcuts-table__cell--source">
                    <span
                      class="shortcuts-table__source"
                      :class="{
                        'shortcuts-table__source--user': globalShortcutsStore.getSource(definition.id) === 'user',
                        'shortcuts-table__source--system': globalShortcutsStore.getSource(definition.id) === 'system',
                      }"
                    >
                      <component
                        :is="globalShortcutsStore.getSource(definition.id) === 'user' ? UserIcon : SettingsIcon"
                        :size="12"
                      />
                      {{ getGlobalSourceLabel(definition.id) }}
                    </span>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent class="shortcuts-settings-context-menu">
                <ContextMenuItem @select="contextResetGlobalShortcut(definition.id)">
                  {{ t('shortcutsUI.resetShortcut') }}
                </ContextMenuItem>
                <ContextMenuItem @select="contextUnassignGlobalShortcut(definition.id)">
                  {{ t('shortcutsUI.unassignBinding') }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            <ContextMenu
              v-for="shortcut in globalExtensionShortcuts"
              :key="`${shortcut.extensionId}-${shortcut.commandId}`"
            >
              <ContextMenuTrigger as-child>
                <div
                  class="shortcuts-table__row"
                  @click="openExtensionGlobalShortcutEditor(shortcut.extensionId, shortcut.commandId, shortcut.commandTitle)"
                >
                  <div class="shortcuts-table__cell shortcuts-table__cell--command">
                    <BlocksIcon
                      :size="14"
                      class="shortcuts-table__cell-icon"
                    />
                    <span class="shortcuts-table__cell-text">
                      {{ shortcut.commandTitle }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--keybinding">
                    <kbd
                      v-if="isShortcutLabelAssigned(shortcut.keybindingLabel)"
                      class="shortcuts-table__kbd"
                    >
                      {{ shortcut.keybindingLabel }}
                    </kbd>
                    <span
                      v-else
                      class="shortcuts-keybinding-unassigned"
                    >
                      {{ unassignedShortcutLabel }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--when" />

                  <div class="shortcuts-table__cell shortcuts-table__cell--source">
                    <span
                      class="shortcuts-table__source"
                      :class="{
                        'shortcuts-table__source--user': shortcut.source === 'user',
                        'shortcuts-table__source--system': shortcut.source === 'system',
                      }"
                    >
                      <component
                        :is="shortcut.source === 'user' ? UserIcon : SettingsIcon"
                        :size="12"
                      />
                      {{ shortcut.extensionName }}
                    </span>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent class="shortcuts-settings-context-menu">
                <ContextMenuItem
                  @select="resetExtensionKeybindingAt(shortcut.extensionId, shortcut.commandId, 'global')"
                >
                  {{ t('shortcutsUI.resetShortcut') }}
                </ContextMenuItem>
                <ContextMenuItem
                  @select="unassignExtensionKeybindingAt(shortcut.extensionId, shortcut.commandId, 'global')"
                >
                  {{ t('shortcutsUI.unassignBinding') }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>
      </div>

      <div class="shortcuts-section__group">
        <div class="shortcuts-section__group-header">
          <div class="shortcuts-section__group-info">
            <h4 class="shortcuts-section__group-title">
              {{ t('shortcutsUI.localShortcutsAppScope') }}
            </h4>
          </div>
        </div>

        <div class="shortcuts-table">
          <div class="shortcuts-table__header">
            <div class="shortcuts-table__header-cell shortcuts-table__cell--command">
              {{ t('command') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--keybinding">
              {{ t('keybinding') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--when">
              {{ t('when') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--source">
              {{ t('source') }}
            </div>
          </div>

          <div class="shortcuts-table__body">
            <ContextMenu
              v-for="definition in shortcutsStore.definitions"
              :key="`${definition.id}-${definition.bindingSlot ?? 0}`"
            >
              <ContextMenuTrigger
                as-child
                :disabled="definition.isReadOnly"
              >
                <div
                  class="shortcuts-table__row"
                  :class="{
                    'shortcuts-table__row--readonly': definition.isReadOnly,
                    'shortcuts-table__row--alternate-chord': definition.alternateChordRow,
                  }"
                  @click="openShortcutEditor(definition)"
                >
                  <div class="shortcuts-table__cell shortcuts-table__cell--command">
                    <component
                      :is="shortcutIcons[definition.id]"
                      :size="14"
                      class="shortcuts-table__cell-icon"
                    />
                    <span class="shortcuts-table__cell-text">
                      {{ t(definition.labelKey) }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--keybinding">
                    <kbd
                      v-if="isShortcutLabelAssigned(shortcutsStore.getShortcutBindingLabel(definition))"
                      class="shortcuts-table__kbd"
                    >
                      {{ shortcutsStore.getShortcutBindingLabel(definition) }}
                    </kbd>
                    <span
                      v-else
                      class="shortcuts-keybinding-unassigned"
                    >
                      {{ unassignedShortcutLabel }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--when">
                    <Tooltip v-if="getConditionsLabelFromDefinition(definition)">
                      <TooltipTrigger as-child>
                        <code class="shortcuts-table__when-code">
                          {{ getConditionsLabelFromDefinition(definition) }}
                        </code>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <code class="shortcuts-table__when-tooltip-code">
                          {{ getConditionsLabelFromDefinition(definition) }}
                        </code>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--source">
                    <span
                      class="shortcuts-table__source"
                      :class="{
                        'shortcuts-table__source--user': shortcutsStore.getShortcutBindingSource(definition) === 'user',
                        'shortcuts-table__source--system': shortcutsStore.getShortcutBindingSource(definition) === 'system',
                      }"
                    >
                      <component
                        :is="getShortcutBindingSourceIcon(definition)"
                        :size="12"
                      />
                      {{ getShortcutBindingSourceLabel(definition) }}
                    </span>
                    <LockIcon
                      v-if="definition.isReadOnly"
                      :size="10"
                      class="shortcuts-table__lock-icon"
                    />
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent
                v-if="!definition.isReadOnly"
                class="shortcuts-settings-context-menu"
              >
                <ContextMenuItem @select="contextResetAppShortcutBinding(definition)">
                  {{ t('shortcutsUI.resetShortcut') }}
                </ContextMenuItem>
                <ContextMenuItem @select="contextUnassignShortcutBinding(definition)">
                  {{ t('shortcutsUI.unassignBinding') }}
                </ContextMenuItem>
                <ContextMenuItem @select="contextAddAlternateShortcutBinding(definition)">
                  {{ t('shortcutsUI.addAlternateBinding') }}
                </ContextMenuItem>
                <template v-if="definition.userDefinedAlternateChord">
                  <ContextMenuItem @select="contextRemoveUserAlternateBinding(definition)">
                    {{ t('shortcutsUI.removeAlternateBinding') }}
                  </ContextMenuItem>
                </template>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>
      </div>

      <template v-if="extensionKeybindings.length > 0">
        <div class="shortcuts-table shortcuts-table--extensions">
          <div class="shortcuts-table__section-header">
            <BlocksIcon :size="16" />
            <span>{{ t('settingsTabs.extensions') }}</span>
          </div>
          <div class="shortcuts-table__header">
            <div class="shortcuts-table__header-cell shortcuts-table__cell--command">
              {{ t('command') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--keybinding">
              {{ t('keybinding') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--when">
              {{ t('when') }}
            </div>
            <div class="shortcuts-table__header-cell shortcuts-table__cell--source">
              {{ t('source') }}
            </div>
          </div>

          <div class="shortcuts-table__body">
            <ContextMenu
              v-for="keybinding in extensionKeybindings"
              :key="`${keybinding.extensionId}-${keybinding.commandId}`"
            >
              <ContextMenuTrigger as-child>
                <div
                  class="shortcuts-table__row"
                  @click="openExtensionKeybindingEditor(keybinding.extensionId, keybinding.commandId, keybinding.commandTitle)"
                >
                  <div class="shortcuts-table__cell shortcuts-table__cell--command">
                    <BlocksIcon
                      :size="14"
                      class="shortcuts-table__cell-icon"
                    />
                    <span class="shortcuts-table__cell-text">
                      {{ keybinding.commandTitle }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--keybinding">
                    <kbd
                      v-if="isShortcutLabelAssigned(keybinding.keybindingLabel)"
                      class="shortcuts-table__kbd"
                    >
                      {{ keybinding.keybindingLabel }}
                    </kbd>
                    <span
                      v-else
                      class="shortcuts-keybinding-unassigned"
                    >
                      {{ unassignedShortcutLabel }}
                    </span>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--when">
                    <code class="shortcuts-table__when-code">
                      {{ keybinding.whenLabel }}
                    </code>
                  </div>

                  <div class="shortcuts-table__cell shortcuts-table__cell--source">
                    <span class="shortcuts-table__source shortcuts-table__source--extension">
                      <BlocksIcon :size="12" />
                      {{ keybinding.extensionName }}
                    </span>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent class="shortcuts-settings-context-menu">
                <ContextMenuItem
                  @select="resetExtensionKeybindingAt(keybinding.extensionId, keybinding.commandId, 'local')"
                >
                  {{ t('shortcutsUI.resetShortcut') }}
                </ContextMenuItem>
                <ContextMenuItem
                  @select="unassignExtensionKeybindingAt(keybinding.extensionId, keybinding.commandId, 'local')"
                >
                  {{ t('shortcutsUI.unassignBinding') }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>
      </template>

      <Dialog v-model:open="isDialogOpen">
        <DialogContent class="shortcut-editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {{ t('shortcutsUI.changeShortcut') }}
            </DialogTitle>
            <DialogDescription v-if="editingDefinition">
              {{ t(editingDefinition.labelKey) }}
            </DialogDescription>
            <DialogDescription v-else-if="editingExtensionKeybinding">
              {{ editingExtensionKeybinding.commandTitle }}
            </DialogDescription>
          </DialogHeader>

          <div class="shortcut-editor">
            <div
              v-if="!isEditingExtension"
              class="shortcut-editor__info-row"
            >
              <span class="shortcut-editor__label">
                {{ t('dialogs.shortcutEditorDialog.shortcut') }}:
              </span>
              <kbd
                v-if="isShortcutLabelAssigned(currentEditingShortcutLabel)"
                class="shortcut-editor__kbd"
              >
                {{ currentEditingShortcutLabel }}
              </kbd>
              <span
                v-else
                class="shortcuts-keybinding-unassigned"
              >
                {{ unassignedShortcutLabel }}
              </span>
            </div>

            <div
              v-if="!isEditingGlobalShortcut && editingAppShortcutDefinition && getConditionsLabelFromDefinition(editingAppShortcutDefinition)"
              class="shortcut-editor__info-row"
            >
              <span class="shortcut-editor__label">
                {{ t('when') }}:
              </span>
              <code class="shortcut-editor__when-code">
                {{ getConditionsLabelFromDefinition(editingAppShortcutDefinition) }}
              </code>
            </div>

            <div class="shortcut-editor__recording">
              <button
                ref="recordButtonRef"
                type="button"
                class="shortcut-editor__record-button"
                :class="{
                  'shortcut-editor__record-button--recording': isRecording && !recordedKeys,
                  'shortcut-editor__record-button--has-value': isRecording && recordedKeys,
                  'shortcut-editor__record-button--conflict': hasConflict || globalRegisterFailed,
                }"
                @click="startRecording"
                @keydown="handleRecordKeyDown"
              >
                <template v-if="isRecording">
                  <span
                    v-if="!captureDisplayLabel"
                    class="shortcut-editor__record-pulse"
                  />
                  <kbd
                    v-if="captureDisplayLabel"
                    class="shortcut-editor__recorded-kbd"
                  >
                    {{ captureDisplayLabel }}
                  </kbd>
                  <span
                    v-if="!captureDisplayLabel"
                    class="shortcut-editor__record-text"
                  >
                    {{ t('dialogs.shortcutEditorDialog.pressDesiredKeyCombination') }}
                  </span>
                </template>
                <kbd
                  v-else-if="recordedKeys"
                  class="shortcut-editor__recorded-kbd"
                >
                  {{ recordedKeysLabel }}
                </kbd>
                <span
                  v-else-if="!isRecording"
                  class="shortcut-editor__record-placeholder"
                >
                  {{ t('click') }}
                </span>
              </button>

              <div
                v-if="hasConflict && conflictLabel"
                class="shortcut-editor__conflict"
              >
                <AlertTriangleIcon :size="14" />
                <span>{{ t('conflict') }}: {{ conflictLabel }}</span>
              </div>

              <div
                v-if="globalRegisterFailed"
                class="shortcut-editor__conflict"
              >
                <AlertTriangleIcon :size="14" />
                <span>{{ t('shortcutsUI.globalShortcutRegisterFailed') }}</span>
              </div>

              <p
                v-if="isEditingGlobalShortcut && isRecording"
                class="shortcut-editor__global-capture-hint"
              >
                {{ t('shortcutsUI.shortcutRecorderGlobalCaptureHint') }}
              </p>
            </div>
          </div>

          <div class="shortcut-editor-dialog__footer">
            <Button
              v-if="hasConflict"
              variant="outline"
              class="shortcut-editor-dialog__replace-button"
              :disabled="!recordedKeys"
              @click="replaceShortcut"
            >
              {{ t('conflictDialog.replace') }}
            </Button>
            <Button
              v-if="!hasConflict"
              :disabled="!recordedKeys"
              @click="isEditingExtension ? saveExtensionKeybinding() : saveShortcut()"
            >
              {{ t('save') }}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </SettingsItem>
</template>

<style scoped>
.shortcuts-settings-item :deep(.settings-view-item__main) {
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  gap: 0;
}

.shortcuts-settings-item :deep(.settings-view-item__header) {
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  margin: 0;
  gap: 1rem;
}

.shortcuts-settings-item :deep(.settings-view-item__header > div:last-child) {
  min-width: 0;
  flex: 1;
}

.shortcuts-settings-item :deep(.settings-view-item__title-row) {
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.shortcuts-settings-item :deep(.settings-view-item__content) {
  min-width: 0;
  padding: 0;
}

.shortcuts-settings-item__reset-all {
  gap: 8px;
}

.shortcuts-section {
  display: flex;
  flex-direction: column;
}

.shortcuts-section__group-header {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  gap: 0.75rem;
}

.shortcuts-section__group-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
}

.shortcuts-section__group-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.shortcuts-section__group-title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 1rem;
  font-weight: 600;
}

.shortcuts-section__group-description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  line-height: 1.4;
}

.shortcuts-table {
  display: flex;
  width: 100%;
  flex-direction: column;
}

.shortcuts-table--extensions {
  border-top: 1px solid hsl(var(--border));
  margin-top: 1rem;
}

.shortcuts-table__section-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: hsl(var(--muted) / 20%);
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.5rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.shortcuts-table__header {
  display: grid;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 30%);
  font-size: 0.75rem;
  font-weight: 600;
  grid-template-columns: minmax(140px, 1fr) 140px 160px 100px;
  text-transform: uppercase;
}

.shortcuts-table__header-cell {
  padding: 0.5rem 1rem;
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__body {
  display: flex;
  flex-direction: column;
}

.shortcuts-table__row {
  display: grid;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  cursor: pointer;
  grid-template-columns: minmax(140px, 1fr) 140px 160px 100px;
  transition: background-color 0.1s ease;
}

.shortcuts-table__row:hover {
  background-color: hsl(var(--muted) / 30%);
}

.shortcuts-table__row--readonly {
  cursor: not-allowed;
  opacity: 0.7;
}

.shortcuts-table__row--alternate-chord {
  background-color: hsl(var(--muted) / 30%);
}

.shortcuts-table__row--readonly:hover {
  background-color: transparent;
}

.shortcuts-table__cell {
  display: flex;
  align-items: center;
  padding: 0.625rem 1rem;
  gap: 0.5rem;
}

.shortcuts-table__cell--command {
  overflow: hidden;
  min-width: 0;
  align-items: flex-start;
}

.shortcuts-table__cell-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__cell-text {
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  -webkit-box-orient: vertical;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.shortcuts-keybinding-unassigned {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.shortcuts-table__kbd {
  padding: 0.125rem 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.75rem;
}

.shortcuts-table__when-code {
  overflow: hidden;
  max-width: 140px;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  cursor: help;
  font-family: monospace;
  font-size: 0.625rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcuts-table__when-tooltip-code {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.75rem;
  white-space: nowrap;
}

.shortcuts-table__source {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  gap: 0.25rem;
}

.shortcuts-table__source--system {
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__source--user {
  color: hsl(var(--primary));
}

.shortcuts-table__source--extension {
  color: hsl(var(--muted-foreground));
}

.shortcuts-table__lock-icon {
  flex-shrink: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
}

.shortcut-editor {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  gap: 1rem;
}

.shortcut-editor__info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shortcut-editor__label {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.shortcut-editor__kbd {
  padding: 0.25rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.875rem;
}

.shortcut-editor__when-code {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: hsl(var(--muted) / 50%);
  color: hsl(var(--muted-foreground));
  font-family: monospace;
  font-size: 0.75rem;
}

.shortcut-editor__recording {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-editor__record-button {
  position: relative;
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 2px dashed hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 30%);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-family: monospace;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.15s ease;
}

.shortcut-editor__record-button:hover {
  border-color: hsl(var(--primary) / 50%);
  background-color: hsl(var(--muted) / 50%);
}

.shortcut-editor__record-button:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 20%);
}

.shortcut-editor__record-button--recording {
  border-style: solid;
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.shortcut-editor__record-button--has-value {
  border-style: solid;
  border-color: hsl(var(--success) / 50%);
  background-color: hsl(var(--success) / 10%);
}

.shortcut-editor__record-button--conflict {
  border-color: hsl(var(--dangerous));
  background-color: hsl(var(--dangerous) / 10%);
}

.shortcut-editor__record-pulse {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
  background-color: hsl(var(--primary));
  inset: 8px 8px auto auto;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.shortcut-editor__recorded-kbd {
  padding: 0.5rem 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 1rem;
  font-weight: 500;
}

.shortcut-editor__record-text {
  font-size: 0.75rem;
}

.shortcut-editor__global-capture-hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  line-height: 1.4;
}

.shortcut-editor__record-placeholder {
  font-size: 0.875rem;
}

.shortcut-editor__conflict {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: var(--radius);
  background-color: hsl(var(--dangerous) / 15%);
  color: hsl(var(--dangerous));
  font-size: 0.75rem;
  gap: 0.5rem;
}

.shortcut-editor-dialog {
  max-width: 400px;
}

.shortcut-editor-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid hsl(var(--border));
  margin-top: 0.5rem;
  gap: 0.5rem;
}

.shortcut-editor-dialog__replace-button.sigma-ui-button {
  border-color: hsl(var(--destructive));
  color: hsl(var(--destructive));
}

.shortcut-editor-dialog__replace-button.sigma-ui-button:hover {
  background-color: hsl(var(--destructive) / 12%);
  color: hsl(var(--destructive));
}
</style>
