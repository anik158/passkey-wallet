import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SOCKET_PATH = process.platform === 'win32'
    ? '\\\\.\\pipe\\passkey-wallet-url'
    : path.join(os.tmpdir(), 'passkey-wallet.sock');

let currentURL = null;
let lastURLTimestamp = 0;
let socketServer = null;

/**
 * Start IPC server to receive URLs from native messaging host
 */
export function startURLServer(onURLReceived) {
    // Remove existing socket file
    if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
    }

    socketServer = net.createServer((socket) => {
        console.log('[URL Server] Client connected');
        let buffer = '';

        const tryParse = (str) => {
            const trimmed = str.trim();
            if (!trimmed) return false;
            try {
                const message = JSON.parse(trimmed);
                console.log('[URL Server] Received:', message.type, message.url || '');
                if (message.type === 'browser-url' && message.url) {
                    currentURL = message.url;
                    lastURLTimestamp = Date.now();
                    if (onURLReceived) onURLReceived(message.url);
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        socket.on('data', (data) => {
            const raw = data.toString();
            console.log('[URL Server] Raw data received:', raw.slice(0, 120));
            buffer += raw;

            if (buffer.includes('\n')) {
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    tryParse(line);
                }
            } else {
                if (tryParse(buffer)) {
                    buffer = '';
                }
            }
        });

        socket.on('end', () => {
            if (buffer.trim()) {
                tryParse(buffer);
                buffer = '';
            }
        });

        socket.on('error', (err) => {
            console.error('[URL Server] Socket error:', err.message);
        });
    });

    socketServer.listen(SOCKET_PATH, () => {
        console.log('[URL Server] Listening on:', SOCKET_PATH);

        // Set permissions on Unix
        if (process.platform !== 'win32') {
            fs.chmodSync(SOCKET_PATH, 0o666);
        }
    });

    socketServer.on('error', (err) => {
        console.error('[URL Server] Server error:', err.message);
    });
}

export function stopURLServer() {
    if (socketServer) {
        socketServer.close();
        socketServer = null;
    }

    if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
    }
}

export function getCurrentURL() {
    if (!currentURL) return null;
    if (Date.now() - lastURLTimestamp > 30000) return null;
    return currentURL;
}
