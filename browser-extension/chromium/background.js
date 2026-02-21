
let port = null;
let pendingUrl = null;
let connecting = false;
const HOST_NAME = 'com.passkey_wallet.native';

function connectNative() {
    if (port || connecting) return;
    connecting = true;
    try {
        port = chrome.runtime.connectNative(HOST_NAME);
        connecting = false;

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

        port.postMessage({ type: 'ping', timestamp: Date.now() });

        if (pendingUrl) {
            sendURLToNativeApp(pendingUrl);
            pendingUrl = null;
        }
    } catch (e) {
        console.error('[PassKey Wallet] Failed to connect:', e);
        setTimeout(connectNative, 5000);
    }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        sendURLToNativeApp(tab.url);
    } catch (e) {
        console.error('[PassKey Wallet] Error:', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
        sendURLToNativeApp(changeInfo.url);
    }
});

function sendURLToNativeApp(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
        return;
    }

    if (!port) {
        pendingUrl = url;
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
