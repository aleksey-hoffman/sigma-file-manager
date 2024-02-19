import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import vuePlugin from '@vitejs/plugin-vue';
import {defineConfig} from 'vite';
import eslintPlugin from 'vite-plugin-eslint';
import stylelintPlugin from 'vite-plugin-stylelint';
// import {run} from 'vite-plugin-run';

export default defineConfig({
  server: {
    port: 5180
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.vue', '.json', '.scss'],
    alias: {'@': resolve(dirname(fileURLToPath(import.meta.url)), 'src')}
  },
  publicDir: resolve('./src/public'),
  clearScreen: false,
  envPrefix: ['VITE_', '_TAURI'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: resolve('./dist')
  },
  plugins: [
    vuePlugin({
      script: {
        defineModel: true
      }
    }),
    stylelintPlugin({fix: true}),
    eslintPlugin({
      fix: true,
      include: ['src/**/*.{js, ts, d.ts, jsx, tsx, vue, vue.ts}']
    })
    // TODO: throwing ENOENT error on Linux
    // run([
    //   {
    //     name: 'sync-i18n',
    //     pattern: ['src/localization/messages/**/*'],
    //     run: ['sync-i18n'],
    //     delay: 200
    //   },
    //   {
    //     name: 'sync-license',
    //     pattern: ['src/**/*.{vue, html, js, ts}'],
    //     run: ['sync-license'],
    //     delay: 200
    //   },
    //   {
    //     name: 'sync-license-tauri',
    //     pattern: ['src-tauri/**/*.{rs}'],
    //     run: ['sync-license'],
    //     delay: 200
    //   }
    // ])
  ]
});
