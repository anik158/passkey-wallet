const FIXED_EXTENSION_ID = 'tygqvasnoghptkmhusdzktfyboigejxl';
const CONSENT_KEY = 'dataConsent';

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(CONSENT_KEY, (result) => {
        if (!result[CONSENT_KEY]) {
            chrome.storage.local.set({ [CONSENT_KEY]: false });
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        }
    });
});

chrome.action.onClicked.addListener(() => {
    chrome.storage.local.get(CONSENT_KEY, (result) => {
        const current = result[CONSENT_KEY] || false;
        const next = !current;
        chrome.storage.local.set({ [CONSENT_KEY]: next });
        chrome.action.setBadgeText({ text: next ? '' : '!' });
        chrome.action.setTitle({ title: next ? 'PassKey Wallet - Active' : 'PassKey Wallet - Click to enable' });
    });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'grant-consent') {
        chrome.storage.local.set({ [CONSENT_KEY]: true });
        chrome.action.setBadgeText({ text: '' });
    }
});
