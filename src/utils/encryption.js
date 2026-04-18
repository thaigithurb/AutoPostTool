const crypto = require('crypto');
const { encryptionKey } = require('../config');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Tạo key 32 bytes từ encryptionKey bất kỳ bằng SHA-256
 */
const getKey = () => {
    return crypto.createHash('sha256').update(encryptionKey).digest();
};

/**
 * Mã hóa chuỗi text bằng AES-256-CBC
 * @param {string} text - Chuỗi cần mã hóa
 * @returns {string} - Chuỗi đã mã hóa (iv:encrypted) dạng hex
 */
const encrypt = (text) => {
    if (!text) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Trả về dạng "iv:encryptedData"
    return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Giải mã chuỗi đã được mã hóa bằng AES-256-CBC
 * @param {string} hash - Chuỗi đã mã hóa (iv:encrypted)
 * @returns {string} - Chuỗi gốc
 */
const decrypt = (hash) => {
    if (!hash) return hash;

    const [ivHex, encrypted] = hash.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

module.exports = { encrypt, decrypt };
