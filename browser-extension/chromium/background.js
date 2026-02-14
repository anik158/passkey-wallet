import './consent.js';

let port = null;
const HOST_NAME = 'com.passkey_wallet.native';

function connectNative() {
    try {
        port = chrome.runtime.connectNative(HOST_NAME);

        port.onMessage.addListener((message) => {
            console.log('[PassKey Wallet] Received:', message);
        });

        port.onDisconnect.addListener(() => {
            console.log('[PassKey Wallet] Disconnected');
            if (chrome.runtime.lastError) {
                console.error('[PassKey Wallet] Error:', chrome.runtime.lastError.message);
            }
            port = null;
            setTimeout(connectNative, 5000);
        });

        console.log('[PassKey Wallet] Connected to native host');

        // Send initial ping to keep connection alive
        port.postMessage({ type: 'ping', timestamp: Date.now() });
    } catch (e) {
        console.error('[PassKey Wallet] Failed to connect:', e);
        setTimeout(connectNative, 5000);
    }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const consent = await chrome.storage.local.get('dataConsent');
    if (!consent.dataConsent) {
        return;
    }

    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        sendURLToNativeApp(tab.url);
    } catch (e) {
        console.error('[PassKey Wallet] Error:', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const consent = await chrome.storage.local.get('dataConsent');
    if (!consent.dataConsent) {
        return;
    }

    if (changeInfo.url && tab.active) {
        sendURLToNativeApp(changeInfo.url);
    }
});

function sendURLToNativeApp(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
        return;
    }

    if (!port) {
        connectNative();
        return;
    }

    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        port.postMessage({
            type: 'url-update',
            url: url,
            hostname: hostname,
            timestamp: Date.now()
        });
        console.log('[PassKey Wallet] Sent URL:', hostname);
    } catch (e) {
        console.error('[PassKey Wallet] Failed to send:', e);
    }
}

connectNative();
