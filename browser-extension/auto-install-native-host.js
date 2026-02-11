import { getDefaultBrowser, getInstalledBrowsers } from '../../src/main/browserDetector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMIUM_EXTENSION_ID = 'tygqvasnoghptkmhusdzktfyboigejxl';
const FIREFOX_EXTENSION_ID = 'passkey-wallet@passkey-wallet.com';

export async function autoInstallNativeHost() {
    console.log('[Auto-Installer] Starting native host auto-installation...');

    const defaultBrowser = await getDefaultBrowser();
    const installedBrowsers = await getInstalledBrowsers();

    console.log('[Auto-Installer] Default browser:', defaultBrowser);
    console.log('[Auto-Installer] Installed browsers:', installedBrowsers);

    const results = {
        success: [],
        failed: [],
        defaultBrowser: defaultBrowser
    };

    const installDir = getNativeHostInstallDir();
    const nativeHostPath = getNativeHostExecutablePath(installDir);

    await ensureNativeHostInstalled(installDir, nativeHostPath);

    if (defaultBrowser !== 'unknown' && installedBrowsers.includes(defaultBrowser)) {
        console.log(`[Auto-Installer] Installing for default browser: ${defaultBrowser}`);
        const result = await installForBrowser(defaultBrowser, nativeHostPath);
        if (result) {
            results.success.push(defaultBrowser);
        } else {
            results.failed.push(defaultBrowser);
        }
    }

    for (const browser of installedBrowsers) {
        if (browser !== defaultBrowser) {
            console.log(`[Auto-Installer] Installing for fallback browser: ${browser}`);
            const result = await installForBrowser(browser, nativeHostPath);
            if (result) {
                results.success.push(browser);
            } else {
                results.failed.push(browser);
            }
        }
    }

    console.log('[Auto-Installer] Installation complete!');
    console.log('[Auto-Installer] Success:', results.success);
    console.log('[Auto-Installer] Failed:', results.failed);

    return results;
}

function getNativeHostInstallDir() {
    const platform = os.platform();

    if (platform === 'win32') {
        return path.join(process.env.LOCALAPPDATA, 'PassKey Wallet');
    } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library/Application Support/PassKey Wallet');
    } else {
        return path.join(os.homedir(), '.local/share/passkey-wallet');
    }
}

function getNativeHostExecutablePath(installDir) {
    const platform = os.platform();
    const ext = platform === 'win32' ? '.exe' : '';
    return path.join(installDir, `native-host${ext}`);
}

async function ensureNativeHostInstalled(installDir, nativeHostPath) {
    if (fs.existsSync(nativeHostPath)) {
        console.log('[Auto-Installer] Native host already installed');
        return;
    }

    console.log('[Auto-Installer] Installing native host binary...');

    fs.mkdirSync(installDir, { recursive: true });

    const platform = os.platform();
    let sourceBinary;

    if (platform === 'win32') {
        sourceBinary = path.join(__dirname, 'dist/native-host-win.exe');
    } else if (platform === 'darwin') {
        sourceBinary = path.join(__dirname, 'dist/native-host-macos');
    } else {
        sourceBinary = path.join(__dirname, 'dist/native-host-linux');
    }

    if (!fs.existsSync(sourceBinary)) {
        throw new Error(`Native host binary not found: ${sourceBinary}`);
    }

    fs.copyFileSync(sourceBinary, nativeHostPath);

    if (platform !== 'win32') {
        fs.chmodSync(nativeHostPath, 0o755);
    }

    console.log('[Auto-Installer] Native host installed to:', nativeHostPath);
}

async function installForBrowser(browser, nativeHostPath) {
    try {
        if (browser === 'firefox') {
            return await installForFirefox(nativeHostPath);
        } else {
            return await installForChromium(browser, nativeHostPath);
        }
    } catch (error) {
        console.error(`[Auto-Installer] Failed to install for ${browser}:`, error);
        return false;
    }
}

async function installForChromium(browser, nativeHostPath) {
    const manifestDir = getChromiumManifestDir(browser);

    if (!manifestDir) {
        console.error(`[Auto-Installer] Unable to determine manifest directory for ${browser}`);
        return false;
    }

    fs.mkdirSync(manifestDir, { recursive: true });

    const manifest = {
        name: 'com.passkey_wallet.native',
        description: 'PassKey Wallet Native Messaging Host',
        path: nativeHostPath,
        type: 'stdio',
        allowed_origins: [
            `chrome-extension://${CHROMIUM_EXTENSION_ID}/`
        ]
    };

    const manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`[Auto-Installer] Installed manifest for ${browser} at:`, manifestPath);
    return true;
}

async function installForFirefox(nativeHostPath) {
    const platform = os.platform();
    let manifestDir, manifestPath;

    if (platform === 'win32') {
        const installDir = path.dirname(nativeHostPath);
        manifestPath = path.join(installDir, 'com.passkey_wallet.native.json');

        const manifest = {
            name: 'com.passkey_wallet.native',
            description: 'PassKey Wallet Native Messaging Host',
            path: nativeHostPath,
            type: 'stdio',
            allowed_extensions: [FIREFOX_EXTENSION_ID]
        };

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const regPath = manifestPath.replace(/\\/g, '\\\\');
        await execAsync(
            `reg add "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.passkey_wallet.native" /ve /t REG_SZ /d "${regPath}" /f`
        );

        console.log('[Auto-Installer] Firefox registry key added');
    } else if (platform === 'darwin') {
        manifestDir = path.join(os.homedir(), 'Library/Application Support/Mozilla/NativeMessagingHosts');
        fs.mkdirSync(manifestDir, { recursive: true });

        const manifest = {
            name: 'com.passkey_wallet.native',
            description: 'PassKey Wallet Native Messaging Host',
            path: nativeHostPath,
            type: 'stdio',
            allowed_extensions: [FIREFOX_EXTENSION_ID]
        };

        manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    } else {
        manifestDir = path.join(os.homedir(), '.mozilla/native-messaging-hosts');
        fs.mkdirSync(manifestDir, { recursive: true });

        const manifest = {
            name: 'com.passkey_wallet.native',
            description: 'PassKey Wallet Native Messaging Host',
            path: nativeHostPath,
            type: 'stdio',
            allowed_extensions: [FIREFOX_EXTENSION_ID]
        };

        manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    console.log('[Auto-Installer] Installed manifest for Firefox at:', manifestPath);
    return true;
}

function getChromiumManifestDir(browser) {
    const platform = os.platform();

    if (platform === 'win32') {
        const base = process.env.LOCALAPPDATA;
        if (browser === 'chrome') {
            return path.join(base, 'Google/Chrome/User Data/NativeMessagingHosts');
        } else if (browser === 'edge') {
            return path.join(base, 'Microsoft/Edge/User Data/NativeMessagingHosts');
        } else if (browser === 'brave') {
            return path.join(base, 'BraveSoftware/Brave-Browser/User Data/NativeMessagingHosts');
        }
    } else if (platform === 'darwin') {
        const base = path.join(os.homedir(), 'Library/Application Support');
        if (browser === 'chrome') {
            return path.join(base, 'Google/Chrome/NativeMessagingHosts');
        } else if (browser === 'edge') {
            return path.join(base, 'Microsoft Edge/NativeMessagingHosts');
        } else if (browser === 'brave') {
            return path.join(base, 'BraveSoftware/Brave-Browser/NativeMessagingHosts');
        }
    } else {
        const base = path.join(os.homedir(), '.config');
        if (browser === 'chrome') {
            return path.join(base, 'google-chrome/NativeMessagingHosts');
        } else if (browser === 'edge') {
            return path.join(base, 'microsoft-edge/NativeMessagingHosts');
        } else if (browser === 'brave') {
            return path.join(base, 'BraveSoftware/Brave-Browser/NativeMessagingHosts');
        }
    }

    return null;
}
