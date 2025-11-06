/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json']
  },
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error'
  }
};

export default config;
