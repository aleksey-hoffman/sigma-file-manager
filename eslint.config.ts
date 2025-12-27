import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
import pluginOxlint from 'eslint-plugin-oxlint';
import pluginStylistic from '@stylistic/eslint-plugin';
import checkFile from 'eslint-plugin-check-file';
import pluginVueI18n from '@intlify/eslint-plugin-vue-i18n';

export default defineConfigWithVueTs(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'src-tauri/**']),
  pluginVue.configs['flat/strongly-recommended'],
  vueTsConfigs.recommended,
  pluginStylistic.configs.customize({
    semi: true,
  }),
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },
  ...pluginOxlint.configs['flat/recommended'],
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Use alias imports (@/) instead of relative parent imports (../)',
            },
          ],
        },
      ],
      'func-style': ['error', 'declaration', { allowTypeAnnotation: true }],
      'vue/max-attributes-per-line': 'error',
      'vue/multi-word-component-names': 'off',
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
