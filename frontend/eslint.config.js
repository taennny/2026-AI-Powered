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

  // 구독 상태는 서버가 단일 출처다. 화면이 setState로 plan을 직접 바꾸면
  // 결제 검증이 실패했을 때 유료 기능이 열린 채로 남는다.
  // 갱신은 subscriptionStore.refresh()만 할 수 있다.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='useSubscriptionStore'][callee.property.name='setState']",
          message:
            "구독 상태를 직접 쓰지 마세요. 서버 응답으로만 갱신됩니다 — useSubscriptionStore.getState().refresh()를 쓰세요.",
        },
      ],
    },
  },

  prettier,
];
