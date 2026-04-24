import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy OAuth token requests to bypass CORS
      '/api/oauth/token': {
        target: 'https://id-shadow.sage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oauth\/token/, '/oauth/token'),
        secure: true,
      },
      // Proxy Sage Core API requests
      '/api/sage-core': {
        target: 'https://api.sandbox.sbc.sage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sage-core/, ''),
        secure: true,
      },
      // Proxy Sage Subscription API requests
      '/api/sage-subscriptions': {
        target: 'https://api.sandbox.sbc.sage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sage-subscriptions/, '/slcsadapter/v2'),
        secure: true,
      },
      // Proxy Doc Intelligence OAuth token requests
      '/doc-auth': {
        target: 'https://id-shadow.sage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/doc-auth/, ''),
        secure: true,
      },
      // Proxy Doc Intelligence Mercury API requests
      '/doc-ai': {
        target: 'https://models.mercury.pre-production.eu-west-1.sageai.sagecloudops.com/external',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/doc-ai/, ''),
        secure: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
