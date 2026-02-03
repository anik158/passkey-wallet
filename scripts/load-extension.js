#!/usr/bin/env node

/**
 * Browser Extension Auto-Installer
 * Opens Chrome with extension loaded automatically
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '..', 'browser-extension', 'chromium');

// Check if extension exists
if (!fs.existsSync(extensionPath)) {
    console.error('Extension not found at:', extensionPath);
    process.exit(1);
}

console.log('Opening Chrome with PassKey Wallet extension...');
console.log('Extension path:', extensionPath);

// Open Chrome with extension loaded
const chromeCommand = `google-chrome --load-extension="${extensionPath}" --new-window "chrome://extensions" 2>/dev/null &`;

exec(chromeCommand, (error) => {
    if (error) {
        console.error('Failed to open Chrome:', error.message);
        console.log('\nManual steps:');
        console.log('1. Open chrome://extensions');
        console.log('2. Enable "Developer mode"');
        console.log('3. Click "Load unpacked"');
        console.log(`4. Select: ${extensionPath}`);
        process.exit(1);
    }

    console.log('✓ Chrome opened with extension!');
    console.log('The extension should now be loaded and ready to use.');
});
