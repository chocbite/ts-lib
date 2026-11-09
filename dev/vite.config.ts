import { defaultClientConditions, defineConfig } from "vite";

//Dev server for trying out the libraries by hand, never built or published
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ["development", ...defaultClientConditions] },
  server: { open: true },
});
