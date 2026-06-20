import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },

    plugins: {
      react,
      "react-hooks": hooks,
      import: importPlugin,
      "unused-imports": unusedImports,
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

      // 안쓰는 import 제거 (🔥 핵심)
      "unused-imports/no-unused-imports": "error",

      // 기본
      "no-unused-vars": "off",
    },
  },

  prettier, // 🔥 Prettier랑 충돌 제거
];
