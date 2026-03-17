const fs = require('fs');
const path = require('path');
const os = require('os');

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const installDir = path.join(localAppData, 'PassKey Wallet');
const exePath = path.join(installDir, 'native-host.exe');

console.log('--- Windows Installation Verification ---');
console.log('1. Checking install directory:', installDir);
console.log('Directory exists:', fs.existsSync(installDir));

if (fs.existsSync(installDir)) {
    console.log('Contents:', fs.readdirSync(installDir).join(', '));
}

console.log('\n2. Checking executable:', exePath);
console.log('Executable exists:', fs.existsSync(exePath));

const manifestPath = path.join(installDir, 'com.passkey_wallet.native_chrome.json');
console.log('\n3. Checking Chrome manifest:', manifestPath);
console.log('Manifest exists:', fs.existsSync(manifestPath));

if (fs.existsSync(manifestPath)) {
    console.log('Manifest contents:');
    console.log(fs.readFileSync(manifestPath, 'utf8'));
}

const { execSync } = require('child_process');
console.log('\n4. Checking Chrome Registry Key:');
try {
    const output = execSync('reg query "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.passkey_wallet.native" /ve', { encoding: 'utf8' });
    console.log(output.trim());
} catch (e) {
    console.log('Registry key not found or error:', e.message);
}
