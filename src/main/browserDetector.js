import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export async function getDefaultBrowser() {
    const platform = os.platform();

    try {
        if (platform === 'win32') {
            return await getWindowsDefaultBrowser();
        } else if (platform === 'darwin') {
            return await getMacOSDefaultBrowser();
        } else if (platform === 'linux') {
            return await getLinuxDefaultBrowser();
        }
    } catch (error) {
        console.error('[Browser Detector] Error detecting default browser:', error);
        return 'unknown';
    }

    return 'unknown';
}

export async function getInstalledBrowsers() {
    const platform = os.platform();
    const browsers = [];

    try {
        if (platform === 'win32') {
            const browserCommands = [
                { name: 'chrome', cmd: 'chrome.exe' },
                { name: 'edge', cmd: 'msedge.exe' },
                { name: 'brave', cmd: 'brave.exe' },
                { name: 'firefox', cmd: 'firefox.exe' }
            ];

            for (const browser of browserCommands) {
                try {
                    await execAsync(`where ${browser.cmd}`);
                    if (!browsers.includes(browser.name)) {
                        browsers.push(browser.name);
                    }
                } catch {
                }
            }

            const registryPaths = [
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\brave.exe',
                'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\firefox.exe'
            ];

            const regBrowserMap = {
                'chrome.exe': 'chrome',
                'msedge.exe': 'edge',
                'brave.exe': 'brave',
                'firefox.exe': 'firefox'
            };

            for (const regPath of registryPaths) {
                try {
                    await execAsync(`reg query "${regPath}"`);
                    const browserExe = regPath.split('\\').pop();
                    const browserName = regBrowserMap[browserExe];
                    if (browserName && !browsers.includes(browserName)) {
                        browsers.push(browserName);
                    }
                } catch {
                }
            }
        } else if (platform === 'darwin') {
            const browserApps = [
                { name: 'chrome', app: 'Google Chrome' },
                { name: 'edge', app: 'Microsoft Edge' },
                { name: 'brave', app: 'Brave Browser' },
                { name: 'firefox', app: 'Firefox' }
            ];

            for (const browser of browserApps) {
                try {
                    const { stdout } = await execAsync(`mdfind "kMDItemKind == 'Application' && kMDItemFSName == '${browser.app}.app'"`);
                    if (stdout.trim()) {
                        browsers.push(browser.name);
                    }
                } catch {
                }
            }
        } else if (platform === 'linux') {
            const checks = ['google-chrome', 'chromium-browser', 'microsoft-edge', 'brave-browser', 'firefox'];

            for (const cmd of checks) {
                try {
                    await execAsync(`which ${cmd}`);
                    if (cmd.includes('chrome') || cmd.includes('chromium')) {
                        if (!browsers.includes('chrome')) browsers.push('chrome');
                    } else if (cmd.includes('edge')) {
                        if (!browsers.includes('edge')) browsers.push('edge');
                    } else if (cmd.includes('brave')) {
                        if (!browsers.includes('brave')) browsers.push('brave');
                    } else if (cmd.includes('firefox')) {
                        if (!browsers.includes('firefox')) browsers.push('firefox');
                    }
                } catch {
                }
            }
        }
    } catch (error) {
        console.error('[Browser Detector] Error detecting installed browsers:', error);
    }

    return browsers;
}

async function getWindowsDefaultBrowser() {
    try {
        const { stdout } = await execAsync(
            'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId'
        );

        const match = stdout.match(/ProgId\s+REG_SZ\s+(.+)/);
        if (match) {
            const progId = match[1].trim();
            if (progId.includes('Chrome')) return 'chrome';
            if (progId.includes('Edge')) return 'edge';
            if (progId.includes('Brave')) return 'brave';
            if (progId.includes('Firefox')) return 'firefox';
        }
    } catch (error) {
    }

    return 'unknown';
}

async function getMacOSDefaultBrowser() {
    try {
        const { stdout } = await execAsync(
            'defaults read ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure | grep -A 2 https'
        );

        if (stdout.includes('chrome')) return 'chrome';
        if (stdout.includes('edge')) return 'edge';
        if (stdout.includes('brave')) return 'brave';
        if (stdout.includes('firefox')) return 'firefox';
    } catch (error) {
    }

    return 'unknown';
}

async function getLinuxDefaultBrowser() {
    try {
        const { stdout } = await execAsync('xdg-settings get default-web-browser');
        const browser = stdout.trim().toLowerCase();

        if (browser.includes('chrome')) return 'chrome';
        if (browser.includes('edge')) return 'edge';
        if (browser.includes('brave')) return 'brave';
        if (browser.includes('firefox')) return 'firefox';
    } catch (error) {
    }

    return 'unknown';
}
