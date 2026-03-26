import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { run } from 'vite-plugin-run';
import { assertNoRestrictedBackgroundSourceImport } from './src/build/background-source-import-guard';

const host = process.env.TAURI_DEV_HOST;

const backgroundSourceImportGuard = {
  name: 'background-source-import-guard',
  load(id: string) {
    assertNoRestrictedBackgroundSourceImport(id);
    return null;
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    backgroundSourceImportGuard,
    run([
      {
        name: 'Sync License Headers',
        run: ['npm', 'run', 'sync-license'],
        pattern: ['src/**/*.{vue,ts,js}', 'src-tauri/src/**/*.rs'],
      },
      {
        name: 'Sync i18n Files',
        run: ['npm', 'run', 'sync-i18n'],
        pattern: ['src/localization/**/*.json'],
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  clearScreen: false, // Prevent vite from obscuring rust errors
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/target/**', '**/node_modules/**'],
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (
          typeof warning.message === 'string'
          && warning.message.includes('dynamically imported')
          && warning.message.includes('dynamic import will not move module into another chunk')
        ) {
          return;
        }

        defaultHandler(warning);
      },
    },
    target:
      process.env.TAURI_ENV_PLATFORM == 'windows'
        ? 'chrome138'
        : 'safari17',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
