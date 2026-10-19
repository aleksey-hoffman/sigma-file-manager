// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 同步浏览（联动）判定。用户 2026-10-19 实测反馈钉下来的：
// 「点击进入本地或远程一个子目录（比如 wp-content)，另一侧没有同步打开」。
//
// 旧实现是**选中驱动 + 只有左格能驱动**，两个都不合用户预期；
// 现在改成**进目录驱动 + 谁动谁说了算**，规则全在
// `planLinkedPaneNavigation` 里，这里逐条钉死。

import { describe, expect, it } from 'vitest';
import {
  appendPathSegment,
  decideLinkedPaneGate,
  getPathLastSegment,
  getPathParent,
  lookupLinkedPanePair,
  planLinkedPaneNavigation,
  recordLinkedPanePair,
  type LinkedPanePairs,
  type LinkedPanePosition,
} from '../linked-split-sync';

const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
const REMOTE_ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
const LOCAL_ROOT = 'E:/website_sbt';

function panes(left: LinkedPanePosition, right: LinkedPanePosition): LinkedPanePosition[] {
  return [left, right];
}

describe('planLinkedPaneNavigation · 回声防护', () => {
  it('认出「这一格就是被我们指挥过去的那一格」，不再往回触发', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: `${REMOTE_ROOT}/wp-content`,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: `${REMOTE_ROOT}/wp-content`,
        },
      ),
      pending: {
        tabId: 'right',
        path: `${REMOTE_ROOT}/wp-content`,
      },
    });

    // 不掐断就是两格无限互相导航。
    expect(result).toBeNull();
  });

  it('回声只认一次：pending 清掉之后同样的上报要正常处理', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: `${REMOTE_ROOT}/wp-content`,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: `${REMOTE_ROOT}/wp-content`,
        },
      ),
      pending: null,
    });

    expect(result).not.toBeNull();
  });

  it('pending 指向别的窗格时不误吞', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/docs`,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: {
        tabId: 'right',
        path: `${REMOTE_ROOT}/something`,
      },
    });

    expect(result).not.toBeNull();
  });
});

describe('planLinkedPaneNavigation · 跨本地/远程按目录名对齐', () => {
  it('左格进入 wp-content，右格收到远端同名子目录', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/wp-content`,
      panes: panes(
        {
          tabId: 'left',
          path: `${LOCAL_ROOT}/wp-content`,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: null,
    });

    expect(result).toEqual({
      tabId: 'right',
      path: `${REMOTE_ROOT}/wp-content`,
    });
  });

  it('右格进入 themes，左格收到本地同名子目录', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: `sfm://remote/${CONN}/vol1/@team/study_platform/wp_content/themes`,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: `sfm://remote/${CONN}/vol1/@team/study_platform/wp_content/themes`,
        },
      ),
      pending: null,
    });

    // 跨族不能照搬绝对路径：那会让本地格整个变成远程目录。
    expect(result).toEqual({
      tabId: 'left',
      path: `${LOCAL_ROOT}/themes`,
    });
  });

  it('右侧停在远程连接根时也能接上第一层', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/wp_root`,
      panes: panes(
        {
          tabId: 'left',
          path: `${LOCAL_ROOT}/wp_root`,
        },
        {
          tabId: 'right',
          path: `sfm://remote/${CONN}`,
        },
      ),
      pending: null,
    });

    expect(result?.path).toBe(`sfm://remote/${CONN}/wp_root`);
  });

  it('跨族时只取最后一段，父路径不跟着搬', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/wp-content/themes/twentytwenty`,
      panes: panes(
        {
          tabId: 'left',
          path: `${LOCAL_ROOT}/wp-content/themes/twentytwenty`,
        },
        {
          tabId: 'right',
          path: `sfm://remote/${CONN}/pub`,
        },
      ),
      pending: null,
    });

    expect(result?.path).toBe(`sfm://remote/${CONN}/pub/twentytwenty`);
  });
});

describe('planLinkedPaneNavigation · 同族维持旧的绝对路径行为', () => {
  it('本地 ↔ 本地：另一格跳到同一个绝对目录', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: 'C:/Projects/demo',
      panes: panes(
        {
          tabId: 'left',
          path: 'C:/Projects',
        },
        {
          tabId: 'right',
          path: 'D:/Other',
        },
      ),
      pending: null,
    });

    // 不能顺手改成相对拼接 —— 这个功能一直就是「跳到同一个绝对目录」。
    expect(result).toEqual({
      tabId: 'right',
      path: 'C:/Projects/demo',
    });
  });

  it('远程 ↔ 远程：同样跳到同一个绝对目录', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: `sfm://remote/${CONN}/pub/demo`,
      panes: panes(
        {
          tabId: 'left',
          path: `sfm://remote/${CONN}/docs`,
        },
        {
          tabId: 'right',
          path: `sfm://remote/${CONN}/pub/demo`,
        },
      ),
      pending: null,
    });

    expect(result).toEqual({
      tabId: 'left',
      path: `sfm://remote/${CONN}/pub/demo`,
    });
  });
});

describe('planLinkedPaneNavigation · 边界', () => {
  it('不是分屏（只有一格）时什么都不做', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/docs`,
      panes: [{
        tabId: 'left',
        path: LOCAL_ROOT,
      }],
      pending: null,
    });

    expect(result).toBeNull();
  });

  it('来源路径为空时什么都不做', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: '',
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: null,
    });

    expect(result).toBeNull();
  });

  it('另一格还没挂上（没有路径）时什么都不做', () => {
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/docs`,
      panes: [{
        tabId: 'left',
        path: LOCAL_ROOT,
      }],
      pending: null,
    });

    expect(result).toBeNull();
  });
});

describe('decideLinkedPaneGate · 初始化期间不许联动', () => {
  const LEFT = 'left';
  const RIGHT = 'right';
  const ALL = [LEFT, RIGHT];

  function gate(options: Partial<Parameters<typeof decideLinkedPaneGate>[0]> = {}) {
    return decideLinkedPaneGate({
      isLinkedMode: true,
      fromTabId: LEFT,
      fromPath: `${LOCAL_ROOT}/wp-content`,
      allTabIds: ALL,
      settledTabIds: new Set(),
      pending: null,
      ...options,
    });
  }

  it('联动没开 → blocked', () => {
    expect(gate({ isLinkedMode: false })).toBe('blocked');
  });

  it('这一格刚挂载、首次上报 → settle（只记账，不联动）', () => {
    // 用户实测反馈 1：打开连接时先加载完的那一格会把「刚打开的路径」
    // 当成用户操作，指挥另一格跳走，结果两端都被推离各自的默认目录。
    expect(gate()).toBe('settle');
  });

  it('还有格没就位 → wait', () => {
    expect(gate({ settledTabIds: new Set([LEFT]) })).toBe('wait');
  });

  it('两格都就位之后 → sync', () => {
    expect(gate({ settledTabIds: new Set([LEFT, RIGHT]) })).toBe('sync');
  });

  it('认出回声，且优先于 settle/wait', () => {
    // 回声优先：否则自己指挥过去的导航会被当成用户操作，
    // 两格立刻开始无限互踩。
    expect(gate({
      settledTabIds: new Set([LEFT]),
      pending: {
        tabId: LEFT,
        path: `${LOCAL_ROOT}/wp-content`,
      },
    })).toBe('echo');

    expect(gate({
      settledTabIds: new Set(),
      pending: {
        tabId: LEFT,
        path: `${LOCAL_ROOT}/wp-content`,
      },
    })).toBe('echo');
  });

  it('pending 指向别的窗格时不算回声', () => {
    expect(gate({
      settledTabIds: new Set([LEFT, RIGHT]),
      pending: {
        tabId: RIGHT,
        path: `${REMOTE_ROOT}/wp-content`,
      },
    })).toBe('sync');
  });

  it('单格时（没有另一格）不会永远卡在 wait', () => {
    expect(gate({
      allTabIds: [LEFT],
      settledTabIds: new Set([LEFT]),
    })).toBe('sync');
  });
});

describe('getPathLastSegment', () => {
  it.each([
    ['本地路径', 'E:/website_sbt/wp-content', 'wp-content'],
    ['本地尾斜杠', 'E:/website_sbt/wp-content/', 'wp-content'],
    ['本地反斜杠', 'E:\\website_sbt\\wp-content', 'wp-content'],
    ['远程路径', `sfm://remote/${CONN}/vol1/wp_root`, 'wp_root'],
    ['远程连接根', `sfm://remote/${CONN}`, ''],
  ])('%s 取最后一段', (_label, input, expected) => {
    expect(getPathLastSegment(input)).toBe(expected);
  });
});

describe('appendPathSegment', () => {
  it('本地路径剥掉尾斜杠再接', () => {
    expect(appendPathSegment('E:/website_sbt/', 'wp-content')).toBe('E:/website_sbt/wp-content');
  });

  it('盘符根不会接成 E:name', () => {
    expect(appendPathSegment('E:/', 'docs')).toBe('E:/docs');
  });

  it('远程路径经 buildRemotePath 拼接而不是字符串硬接', () => {
    expect(appendPathSegment('sfm://remote/c1/pub', 'docs')).toBe('sfm://remote/c1/pub/docs');
  });
});

describe('getPathLastSegment · 根没有目录名可言', () => {
  it.each([
    ['盘符根带斜杠', 'E:/'],
    ['盘符根不带斜杠', 'E:'],
  ])('%s 返回空串，不能被当成目录名接出去', (_label, input) => {
    // 不挡的话 `E:/` 会被取成 `E:`，再接成 `…/wp_root/E:` —— 两边都不存在。
    expect(getPathLastSegment(input)).toBe('');
  });
});

describe('getPathParent', () => {
  it.each([
    ['本地普通目录', `${LOCAL_ROOT}/wp-content`, LOCAL_ROOT],
    ['本地盘符下一级', `${LOCAL_ROOT}`, 'E:/'],
    ['本地反斜杠', 'E:\\website_sbt\\wp-content', 'E:/website_sbt'],
  ])('%s 的上级是 %s', (_label, input, expected) => {
    expect(getPathParent(input)).toBe(expected);
  });

  it.each([
    ['本地盘符根', 'E:/'],
    ['本地盘符根不带斜杠', 'E:'],
    ['远程连接根', `sfm://remote/${CONN}`],
    ['远程 scheme 本身', 'sfm://remote'],
    ['空路径', ''],
  ])('%s 没有上级', (_label, input) => {
    expect(getPathParent(input)).toBeNull();
  });

  it('远程逐级上溯时停在连接根，不会跑到 sfm://remote', () => {
    // getRemoteParentPath 在连接根上返回的是 `sfm://remote` —— 那不是能进树的路径，
    // 所以这里必须自己先挡一道。
    expect(getPathParent(`${REMOTE_ROOT}/wp-content`)).toBe(REMOTE_ROOT);
    expect(getPathParent(`sfm://remote/${CONN}/vol1`)).toBe(`sfm://remote/${CONN}`);
    expect(getPathParent(`sfm://remote/${CONN}/vol1/@team`)).toBe(`sfm://remote/${CONN}/vol1`);
  });

  it('POSIX 绝对路径上溯到 /', () => {
    expect(getPathParent('/usr/local/bin')).toBe('/usr/local');
  });
});

describe('跨族对应关系表 · 用户实测反馈 2 的那条真实路径序列', () => {
  /**
   * 用户截图里的实际状态：
   *   左（本地） E:\website_sbt\wp-content
   *   右（远程） @team\study_platform\wp_root\wp-content
   * 两边父级名字不同 —— `website_sbt` vs `wp_root` —— 点「上一级」按名对齐必然落空。
   */
  it('进同名子目录 → 记下这一对 → 点「上一级」按记录对上', () => {
    const pairs: LinkedPanePairs = new Map();

    // 第 1 步：左格进入 wp-content，右格收到远端同名子目录。
    const descend = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: `${LOCAL_ROOT}/wp-content`,
      panes: panes(
        {
          tabId: 'left',
          path: `${LOCAL_ROOT}/wp-content`,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: null,
      pairs,
    });

    expect(descend).toEqual({
      tabId: 'right',
      path: `${REMOTE_ROOT}/wp-content`,
    });

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`, descend!.path);

    // 第 2 步：左格点「上一级」。按名对齐会算出
    // `…/wp_root/wp-content/website_sbt`（哪边都不存在），必须走对应表。
    const up = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: LOCAL_ROOT,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: `${REMOTE_ROOT}/wp-content`,
        },
      ),
      pending: null,
      pairs,
    });

    expect(up).toEqual({
      tabId: 'right',
      path: REMOTE_ROOT,
    });
  });

  it('同一状态下没有对应表时，上一级仍然按名对齐（记录为什么需要这张表）', () => {
    // 阳性对照：同一份输入，去掉对应表就退回旧行为，产出的是一条不存在的路径。
    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: LOCAL_ROOT,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: `${REMOTE_ROOT}/wp-content`,
        },
      ),
      pending: null,
    });

    expect(result?.path).toBe(`${REMOTE_ROOT}/wp-content/website_sbt`);
  });

  it('反向：右格点上一级也能对上本地', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`, `${REMOTE_ROOT}/wp-content`);

    const up = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: REMOTE_ROOT,
      panes: panes(
        {
          tabId: 'left',
          path: `${LOCAL_ROOT}/wp-content`,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: null,
      pairs,
    });

    expect(up).toEqual({
      tabId: 'left',
      path: LOCAL_ROOT,
    });
  });

  it('超出对应关系范围的「上一级」静默不同步，而不是拼出一条假路径', () => {
    // 关联定义在 website_sbt ↔ wp_root 这一层；再往上没有对应项。
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`, `${REMOTE_ROOT}/wp-content`);

    const above = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: 'E:/',
      panes: panes(
        {
          tabId: 'left',
          path: 'E:/',
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: null,
      pairs,
    });

    expect(above).toBeNull();
  });
});

describe('recordLinkedPanePair', () => {
  it('双向记录', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`, `${REMOTE_ROOT}/wp-content`);

    expect(lookupLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`))
      .toBe(`${REMOTE_ROOT}/wp-content`);
    expect(lookupLinkedPanePair(pairs, `${REMOTE_ROOT}/wp-content`))
      .toBe(`${LOCAL_ROOT}/wp-content`);
  });

  it('连带记录父级 —— 这是「上一级」能同步的全部原因', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/wp-content`, `${REMOTE_ROOT}/wp-content`);

    expect(lookupLinkedPanePair(pairs, LOCAL_ROOT)).toBe(REMOTE_ROOT);
    expect(lookupLinkedPanePair(pairs, REMOTE_ROOT)).toBe(LOCAL_ROOT);
  });

  it('手输的反斜杠归一到同一个 key', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, 'E:\\website_sbt', `${REMOTE_ROOT}`);

    expect(lookupLinkedPanePair(pairs, 'E:/website_sbt')).toBe(REMOTE_ROOT);
    expect(lookupLinkedPanePair(pairs, 'E:\\website_sbt')).toBe(REMOTE_ROOT);
  });

  it('尾斜杠写法归一到同一个 key', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/`, `${REMOTE_ROOT}/wp-content/`);

    // 这一对记的是 website_sbt ↔ wp_root/wp-content，断言的就是它归一后的样子。
    expect(lookupLinkedPanePair(pairs, LOCAL_ROOT)).toBe(`${REMOTE_ROOT}/wp-content`);
    expect(lookupLinkedPanePair(pairs, `${LOCAL_ROOT}/`)).toBe(`${REMOTE_ROOT}/wp-content`);
    expect(lookupLinkedPanePair(pairs, `${REMOTE_ROOT}/wp-content`)).toBe(LOCAL_ROOT);
  });

  it('不记同族路径（两边同名同路径没有对应信息）', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, 'C:/Projects', 'C:/Projects');

    expect(lookupLinkedPanePair(pairs, 'C:/Projects')).toBeNull();
  });

  it('空路径不记', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, '', `${REMOTE_ROOT}`);

    expect(pairs.size).toBe(0);
  });

  it('超过上限整表清空，避免长会话无限增长', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/a`, `${REMOTE_ROOT}/a`, 8);

    expect(pairs.size).toBeLessThanOrEqual(8);

    recordLinkedPanePair(pairs, `${LOCAL_ROOT}/b`, `${REMOTE_ROOT}/b`, 8);

    expect(pairs.size).toBeLessThanOrEqual(8);
  });
});

describe('lookupLinkedPanePair · 没有表时安全退化', () => {
  it('pairs 未传（undefined）返回 null，不抛', () => {
    expect(lookupLinkedPanePair(undefined, LOCAL_ROOT)).toBeNull();
  });

  it('表里没有这条路径返回 null', () => {
    expect(lookupLinkedPanePair(new Map(), LOCAL_ROOT)).toBeNull();
  });

  it('空路径返回 null', () => {
    expect(lookupLinkedPanePair(new Map([['E:/website_sbt', 'x']]), '')).toBeNull();
  });
});

describe('对应关系表不越权', () => {
  it('同族仍然走绝对路径，不查对应表', () => {
    // 规则 2 的优先级不能被对应表抢走 —— 这个功能一直就是「跳到同一个绝对目录」。
    const pairs: LinkedPanePairs = new Map([['C:/Projects/demo', 'D:/somewhere-else']]);

    const result = planLinkedPaneNavigation({
      fromTabId: 'left',
      fromPath: 'C:/Projects/demo',
      panes: panes(
        {
          tabId: 'left',
          path: 'C:/Projects',
        },
        {
          tabId: 'right',
          path: 'D:/Other',
        },
      ),
      pending: null,
      pairs,
    });

    expect(result).toEqual({
      tabId: 'right',
      path: 'C:/Projects/demo',
    });
  });

  it('回声仍然优先于对应表', () => {
    const pairs: LinkedPanePairs = new Map();

    recordLinkedPanePair(pairs, LOCAL_ROOT, REMOTE_ROOT);

    const result = planLinkedPaneNavigation({
      fromTabId: 'right',
      fromPath: REMOTE_ROOT,
      panes: panes(
        {
          tabId: 'left',
          path: LOCAL_ROOT,
        },
        {
          tabId: 'right',
          path: REMOTE_ROOT,
        },
      ),
      pending: {
        tabId: 'right',
        path: REMOTE_ROOT,
      },
      pairs,
    });

    expect(result).toBeNull();
  });
});
