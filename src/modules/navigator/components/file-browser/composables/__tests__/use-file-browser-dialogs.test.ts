// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程「新建空文件」是**永久非目标**（规格 §1）。
//
// 真机验收撞到的问题：菜单里的「新建文件」入口已经藏起来了，
// 但**快捷键绕过了菜单** —— 远程格按 Ctrl+Shift+M 照样弹出一个
// 注定失败的「新建文件」对话框，用户填完名字点「创建」才看到错误提示。
//
// 这条用例钉住「对话框入口这道守卫」：远程目标下**根本不该弹出对话框**，
// 而是当场给一句提示。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ref } from 'vue';

const { toastCustomMock } = vi.hoisted(() => ({
  toastCustomMock: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    custom: toastCustomMock,
  },
  ToastStatic: { name: 'ToastStatic' },
}));

import { useFileBrowserDialogs } from '../use-file-browser-dialogs';

const REMOTE_DIR = 'sfm://remote/conn-1/docs';
const LOCAL_DIR = 'C:/Users/Duanyi';

function createDialogs(currentPath: string) {
  return useFileBrowserDialogs({
    renameState: ref({
      isActive: false,
      entry: null,
    }),
    cancelRename: vi.fn(),
    confirmRename: vi.fn(),
    createNewItem: vi.fn(),
    currentPath: ref(currentPath),
  });
}

describe('「新建」对话框的远程守卫', () => {
  beforeEach(() => {
    toastCustomMock.mockReset();
  });

  it('远程目录下「新建文件」不弹对话框，当场给提示', () => {
    const dialogs = createDialogs(REMOTE_DIR);

    dialogs.openNewItemDialog('file');

    expect(dialogs.isNewItemDialogOpen.value).toBe(false);
    expect(dialogs.newItemDialogState.value.isOpen).toBe(false);
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
  });

  it('远程目录下「新建目录」照常弹（阳性对照：守卫没把正常功能一起挡掉）', () => {
    const dialogs = createDialogs(REMOTE_DIR);

    dialogs.openNewItemDialog('directory');

    expect(dialogs.isNewItemDialogOpen.value).toBe(true);
    expect(dialogs.newItemDialogState.value.type).toBe('directory');
    expect(toastCustomMock).not.toHaveBeenCalled();
  });

  it('本地目录下「新建文件」照常弹（阳性对照：守卫没误伤本地）', () => {
    const dialogs = createDialogs(LOCAL_DIR);

    dialogs.openNewItemDialog('file');

    expect(dialogs.isNewItemDialogOpen.value).toBe(true);
    expect(dialogs.newItemDialogState.value.type).toBe('file');
    expect(toastCustomMock).not.toHaveBeenCalled();
  });

  it('右键菜单传了远程目标路径时同样被挡下', () => {
    // 上下文菜单那三个调用点是**显式传 targetPaths** 的，
    // 守卫不能只看当前目录 —— 否则「在远程目录上右键新建文件」会漏过去。
    const dialogs = createDialogs(LOCAL_DIR);

    dialogs.openNewItemDialog('file', [REMOTE_DIR]);

    expect(dialogs.isNewItemDialogOpen.value).toBe(false);
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
  });

  it('目标里混了本地和远程，「新建文件」整体被挡下', () => {
    // 建一半比压根不给入口糟糕得多。
    const dialogs = createDialogs(LOCAL_DIR);

    dialogs.openNewItemDialog('file', [LOCAL_DIR, REMOTE_DIR]);

    expect(dialogs.isNewItemDialogOpen.value).toBe(false);
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
  });
});
