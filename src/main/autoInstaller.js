import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const CHROMIUM_EXTENSION_ID = 'cnbinghihnicbcflaoaggpnpjfimpgah';
const FIREFOX_EXTENSION_ID = 'passkey-wallet@passkey-wallet.com';

export async function autoInstallNativeHost() {
    console.log('[Auto-Installer] Starting native host auto-installation...');

    const defaultBrowser = await getDefaultBrowser();
    const installedBrowsers = await getInstalledBrowsers();

    console.log('[Auto-Installer] Default browser:', defaultBrowser);
    console.log('[Auto-Installer] Installed browsers:', installedBrowsers);

    const results = { success: [], failed: [], defaultBrowser };

    const installDir = getNativeHostInstallDir();
    const nativeHostPath = getNativeHostExecutablePath(installDir);

    await ensureNativeHostInstalled(installDir, nativeHostPath);

    const browsersToInstall = defaultBrowser !== 'unknown' && installedBrowsers.includes(defaultBrowser)
        ? [defaultBrowser, ...installedBrowsers.filter(b => b !== defaultBrowser)]
        : installedBrowsers;

    for (const browser of browsersToInstall) {
        const ok = await installForBrowser(browser, nativeHostPath);
        results[ok ? 'success' : 'failed'].push(browser);
    }

    console.log('[Auto-Installer] Done — success:', results.success, 'failed:', results.failed);
    return results;
}

function getNativeHostInstallDir() {
    const platform = os.platform();
    if (platform === 'win32') return path.join(process.env.LOCALAPPDATA, 'PassKey Wallet');
    if (platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support/PassKey Wallet');
    return path.join(os.homedir(), '.local/share/passkey-wallet');
}

function getNativeHostExecutablePath(installDir) {
    return path.join(installDir, os.platform() === 'win32' ? 'native-host.exe' : 'native-host');
}

async function ensureNativeHostInstalled(installDir, nativeHostPath) {
    if (fs.existsSync(nativeHostPath)) {
        console.log('[Auto-Installer] Native host already installed');
        return;
    }

    fs.mkdirSync(installDir, { recursive: true });

    const { app } = await import('electron');
    let appPath = app.getAppPath();
    if (app.isPackaged && appPath.includes('app.asar')) {
        appPath = appPath.replace('app.asar', 'app.asar.unpacked');
    }

    const binaryName = platform === 'win32' ? 'native-host-win.exe'
        : platform === 'darwin' ? 'native-host-macos'
            : 'native-host-linux';

    const sourceBinary = path.join(appPath, 'browser-extension', 'dist', binaryName);

    if (!fs.existsSync(sourceBinary)) {
        throw new Error(`Native host binary not found: ${sourceBinary}`);
    }

    fs.copyFileSync(sourceBinary, nativeHostPath);
    if (platform !== 'win32') fs.chmodSync(nativeHostPath, 0o755);

    console.log('[Auto-Installer] Native host installed to:', nativeHostPath);
}

async function installForBrowser(browser, nativeHostPath) {
    try {
        return browser === 'firefox'
            ? await installForFirefox(nativeHostPath)
            : await installForChromium(browser, nativeHostPath);
    } catch (error) {
        console.error(`[Auto-Installer] Failed for ${browser}:`, error);
        return false;
    }
}

async function installForChromium(browser, nativeHostPath) {
    const manifestDir = getChromiumManifestDir(browser);
    if (!manifestDir) return false;

    fs.mkdirSync(manifestDir, { recursive: true });

    const manifest = {
        name: 'com.passkey_wallet.native',
        description: 'PassKey Wallet Native Messaging Host',
        path: nativeHostPath,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${CHROMIUM_EXTENSION_ID}/`]
    };

    const manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[Auto-Installer] Manifest installed for ${browser}`);

    if (os.platform() === 'win32') {
        const regPath = getChromiumRegistryPath(browser);
        if (regPath) {
            try {
                await execAsync(`reg add "${regPath}\\com.passkey_wallet.native" /ve /t REG_SZ /d "${manifestPath}" /f`);
                console.log(`[Auto-Installer] Registry added for ${browser}`);
            } catch (err) {
                console.error(`[Auto-Installer] Failed to add registry for ${browser}:`, err.message);
            }
        }
    }

    return true;
}

function getChromiumRegistryPath(browser) {
    if (browser === 'chrome') return 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts';
    if (browser === 'edge') return 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts';
    if (browser === 'brave') return 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts';
    return null;
}

async function installForFirefox(nativeHostPath) {
    const platform = os.platform();
    const manifest = {
        name: 'com.passkey_wallet.native',
        description: 'PassKey Wallet Native Messaging Host',
        path: nativeHostPath,
        type: 'stdio',
        allowed_extensions: [FIREFOX_EXTENSION_ID]
    };

    if (platform === 'win32') {
        const manifestPath = path.join(path.dirname(nativeHostPath), 'com.passkey_wallet.native.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        await execAsync(`reg add "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.passkey_wallet.native" /ve /t REG_SZ /d "${manifestPath}" /f`);
    } else {
        const manifestDir = platform === 'darwin'
            ? path.join(os.homedir(), 'Library/Application Support/Mozilla/NativeMessagingHosts')
            : path.join(os.homedir(), '.mozilla/native-messaging-hosts');

        fs.mkdirSync(manifestDir, { recursive: true });
        fs.writeFileSync(path.join(manifestDir, 'com.passkey_wallet.native.json'), JSON.stringify(manifest, null, 2));
    }

    console.log('[Auto-Installer] Firefox manifest installed');
    return true;
}

function getChromiumManifestDir(browser) {
    const platform = os.platform();

    if (platform === 'win32') {
        const base = process.env.LOCALAPPDATA;
        const dirs = { chrome: 'Google/Chrome/User Data', edge: 'Microsoft/Edge/User Data', brave: 'BraveSoftware/Brave-Browser/User Data' };
        return dirs[browser] ? path.join(base, dirs[browser], 'NativeMessagingHosts') : null;
    }

    if (platform === 'darwin') {
        const base = path.join(os.homedir(), 'Library/Application Support');
        const dirs = { chrome: 'Google/Chrome', edge: 'Microsoft Edge', brave: 'BraveSoftware/Brave-Browser' };
        return dirs[browser] ? path.join(base, dirs[browser], 'NativeMessagingHosts') : null;
    }

    const base = path.join(os.homedir(), '.config');
    const dirs = { chrome: 'google-chrome', edge: 'microsoft-edge', brave: 'BraveSoftware/Brave-Browser' };
    return dirs[browser] ? path.join(base, dirs[browser], 'NativeMessagingHosts') : null;
}

async function getDefaultBrowser() {
    const platform = os.platform();
    try {
        if (platform === 'win32') {
            const { stdout } = await execAsync('reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId');
            const match = stdout.match(/ProgId\s+REG_SZ\s+(.+)/);
            if (match) {
                const p = match[1].trim();
                if (p.includes('Chrome')) return 'chrome';
                if (p.includes('Edge')) return 'edge';
                if (p.includes('Brave')) return 'brave';
                if (p.includes('Firefox')) return 'firefox';
            }
        } else if (platform === 'darwin') {
            const { stdout } = await execAsync('defaults read ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure | grep -A 2 https');
            if (stdout.includes('chrome')) return 'chrome';
            if (stdout.includes('edge')) return 'edge';
            if (stdout.includes('brave')) return 'brave';
            if (stdout.includes('firefox')) return 'firefox';
        } else {
            const { stdout } = await execAsync('xdg-settings get default-web-browser');
            const b = stdout.trim().toLowerCase();
            if (b.includes('chrome')) return 'chrome';
            if (b.includes('edge')) return 'edge';
            if (b.includes('brave')) return 'brave';
            if (b.includes('firefox')) return 'firefox';
        }
    } catch { }
    return 'unknown';
}

async function getInstalledBrowsers() {
    const platform = os.platform();
    const browsers = [];

    try {
        if (platform === 'win32') {
            for (const [name, exe] of [['chrome', 'chrome.exe'], ['edge', 'msedge.exe'], ['brave', 'brave.exe'], ['firefox', 'firefox.exe']]) {
                try { await execAsync(`where ${exe}`); browsers.push(name); } catch { }
                try {
                    await execAsync(`reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}"`);
                    if (!browsers.includes(name)) browsers.push(name);
                } catch { }
            }
        } else if (platform === 'darwin') {
            for (const [name, app] of [['chrome', 'Google Chrome'], ['edge', 'Microsoft Edge'], ['brave', 'Brave Browser'], ['firefox', 'Firefox']]) {
                try {
                    const { stdout } = await execAsync(`mdfind "kMDItemKind == 'Application' && kMDItemFSName == '${app}.app'"`);
                    if (stdout.trim()) browsers.push(name);
                } catch { }
            }
        } else {
            for (const cmd of ['google-chrome', 'chromium-browser', 'microsoft-edge', 'brave-browser', 'firefox']) {
                try {
                    await execAsync(`which ${cmd}`);
                    const name = cmd.includes('chrome') || cmd.includes('chromium') ? 'chrome'
                        : cmd.includes('edge') ? 'edge'
                            : cmd.includes('brave') ? 'brave'
                                : 'firefox';
                    if (!browsers.includes(name)) browsers.push(name);
                } catch { }
            }
        }
    } catch { }

    return browsers;
}
