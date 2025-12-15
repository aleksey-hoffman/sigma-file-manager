import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
// import tailwindcss from '@tailwindcss/vite';
import { run } from 'vite-plugin-run';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // tailwindcss(),
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
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM == 'windows'
        ? 'chrome138'
        : 'safari17',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
