import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  // Alchemy adds the Cloudflare plugin when it deploys. A plain `vite build` has no such module to resolve.
  build: { rollupOptions: { external: ["cloudflare:workers"] } },
});
