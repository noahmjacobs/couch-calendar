import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// stamped into the bundle so the running build can be identified on a device,
// which is the only way to tell a bad fix from a cached page
const BUILD_ID = new Date()
  .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  .replace(',', '')

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
  server: {
    port: 3000
  },
  preview: {
    allowedHosts: true
  }
});
