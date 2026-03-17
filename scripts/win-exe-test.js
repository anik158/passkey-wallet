const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('--- Executable Launch Test ---');

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const exePath = path.join(localAppData, 'PassKey Wallet', 'native-host.exe');

console.log('Attempting to launch:', exePath);

try {
    const result = spawnSync(exePath, [], { stdio: 'pipe', encoding: 'utf-8' });
    if (result.error) {
        console.error('Launch failed with error:', result.error.message);
    } else {
        console.log('Launch succeeded!');
        console.log('Status Code:', result.status);
        if (result.stdout) console.log('Stdout:', result.stdout.substring(0, 100));
        if (result.stderr) console.log('Stderr:', result.stderr.substring(0, 100));
    }
} catch (err) {
    console.error('Exception during launch:', err.message);
}
