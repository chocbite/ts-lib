import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

//Used with --config config/eslint.config.js, paths below are relative to the repo root
export default defineConfig(
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  //Only the library source is linted, the config files and dev pages are not
  globalIgnores(["**/dist/", "dev/", "config/"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-array-delete": "off",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    //ts-lib must stay free of browser features, the lib setting in tsconfig.core.json also enforces this
    files: ["package-core/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "navigator",
        "location",
        "HTMLElement",
        "Element",
        "Node",
        "customElements",
        "ResizeObserver",
        "IntersectionObserver",
        "MutationObserver",
        "requestAnimationFrame",
        "getComputedStyle",
        "CSS",
        "Event",
        "KeyboardEvent",
        "MouseEvent",
        "PointerEvent",
      ],
    },
  },
);
