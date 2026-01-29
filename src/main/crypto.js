import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptData(dataObject, password) {
    // 1. Generate salt and IV
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    // 2. Derive key using Scrypt (stronger than PBKDF2)
    const key = crypto.scryptSync(password, salt, 32);

    // 3. Encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(dataObject), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // 4. Return as single string: salt:iv:tag:encrypted
    return [
        salt.toString('hex'),
        iv.toString('hex'),
        tag.toString('hex'),
        encrypted
    ].join(':');
}

export function decryptData(encryptedString, password) {
    // 1. Parse
    const parts = encryptedString.split(':');
    if (parts.length !== 4) throw new Error('Invalid file format');

    const [saltHex, ivHex, tagHex, contentHex] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    // 2. Derive key
    const key = crypto.scryptSync(password, salt, 32);

    // 3. Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}
