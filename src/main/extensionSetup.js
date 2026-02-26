import { app } from 'electron';
import path from 'path';

/**
 * Simple helper to get extension folder path
 * Extension files are bundled with the app
 */
export function getExtensionPath() {
    const isDev = !app.isPackaged;
    return isDev
        ? path.join(app.getAppPath(), 'browser-extension')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'browser-extension');
}
