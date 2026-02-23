import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'src/main/index.js',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'better-sqlite3-multiple-ciphers',
                'active-win',
                'argon2',
                'electron-store',
                'mock-aws-s3',
                'aws-sdk',
                'nock'
              ]
            }
          }
        }
      },
      {
        entry: 'src/preload.js',
        onstart(options) { options.reload(); }
      },
      {
        entry: 'src/preload-extension.js',
        onstart(options) { options.reload(); }
      },
    ]),
  ],
  build: {
    rollupOptions: {
      input: {
        dashboard: path.resolve(__dirname, 'src/render/dashboard.html'),
        overlay: path.resolve(__dirname, 'src/render/overlay.html'),
        login: path.resolve(__dirname, 'src/render/login.html'),
        'extension-prompt': path.resolve(__dirname, 'src/render/extension-prompt.html'),
      }
    }
  }
});