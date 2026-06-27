import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {jsx: true},
      },
    },

    plugins: {
      react,
      "react-hooks": hooks,
      import: importPlugin,
      "unused-imports": unusedImports,
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      // React
      "react/react-in-jsx-scope": "off",

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // import 정리
      "import/order": [
        "warn",
        {
          groups: [["builtin", "external"], "internal", ["parent", "sibling"]],
          "newlines-between": "always",
        },
      ],

      // 안쓰는 import 제거
      "unused-imports/no-unused-imports": "error",

      // JS no-unused-vars 끄고 TS 버전 사용
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",

      // TS에서 no-undef 오탐 방지
      "no-undef": "off",
    },
  },

  prettier,
];
