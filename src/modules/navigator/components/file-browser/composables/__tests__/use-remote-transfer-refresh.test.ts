// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-20：这一格收到「传输完成」通知时的反应。
//
// 这一层就是用户看到的那句话：「下载到本地之后，资源管理器没有立刻显示
// 新下载的文件」。断言钉的是「目标目录就是我这儿 → 重新读一次目录」。
//

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useRemoteTransferRefresh } from '../use-remote-transfer-refresh';

describe('这一格对传输完成通知的反应', () => {
  it('目标目录就是这一格当前所在的目录 → 重新读一次', () => {
    const refresh = vi.fn();
    const { handleTransferCompleted } = useRemoteTransferRefresh({
      currentPath: () => 'C:/Users/Duanyi/afm-acceptance',
      refresh,
    });

    handleTransferCompleted('C:/Users/Duanyi/afm-acceptance');

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('目标目录是别处的 → 不刷（刷了会读到跟当前目录不搭的内容）', () => {
    const refresh = vi.fn();
    const { handleTransferCompleted } = useRemoteTransferRefresh({
      currentPath: () => 'C:/Users/Duanyi/afm-acceptance',
      refresh,
    });

    handleTransferCompleted('C:/Users/Duanyi/其它目录');

    expect(refresh).not.toHaveBeenCalled();
  });

  it('这一格还没导航过去（路径为空）→ 不刷', () => {
    const refresh = vi.fn();
    const { handleTransferCompleted } = useRemoteTransferRefresh({
      currentPath: () => null,
      refresh,
    });

    handleTransferCompleted('C:/Users/Duanyi/afm-acceptance');

    expect(refresh).not.toHaveBeenCalled();
  });

  it('异步刷新也不会漏掉（返回 Promise 也不该抛）', () => {
    const refresh = vi.fn(async () => {});
    const { handleTransferCompleted } = useRemoteTransferRefresh({
      currentPath: () => 'C:/a',
      refresh,
    });

    expect(() => handleTransferCompleted('C:/a')).not.toThrow();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
