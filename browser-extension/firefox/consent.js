const CONSENT_KEY = 'dataConsent';

browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        browser.tabs.create({
            url: browser.runtime.getURL('consent.html')
        });
    }
});

browser.browserAction.onClicked.addListener(() => {
    browser.storage.local.get(CONSENT_KEY).then((result) => {
        const next = !(result[CONSENT_KEY] || false);
        browser.storage.local.set({ [CONSENT_KEY]: next });
        browser.browserAction.setBadgeText({ text: next ? '' : '!' });
        browser.browserAction.setTitle({
            title: next ? 'PassKey Wallet - Active (click to disable)' : 'PassKey Wallet - Disabled (click to enable)'
        });
    });
});

browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'grant-consent') {
        browser.storage.local.set({ [CONSENT_KEY]: true });
        browser.browserAction.setBadgeText({ text: '' });
    }
});
