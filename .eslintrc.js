/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json']
  },
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error'
  }
};

module.exports = config;