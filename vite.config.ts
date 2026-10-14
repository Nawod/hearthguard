import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/ws": { target: "ws://127.0.0.1:5190", ws: true } } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("node_modules")
            ? id.includes("rapier")
              ? "physics"
              : id.includes("three")
                ? "graphics"
                : id.includes("react")
                  ? "interface"
                  : undefined
            : undefined,
      },
    },
  },
});
