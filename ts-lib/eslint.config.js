import { defineConfig } from "eslint/config";
import base from "../config/eslint.base.js";

//ts-lib must stay free of browser features, the lib setting in tsconfig.json also enforces this
export default defineConfig(base, {
  rules: {
    "no-restricted-globals": [
      "error",
      "window", "document", "localStorage", "sessionStorage", "navigator", "location", "HTMLElement", "Element", "Node", "customElements", "ResizeObserver", "IntersectionObserver", "MutationObserver", "requestAnimationFrame", "getComputedStyle", "CSS", "Event", "KeyboardEvent", "MouseEvent", "PointerEvent",
    ],
  },
});
