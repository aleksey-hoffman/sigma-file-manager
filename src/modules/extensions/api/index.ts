// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type { SigmaExtensionAPI } from '@sigma-file-manager/api';

export {
  initPlatformInfo,
  getPlatformInfo,
  ensurePlatformInfo,
} from '@/modules/extensions/api/platform';

export {
  extensionDialogState,
  showExtensionDialog,
  closeExtensionDialog,
} from '@/modules/extensions/api/dialog-state';

export type { SettingsChangeCallback } from '@/modules/extensions/api/configuration';
export {
  registerExtensionConfiguration,
  getExtensionConfiguration,
  getAllExtensionConfigurations,
  notifySettingsChange,
} from '@/modules/extensions/api/configuration';

export type {
  ContextMenuRegistration,
  SidebarRegistration,
  ToolbarRegistration,
  CommandRegistration,
} from '@/modules/extensions/api/registrations';
export type { KeybindingRegistration } from '@/modules/extensions/api/keybindings';
export {
  getContextMenuRegistrations,
  getSidebarRegistrations,
  getToolbarRegistrations,
  getCommandRegistrations,
  clearAllRegistrations,
  clearExtensionRegistrations,
} from '@/modules/extensions/api/registrations';

export {
  getKeybindingRegistrations,
  setAppKeybindingConflictChecker,
  parseKeybindingString,
  formatKeybindingKeys,
  getKeybindingParts,
  registerExtensionKeybindings,
  getKeybindingForCommand,
  getKeybindingForContextMenuItem,
} from '@/modules/extensions/api/keybindings';

export {
  getBinaryDownloadCount,
  clearBinaryDownloadCount,
} from '@/modules/extensions/api/binary-download-counts';

export { createExtensionAPI } from '@/modules/extensions/api/create-extension-api';
