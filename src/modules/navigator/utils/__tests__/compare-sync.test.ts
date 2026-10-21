// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  compareLocationLabel,
  compareNodeDepths,
  countStatuses,
  defaultCompareCriteria,
  filterCompareNodes,
  formatExcludePatterns,
  isUndecidedStatus,
  parseExcludePatterns,
  toCompareLocation,
} from '@/modules/navigator/utils/compare-sync';
import type { CompareNode } from '@/types/compare-sync';

function fileNode(name: string, relPath: string, status: CompareNode['status']): CompareNode {
  return {
    name,
    relPath,
    kind: 'file',
    status,
    direction: 'none',
    left: null,
    right: null,
    children: [],
  };
}

describe('toCompareLocation', () => {
  it('把本地路径原样留下', () => {
    expect(toCompareLocation('C:\\Users\\Duanyi')).toEqual({
      type: 'local',
      path: 'C:\\Users\\Duanyi',
    });
  });

  it('把远程路径拆成连接 id 与远端路径', () => {
    expect(toCompareLocation('sfm://remote/conn-a/pub/docs')).toEqual({
      type: 'remote',
      connectionId: 'conn-a',
      path: '/pub/docs',
    });
  });

  it('远程连接根解析成根路径', () => {
    expect(toCompareLocation('sfm://remote/conn-a')).toEqual({
      type: 'remote',
      connectionId: 'conn-a',
      path: '/',
    });
  });

  it('空路径返回 null', () => {
    expect(toCompareLocation('   ')).toBeNull();
  });

  it('非法远程路径返回 null 而不是半截结果', () => {
    expect(toCompareLocation('sfm://remote/')).toBeNull();
    expect(toCompareLocation('sfm://remote/conn/../etc')).toBeNull();
  });
});

describe('compareLocationLabel', () => {
  it('本地显示路径', () => {
    expect(compareLocationLabel({
      type: 'local',
      path: 'C:/x',
    })).toBe('C:/x');
  });

  it('远程显示 sfm:// 形式', () => {
    expect(compareLocationLabel({
      type: 'remote',
      connectionId: 'c',
      path: '/p',
    }))
      .toBe('sfm://remote/c/p');
  });
});

describe('filterCompareNodes', () => {
  const tree: CompareNode[] = [
    {
      ...fileNode('sub', 'sub', 'same'),
      kind: 'directory',
      children: [
        fileNode('a.txt', 'sub/a.txt', 'only_left'),
        fileNode('b.txt', 'sub/b.txt', 'same'),
      ],
    },
    fileNode('top.txt', 'top.txt', 'only_right'),
  ];

  it('只保留命中的节点', () => {
    const filtered = filterCompareNodes(tree, node => node.status === 'only_right');

    expect(filtered.map(node => node.relPath)).toEqual(['top.txt']);
  });

  it('命中的是子项时保留父目录这一层', () => {
    const filtered = filterCompareNodes(tree, node => node.status === 'only_left');

    expect(filtered.map(node => node.relPath)).toEqual(['sub']);
    expect(filtered[0].children.map(node => node.relPath)).toEqual(['sub/a.txt']);
  });

  it('没有任何命中时返回空数组', () => {
    expect(filterCompareNodes(tree, () => false)).toEqual([]);
  });
});

describe('countStatuses', () => {
  it('把各层级的状态都数进去', () => {
    const tree: CompareNode[] = [
      {
        ...fileNode('sub', 'sub', 'same'),
        kind: 'directory',
        children: [
          fileNode('a.txt', 'sub/a.txt', 'only_left'),
          fileNode('b.txt', 'sub/b.txt', 'size_diff'),
        ],
      },
    ];

    const counts = countStatuses(tree);

    expect(counts.same).toBe(1);
    expect(counts.only_left).toBe(1);
    expect(counts.size_diff).toBe(1);
    expect(counts.only_right).toBe(0);
  });
});

describe('isUndecidedStatus', () => {
  it('四种待定状态都算待定', () => {
    expect(isUndecidedStatus('size_diff')).toBe(true);
    expect(isUndecidedStatus('content_diff')).toBe(true);
    expect(isUndecidedStatus('kind_diff')).toBe(true);
    expect(isUndecidedStatus('indeterminate')).toBe(true);
  });

  it('单侧独有与新旧不算是待定', () => {
    expect(isUndecidedStatus('only_left')).toBe(false);
    expect(isUndecidedStatus('newer')).toBe(false);
    expect(isUndecidedStatus('same')).toBe(false);
  });
});

describe('parseExcludePatterns', () => {
  it('一行一条，忽略空行与首尾空白', () => {
    expect(parseExcludePatterns('*.tmp\n\n  node_modules  \r\n.git')).toEqual([
      '*.tmp',
      'node_modules',
      '.git',
    ]);
  });

  it('空文本得到空数组', () => {
    expect(parseExcludePatterns('')).toEqual([]);
  });

  it('写回多行文本能往返', () => {
    const patterns = ['*.tmp', 'node_modules'];

    expect(parseExcludePatterns(formatExcludePatterns(patterns))).toEqual(patterns);
  });
});

describe('defaultCompareCriteria', () => {
  it('默认按时间 + 按大小', () => {
    const criteria = defaultCompareCriteria();

    expect(criteria.byTime).toBe(true);
    expect(criteria.bySize).toBe(true);
    expect(criteria.byChecksum).toBe(false);
    expect(criteria.caseSensitive).toBe(true);
    expect(criteria.recursive).toBe(true);
    expect(criteria.maxDepth).toBeNull();
  });
});

describe('compareNodeDepths', () => {
  it('按层级记录每个节点的深度', () => {
    const tree: CompareNode[] = [
      {
        ...fileNode('sub', 'sub', 'same'),
        kind: 'directory',
        children: [fileNode('a.txt', 'sub/a.txt', 'same')],
      },
    ];

    const depths = compareNodeDepths(tree);

    expect(depths.get('sub')).toBe(0);
    expect(depths.get('sub/a.txt')).toBe(1);
  });
});
