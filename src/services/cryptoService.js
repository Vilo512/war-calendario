// Service for client-side AES-256-GCM encryption & decryption
// Using native Web Crypto API (SubtleCrypto)

const DEFAULT_SALT = 'WAR_LLEIDA_CLEANING_SALT_2026';
const FALLBACK_SECRET = 'WAR_CLEANING_SEC_KEY_8f93b1d2e4a5c6';

/**
 * Derives a cryptographic key from a secret passphrase and salt
 */
async function deriveKey(secretPassphrase = FALLBACK_SECRET) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretPassphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(DEFAULT_SALT),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain text string with AES-256-GCM
 * Returns an object { ciphertext: string, iv: string } (both Base64)
 */
export async function encryptText(plainText, customSecret = null) {
  if (!plainText || typeof plainText !== 'string') return null;

  try {
    const secret = customSecret || import.meta.env.VITE_ADMIN_ENCRYPTION_KEY || FALLBACK_SECRET;
    const key = await deriveKey(secret);
    const enc = new TextEncoder();
    const encodedData = enc.encode(plainText);

    // 12-byte random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    // Convert to base64
    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64
    };
  } catch (error) {
    console.error('Error encrypting text:', error);
    throw error;
  }
}

/**
 * Decrypts a ciphertext object { ciphertext: string, iv: string }
 * Returns the decrypted string or null
 */
export async function decryptText(encryptedObj, customSecret = null) {
  if (!encryptedObj || !encryptedObj.ciphertext || !encryptedObj.iv) return null;

  try {
    const secret = customSecret || import.meta.env.VITE_ADMIN_ENCRYPTION_KEY || FALLBACK_SECRET;
    const key = await deriveKey(secret);

    // Decode base64
    const ivBytes = new Uint8Array(
      atob(encryptedObj.iv)
        .split('')
        .map(c => c.charCodeAt(0))
    );
    const encryptedBytes = new Uint8Array(
      atob(encryptedObj.ciphertext)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      key,
      encryptedBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting text:', error);
    return null;
  }
}
