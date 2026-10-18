// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  getAddressBarSegments,
  isUncPath,
  isUnixFilesystemRoot,
  canonicalizePath,
} from '@/utils/normalize-path';
import {
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  LOCATIONS_VIRTUAL_PATH,
  shouldPrependLocationsCrumb,
} from '@/utils/virtual-locations';
import {
  buildRemoteConnectionPath,
  buildRemotePath,
  isRemotePath,
  parseRemotePath,
  REMOTE_SCHEME,
} from '@/utils/remote-paths';

export type AddressBarPart = {
  path: string;
  name: string;
  isLast: boolean;
  disableDropTarget?: boolean;
  displayRootIcon?: boolean;
  useLocationsDropdown?: boolean;
};

/**
 * 远程面包屑需要的额外上下文。
 *
 * **刻意做成参数而不是在模块里读 store**：`buildAddressBarParts` 至今是一个纯函数，
 * 它的单测不装 pinia、不建 Tauri 桩。连接名一旦从这里自己去拿 store，
 * 这些测试就得整套重写 —— 而面包屑的判别点（路径拼得对不对）跟连接名从哪来无关。
 */
export interface RemoteBreadcrumbContext {
  /** `sfm://remote` 那一级的显示名（i18n）。 */
  rootLabel: string;
  /** 连接 id → 连接名。查不到时退回 id 本身。 */
  connectionNames: Record<string, string>;
}

const NO_REMOTE_CONTEXT: RemoteBreadcrumbContext = {
  rootLabel: REMOTE_SCHEME,
  connectionNames: {},
};

/**
 * FORK-MODIFICATION 2026-10-18：远程面包屑（阶段 2 需求 1）。
 *
 * ## 改动前为什么是错的
 *
 * `sfm://remote/c/pub` 走通用分支时，`getAddressBarSegments` 会切出
 * `['sfm:', 'remote', 'c', 'pub']`，而 `sfm:` 里带冒号，被 `pathSegments[0].includes(':')`
 * 那条当成 **Windows 盘符**，拼成 `sfm:/remote/c/pub` —— 一个用户从没去过的路径。
 * 点面包屑的任何一级都会跳到那里去。
 *
 * ## 这里必须用什么拼
 *
 * **`buildRemotePath`，不是字符串拼接。** 规范化的唯一权威是 `remote-paths.ts`
 * （它又是 Rust 侧 `path.rs` 的镜像），手工拼出来的路径在尾斜杠、连续斜杠、
 * 中文与空格这些边界上会和后端解析出两个结果。
 *
 * ## 层级为什么是「远程 → 连接 → 路径」
 *
 * `getNavigableParentPath` 允许从 `sfm://remote/<id>` 上到 `sfm://remote`，
 * 所以根这一级必须存在，否则「返回上一级」会走进一个没有面包屑的页面。
 */
function buildRemoteAddressBarParts(
  path: string,
  context: RemoteBreadcrumbContext,
): AddressBarPart[] {
  const rootPart: AddressBarPart = {
    path: REMOTE_SCHEME,
    name: context.rootLabel,
    isLast: false,
    disableDropTarget: true,
  };

  // `sfm://remote` 本身不是一个连接，`parseRemotePath` 对它返回 null，
  // 所以必须先于解析单独处理。
  if (path === REMOTE_SCHEME) {
    return [{
      ...rootPart,
      isLast: true,
    }];
  }

  const parsed = parseRemotePath(path);

  if (parsed === null) {
    // 非法远程路径（含 `.` / `..` 段）不产出面包屑。
    // 与 `getNavigableParentPath` 对同一批路径返回 null 保持一致 ——
    // 一个能点、一个不能点的面包屑比完全没有更糟。
    return [];
  }

  const segments = parsed.remotePath === '/'
    ? []
    : parsed.remotePath.slice(1).split('/');

  const connectionPath = buildRemoteConnectionPath(parsed.connectionId);

  if (connectionPath === null) {
    return [];
  }

  const parts: AddressBarPart[] = [
    rootPart,
    {
      path: connectionPath,
      // 连接名查不到就显示 id：uuid 难看，但至少让用户看得出「是哪一条」，
      // 总好过整条面包屑空着。
      name: context.connectionNames[parsed.connectionId] ?? parsed.connectionId,
      isLast: segments.length === 0,
    },
  ];

  segments.forEach((segment, index) => {
    const partialPath = buildRemotePath(parsed.connectionId, `/${segments.slice(0, index + 1).join('/')}`);

    if (partialPath === null) {
      return;
    }

    parts.push({
      path: partialPath,
      name: segment,
      isLast: index === segments.length - 1,
    });
  });

  return parts;
}

export function buildAddressBarParts(
  currentPath: string,
  platform: string | null,
  locationsLabel: string,
  remoteContext: RemoteBreadcrumbContext = NO_REMOTE_CONTEXT,
): AddressBarPart[] {
  if (!currentPath) {
    return [];
  }

  // 必须排在 `canonicalizePath` 之前：canonicalizePath 会把尾斜杠剥掉，
  // 通用分支会把 `sfm:` 当盘符（见 buildRemoteAddressBarParts 的注释）。
  if (isRemotePath(currentPath)) {
    return buildRemoteAddressBarParts(currentPath, remoteContext);
  }

  if (isVirtualLocationPath(currentPath)) {
    return [{
      path: LOCATIONS_VIRTUAL_PATH,
      name: locationsLabel,
      isLast: true,
      disableDropTarget: true,
      displayRootIcon: true,
      useLocationsDropdown: true,
    }];
  }

  const normalizedPath = canonicalizePath(currentPath);
  const parts = getAddressBarSegments(normalizedPath);
  const uncPath = isUncPath(normalizedPath);
  const formattedParts: AddressBarPart[] = [];

  parts.forEach((part, index) => {
    const pathSegments = parts.slice(0, index + 1);
    let fullPath = '';

    if (uncPath) {
      fullPath = `//${pathSegments.join('/')}`;
    }
    else if (isUnixFilesystemRoot(normalizedPath)) {
      fullPath = '/';
    }
    else if (normalizedPath.startsWith('/')) {
      fullPath = `/${pathSegments.join('/')}`;
    }
    else if (pathSegments[0]?.includes(':')) {
      fullPath = `${pathSegments[0]}/`;

      if (pathSegments.length > 1) {
        fullPath += pathSegments.slice(1).join('/');
      }
    }
    else {
      fullPath = pathSegments.join('/');
    }

    formattedParts.push({
      path: fullPath,
      name: part,
      isLast: index === parts.length - 1,
      disableDropTarget: isVirtualDirectoryPath(fullPath),
    });
  });

  if (!shouldPrependLocationsCrumb(currentPath, platform)) {
    return formattedParts;
  }

  return [
    {
      path: LOCATIONS_VIRTUAL_PATH,
      name: locationsLabel,
      isLast: false,
      disableDropTarget: true,
      displayRootIcon: true,
      useLocationsDropdown: true,
    },
    ...formattedParts,
  ];
}
