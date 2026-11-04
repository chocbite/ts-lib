import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  globalIgnores([
    "dist/*",
    "eslint.config.js",
    "vite.config.ts",
    "vitest.config.ts",
    "tsdown.config.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-array-delete": "off",
      //state relied on noUncheckedIndexedAccess, which is off in the monorepo for now
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
