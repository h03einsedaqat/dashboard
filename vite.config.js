import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { novaIncludes, novaRoot, collectPages } from './tools/nova-plugin.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = collectPages('src/pages');

export default defineConfig({
  root,
  /** Relative base keeps the built template portable (sub-folders, file servers, CDNs). */
  base: './',
  publicDir: 'public',

  plugins: [novaIncludes(), novaRoot()],

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
        silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import'],
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    fs: { strict: false },
    warmup: { clientFiles: ['./src/main.js'] },
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
