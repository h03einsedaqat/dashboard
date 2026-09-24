import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { novaIncludes, novaRoot, collectPages } from './tools/nova-plugin.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = collectPages('src/pages');

/**
 * Answers the dev-server keep-alive ping (`initKeepAlive()` in
 * src/js/core/load.js). Returning 204 keeps the response free of CORS and
 * content-type noise while proving the socket is still alive.
 */
function novaHeartbeat() {
  return {
    name: 'nova-heartbeat',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__nova-heartbeat', (_req, res) => {
        res.statusCode = 204;
        res.setHeader('Cache-Control', 'no-store');
        res.end();
      });
    },
  };
}

export default defineConfig({
  root,
  /** Relative base keeps the built template portable (sub-folders, file servers, CDNs). */
  base: './',
  publicDir: 'public',

  plugins: [novaIncludes(), novaRoot(), novaHeartbeat()],

  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '~': path.resolve(root, 'node_modules'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'if-function'],
        quietDeps: true,
      },
    },
  },

  /**
   * Long-lived previews sit behind a proxy that drops idle sockets, which made
   * Vite's client report “connection lost” after about a minute of inactivity.
   * The overlay is silenced (`initConnectivity()` in src/js/core/load.js already
   * explains the state to the user) and the keep-alive tick is answered by the
   * dev server itself, so the proxy keeps seeing traffic.
   */
  /**
   * Pre-bundle every runtime dependency up front. Without this, Vite found
   * `apexcharts`, `sortablejs` and `sweetalert2` lazily — the first time a page
   * with a chart/kanban/dialog was opened — re-optimised, and invalidated the
   * chunks the open tab was using. The result was the «page suddenly errors
   * and nothing works until I restart» experience while clicking around.
   */
  optimizeDeps: {
    entries: ['index.html', 'src/pages/**/*.html'],
    include: ['apexcharts', 'sortablejs', 'sweetalert2', 'dayjs', 'jalaali-js'],
    holdUntilCrawlEnd: true,
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    fs: { strict: false },
    warmup: { clientFiles: ['./src/main.js', './src/js/pages/*.js', './src/js/core/*.js'] },
    hmr: { overlay: false },
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: path.resolve(root, 'index.html'),
        ...pages,
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('apexcharts')) return 'vendor-charts';
            if (id.includes('bootstrap')) return 'vendor-bootstrap';
            if (id.includes('sweetalert2')) return 'vendor-swal';
            if (id.includes('sortablejs')) return 'vendor-sortable';
            return 'vendor';
          }
          return undefined;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (asset) => {
          const name = asset.names?.[0] ?? asset.name ?? '';
          if (/\.(woff2?|ttf|eot)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)) return 'assets/img/[name]-[hash][extname]';
          if (/\.css$/i.test(name)) return 'assets/css/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
