import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// stamped into the bundle so the running build can be identified on a device,
// which is the only way to tell a bad fix from a cached page. Railway exposes
// the commit it built from; locally, ask git; failing both, fall back to a time.
const BUILD_ID = (() => {
  const fromRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromRailway) return fromRailway.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
})();

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react()],
  build: {
    rollupOptions: {
      // two pages from one build: the Couch App at / and the 449 Exchange at /exchange/
      input: {
        main: resolve(__dirname, 'index.html'),
        exchange: resolve(__dirname, 'exchange/index.html')
      }
    }
  },
  server: {
    port: 3000
  },
  preview: {
    allowedHosts: true
  }
});
