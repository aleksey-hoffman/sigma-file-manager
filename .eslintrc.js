module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/recommended',
    '@vue/standard',
    'plugin:@intlify/vue-i18n/recommended',
  ],
  parserOptions: {
    parser: 'babel-eslint',
  },
  plugins: [
    'only-warn',
  ],
  rules: {
    'no-console': 'off',
    'no-debugger': 'off',
    'brace-style': [2, 'stroustrup', {allowSingleLine: true}],
    'vue/valid-v-on': 'warn',
    'vue/no-side-effects-in-computed-properties': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/valid-v-for': 'warn',
    'no-use-before-define': 'warn',
    'new-cap': 'warn',
    'no-undef': 'warn',
    'no-tabs': 'off',
    'import/first': 'off',
    'no-unused-vars': 'off',
    'eol-last': 'off',
    'quote-props': 'off',
    'standard/no-callback-literal': 'off',
    'no-template-curly-in-string': 'off',
    'prefer-promise-reject-errors': 'off',
    'no-return-await': 'off',
    'prefer-const': 'off',
    'no-multiple-empty-lines': 'warn',
    'no-trailing-spaces': 'warn',
    'handle-callback-err': 'warn',
    'import/no-webpack-loader-syntax': 'warn',
    'no-mixed-operators': 'warn',
    'no-useless-catch': 'warn',
    'no-useless-escape': 'warn',
    'no-return-assign': 'warn',
    'operator-linebreak': 'warn',
    'camelcase': 'warn',
    'no-global-assign': 'warn',
    'comma-dangle': ['error', 'always-multiline'],
    'padded-blocks': 'warn',
    'space-before-function-paren': 'warn',
    'indent': 'warn',
    'no-unreachable': 'warn',
    'object-curly-spacing': ['error', 'never', {'arraysInObjects': true}],
    'block-spacing': ['error', 'never'],
    'semi': ['error', 'never'],
    'vue/max-attributes-per-line': ['error', {
      'singleline': {
        'max': 1,
      },
      'multiline': {
        'max': 1,
      },
    }],
    'vue/html-indent': ['error', 2, {
      'attribute': 1,
      'baseIndent': 1,
      'closeBracket': 0,
      'alignAttributesVertically': true,
      'ignores': [],
    }],
    'vue/html-self-closing': ['error', {
      'html': {
        'void': 'always',
        'normal': 'always',
        'component': 'always',
      },
    }],
    'vue/no-v-html': 'off',
    'vue/mustache-interpolation-spacing': ['error', 'never'],
    'vue/component-definition-name-casing': ['error', 'kebab-case'],
    'vue/order-in-components': 'off',
    '@intlify/vue-i18n/no-raw-text': [
      'error',
      {
        'ignoreNodes': ['v-icon'],
        'ignoreText': ['(', ')', '[', ']', '{', '}', ',', '.', '...', ';', ':', '"', '\'', '+', '-', '=', '%', '@', '/', '\\', ' '],
      },
    ],
    '@intlify/vue-i18n/no-missing-keys': ['error'],
    '@intlify/vue-i18n/no-unused-keys': ['error'],
    '@intlify/vue-i18n/valid-message-syntax': ['error'],
  },
  settings: {
    'vue-i18n': {
      localeDir: './src/localization/locales/*.{json}',
    },
  },
}
