const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('=== Electron Build Debug Info ===');
console.log('__dirname:', __dirname);
console.log('app.getAppPath():', app.getAppPath());
console.log('process.resourcesPath:', process.resourcesPath);
console.log('Expected HTML path:', path.join(__dirname, '../render/login.html'));
console.log('Icon path:', path.resolve(__dirname, '../public/passkey_wallet.svg'));

// Check if files exist
const fs = require('fs');
const htmlPath = path.join(__dirname, '../render/login.html');
const iconPath = path.resolve(__dirname, '../public/passkey_wallet.svg');

console.log('HTML exists?', fs.existsSync(htmlPath));
console.log('Icon exists?', fs.existsSync(iconPath));

// List files in render directory
try {
    const renderDir = path.join(__dirname, '../render');
    console.log('Render directory contents:', fs.readdirSync(renderDir));
} catch (e) {
    console.log('Cannot read render directory:', e.message);
}
