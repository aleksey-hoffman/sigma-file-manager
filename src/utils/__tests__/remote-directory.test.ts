// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-18：远程 invoke 封装与错误解包（阶段 2 需求 1）。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  REMOTE_READ_DIR_COMMAND,
  REMOTE_STAT_COMMAND,
  applyHostKeyTrust,
  buildHostKeyTrustPrompt,
  describeRemoteError,
  forgetKnownHost,
  isRemoteErrorPayload,
  listKnownHosts,
  readRemoteDirectory,
  statRemoteEntry,
  trustKindForProtocol,
  type HostKeyTrustPrompt,
} from '@/utils/remote-directory';
import type { RemoteConnection } from '@/types/remote';

const { invokeMock } = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('remote-directory', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  describe('describeRemoteError', () => {
    it('从 { kind, message } 里取 message，而不是变成 [object Object]', () => {
      // 这是这一层存在的全部理由：导航器原本写的是 String(caughtError)，
      // 远程 RemoteError 是普通对象，用户在认证失败时看到的是字面量
      // 「[object Object]」—— 正是规格 §6.3 明令禁止的笼统错误。
      expect(describeRemoteError({
        kind: 'auth',
        message: '密码错误',
      })).toBe('密码错误');
    });

    it('本地的 Error 仍取 message（行为不变）', () => {
      expect(describeRemoteError(new Error('本地读目录失败'))).toBe('本地读目录失败');
    });

    it('本地的字符串错误原样返回（行为不变）', () => {
      expect(describeRemoteError('read_dir failed')).toBe('read_dir failed');
    });

    it('空载荷不被误认成远程错误', () => {
      // `{}` 与 `{ message: 1 }` 都必须落到 String() 分支：
      // isRemoteErrorPayload 放宽成「有 message 就算」的话，
      // 任何带 message 字段的第三方对象都会被当成 RemoteError 吞掉。
      expect(isRemoteErrorPayload({})).toBe(false);
      expect(isRemoteErrorPayload({ message: 'x' })).toBe(false);
      expect(isRemoteErrorPayload({ kind: 'auth' })).toBe(false);
      expect(isRemoteErrorPayload(null)).toBe(false);
      expect(isRemoteErrorPayload('auth')).toBe(false);

      expect(describeRemoteError({})).toBe('[object Object]');
      expect(describeRemoteError({ message: 1 })).toBe('[object Object]');
    });

    it('认得出真正的 RemoteError 载荷', () => {
      expect(isRemoteErrorPayload({
        kind: 'not_found',
        message: '没有那个目录',
      })).toBe(true);
    });
  });

  describe('command 契约', () => {
    it('列目录用 remote_read_dir，只传 path', async () => {
      invokeMock.mockResolvedValue({ path: 'sfm://remote/c' });

      await readRemoteDirectory('sfm://remote/c');

      expect(REMOTE_READ_DIR_COMMAND).toBe('remote_read_dir');
      expect(invokeMock).toHaveBeenCalledWith('remote_read_dir', {
        path: 'sfm://remote/c',
      });
    });

    it('取条目用 remote_stat_dir_entry', async () => {
      invokeMock.mockResolvedValue({ name: 'a.txt' });

      await statRemoteEntry('sfm://remote/c/a.txt');

      expect(REMOTE_STAT_COMMAND).toBe('remote_stat_dir_entry');
      expect(invokeMock).toHaveBeenCalledWith('remote_stat_dir_entry', {
        path: 'sfm://remote/c/a.txt',
      });
    });

    it('stat 失败吞掉错误给 null，read_dir 失败原样抛出', async () => {
      // 两者方向相反是有意的：地址栏自动补全要「false 就当不存在」，
      // 而导航器要把「密码错 / 网络不通」如实显示出来，静默兜底才是需求 1 的病根。
      invokeMock.mockRejectedValue({
        kind: 'not_found',
        message: '没有那个条目',
      });

      await expect(statRemoteEntry('sfm://remote/c/nope')).resolves.toBeNull();
      await expect(readRemoteDirectory('sfm://remote/c')).rejects.toEqual({
        kind: 'not_found',
        message: '没有那个条目',
      });
    });
  });

  // FORK-MODIFICATION 2026-10-18：主机公钥信任流（阶段 2 决策 3）。
  describe('buildHostKeyTrustPrompt', () => {
    const connection: RemoteConnection = {
      id: 'c',
      name: '速豹堂',
      protocol: 'sftp',
      host: '192.168.1.9',
      port: 22,
      username: 'duanyi',
      initialPath: '/',
      proxy: { kind: 'direct' },
    };

    it('协议决定信任类型：SFTP 是 SSH 公钥，FTPS 是证书', () => {
      // 键是 `(host, port, kind)` 三元，kind 必须由**连接**算出来。
      // 错误载荷里不带它 —— 否则后端每个协议都要在自己的错误里塞一个 kind，
      // 而错误是协议实现产的，不该由它回答「你属于哪一类信任」。
      expect(trustKindForProtocol('sftp')).toBe('ssh');
      expect(trustKindForProtocol('ftps_explicit')).toBe('x509');
      expect(trustKindForProtocol('ftps_implicit')).toBe('x509');
      // 明文 FTP 压根没有主机密钥概念。
      expect(trustKindForProtocol('ftp')).toBeNull();
      // 不认识的协议不猜：猜错等于把一张证书当成公钥写进信任记录。
      expect(trustKindForProtocol('gopher')).toBeNull();
    });

    it('FTPS 连接的提示带 kind=x509，即使错误载荷与 SSH 一模一样', () => {
      // 阳性对照：同一个错误载荷，换协议就换 kind。
      // 少了这条，`kind` 就可能恒为 ssh，于是 FTPS 的证书被写进 SSH 记录 ——
      // 界面上「已信任主机」看着正常，之后的 FTPS 连接却永远报「首次见到」。
      const caught = {
        kind: 'host_key_unknown',
        message: '未信任这台主机',
        fingerprint: 'SHA256:AA:BB:CC',
        keyType: 'X509',
      };

      expect(buildHostKeyTrustPrompt(
        caught,
        'sfm://remote/c',
        {
          ...connection,
          protocol: 'ftps_explicit',
          port: 21,
        },
      )?.kind).toBe('x509');

      expect(buildHostKeyTrustPrompt(
        caught,
        'sfm://remote/c',
        {
          ...connection,
          protocol: 'ftps_implicit',
          port: 990,
        },
      )?.kind).toBe('x509');
    });

    it('明文 FTP 连接上不弹主机密钥弹窗', () => {
      // FTP 没有 TLS，把它导到信任流上只会产出一条永远写不进去的记录。
      expect(buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: 'x',
          fingerprint: 'SHA256:aaa',
          keyType: 'Ed25519',
        },
        'sfm://remote/c',
        {
          ...connection,
          protocol: 'ftp',
        },
      )).toBeNull();
    });

    it('首见（unknown）产出 changed=false 的提示', () => {
      const prompt = buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: '未信任这台主机',
          fingerprint: 'SHA256:aaa',
          keyType: 'Ed25519',
        },
        'sfm://remote/c/var/www',
        connection,
      );

      expect(prompt).toEqual({
        path: 'sfm://remote/c/var/www',
        host: '192.168.1.9',
        port: 22,
        fingerprint: 'SHA256:aaa',
        keyType: 'Ed25519',
        kind: 'ssh',
        changed: false,
      });
    });

    it('变更（changed）带上用户当初信任的那一份指纹', () => {
      // expectedFingerprint 是**变更**这一类错误独有的字段：它让用户能并排比对，
      // 而不是只看到一串自己无从判断的新指纹。
      const prompt = buildHostKeyTrustPrompt(
        {
          kind: 'host_key_changed',
          message: '主机密钥变了',
          fingerprint: 'SHA256:new',
          expectedFingerprint: 'SHA256:old',
          keyType: 'Ed25519',
        },
        'sfm://remote/c',
        connection,
      );

      expect(prompt?.changed).toBe(true);
      expect(prompt?.expectedFingerprint).toBe('SHA256:old');
      expect(prompt?.fingerprint).toBe('SHA256:new');
    });

    it('unknown 不带 expectedFingerprint，键压根不出现', () => {
      // 用 `in` 而不是 `toBeUndefined()`：属性存在且值为 undefined，
      // 序列化出去会变成一个 null 字段，前端 `expectedFingerprint &&` 的判断反而更脆。
      const prompt = buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: '未信任这台主机',
          fingerprint: 'SHA256:aaa',
          keyType: 'Ed25519',
        },
        'sfm://remote/c',
        connection,
      );

      expect(prompt && 'expectedFingerprint' in prompt).toBe(false);
    });

    it('缺 keyType 时落空串，不留 undefined', () => {
      const prompt = buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: 'x',
          fingerprint: 'SHA256:aaa',
        },
        'sfm://remote/c',
        connection,
      );

      expect(prompt?.keyType).toBe('');
    });

    it('不是主机密钥类错误一律不弹窗', () => {
      // 阳性对照：同一批数据里只有 kind 变了，结果必须是 null。
      // 没有这条，下面的「路径不匹配」等分支就可能只是判空逻辑恰好成立。
      expect(buildHostKeyTrustPrompt(
        {
          kind: 'auth',
          message: '密码错误',
        },
        'sfm://remote/c',
        connection,
      )).toBeNull();

      expect(buildHostKeyTrustPrompt(
        {
          kind: 'unreachable',
          message: '连不上',
        },
        'sfm://remote/c',
        connection,
      )).toBeNull();
    });

    it('缺 fingerprint 的主机密钥错误不弹窗', () => {
      // 后端保证这两个 kind 一定带指纹；万一哪天漏了，
      // 弹出一个指纹栏是空的确认框比不弹更糟 —— 用户点了信任也换不来任何东西。
      expect(buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: 'x',
        },
        'sfm://remote/c',
        connection,
      )).toBeNull();
    });

    it('连接查不到时宁可不弹', () => {
      // 弹窗里没有 host/port，用户点「信任」也写不进任何记录，
      // 只是把失败重来一遍 —— 比不弹更让人困惑。
      expect(buildHostKeyTrustPrompt(
        {
          kind: 'host_key_unknown',
          message: 'x',
          fingerprint: 'SHA256:aaa',
          keyType: 'Ed25519',
        },
        'sfm://remote/c',
        undefined,
      )).toBeNull();
    });

    it('路径不是远程路径，或指向另一个连接，都不弹', () => {
      const caught = {
        kind: 'host_key_unknown',
        message: 'x',
        fingerprint: 'SHA256:aaa',
        keyType: 'Ed25519',
      };

      expect(buildHostKeyTrustPrompt(caught, 'C:\\Users\\Duanyi', connection)).toBeNull();
      expect(buildHostKeyTrustPrompt(caught, 'sfm://remote/other', connection)).toBeNull();
    });
  });

  describe('applyHostKeyTrust', () => {
    const prompt: HostKeyTrustPrompt = {
      path: 'sfm://remote/c',
      host: '192.168.1.9',
      port: 22,
      fingerprint: 'SHA256:aaa',
      keyType: 'Ed25519',
      kind: 'ssh',
      changed: false,
    };

    it('首见只写一条记录，不发 forget', async () => {
      // 多发一次 forget 无害，但会让设置页「已信任主机」列表在用户点确认的瞬间闪一下。
      invokeMock.mockResolvedValue(true);

      await applyHostKeyTrust(prompt);

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('remote_trust_host', {
        host: '192.168.1.9',
        port: 22,
        fingerprint: 'SHA256:aaa',
        keyType: 'Ed25519',
        kind: 'ssh',
      });
    });

    it('证书信任带上 kind=x509，而不是默认成 ssh', () => {
      // 漏掉 kind 的后果不是「少传一个字段」，而是**把证书写进 SSH 记录**：
      // 界面上「已信任主机」看着正常，之后的 FTPS 连接却永远报「首次见到」。
      invokeMock.mockResolvedValue(true);

      return applyHostKeyTrust({
        ...prompt,
        kind: 'x509',
        keyType: 'X509',
      }).then(() => {
        expect(invokeMock).toHaveBeenCalledWith('remote_trust_host', {
          host: '192.168.1.9',
          port: 22,
          fingerprint: 'SHA256:aaa',
          keyType: 'X509',
          kind: 'x509',
        });
      });
    });

    it('变更时先删旧记录再写新记录，顺序不能反', async () => {
      const order: string[] = [];
      invokeMock.mockImplementation(async (command: string) => {
        order.push(command);
        return true;
      });

      await applyHostKeyTrust({
        ...prompt,
        changed: true,
        expectedFingerprint: 'SHA256:old',
      });

      expect(order).toEqual(['remote_forget_host', 'remote_trust_host']);
      // **两条命令都要带 kind**：漏掉的话，「删掉旧的证书信任」
      // 会变成「删掉同一台主机的 SSH 信任」—— 而用户点的是证书那一条。
      expect(invokeMock).toHaveBeenNthCalledWith(1, 'remote_forget_host', {
        host: '192.168.1.9',
        port: 22,
        kind: 'ssh',
      });
    });
  });

  describe('已信任主机管理', () => {
    it('列表走 remote_list_known_hosts', async () => {
      invokeMock.mockResolvedValue([]);

      await listKnownHosts();

      expect(invokeMock).toHaveBeenCalledWith('remote_list_known_hosts');
    });

    it('删除走 remote_forget_host 并把结果交回调用方', async () => {
      invokeMock.mockResolvedValue(true);

      await expect(forgetKnownHost('192.168.1.9', 22, 'ssh')).resolves.toBe(true);

      expect(invokeMock).toHaveBeenCalledWith('remote_forget_host', {
        host: '192.168.1.9',
        port: 22,
        kind: 'ssh',
      });
    });

    it('删证书信任时传 kind=x509，不碰同端点的 SSH 信任', () => {
      // 键是三元：同一台主机的 SSH 与证书是两行，点掉一行不该动另一行。
      invokeMock.mockResolvedValue(true);

      return forgetKnownHost('192.168.1.9', 990, 'x509').then(() => {
        expect(invokeMock).toHaveBeenCalledWith('remote_forget_host', {
          host: '192.168.1.9',
          port: 990,
          kind: 'x509',
        });
      });
    });
  });
});
