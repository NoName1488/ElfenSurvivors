import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      /*
       * Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
       *
       * release/ is excluded because electron-builder writes a running executable there.
       * Watching it while the packaged app is open throws EBUSY from the OS and takes the
       * whole dev server down - which is exactly what happens if you build the desktop app
       * without stopping `npm run dev` first.
       */
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : { ignored: ['**/release/**', '**/dist/**', '**/.baseline/**'] },
    },
  };
});
