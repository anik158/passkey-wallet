import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicKeyBase64 = fs.readFileSync(
    path.join(__dirname, 'browser-extension/public_key.txt'),
    'utf8'
).trim();

const publicKeyDER = Buffer.from(publicKeyBase64, 'base64');

const hash = crypto.createHash('sha256').update(publicKeyDER).digest();

let extensionId = '';
for (let i = 0; i < 32; i++) {
    extensionId += String.fromCharCode(97 + (hash[i] % 26));
}

console.log('Extension ID:', extensionId);

const publicKeyForManifest = publicKeyBase64;
console.log('\nAdd this to chromium/manifest.json:');
console.log('"key": "' + publicKeyForManifest + '"');
