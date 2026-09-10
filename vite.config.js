import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { execSync } from 'node:child_process';

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
  server: {
    port: 3000
  },
  preview: {
    allowedHosts: true
  }
});
