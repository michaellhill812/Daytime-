import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Two pages, no cloud. `__CLOUD_BUILD__` still has to be defined because the
// app's own modules reference it; false keeps the Supabase import out.
export default defineConfig({
  root: here,
  plugins: [react()],
  define: { __CLOUD_BUILD__: 'false' },
  build: {
    outDir: resolve(here, '../../.harness-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        signin: resolve(here, 'signin.html'),
        people: resolve(here, 'people.html'),
      },
    },
  },
});
