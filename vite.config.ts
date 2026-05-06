import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — cached separately, changes rarely
          "vendor-react": ["react", "react-dom"],
          // Animation — motion is large (~120 kB min)
          "vendor-motion": ["motion"],
          // Landing-only heavy deps — globe + dotted map only load on /
          "vendor-landing": ["cobe", "svg-dotted-map"],
        },
      },
    },
  },
});
