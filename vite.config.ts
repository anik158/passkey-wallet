import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

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
});