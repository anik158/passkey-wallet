const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Windows Native Messaging Diagnostics ---');

let localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
console.log('1. LOCALAPPDATA resolves to:', localAppData);

const installDir = path.join(localAppData, 'PassKey Wallet');
console.log('2. Install Dir:', installDir);

const nativeHostPath = path.join(installDir, 'native-host.exe');
console.log('3. Native Host Binary Path:', nativeHostPath);

const manifestDir = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
console.log('4. Chrome Manifest Dir:', manifestDir);

const manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');
console.log('5. Chrome Manifest Path:', manifestPath);

const regPath = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts';
const keyPath = `${regPath}\\com.passkey_wallet.native`;
const escapedManifestPath = manifestPath.replace(/\//g, '\\\\');

console.log('\n--- Registry Command that would be run ---');
const cmd = `reg add "${keyPath}" /ve /t REG_SZ /d "${escapedManifestPath}" /f`;
console.log(cmd);

console.log('\n--- Troubleshooting Instructions ---');
console.log('A. Does native-host.exe actually exist at Path 3?');
console.log('B. Does the JSON file actually exist at Path 5?');
console.log('C. If you open the JSON file at Path 5, does its "path" property exactly match Path 3 (with double backslashes)?');
console.log('D. If you copy the Registry Command exactly as printed above and paste it into a Command Prompt, does it say "The operation completed successfully."?');
