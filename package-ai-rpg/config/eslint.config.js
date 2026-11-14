import { resolve } from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

//Used with --config config/eslint.config.js, see the scripts in package.json
export default defineConfig(
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  globalIgnores(["dist/", "config/"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: resolve(import.meta.dirname, ".."),
      },
    },
  },
);
