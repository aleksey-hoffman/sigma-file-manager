// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import { buildAddressBarParts } from '../address-bar-parts';

describe('buildAddressBarParts', () => {
  it('builds Locations > / for the unix filesystem root', () => {
    const parts = buildAddressBarParts('/', 'linux', 'Locations');

    expect(parts.map(part => ({
      path: part.path,
      name: part.name,
    }))).toEqual([
      {
        path: LOCATIONS_VIRTUAL_PATH,
        name: 'Locations',
      },
      {
        path: '/',
        name: '/',
      },
    ]);
  });

  it('builds Locations > C: for a windows drive root', () => {
    const parts = buildAddressBarParts('C:/', 'windows', 'Locations');

    expect(parts.map(part => ({
      path: part.path,
      name: part.name,
    }))).toEqual([
      {
        path: LOCATIONS_VIRTUAL_PATH,
        name: 'Locations',
      },
      {
        path: 'C:/',
        name: 'C:',
      },
    ]);
  });

  it('builds Locations > / for trailing-slash-only unix roots', () => {
    const parts = buildAddressBarParts('///', 'linux', 'Locations');

    expect(parts.map(part => ({
      path: part.path,
      name: part.name,
    }))).toEqual([
      {
        path: LOCATIONS_VIRTUAL_PATH,
        name: 'Locations',
      },
      {
        path: '/',
        name: '/',
      },
    ]);
  });

  it('does not prepend Locations for nested unix home paths', () => {
    const parts = buildAddressBarParts('/home/user', 'linux', 'Locations');

    expect(parts.map(part => ({
      path: part.path,
      name: part.name,
    }))).toEqual([
      {
        path: '/home',
        name: 'home',
      },
      {
        path: '/home/user',
        name: 'user',
      },
    ]);
  });

  // FORK-MODIFICATION 2026-10-18：远程面包屑（阶段 2 需求 1）。
  describe('远程路径族', () => {
    const context = {
      rootLabel: 'Remote',
      connectionNames: {
        'conn-a': '速豹堂',
      },
    };

    it('逐级拼出可导航的远程路径，而不是 sfm:/ 开头的假盘符', () => {
      // 改动前：getAddressBarSegments 切出 ['sfm:','remote','c','pub']，
      // 'sfm:' 带冒号被当成 Windows 盘符，拼成 'sfm:/remote/c/pub' —— 一个用户
      // 从没去过的路径。下面每一条 path 都是能真正 navigateTo 的。
      const parts = buildAddressBarParts('sfm://remote/conn-a/pub/docs', 'windows', 'Locations', context);

      expect(parts.map(part => ({
        path: part.path,
        name: part.name,
        isLast: part.isLast,
      }))).toEqual([
        {
          path: 'sfm://remote',
          name: 'Remote',
          isLast: false,
        },
        {
          path: 'sfm://remote/conn-a',
          name: '速豹堂',
          isLast: false,
        },
        {
          path: 'sfm://remote/conn-a/pub',
          name: 'pub',
          isLast: false,
        },
        {
          path: 'sfm://remote/conn-a/pub/docs',
          name: 'docs',
          isLast: true,
        },
      ]);

      // 判别点：没有任何一条落进本地盘符拼法（单斜杠的 sfm:/remote/...）。
      // 注意不能用 startsWith('sfm:/') 判断 —— 正确的 sfm://remote 本身也满足它。
      expect(parts.every(part => !part.path.startsWith('sfm:/remote'))).toBe(true);
      expect(parts.every(part => part.path.startsWith('sfm://remote'))).toBe(true);
    });

    it('连接根那一级是末级，名字是连接名', () => {
      const parts = buildAddressBarParts('sfm://remote/conn-a', 'windows', 'Locations', context);

      expect(parts.map(part => part.path)).toEqual([
        'sfm://remote',
        'sfm://remote/conn-a',
      ]);
      expect(parts[1]?.name).toBe('速豹堂');
      expect(parts[1]?.isLast).toBe(true);
    });

    it('查不到连接名时退回连接 id，而不是留空', () => {
      // 连接被删掉后 workspace 里可能还留着标签页。空名字会让面包屑出现一个
      // 看得见、点不动的空按钮；uuid 难看但至少能认出是哪一条。
      const parts = buildAddressBarParts('sfm://remote/conn-gone/pub', 'windows', 'Locations', context);

      expect(parts.map(part => part.name)).toEqual([
        'Remote',
        'conn-gone',
        'pub',
      ]);
    });

    it('sfm://remote 本身只有一级，且不能当拖放目标', () => {
      // getNavigableParentPath 允许从连接根上到 sfm://remote，
      // 所以这一级必须存在，否则「返回上一级」会走进一个没有面包屑的页面。
      const parts = buildAddressBarParts('sfm://remote', 'windows', 'Locations', context);

      expect(parts).toHaveLength(1);
      expect(parts[0]?.path).toBe('sfm://remote');
      expect(parts[0]?.isLast).toBe(true);
      expect(parts[0]?.disableDropTarget).toBe(true);
    });

    it('非法远程路径不产出面包屑', () => {
      // `..` 段让 parseRemotePath 返回 null。`getNavigableParentPath` 对同一批路径
      // 也返回 null —— 一个能点、一个不能点的面包屑比完全没有更糟。
      expect(buildAddressBarParts('sfm://remote/conn-a/pub/../etc', 'windows', 'Locations', context))
        .toEqual([]);
    });

    it('不传远程上下文时退回方案名与连接 id', () => {
      // 组件外的调用方（以及老测试）可以继续用三参数签名，不该在这里崩掉。
      const parts = buildAddressBarParts('sfm://remote/conn-a/pub', 'windows', 'Locations');

      expect(parts.map(part => part.name)).toEqual([
        'sfm://remote',
        'conn-a',
        'pub',
      ]);
    });

    it('本地路径不受远程分支影响（阳性对照）', () => {
      const parts = buildAddressBarParts('C:/Users', 'windows', 'Locations');

      expect(parts.map(part => part.path)).toEqual([
        'sfm://locations',
        'C:/',
        'C:/Users',
      ]);
    });
  });
});
