import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A stamp identifying this build. In CI the commit SHA is exact; locally the
 * build time is enough to tell two builds apart.
 */
const APP_VERSION = process.env.GITHUB_SHA?.slice(0, 7) ?? `dev-${Date.now()}`

/**
 * Writes the stamp to version.json beside index.html, so a client holding a
 * stale cached index.html (GitHub Pages caches it, a home-screen web app even
 * longer) can notice a newer deploy for itself. See src/lib/version.ts.
 */
function emitVersion(): Plugin {
  return {
    name: 'emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), emitVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // A fixed port keeps the dev server on one origin, so localStorage (settings,
  // theme, local-mode data) doesn't look "forgotten" on the next run. 5174 so it
  // can run alongside the trading dashboard on 5173.
  server: {
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
})
