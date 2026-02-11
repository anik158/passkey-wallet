let selectedBrowser = null;
let currentStep = 1;
let extensionPath = '';
let extensionId = '';

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupBrowserSelection();
    setupNavigationButtons();
    setupActionButtons();

    const paths = await window.api.getExtensionPath();
    extensionPath = paths.chromium;
    document.getElementById('extensionPath').textContent = extensionPath;
}

function setupBrowserSelection() {
    const browserCards = document.querySelectorAll('.browser-card');
    const btnNext = document.getElementById('btnStep1Next');

    browserCards.forEach(card => {
        card.addEventListener('click', () => {
            browserCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedBrowser = card.dataset.browser;
            btnNext.disabled = false;
        });
    });

    btnNext.addEventListener('click', () => {
        goToStep(2);
    });
}

function setupNavigationButtons() {
    document.getElementById('btnStep2Back').addEventListener('click', () => goToStep(1));
    document.getElementById('btnStep2Next').addEventListener('click', async () => {
        if (selectedBrowser !== 'firefox') {
            const id = await detectExtensionId();
            if (id) {
                extensionId = id;
                document.getElementById('detectedExtensionId').textContent = id;
            } else {
                document.getElementById('detectedExtensionId').textContent = 'Unable to detect. Please ensure extension is installed.';
            }
        }
        goToStep(3);
    });

    document.getElementById('btnStep3Back').addEventListener('click', () => goToStep(2));

    document.getElementById('btnRunInstaller').addEventListener('click', async () => {
        await runNativeHostInstaller();
        goToStep(4);
    });

    document.getElementById('btnFinish').addEventListener('click', () => {
        window.api.send('close-browser-setup');
    });
}

function setupActionButtons() {
    document.getElementById('btnCopyPath').addEventListener('click', () => {
        navigator.clipboard.writeText(extensionPath);
        showNotification('Path copied to clipboard!');
    });

    document.getElementById('btnOpenExtensionsPage').addEventListener('click', () => {
        let url = 'chrome://extensions';
        if (selectedBrowser === 'edge') url = 'edge://extensions';
        else if (selectedBrowser === 'brave') url = 'brave://extensions';

        window.open(url);
    });

    document.getElementById('btnOpenFirefoxAddons').addEventListener('click', () => {
        window.open('about:debugging#/runtime/this-firefox');
    });

    document.getElementById('btnCopyExtensionId').addEventListener('click', () => {
        navigator.clipboard.writeText(extensionId);
        showNotification('Extension ID copied!');
    });
}

function goToStep(stepNumber) {
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById(`step${stepNumber}`).classList.add('active');
    currentStep = stepNumber;

    if (stepNumber === 2) {
        if (selectedBrowser === 'firefox') {
            document.getElementById('chromiumInstructions').style.display = 'none';
            document.getElementById('firefoxInstructions').style.display = 'block';
            document.getElementById('extensionIdSection').style.display = 'none';
        } else {
            document.getElementById('chromiumInstructions').style.display = 'block';
            document.getElementById('firefoxInstructions').style.display = 'none';
            document.getElementById('extensionIdSection').style.display = 'block';
        }
    }

    if (stepNumber === 4) {
        const browserName = selectedBrowser.charAt(0).toUpperCase() + selectedBrowser.slice(1);
        document.getElementById('installedBrowserName').textContent = browserName;
    }
}

async function detectExtensionId() {
    try {
        const result = await window.api.detectExtensionId(selectedBrowser);
        return result;
    } catch (error) {
        console.error('Failed to detect extension ID:', error);
        return null;
    }
}

async function runNativeHostInstaller() {
    try {
        const result = await window.api.runNativeHostInstaller({
            browser: selectedBrowser,
            extensionId: extensionId
        });

        if (result.success) {
            showNotification('Native host installed successfully!');
        } else {
            showNotification('Installation completed. Please check terminal for details.');
        }
    } catch (error) {
        console.error('Installer error:', error);
        showNotification('Error running installer. Please run manually.');
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
