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
              input: {
                index: 'src/main/index.js',
                'preload-extension': 'src/preload-extension.js',
              },
              external: [
                'better-sqlite3-multiple-ciphers',
                'active-win',
                'argon2',
                'electron-store',
                'mock-aws-s3',
                'aws-sdk',
                'nock',
                'electron'
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
      }
    }
  }
});