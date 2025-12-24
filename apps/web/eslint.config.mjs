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
}, ...storybook.configs["flat/recommended"], ...storybook.configs["flat/recommended"], ...storybook.configs["flat/recommended"]];

export default eslintConfig;

