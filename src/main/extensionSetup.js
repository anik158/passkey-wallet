import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Automatically installs browser extension support.
 * Re-runs every time to detect newly installed browsers.
 * Handles native messaging host installation and browser registration.
 */
export async function setupBrowserExtension() {
    const platform = process.platform;
    const appPath = app.getPath('exe');

    const isDev = !app.isPackaged;
    const resourcesPath = isDev
        ? app.getAppPath()
        : process.resourcesPath;

    console.log('[Extension Setup] Resources path:', resourcesPath);

    const results = {
        nativeHost: false,
        browsers: {}
    };

    try {
        results.nativeHost = await installNativeHost(platform, resourcesPath, appPath);
        results.browsers = await registerWithBrowsers(platform);

        return {
            success: true,
            installed: Object.keys(results.browsers).filter(b => results.browsers[b]).length,
            browsers: results.browsers
        };
    } catch (error) {
        console.error('[Extension Setup] Error:', error);
        return { success: false, error: error.message };
    }
}

async function installNativeHost(platform, resourcesPath, appPath) {
    const hostScript = path.join(resourcesPath, 'native-host', 'passkey-wallet-host.js');

    if (!fs.existsSync(hostScript)) {
        console.log('[Extension Setup] Native host script not found at:', hostScript);
        console.log('[Extension Setup] Skipping - extension support will not be available');
        return false;
    }

    if (platform === 'win32') {
        try {
            const targetDir = path.dirname(appPath);
            const targetPath = path.join(targetDir, 'passkey-wallet-host.js');
            fs.copyFileSync(hostScript, targetPath);
            console.log('[Extension Setup] ✓ Windows native host installed');
            return true;
        } catch (e) {
            console.error('[Extension Setup] Windows install failed:', e.message);
            return false;
        }

    } else if (platform === 'linux' || platform === 'darwin') {
        const targetPath = '/usr/local/bin/passkey-wallet-host';

        if (fs.existsSync(targetPath)) {
            console.log('[Extension Setup] Native host already installed');
            return true;
        }

        try {
            execSync(`pkexec cp "${hostScript}" "${targetPath}" 2>/dev/null`);
            execSync(`pkexec chmod +x "${targetPath}" 2>/dev/null`);
            console.log('[Extension Setup] ✓ Native host installed via pkexec');
            return true;
        } catch (e) {
            console.log('[Extension Setup] pkexec failed, trying sudo...');

            try {
                execSync(`sudo -n cp "${hostScript}" "${targetPath}" 2>/dev/null`);
                execSync(`sudo -n chmod +x "${targetPath}" 2>/dev/null`);
                console.log('[Extension Setup] ✓ Native host installed via sudo');
                return true;
            } catch (sudoError) {
                console.log('[Extension Setup] ⚠️  Native host installation skipped (no permissions)');
                console.log('[Extension Setup] Extension will not work until manually installed');
                return false;
            }
        }
    }

    return false;
}

async function registerWithBrowsers(platform) {
    const browsers = {
        chrome: getChromePath(platform),
        edge: getEdgePath(platform),
        brave: getBravePath(platform),
        firefox: getFirefoxPath(platform)
    };

    const results = {};

    for (const [browser, configPath] of Object.entries(browsers)) {
        if (!configPath) {
            results[browser] = false;
            continue;
        }

        if (!fs.existsSync(configPath)) {
            results[browser] = false;
            console.log(`[Extension Setup] ${browser} not installed (${configPath} not found)`);
            continue;
        }

        try {
            const manifestDir = path.join(configPath, 'NativeMessagingHosts');
            fs.mkdirSync(manifestDir, { recursive: true });

            const manifestContent = generateManifest(browser, platform);
            const manifestPath = path.join(manifestDir, 'com.passkey_wallet.native.json');

            fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
            results[browser] = true;
            console.log(`[Extension Setup] ✓ Registered with ${browser}`);
        } catch (e) {
            results[browser] = false;
            console.error(`[Extension Setup] ✗ Failed to register ${browser}:`, e.message);
        }
    }

    return results;
}

function getChromePath(platform) {
    if (platform === 'linux') return path.join(app.getPath('home'), '.config/google-chrome');
    if (platform === 'win32') return path.join(app.getPath('appData'), 'Google', 'Chrome');
    if (platform === 'darwin') return path.join(app.getPath('home'), 'Library/Application Support/Google/Chrome');
}

function getEdgePath(platform) {
    if (platform === 'linux') return path.join(app.getPath('home'), '.config/microsoft-edge');
    if (platform === 'win32') return path.join(app.getPath('appData'), 'Microsoft', 'Edge');
    if (platform === 'darwin') return path.join(app.getPath('home'), 'Library/Application Support/Microsoft Edge');
}

function getBravePath(platform) {
    if (platform === 'linux') return path.join(app.getPath('home'), '.config/BraveSoftware/Brave-Browser');
    if (platform === 'win32') return path.join(app.getPath('appData'), 'BraveSoftware', 'Brave-Browser');
    if (platform === 'darwin') return path.join(app.getPath('home'), 'Library/Application Support/BraveSoftware/Brave-Browser');
}

function getFirefoxPath(platform) {
    if (platform === 'linux') return path.join(app.getPath('home'), '.mozilla');
    if (platform === 'win32') return path.join(app.getPath('appData'), 'Mozilla');
    if (platform === 'darwin') return path.join(app.getPath('home'), 'Library/Application Support/Mozilla');
}

function generateManifest(browser, platform) {
    let hostPath;

    if (platform === 'win32') {
        const appData = app.getPath('appData');
        hostPath = path.join(path.dirname(app.getPath('exe')), 'passkey-wallet-host.js');
    } else {
        hostPath = '/usr/local/bin/passkey-wallet-host';
    }

    const isFirefox = browser === 'firefox';

    return {
        name: 'com.passkey_wallet.native',
        description: 'PassKey Wallet Native Messaging Host',
        path: hostPath,
        type: 'stdio',
        [isFirefox ? 'allowed_extensions' : 'allowed_origins']: isFirefox
            ? ['passkey-wallet@passkey-wallet.com']
            : []
    };
}

export function getExtensionPath() {
    const isDev = !app.isPackaged;
    return isDev
        ? path.join(app.getAppPath(), 'browser-extension')
        : path.join(process.resourcesPath, 'browser-extension');
}
