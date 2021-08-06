/* eslint-disable header/header */

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  env: {
    es6: true,
    node: true
  },
  parserOptions: {
    "project": "tsconfig.json",
    "sourceType": "module",
  },
  plugins: [
    "@typescript-eslint",
    "@typescript-eslint/tslint",
    "header",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "header/header": [2, "./header.js"],
    "@typescript-eslint/no-use-before-define": ["error", { "functions": false, "classes": false }],
    "@typescript-eslint/no-unused-vars": [1],
    "@typescript-eslint/explicit-function-return-type": [1, { "allowExpressions": true }],
    "indent": ["error", 2, { "SwitchCase": 1 }],
    "eol-last": ["error"],
    "space-infix-ops": ["error", { "int32Hint": false }],
    "no-multi-spaces": ["error", { "ignoreEOLComments": true }],
    "keyword-spacing": ["error"],
    "semi": ["error"]
  },

};
