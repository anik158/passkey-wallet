#!/usr/bin/env node

/**
 * Native Messaging Host for PassKey Wallet
 * Receives URL updates from browser extension
 */

let currentURL = null;

process.stdin.on('readable', () => {
    let input = [];
    let chunk;

    while ((chunk = process.stdin.read()) !== null) {
        input.push(chunk);
    }

    if (input.length > 0) {
        const buffer = Buffer.concat(input);
        const messageLength = buffer.readUInt32LE(0);
        const messageString = buffer.slice(4, 4 + messageLength).toString();

        try {
            const message = JSON.parse(messageString);
            handleMessage(message);
        } catch (e) {
            console.error('[Native Host] Parse error:', e);
        }
    }
});

function handleMessage(message) {
    if (message.type === 'url-update') {
        currentURL = message.hostname;
        console.error(`[Native Host] URL updated: ${currentURL}`);

        sendResponse({
            type: 'ack',
            received: message.hostname
        });
    }
}

function sendResponse(message) {
    const jsonMessage = JSON.stringify(message);
    const messageLength = Buffer.byteLength(jsonMessage);

    const buffer = Buffer.alloc(4 + messageLength);
    buffer.writeUInt32LE(messageLength, 0);
    buffer.write(jsonMessage, 4);

    process.stdout.write(buffer);
}

exports.getCurrentURL = () => currentURL;

console.error('[Native Host] PassKey Wallet native messaging host started');
