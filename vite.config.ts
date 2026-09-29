import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"

export default defineConfig({
  // Relative asset paths so the build works under any sub-path (e.g. GitHub Pages /senanla/).
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { chunkSizeWarningLimit: 1024 },
})
