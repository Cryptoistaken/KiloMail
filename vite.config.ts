import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";

function inlineCss(): Plugin {
  return {
    name: "inline-css",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist")
      const htmlPath = path.join(dist, "index.html")
      if (!fs.existsSync(htmlPath)) return
      let html = fs.readFileSync(htmlPath, "utf-8")
      const cssLinks = html.match(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g)
      if (!cssLinks) return
      for (const link of cssLinks) {
        const cssPath = path.join(dist, link.match(/href="([^"]+)"/)![1].replace(/^\//, ""))
        if (!fs.existsSync(cssPath)) continue
        const css = fs.readFileSync(cssPath, "utf-8")
        html = html.replace(link, `<style>${css}</style>`)
        try { fs.unlinkSync(cssPath) } catch {}
      }
      fs.writeFileSync(htmlPath, html, "utf-8")
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-landing": ["svg-dotted-map"],
        },
      },
    },
  },
});
