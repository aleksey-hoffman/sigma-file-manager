// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionContextMenuItem,
  ExtensionSidebarItem,
  ExtensionToolbarDropdown,
  ExtensionCommand,
  ContextMenuContext,
  Disposable,
} from '@/types/extension';
import { clearExtensionContextListeners } from '@/modules/extensions/context';
import {
  clearKeybindingRegistrationsForExtension,
  clearAllKeybindingRegistrations,
} from '@/modules/extensions/api/keybindings';
import {
  deleteExtensionConfiguration,
  clearExtensionConfigurations,
  clearAllSettingsChangeListeners,
} from '@/modules/extensions/api/configuration';

export type ContextMenuRegistration = {
  extensionId: string;
  item: ExtensionContextMenuItem;
  handler: (context: ContextMenuContext) => Promise<void> | void;
};

export type SidebarRegistration = {
  extensionId: string;
  page: ExtensionSidebarItem;
};

export type ToolbarRegistration = {
  extensionId: string;
  dropdown: ExtensionToolbarDropdown;
  handlers: Record<string, () => Promise<void> | void>;
};

export type CommandRegistration = {
  extensionId: string;
  command: ExtensionCommand;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
};

const contextMenuRegistrations: ContextMenuRegistration[] = [];
const sidebarRegistrations: SidebarRegistration[] = [];
const toolbarRegistrations: ToolbarRegistration[] = [];
const commandRegistrations: CommandRegistration[] = [];

export function addContextMenuRegistration(registration: ContextMenuRegistration): Disposable {
  contextMenuRegistrations.push(registration);
  return {
    dispose: () => {
      const index = contextMenuRegistrations.indexOf(registration);

      if (index !== -1) {
        contextMenuRegistrations.splice(index, 1);
      }
    },
  };
}

export function addSidebarRegistration(registration: SidebarRegistration): Disposable {
  sidebarRegistrations.push(registration);
  return {
    dispose: () => {
      const index = sidebarRegistrations.indexOf(registration);

      if (index !== -1) {
        sidebarRegistrations.splice(index, 1);
      }
    },
  };
}

export function addToolbarRegistration(registration: ToolbarRegistration): Disposable {
  toolbarRegistrations.push(registration);
  return {
    dispose: () => {
      const index = toolbarRegistrations.indexOf(registration);

      if (index !== -1) {
        toolbarRegistrations.splice(index, 1);
      }
    },
  };
}

export function addCommandRegistration(registration: CommandRegistration): Disposable {
  commandRegistrations.push(registration);
  return {
    dispose: () => {
      const index = commandRegistrations.indexOf(registration);

      if (index !== -1) {
        commandRegistrations.splice(index, 1);
      }
    },
  };
}

export function getContextMenuRegistrations(): ContextMenuRegistration[] {
  return [...contextMenuRegistrations];
}

export function getSidebarRegistrations(): SidebarRegistration[] {
  return [...sidebarRegistrations];
}

export function getToolbarRegistrations(): ToolbarRegistration[] {
  return [...toolbarRegistrations];
}

export function getCommandRegistrations(): CommandRegistration[] {
  return [...commandRegistrations];
}

export function findCommandRegistration(commandId: string): CommandRegistration | undefined {
  return commandRegistrations.find(reg => reg.command.id === commandId);
}

export function clearAllRegistrations(): void {
  contextMenuRegistrations.length = 0;
  sidebarRegistrations.length = 0;
  toolbarRegistrations.length = 0;
  commandRegistrations.length = 0;
  clearAllKeybindingRegistrations();
  clearAllSettingsChangeListeners();
  clearExtensionConfigurations();
}

export function clearExtensionActivationRegistrations(extensionId: string): void {
  clearExtensionContextListeners(extensionId);

  for (let registrationIndex = contextMenuRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (contextMenuRegistrations[registrationIndex].extensionId === extensionId) {
      contextMenuRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = sidebarRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (sidebarRegistrations[registrationIndex].extensionId === extensionId) {
      sidebarRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = toolbarRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (toolbarRegistrations[registrationIndex].extensionId === extensionId) {
      toolbarRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = commandRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (commandRegistrations[registrationIndex].extensionId === extensionId) {
      commandRegistrations.splice(registrationIndex, 1);
    }
  }
}

export function clearExtensionRegistrations(extensionId: string): void {
  clearExtensionActivationRegistrations(extensionId);
  clearKeybindingRegistrationsForExtension(extensionId);
  deleteExtensionConfiguration(extensionId);
}
