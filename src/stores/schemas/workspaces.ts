// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import uniqueId from '@/utils/unique-id';
import type {
  Workspace,
  Tab,
  TabGroup,
  TabAction,
} from '@/types/workspaces';
import type { StorageAdapter } from './schema-utils';
import {
  clampIndex,
  getBoolean,
  getNumber,
  getString,
  isRecord,
  migrateStorageSchema,
} from './schema-utils';

export const WORKSPACES_SCHEMA_VERSION_KEY = '__schemaVersion';
export const WORKSPACES_SCHEMA_VERSION = 1;

function parseTabType(value: unknown): Tab['type'] {
  if (value === 'directory' || value === 'file' || value === 'search') {
    return value;
  }

  return 'directory';
}

function parseTab(tabValue: unknown): Tab | null {
  if (!isRecord(tabValue)) {
    return null;
  }

  const tabPath = getString(tabValue.path, '');

  if (!tabPath) {
    return null;
  }

  const tabId = getString(tabValue.id, uniqueId());
  const tabName = getString(tabValue.name, '');

  return {
    id: tabId,
    name: tabName || tabPath,
    path: tabPath,
    type: parseTabType(tabValue.type),
    paneWidth: getNumber(tabValue.paneWidth, 100),
    filterQuery: getString(tabValue.filterQuery, ''),
    dirEntries: [],
    selectedDirEntries: [],
  };
}

function parseTabGroup(tabGroupValue: unknown): TabGroup | null {
  if (!Array.isArray(tabGroupValue)) {
    return null;
  }

  const parsedTabs: Tab[] = [];

  for (const tabValue of tabGroupValue) {
    const parsedTab = parseTab(tabValue);

    if (parsedTab) {
      parsedTabs.push(parsedTab);
    }
  }

  if (parsedTabs.length === 0) {
    return null;
  }

  return parsedTabs;
}

function parseTabGroups(tabGroupsValue: unknown): TabGroup[] {
  if (!Array.isArray(tabGroupsValue)) {
    return [];
  }

  const parsedTabGroups: TabGroup[] = [];

  for (const tabGroupValue of tabGroupsValue) {
    const parsedTabGroup = parseTabGroup(tabGroupValue);

    if (parsedTabGroup) {
      parsedTabGroups.push(parsedTabGroup);
    }
  }

  return parsedTabGroups;
}

function parseTabActions(actionsValue: unknown): TabAction[] {
  if (!Array.isArray(actionsValue)) {
    return [];
  }

  const parsedActions: TabAction[] = [];

  for (const actionValue of actionsValue) {
    if (!isRecord(actionValue)) {
      continue;
    }

    const name = getString(actionValue.name, '');
    const path = getString(actionValue.path, '');

    if (!name || !path) {
      continue;
    }

    parsedActions.push({
      name,
      path,
    });
  }

  return parsedActions;
}

export function parseWorkspaces(workspacesValue: unknown): Workspace[] | null {
  if (!Array.isArray(workspacesValue) || workspacesValue.length === 0) {
    return null;
  }

  const parsedWorkspaces: Workspace[] = [];

  for (const workspaceValue of workspacesValue) {
    if (!isRecord(workspaceValue)) {
      continue;
    }

    const tabGroups = parseTabGroups(workspaceValue.tabGroups);

    if (tabGroups.length === 0) {
      continue;
    }

    const tabGroupMaxIndex = tabGroups.length - 1;
    const tabGroupIndex = clampIndex(getNumber(workspaceValue.currentTabGroupIndex, 0), tabGroupMaxIndex);
    const currentGroup = tabGroups[tabGroupIndex] ?? tabGroups[0];
    const tabMaxIndex = Math.max(0, (currentGroup?.length ?? 1) - 1);
    const tabIndex = clampIndex(getNumber(workspaceValue.currentTabIndex, 0), tabMaxIndex);

    parsedWorkspaces.push({
      id: getNumber(workspaceValue.id, 0),
      isPrimary: getBoolean(workspaceValue.isPrimary, false),
      isCurrent: getBoolean(workspaceValue.isCurrent, false),
      name: getString(workspaceValue.name, 'primary'),
      actions: parseTabActions(workspaceValue.actions),
      tabGroups,
      currentTabGroupIndex: tabGroupIndex,
      currentTabIndex: tabIndex,
    });
  }

  if (parsedWorkspaces.length === 0) {
    return null;
  }

  const primaryWorkspaceIndex = Math.max(0, parsedWorkspaces.findIndex(workspace => workspace.isPrimary));
  const currentWorkspaceIndexRaw = parsedWorkspaces.findIndex(workspace => workspace.isCurrent);
  const currentWorkspaceIndex = currentWorkspaceIndexRaw === -1 ? primaryWorkspaceIndex : currentWorkspaceIndexRaw;

  return parsedWorkspaces.map((workspace, index) => ({
    ...workspace,
    isPrimary: index === primaryWorkspaceIndex,
    isCurrent: index === currentWorkspaceIndex,
  }));
}

async function migrateWorkspacesStep(storage: StorageAdapter, fromVersion: number, toVersion: number) {
  if (fromVersion === 0 && toVersion === 1) {
    return;
  }

  void storage;
}

export async function migrateWorkspacesStorage(storage: StorageAdapter) {
  await migrateStorageSchema({
    storage,
    schemaVersionKey: WORKSPACES_SCHEMA_VERSION_KEY,
    latestSchemaVersion: WORKSPACES_SCHEMA_VERSION,
    migrateStep: migrateWorkspacesStep,
  });
}
