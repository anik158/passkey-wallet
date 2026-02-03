import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SOCKET_PATH = process.platform === 'win32'
    ? '\\\\.\\pipe\\passkey-wallet-url'
    : path.join(os.tmpdir(), 'passkey-wallet.sock');

let currentURL = null;
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

        socket.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('[URL Server] Received:', message);

                if (message.type === 'browser-url' && message.url) {
                    currentURL = message.url;
                    if (onURLReceived) {
                        onURLReceived(message.url);
                    }
                }
            } catch (e) {
                console.error('[URL Server] Parse error:', e.message);
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
    return currentURL;
}
