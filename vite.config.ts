import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.SERVER_PORT || process.env.SERVER_PORT || (env.PORT && env.PORT !== "1000" ? env.PORT : "") || "5000";
  let backendTarget = env.VITE_API_URL || process.env.VITE_API_URL || `http://127.0.0.1:${serverPort}`;
  // Avoid self-proxying if VITE_API_URL points to Vite's own dev port (1000)
  if (backendTarget.includes(":1000")) {
    backendTarget = `http://127.0.0.1:${serverPort}`;
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-dom") || id.includes("react-router") || id.includes("/react/")) {
                return "vendor-react";
              }
              if (id.includes("recharts")) {
                return "vendor-charts";
              }
              if (id.includes("lucide-react")) {
                return "vendor-icons";
              }
              if (id.includes("sonner") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("zustand")) {
                return "vendor-ui";
              }
            }
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 1000,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/health": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
