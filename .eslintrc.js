module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: [
    'plugin:vue/essential',
    '@vue/standard'
  ],
  parserOptions: {
    parser: 'babel-eslint'
  },
  plugins: [
    'only-warn'
  ],
  rules: {
    'no-console': 'off',
    'no-debugger': 'off',
    'brace-style': [2, 'stroustrup', { allowSingleLine: true }],
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
    'comma-dangle': 'warn',
    'padded-blocks': 'warn',
    'space-before-function-paren': 'warn',
    'indent': 'warn',
    'no-unreachable': 'warn'
  }
}
