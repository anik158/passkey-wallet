import { app, shell, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let extensionPromptWindow = null;

/**
 * Guide user through one-time extension installation using custom dialog
 */
export async function promptExtensionInstall() {
    const hasSeenPrompt = app.getPath('userData') + '/extension-prompted';

    if (fs.existsSync(hasSeenPrompt)) {
        return;
    }

    extensionPromptWindow = new BrowserWindow({
        width: 550,
        height: 480,
        frame: false,
        resizable: false,
        center: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const isDev = !app.isPackaged;
    const htmlPath = isDev
        ? `http://localhost:5173/src/render/extension-prompt.html`
        : `file://${path.join(__dirname, '../dist/src/render/extension-prompt.html')}`;

    extensionPromptWindow.loadURL(htmlPath);

    extensionPromptWindow.on('closed', () => {
        extensionPromptWindow = null;
    });
}

// Handle dialog responses
ipcMain.on('extension-prompt-response', async (event, { action, dontShowAgain }) => {
    if (dontShowAgain) {
        const hasSeenPrompt = app.getPath('userData') + '/extension-prompted';
        fs.writeFileSync(hasSeenPrompt, '1');
    }

    if (action === 'install') {
        await openExtensionInstallGuide();
    }

    if (extensionPromptWindow) {
        extensionPromptWindow.close();
    }
});

async function openExtensionInstallGuide() {
    let extensionPath = path.join(process.resourcesPath, 'browser-extension');
    const isDev = !app.isPackaged;

    if (isDev) {
        extensionPath = path.join(app.getAppPath(), 'browser-extension');
    }

    // Show chromium folder in file manager
    const chromiumPath = path.join(extensionPath, 'chromium');
    shell.showItemInFolder(chromiumPath);

    // Wait a bit then open chrome extensions page
    setTimeout(() => {
        shell.openExternal('chrome://extensions');
    }, 500);
}

export { openExtensionInstallGuide };
