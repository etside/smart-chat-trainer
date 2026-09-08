import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    outDir: "dist-pwa",
    emptyOutDir: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
