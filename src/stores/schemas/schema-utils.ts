// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type StorageAdapter = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  save: () => Promise<void>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeSchemaVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  return 0;
}

export async function migrateStorageSchema(params: {
  storage: StorageAdapter;
  schemaVersionKey: string;
  latestSchemaVersion: number;
  migrateStep: (storage: StorageAdapter, fromVersion: number, toVersion: number) => Promise<void>;
}) {
  const {
    storage,
    schemaVersionKey,
    latestSchemaVersion,
    migrateStep,
  } = params;

  const storedSchemaVersionValue = await storage.get<unknown>(schemaVersionKey);
  const normalizedStoredSchemaVersion = normalizeSchemaVersion(storedSchemaVersionValue);
  let storedSchemaVersion = normalizedStoredSchemaVersion;
  storedSchemaVersion = Math.min(storedSchemaVersion, latestSchemaVersion);

  let didMigrate = false;

  while (storedSchemaVersion < latestSchemaVersion) {
    const nextSchemaVersion = storedSchemaVersion + 1;
    await migrateStep(storage, storedSchemaVersion, nextSchemaVersion);
    storedSchemaVersion = nextSchemaVersion;
    didMigrate = true;
  }

  const shouldPersistSchemaVersion = didMigrate || normalizedStoredSchemaVersion !== latestSchemaVersion;

  if (shouldPersistSchemaVersion) {
    await storage.set(schemaVersionKey, latestSchemaVersion);
    await storage.save();
  }
}

export function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function clampIndex(value: number, maxIndex: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (maxIndex < 0) {
    return 0;
  }

  return Math.min(Math.max(0, Math.floor(value)), maxIndex);
}

export function collectNestedRecordPaths(schema: unknown): Set<string> {
  const keys = new Set<string>();

  function traverse(node: unknown, pathPrefix: string) {
    if (!isRecord(node)) {
      return;
    }

    for (const [key, childValue] of Object.entries(node)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      keys.add(nextPath);
      traverse(childValue, nextPath);
    }
  }

  traverse(schema, '');

  return keys;
}
