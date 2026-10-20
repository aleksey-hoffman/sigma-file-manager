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

// 假沙箱（createSandbox / createSandboxedFunction）已删除：它们与宿主共用同一
// realm 的内建对象，挡不住 `Object['con' + 'structor']` 这类绕法，留着只给
// 虚假的安全感。真正的隔离边界是 Web Worker 与 sandboxed iframe。
export {
  validateExtensionCode,
  freezeObject,
  type ExtensionSandbox,
} from './sandbox';
