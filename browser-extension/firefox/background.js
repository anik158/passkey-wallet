let port = null;
let pendingUrl = null;
const HOST_NAME = 'com.passkey_wallet.native';

function connectNative() {
    try {
        port = browser.runtime.connectNative(HOST_NAME);

        port.onMessage.addListener((message) => {
            console.log('[PassKey Wallet] Received:', message);
        });

        port.onDisconnect.addListener(() => {
            console.log('[PassKey Wallet] Disconnected');
            if (browser.runtime.lastError) {
                console.error('[PassKey Wallet] Error:', browser.runtime.lastError.message);
            }
            port = null;
            setTimeout(connectNative, 5000);
        });

        console.log('[PassKey Wallet] Connected to native host');

        if (pendingUrl) {
            sendURLToNativeApp(pendingUrl);
            pendingUrl = null;
        }
    } catch (e) {
        console.error('[PassKey Wallet] Failed to connect:', e);
        setTimeout(connectNative, 5000);
    }
}

browser.tabs.onActivated.addListener(async (activeInfo) => {
    const consent = await browser.storage.local.get('dataConsent');
    if (!consent.dataConsent) {
        return;
    }

    try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        sendURLToNativeApp(tab.url);
    } catch (e) {
        console.error('[PassKey Wallet] Error:', e);
    }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const consent = await browser.storage.local.get('dataConsent');
    if (!consent.dataConsent) {
        return;
    }

    if (changeInfo.url && tab.active) {
        sendURLToNativeApp(changeInfo.url);
    }
});

function sendURLToNativeApp(url) {
    if (!url || url.startsWith('moz-extension://') || url.startsWith('about:') || url.startsWith('chrome://')) {
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
