// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export {
  loadExtensionRuntime,
  unloadExtensionRuntime,
  getLoadedRuntime,
  getAllLoadedRuntimes,
  isExtensionTypeSupported,
  type LoadedExtensionRuntime,
} from './loader';

export {
  createSandbox,
  createSandboxedFunction,
  validateExtensionCode,
  freezeObject,
  type ExtensionSandbox,
} from './sandbox';
