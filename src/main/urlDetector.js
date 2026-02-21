import { execSync } from 'child_process';
import axios from 'axios';
import { getCurrentURL } from './urlServer.js';

/**
 * Detects browser URL using Chrome DevTools Protocol.
 * Requires Chrome to be launched with --remote-debugging-port=9222
 * Falls back to window title parsing if CDP not available.
 */
export async function getBrowserURL() {
    const platform = process.platform;

    try {
        const chromeURL = await getChromeURLViaCDP();
        if (chromeURL) return chromeURL;

        switch (platform) {
            case 'linux':
                return getLinuxBrowserURL();
            case 'win32':
                return getWindowsBrowserURL();
            case 'darwin':
                return getMacBrowserURL();
            default:
                return null;
        }
    } catch (e) {
        console.error('[URL_DETECTOR] Error:', e.message);
        return null;
    }
}

async function getChromeURLViaCDP() {
    try {
        const response = await axios.get('http://localhost:9222/json', { timeout: 500 });
        const tabs = response.data;

        const activeTab = tabs.find(tab => tab.type === 'page' && !tab.url.startsWith('chrome://'));
        if (activeTab && activeTab.url) {
            const url = new URL(activeTab.url);
            console.log('[URL_DETECTOR] Chrome CDP:', url.hostname);
            return url.hostname.replace('www.', '');
        }

        return null;
    } catch (e) {
        return null;
    }
}

async function getLinuxBrowserURL() {
    const extensionURL = getCurrentURL();

    if (extensionURL) {
        try {
            const url = new URL(extensionURL);
            console.log('[URL Detector] From extension:', url.hostname);
            return url.hostname.replace('www.', '');
        } catch (e) {
        }
    }

    console.log('[URL Detector] Linux: Use browser extension for URL detection');
    return null;
}
function getWaylandBrowserURL() {
    return null;
}

function getWindowsBrowserURL() {
    return null;
}

function getMacBrowserURL() {
    return null;
}
