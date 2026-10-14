import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      setupFiles: [fileURLToPath(new URL('./src/test-support/vitest-setup.ts', import.meta.url))],
      // FORK-MODIFICATION: 全量单测在本机会并行跑 175 个测试文件，
      // 默认 5 秒阈值下即便不改任何代码也会假红（基线同样复现）。
      // 假红比没有门禁更糟：它会诱导下一个人去"修"一个不存在的缺陷。
      testTimeout: 30000,
    },
  }),
);
