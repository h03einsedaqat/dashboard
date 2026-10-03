import { defineConfig } from 'vite';
import path from 'node:path';
import zlib from 'node:zlib';
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

/**
 * Dev-server compression.
 *
 * Vite ships every module verbatim, so a phone on a real 4G link downloaded
 * ~11 MB of text (unminified page controllers, the whole SCSS, three locale
 * packs, ~80 requests) before the first paint — the preview took half a minute
 * to show a page. gzip on the way out turns that into ~1.5 MB with no change
 * to what the browser executes; the production build is unaffected (`apply:
 * 'serve'`).
 */
/**
 * Vite hands every module to the browser with its whole source embedded as a
 * `data:` source map — `modules.js` left the server as 2.8 MB although the file
 * on disk is 467 KB. The map is stripped here (dev only): the trade is one
 * devtools convenience for a six-fold smaller payload on a phone.
 */
function stripInlineMap(body) {
  const text = body.toString('utf8');
  const at = text.lastIndexOf('//# sourceMappingURL=data:');
  if (at === -1) return body;
  const eol = text.indexOf('\n', at);
  return Buffer.from(text.slice(0, at) + (eol === -1 ? '' : text.slice(eol + 1)), 'utf8');
}

function novaCompression({ threshold = 1024 } = {}) {
  return {
    name: 'nova-compression',
    apply: 'serve',
    configureServer(server) {
      /* eslint-disable-next-line consistent-return */
      server.middlewares.use((req, res, next) => {
        const accept = String(req.headers['accept-encoding'] ?? '');
        if (!/\bgzip\b/.test(accept) || req.headers.range) return next();
        const chunks = [];
        let skipped = false;
        const finish = res.end.bind(res);
        const flushWrite = res.write.bind(res);
        res.write = (chunk, encoding, callback) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
          if (typeof encoding === 'function') encoding();
          else if (typeof callback === 'function') callback();
          return true;
        };
        res.end = (chunk, encoding, callback) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
          }
          if (typeof encoding === 'function') encoding();
          else if (typeof callback === 'function') callback();
          const raw = Buffer.concat(chunks);
          const type = String(res.getHeader('content-type') ?? '');
          const body = /javascript/.test(type) ? stripInlineMap(raw) : raw;
          const compressible =
            !skipped &&
            res.statusCode !== 204 &&
            res.statusCode !== 304 &&
            !res.getHeader('content-encoding') &&
            body.length >= threshold &&
            /^(?:text\/|application\/(?:javascript|json|xml|manifest\+json)|image\/svg)/.test(type);
          if (!compressible) {
            if (!res.getHeader('content-length') && !res.headersSent) res.setHeader('content-length', body.length);
            finish(body);
            return res;
          }
          const gzipped = zlib.gzipSync(body, { level: 6 });
          res.removeHeader('content-length');
          res.setHeader('content-encoding', 'gzip');
          res.setHeader('vary', 'Accept-Encoding');
          res.setHeader('content-length', gzipped.length);
          finish(gzipped);
          return res;
        };
        /* A response already streamed by an earlier middleware is left alone. */
        res.on('pipe', () => {
          skipped = true;
          res.write = flushWrite;
        });
        next();
      });
    },
  };
}

export default defineConfig({
  root,
  /** Relative base keeps the built template portable (sub-folders, file servers, CDNs). */
  base: './',
  publicDir: 'public',

  plugins: [novaIncludes(), novaRoot(), novaHeartbeat(), novaCompression()],

  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '~': path.resolve(root, 'node_modules'),
    },
  },

  css: {
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'if-function'],
        quietDeps: true,
      },
    },
  },

  esbuild: {
    target: 'es2020',
    legalComments: 'none',
    sourcemap: false,
    // Drop console in production for smaller bundle
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
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
    include: ['apexcharts', 'sortablejs', 'sweetalert2', 'dayjs', 'jalaali-js', 'bootstrap'],
    exclude: ['@swc/wasm', 'lightningcss'],
    holdUntilCrawlEnd: true,
    esbuildOptions: {
      target: 'es2020',
    },
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
    cssMinify: 'esbuild',
    minify: 'esbuild',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1200,
    reportCompressedSize: false,
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
            if (id.includes('dayjs') || id.includes('jalaali')) return 'vendor-date';
            return 'vendor';
          }
          // Split large page controllers
          if (id.includes('src/js/pages/modules.js')) return 'modules';
          if (id.includes('src/js/pages/content.js')) return 'content';
          if (id.includes('src/js/pages/apps.js')) return 'apps';
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
