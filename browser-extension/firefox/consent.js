const consentKey = 'dataConsent';

chrome.runtime.onInstalled.addListener(async () => {
    const result = await chrome.storage.local.get(consentKey);

    if (!result[consentKey]) {
        const userConsent = confirm(
            'PassKey Wallet Desktop Connector needs to send website URLs to the PassKey Wallet desktop application on your computer.\n\n' +
            'This data is:\n' +
            '• Only sent to your local desktop app (localhost)\n' +
            '• NOT sent to any external servers\n' +
            '• Used to detect credentials for the current website\n\n' +
            'Do you want to allow this?'
        );

        await chrome.storage.local.set({ [consentKey]: userConsent });

        if (!userConsent) {
            console.log('[PassKey Wallet] User declined data collection consent');
        }
    }
});

chrome.action.onClicked.addListener(async () => {
    const userConsent = confirm(
        'Data Collection Settings\n\n' +
        'PassKey Wallet sends website URLs to your local desktop application.\n\n' +
        'Enable data collection?'
    );

    await chrome.storage.local.set({ [consentKey]: userConsent });

    alert(userConsent ?
        'Data collection enabled. URLs will be sent to your desktop app.' :
        'Data collection disabled. Extension will not send URLs.'
    );
});
