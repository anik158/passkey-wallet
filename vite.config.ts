import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    electron({
      main: {
        entry: 'src/main/index.js',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'better-sqlite3-multiple-ciphers',
                'active-win',
                'argon2',
                'electron-store',
                'mock-aws-s3', // Just in case
                'aws-sdk',
                'nock'
              ]
            }
          }
        }
      },
      preload: {
        input: 'src/preload.js',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        dashboard: path.resolve(__dirname, 'src/render/dashboard.html'),
        overlay: path.resolve(__dirname, 'src/render/overlay.html'),
        login: path.resolve(__dirname, 'src/render/login.html'),
        'extension-prompt': path.resolve(__dirname, 'src/render/extension-prompt.html'),
        'browser-setup': path.resolve(__dirname, 'src/render/browser-setup.html'),
      }
    }
  }
});