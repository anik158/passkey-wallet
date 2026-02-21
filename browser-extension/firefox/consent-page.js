document.getElementById('btnAllow').addEventListener('click', async () => {
    const btn = document.getElementById('btnAllow');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
        await browser.storage.local.set({ dataConsent: true });
        document.querySelector('.card').innerHTML = '<div style="text-align:center;padding:2rem;"><div style="font-size:3rem">✅</div><h2 style="color:#06b6d4;margin:1rem 0">Consent Granted</h2><p style="color:#94a3b8">PassKey Wallet will now detect credentials for visited websites.</p></div>';
        setTimeout(() => window.close(), 1800);
    } catch (e) {
        document.querySelector('.card').innerHTML = '<div style="text-align:center;padding:2rem;color:#fca5a5"><h2>⚠️ Error</h2><p>' + e.message + '</p><p style="margin-top:1rem;font-size:0.8rem;color:#94a3b8">Try reloading the extension and clicking the icon.</p></div>';
    }
});

document.getElementById('btnDeny').addEventListener('click', async () => {
    await browser.storage.local.set({ dataConsent: false });
    window.close();
});
