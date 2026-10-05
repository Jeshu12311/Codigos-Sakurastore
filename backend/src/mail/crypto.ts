import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function toBase64Url(value: Buffer): string {
  return value.toString('base64url');
}

function fromBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Envelope de secreto inválido.');
  return Buffer.from(value, 'base64url');
}

/** Decodes the 32-byte AES key kept in MAIL_TOKEN_KEY_B64. */
export function parseMailTokenKey(keyBase64: string): Buffer {
  if (!keyBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(keyBase64) || keyBase64.length % 4 !== 0) {
    throw new Error('MAIL_TOKEN_KEY_B64 debe ser una clave AES-256 en base64.');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32 || key.toString('base64') !== keyBase64) {
    throw new Error('MAIL_TOKEN_KEY_B64 debe decodificar exactamente a 32 bytes.');
  }
  return key;
}

/** Encrypts a UTF-8 secret with AES-256-GCM and returns a versioned envelope. */
export function sealSecret(plaintext: string, keyBase64: string, aad?: string): string {
  const key = parseMailTokenKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_BYTES });
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [ENVELOPE_VERSION, toBase64Url(iv), toBase64Url(ciphertext), toBase64Url(cipher.getAuthTag())].join('.');
}

/** Authenticates and decrypts a secret produced by sealSecret. */
export function openSecret(envelope: string, keyBase64: string, aad?: string): string {
  const [version, encodedIv, encodedCiphertext, encodedTag, ...extra] = envelope.split('.');
  if (version !== ENVELOPE_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra.length > 0) {
    throw new Error('Envelope de secreto inválido.');
  }
  const iv = fromBase64Url(encodedIv);
  const ciphertext = fromBase64Url(encodedCiphertext);
  const tag = fromBase64Url(encodedTag);
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) throw new Error('Envelope de secreto inválido.');

  try {
    const decipher = createDecipheriv('aes-256-gcm', parseMailTokenKey(keyBase64), iv, { authTagLength: AUTH_TAG_BYTES });
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('No se pudo autenticar el secreto cifrado.');
  }
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/** Creates an RFC 7636 S256 verifier/challenge pair without persisting either value. */
export function createPkcePair(): PkcePair {
  const verifier = toBase64Url(randomBytes(64));
  const challenge = toBase64Url(createHash('sha256').update(verifier, 'ascii').digest());
  return { verifier, challenge, method: 'S256' };
}

export function createOAuthState(): string {
  return toBase64Url(randomBytes(32));
}

export function hashOAuthState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}
