// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionManifest,
  ExtensionActivationEvent,
  ExtensionRegistryEntry,
} from '@/types/extension';
import { getPlatformInfo } from '@/modules/extensions/api';
import { i18n } from '@/localization';

export function getActivationEvents(manifest: ExtensionManifest): ExtensionActivationEvent[] {
  if (!manifest.activationEvents || manifest.activationEvents.length === 0) {
    return ['onStartup'];
  }

  return manifest.activationEvents;
}

export type CommandIdParts = {
  fullCommandId: string;
  shortCommandId: string;
};

export function getCommandIdParts(extensionId: string, commandId: string): CommandIdParts {
  const fullCommandId = commandId.includes('.') ? commandId : `${extensionId}.${commandId}`;
  const prefix = `${extensionId}.`;
  const shortCommandId = fullCommandId.startsWith(prefix)
    ? fullCommandId.slice(prefix.length)
    : commandId;

  return {
    fullCommandId,
    shortCommandId,
  };
}

export function matchesCommandActivationEvent(
  activationEvents: ExtensionActivationEvent[],
  extensionId: string,
  commandId: string,
): boolean {
  const { fullCommandId, shortCommandId } = getCommandIdParts(extensionId, commandId);
  const fullEvent = `onCommand:${fullCommandId}` as ExtensionActivationEvent;
  const shortEvent = `onCommand:${shortCommandId}` as ExtensionActivationEvent;
  return activationEvents.includes(fullEvent) || activationEvents.includes(shortEvent);
}

export function shouldActivateForEvent(
  manifest: ExtensionManifest,
  extensionId: string,
  activationEvent: ExtensionActivationEvent,
): boolean {
  const activationEvents = getActivationEvents(manifest);

  if (activationEvent.startsWith('onCommand:')) {
    const commandId = activationEvent.slice('onCommand:'.length);
    return matchesCommandActivationEvent(activationEvents, extensionId, commandId);
  }

  return activationEvents.includes(activationEvent);
}

export function shouldActivateOnStartup(manifest: ExtensionManifest): boolean {
  const activationEvents = getActivationEvents(manifest);
  return activationEvents.includes('onStartup');
}

export function isManifestCompatibleWithPlatform(manifest: ExtensionManifest): boolean {
  if (!manifest.platforms || manifest.platforms.length === 0) {
    return true;
  }

  const currentOS = getPlatformInfo().os;
  return manifest.platforms.includes(currentOS);
}

export function assertManifestPlatformCompatibility(manifest: ExtensionManifest): void {
  if (isManifestCompatibleWithPlatform(manifest)) {
    return;
  }

  const currentOS = getPlatformInfo().os;
  const supported = manifest.platforms!.join(', ');
  throw new Error(
    i18n.global.t('extensions.platformIncompatible', {
      current: currentOS,
      supported,
    }),
  );
}

export function getRegistryIntegrity(
  registryEntry: ExtensionRegistryEntry,
  version: string,
): string | undefined {
  const versionMetadata = registryEntry.releaseMetadata?.[version];
  return versionMetadata?.integrity ?? registryEntry.integrity;
}

const blockingCommandActivationEvents = new Set<ExtensionActivationEvent>([
  'onStartup',
  'onInstall',
  'onUpdate',
  'onEnable',
]);

export function shouldBlockCommandsForActivationEvent(
  activationEvent?: ExtensionActivationEvent,
): boolean {
  return activationEvent !== undefined && blockingCommandActivationEvents.has(activationEvent);
}

export function cloneSerializableValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
