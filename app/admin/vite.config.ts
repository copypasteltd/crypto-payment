import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/admin/v1": {
          target: env.VITE_ADMIN_PROXY_TARGET || "http://127.0.0.1:38100",
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react-router")) return "router";
            if (id.includes("@tanstack")) return "data";
            if (id.includes("i18next")) return "i18n";
            if (id.includes(`${path.sep}react${path.sep}`) || id.includes(`${path.sep}react-dom${path.sep}`)) {
              return "react";
            }
            return "vendor";
          },
        },
      },
    },
  };
});
