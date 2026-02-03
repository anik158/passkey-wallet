#!/usr/bin/env node

/**
 * Native Messaging Host for PassKey Wallet
 * Communicates with browser extension via stdin/stdout
 * Forwards URLs to PassKey Wallet app via Unix socket
 */

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Log to stderr only (stdout is for protocol)
const log = (msg) => process.stderr.write(`[Native Host] ${msg}\n`);

// Socket path for IPC with Electron app
const SOCKET_PATH = process.platform === 'win32'
    ? '\\\\.\\pipe\\passkey-wallet-url'
    : path.join(os.tmpdir(), 'passkey-wallet.sock');

log('Starting...');

let messageLength = null;
let messageBuffer = Buffer.alloc(0);
let appSocket = null;

// Connect to Electron app
function connectToApp() {
    if (appSocket) return;

    try {
        appSocket = net.connect(SOCKET_PATH);

        appSocket.on('connect', () => {
            log('Connected to PassKey Wallet app');
        });

        appSocket.on('error', (err) => {
            log(`App connection error: ${err.message}`);
            appSocket = null;
            // Retry after 5 seconds
            setTimeout(connectToApp, 5000);
        });

        appSocket.on('close', () => {
            log('App connection closed');
            appSocket = null;
        });
    } catch (e) {
        log(`Failed to connect to app: ${e.message}`);
        appSocket = null;
    }
}

// Start trying to connect
connectToApp();

process.stdin.on('data', (chunk) => {
    try {
        // Append new data
        messageBuffer = Buffer.concat([messageBuffer, chunk]);

        // Try to read messages
        while (true) {
            // Read length header (4 bytes)
            if (messageLength === null && messageBuffer.length >= 4) {
                messageLength = messageBuffer.readUInt32LE(0);
                messageBuffer = messageBuffer.slice(4);
                log(`Expecting message of length: ${messageLength}`);
            }

            // Read message body
            if (messageLength !== null && messageBuffer.length >= messageLength) {
                const messageBytes = messageBuffer.slice(0, messageLength);
                messageBuffer = messageBuffer.slice(messageLength);

                const message = JSON.parse(messageBytes.toString());
                log(`Received: ${JSON.stringify(message)}`);

                // Handle message
                handleMessage(message);

                // Reset for next message
                messageLength = null;
            } else {
                // Not enough data yet, wait for more
                break;
            }
        }
    } catch (e) {
        log(`Error processing data: ${e.message}`);
        process.exit(1);
    }
});

process.stdin.on('end', () => {
    log('stdin closed, exiting');
    if (appSocket) appSocket.end();
    process.exit(0);
});

process.stdin.on('error', (err) => {
    log(`stdin error: ${err.message}`);
    process.exit(1);
});

function sendMessage(message) {
    try {
        const json = JSON.stringify(message);
        const buffer = Buffer.from(json);
        const header = Buffer.alloc(4);
        header.writeUInt32LE(buffer.length, 0);

        process.stdout.write(header);
        process.stdout.write(buffer);

        log(`Sent: ${json}`);
    } catch (e) {
        log(`Error sending message: ${e.message}`);
    }
}

function handleMessage(message) {
    if (message.type === 'url-update') {
        // Forward URL to PassKey Wallet app
        if (!appSocket) {
            connectToApp();
        }

        if (appSocket && appSocket.writable) {
            const ipcMessage = JSON.stringify({
                type: 'browser-url',
                url: message.url,
                hostname: message.hostname,
                timestamp: message.timestamp
            }) + '\n';

            appSocket.write(ipcMessage);
            log(`Forwarded URL to app: ${message.hostname}`);
        } else {
            log('Cannot forward URL - not connected to app');
        }

        // Acknowledge to extension
        sendMessage({
            type: 'ack',
            url: message.url,
            timestamp: Date.now()
        });
    } else if (message.type === 'ping') {
        sendMessage({ type: 'pong' });
    }
}

log('Ready, waiting for messages...');

// Keep process alive
setInterval(() => { }, 1000000);
