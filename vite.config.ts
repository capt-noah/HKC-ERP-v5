import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = env.PORT || env.SERVER_PORT || process.env.PORT || process.env.SERVER_PORT || "8787";
  let backendTarget = env.VITE_API_URL || process.env.VITE_API_URL || `http://127.0.0.1:${serverPort}`;
  // Avoid self-proxying if VITE_API_URL is set to Vite's own dev port (3000)
  if (backendTarget.includes(":3000")) {
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
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-charts": ["recharts"],
            "vendor-motion": ["framer-motion"],
            "vendor-icons": ["lucide-react"],
            "vendor-ui": ["sonner", "clsx", "tailwind-merge", "zustand"],
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
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
