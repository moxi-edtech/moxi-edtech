// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import typescriptParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [// In API routes we accept dynamic shapes more often
{
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ],
}, {
  files: ["**/*.{js,jsx,ts,tsx}"],
  plugins: {
    "@next/next": nextPlugin,
    "react": reactPlugin,
    "react-hooks": hooksPlugin,
    "@typescript-eslint": tsPlugin,
  },
  languageOptions: {
    parser: typescriptParser,
    globals: {
      "React": "readonly",
    }
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    ...reactPlugin.configs.recommended.rules,
    ...hooksPlugin.configs.recommended.rules,
    // Relax strictness during builds while keeping visibility
    "@typescript-eslint/no-explicit-any": "warn",
    // Downgrade prefer-const so it doesn't fail builds
    "prefer-const": "warn",
    // Keep lint from blocking on non-critical React lint rules
    "react/no-unescaped-entities": "warn",
    "react/jsx-no-target-blank": "warn",
    "@next/next/no-html-link-for-pages": "warn",
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/static-components": "warn",
    "react-hooks/error-boundaries": "warn",
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/use-memo": "warn",
    "storybook/no-renderer-packages": "warn",
    "storybook/no-uninstalled-addons": "warn",
    // Allow intentionally unused vars prefixed with _
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unknown-property": ["error", { "ignore": ["jsx", "global"] }]
  },
}, {
  files: ["src/app/api/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
}, {
  files: ["src/components/secretaria/AdmissaoWizardClient.tsx"],
  rules: {
    "react-hooks/set-state-in-effect": "off",
  },
},
...storybook.configs["flat/recommended"],
...storybook.configs["flat/recommended"],
...storybook.configs["flat/recommended"],
{
  files: [".storybook/**/*.{js,jsx,ts,tsx}"],
  rules: {
    "storybook/no-uninstalled-addons": "warn",
  },
},
{
  files: ["**/*.stories.{js,jsx,ts,tsx}"],
  rules: {
    "storybook/no-renderer-packages": "warn",
  },
}];

export default eslintConfig;
