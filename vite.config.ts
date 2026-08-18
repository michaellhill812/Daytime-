import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_EMBED=1 produces the single-file build: one JS chunk to inline, and no
// cloud code at all. __CLOUD_BUILD__ has to be a `define` rather than an env
// lookup — rollup only drops the dynamic import when the guard folds to a
// literal `false` at compile time.
const embed = process.env.VITE_EMBED === '1';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  define: { __CLOUD_BUILD__: JSON.stringify(!embed) },
  build: embed ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
