import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
import pluginStylistic from '@stylistic/eslint-plugin';
import checkFile from 'eslint-plugin-check-file';
import pluginVueI18n from '@intlify/eslint-plugin-vue-i18n';

export default defineConfigWithVueTs(
  // `_acceptance/**` 是真机验收的临时探针区（NSIS 探针工程、一次性 .mjs/.ps1 脚本）。
  // 它与 `.gitignore` 里的 `/_acceptance/` 是同一件事，但 eslint 不读 .gitignore ——
  // 少了这条规则，光探针脚本就会往门禁里灌进 600 多个错误，把真实问题淹掉。
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/e2e-webdriver/**', 'src-tauri/**', '_acceptance/**']),
  pluginVue.configs['flat/strongly-recommended'],
  vueTsConfigs.recommended,
  pluginStylistic.configs.customize({
    semi: true,
  }),
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      'vitest/valid-expect': 'off',
    },
  },
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'func-style': ['error', 'declaration', { allowTypeAnnotation: true }],
      'vue/max-attributes-per-line': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/one-component-per-file': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase', {
        registeredComponentsOnly: true,
        ignores: [],
        globals: ['RouterView', 'Teleport', 'Component', 'Transition', 'TransitionGroup'],
      }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            multiline: true,
            consistent: true,
          },
          ObjectPattern: { multiline: true },
          ImportDeclaration: {
            multiline: true,
            minProperties: 5,
          },
          ExportDeclaration: { multiline: true },
          TSTypeLiteral: {
            multiline: true,
            consistent: true,
            minProperties: 2,
          },
          TSInterfaceBody: {
            multiline: true,
            consistent: true,
            minProperties: 2,
          },
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'block-like',
        },
      ],
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*': 'KEBAB_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
      'check-file/folder-naming-convention': [
        'error',
        {
          '**/': 'KEBAB_CASE',
        },
        {
          ignoreWords: ['__tests__'],
        },
      ],
    },
    settings: {
      'vue-i18n': {
        localeDir: './src/localization/messages/*.json',
      },
    },
  },
  {
    files: ['src/**/*.vue'],
    plugins: {
      '@intlify/vue-i18n': pluginVueI18n,
    },
    rules: {
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          ignoreNodes: ['v-icon'],
          ignoreText: [
            '(',
            ')',
            '(+',
            '[',
            ']',
            '{',
            '}',
            ',',
            '.',
            '...',
            ';',
            ':',
            '"',
            '\'',
            '+',
            '-',
            '=',
            '%',
            '@',
            '|',
            '/',
            '\\',
            ' ',
            '—',
            '·',
            'Alt',
            'Ctrl',
            'Shift',
            'Meta',
            'Enter',
            '⚠',
            'Esc',
            'Tab',
            'Shift+Tab',
            'Ctrl+F',
            'Ctrl+Shift+G',
            'Ctrl+P',
            '↑↓',
          ],
        },
      ],
    },
  },
);
