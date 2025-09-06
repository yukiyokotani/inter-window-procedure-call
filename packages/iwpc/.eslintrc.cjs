/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@silurus/eslint-config/react-internal.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.lint.json',
    tsconfigRootDir: __dirname
  },
  ignorePatterns: ['**/*.cjs']
};
