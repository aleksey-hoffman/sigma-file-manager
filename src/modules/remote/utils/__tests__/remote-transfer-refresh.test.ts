// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-20：传输完成通知的语义。
//
// 用户反馈：下载到本地 / 上传到远程之后，对面那一格不刷新，
// 新传过去的文件要等手动刷新才出现。
//
// 这里钉的是「通知」这一层：谁收到、收到什么、退订之后还收不收到。
// 判定「这一格是不是目标那一格」在另一个文件里测
// （`use-remote-transfer-refresh.test.ts`），因为那是**这一格**的职责。
//

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isRemoteTransferTargetPane,
  notifyRemoteTransferCompleted,
  shouldRefreshTargetPane,
  subscribeRemoteTransferCompleted,
} from '../remote-transfer-refresh';

const unsubscribes: Array<() => void> = [];

function subscribe(handler: (targetPath: string) => void) {
  const unsubscribe = subscribeRemoteTransferCompleted(handler);
  unsubscribes.push(unsubscribe);

  return unsubscribe;
}

afterEach(() => {
  while (unsubscribes.length > 0) {
    unsubscribes.pop()?.();
  }
});

describe('传输完成通知', () => {
  it('订阅者收到的是目标目录路径', () => {
    const handler = vi.fn();
    subscribe(handler);

    notifyRemoteTransferCompleted('C:/Users/Duanyi/afm-acceptance');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('C:/Users/Duanyi/afm-acceptance');
  });

  it('退订之后不再收到', () => {
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);

    notifyRemoteTransferCompleted('C:/a');
    unsubscribe();
    notifyRemoteTransferCompleted('C:/a');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('空路径不通知 —— 没有目标目录可谈', () => {
    const handler = vi.fn();
    subscribe(handler);

    notifyRemoteTransferCompleted('');

    expect(handler).not.toHaveBeenCalled();
  });

  it('一个订阅者抛异常不连累其它订阅者', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();

    subscribe(failing);
    subscribe(healthy);

    notifyRemoteTransferCompleted('C:/a');

    expect(failing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('订阅者退订自己不影响这一轮其它订阅者', () => {
    const second = vi.fn();
    const first = vi.fn(() => {
      // 退订发生在通知处理中
      firstUnsubscribe();
    });
    const firstUnsubscribe = subscribe(first);
    subscribe(second);

    notifyRemoteTransferCompleted('C:/a');

    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('isRemoteTransferTargetPane', () => {
  it('路径逐字相同才算目标那一格', () => {
    expect(isRemoteTransferTargetPane('C:/a', 'C:/a')).toBe(true);
    expect(isRemoteTransferTargetPane('C:/a', 'C:/b')).toBe(false);
    expect(isRemoteTransferTargetPane('C:/a', 'C:/A')).toBe(false);
  });

  it('空路径 / 空 pane 路径都不算', () => {
    expect(isRemoteTransferTargetPane('', 'C:/a')).toBe(false);
    expect(isRemoteTransferTargetPane('C:/a', '')).toBe(false);
    expect(isRemoteTransferTargetPane('C:/a', null)).toBe(false);
    expect(isRemoteTransferTargetPane('C:/a', undefined)).toBe(false);
  });
});

describe('shouldRefreshTargetPane', () => {
  const base = {
    transferredFiles: 0,
    transferredDirs: 0,
    skippedCount: 0,
    failureCount: 0,
  };

  it('传过去了东西就要刷新', () => {
    expect(shouldRefreshTargetPane({
      ...base,
      transferredFiles: 1,
    })).toBe(true);
    expect(shouldRefreshTargetPane({
      ...base,
      transferredDirs: 1,
    })).toBe(true);
  });

  it('有失败也要刷新 —— 目录是递归传的，可能已经写进去一部分', () => {
    expect(shouldRefreshTargetPane({
      ...base,
      failureCount: 1,
    })).toBe(true);
  });

  it('只是「目标已存在」而跳过的不刷新 —— 目录内容没变', () => {
    expect(shouldRefreshTargetPane({
      ...base,
      skippedCount: 3,
    })).toBe(false);
  });

  it('什么都没发生就不刷新', () => {
    expect(shouldRefreshTargetPane(base)).toBe(false);
  });
});
