// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  BinaryInfo,
  ContextMenuContext,
  ExtensionActivationContext,
  ExtensionActivationEvent,
  ExtensionCommand,
  ExtensionContextMenuItem,
  ExtensionKeybindingWhen,
  ExtensionManifest,
  ExtensionScopedDirectory,
  ExtensionSidebarItem,
  ExtensionToolbarDropdown,
} from '@sigma-file-manager/api';

export type * from '@sigma-file-manager/api';

export type ExtensionRegistryEntry = {
  id: string;
  name: string;
  description: string;
  publisher: string;
  publisherUrl: string;
  repository: string;
  featured: boolean;
  categories: string[];
  tags?: string[];
  integrity?: string;
  releaseMetadata?: Record<string, {
    integrity?: string;
    manifest?: string;
  }>;
};

export type ExtensionRegistry = {
  schemaVersion: string;
  extensions: ExtensionRegistryEntry[];
};

export type ExtensionKeybindingOverride = {
  commandId: string;
  keys: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    key: string;
  };
};

export type ExtensionSettings = {
  scopedDirectories: ExtensionScopedDirectory[];
  customSettings?: Record<string, unknown>;
  configurationValues?: Record<string, unknown>;
  keybindingOverrides?: ExtensionKeybindingOverride[];
};

export type InstalledExtension = {
  id: string;
  version: string;
  enabled: boolean;
  autoUpdate: boolean;
  installedAt: number;
  manifest: ExtensionManifest;
  settings: ExtensionSettings;
  registryEntry?: ExtensionRegistryEntry;
  isLocal?: boolean;
  localSourcePath?: string;
  installPendingDependencies?: boolean;
};

export type ExtensionLoadState = 'unloaded' | 'loading' | 'loaded' | 'error';

export type ExtensionActivateContext = ExtensionActivationContext;

export type ExtensionInstance = {
  activate: (context?: ExtensionActivateContext) => Promise<void> | void;
  deactivate: () => Promise<void> | void;
};

export type LoadedExtension = {
  id: string;
  state: ExtensionLoadState;
  activationEvent?: ExtensionActivationEvent;
  error?: string;
  instance?: ExtensionInstance;
};

export type InstalledExtensionData = {
  version: string;
  enabled: boolean;
  autoUpdate: boolean;
  installedAt: number;
  manifest: ExtensionManifest;
  settings: ExtensionSettings;
  isLocal?: boolean;
  localSourcePath?: string;
  installPendingDependencies?: boolean;
};

export type SharedBinaryInfo = BinaryInfo & {
  usedBy: string[];
};

export type ExtensionStorageData = {
  installedExtensions: Record<string, InstalledExtensionData>;
  sharedBinaries: Record<string, SharedBinaryInfo>;
  registryCache?: {
    data: ExtensionRegistry;
    fetchedAt: number;
  };
  recentCommandIds?: string[];
};

export type ContextMenuItemRegistration = {
  extensionId: string;
  item: ExtensionContextMenuItem;
  handler: (context: ContextMenuContext) => Promise<void> | void;
};

export type SidebarPageRegistration = {
  extensionId: string;
  page: ExtensionSidebarItem;
  component?: unknown;
  url?: string;
};

export type ToolbarDropdownRegistration = {
  extensionId: string;
  dropdown: ExtensionToolbarDropdown;
  handlers: Record<string, () => Promise<void> | void>;
};

export type CommandRegistration = {
  extensionId: string;
  command: ExtensionCommand;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
};

export type ExtensionKeybindingRegistration = {
  extensionId: string;
  commandId: string;
  keys: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    key: string;
  };
  when?: ExtensionKeybindingWhen;
};

export type ModalSubmitCallback = (values: Record<string, unknown>, buttonId: string) => void | boolean | Promise<void | boolean>;
export type ModalCloseCallback = () => void;
export type ModalValueChangeCallback = (elementId: string, value: unknown, allValues: Record<string, unknown>) => void;
