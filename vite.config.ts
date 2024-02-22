import {fileURLToPath, URL} from 'node:url';
import vuePlugin from '@vitejs/plugin-vue';
import {defineConfig} from 'vite';
import eslintPlugin from 'vite-plugin-eslint';
import stylelintPlugin from 'vite-plugin-stylelint';

export default defineConfig({
  server: {
    port: 5180
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  publicDir: './src/public',
  clearScreen: false,
  envPrefix: ['VITE_', '_TAURI'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: './dist'
  },
  plugins: [
    vuePlugin(),
    stylelintPlugin({fix: true}),
    eslintPlugin({
      fix: true,
      include: ['src/**/*.{js,ts,d.ts,jsx,tsx,vue,vue.ts}']
    })
  ]
});
