import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPkcePair, openSecret, parseMailTokenKey, sealSecret } from '../src/mail/crypto.js';

const key = Buffer.alloc(32, 7).toString('base64');

describe('mail crypto', () => {
  it('round-trips an authenticated AES-256-GCM envelope', () => {
    const envelope = sealSecret('refresh-token-with-ñ', key);
    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(openSecret(envelope, key)).toBe('refresh-token-with-ñ');
  });

  it('rejects a tampered envelope and keys that are not 32 bytes', () => {
    const envelope = sealSecret('secret', key);
    const parts = envelope.split('.');
    parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;
    const tampered = parts.join('.');
    expect(() => openSecret(tampered, key)).toThrow(/autenticar|inválido/i);
    expect(() => parseMailTokenKey(Buffer.alloc(31).toString('base64'))).toThrow(/32 bytes/i);
  });

  it('authenticates the envelope context', () => {
    const envelope = sealSecret('secret', key, 'mailbox:one');
    expect(openSecret(envelope, key, 'mailbox:one')).toBe('secret');
    expect(() => openSecret(envelope, key, 'mailbox:two')).toThrow(/autenticar/i);
  });

  it('creates an RFC 7636 S256 PKCE pair', () => {
    const pair = createPkcePair();
    expect(pair).toMatchObject({ method: 'S256' });
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pair.challenge).toBe(createHash('sha256').update(pair.verifier, 'ascii').digest('base64url'));
  });
});
