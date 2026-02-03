const { ipcRenderer } = require('electron');

document.getElementById('install-btn').addEventListener('click', () => {
    const dontShowAgain = document.getElementById('dont-show-again').checked;
    ipcRenderer.send('extension-prompt-response', { action: 'install', dontShowAgain });
});

document.getElementById('skip-btn').addEventListener('click', () => {
    const dontShowAgain = document.getElementById('dont-show-again').checked;
    ipcRenderer.send('extension-prompt-response', { action: 'skip', dontShowAgain });
});
