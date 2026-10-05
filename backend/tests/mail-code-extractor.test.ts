import { describe, expect, it } from 'vitest';
import { extractEmailCode, normalizeSender } from '../src/mail/code-extractor.js';

describe('email code extractor', () => {
  it('only extracts a code from an allowlisted normalized sender', () => {
    expect(extractEmailCode({ from: 'Servicio <no-reply@example.com>', text: 'Tu código de seguridad es 483921.' }, ['NO-REPLY@EXAMPLE.COM']))
      .toBe('483921');
    expect(extractEmailCode({ from: 'spoof@example.com', text: 'Tu código es 483921' }, ['no-reply@example.com']))
      .toBeNull();
  });

  it('extracts a contextual alphanumeric code from HTML without fetching or mutating state', () => {
    expect(extractEmailCode({ from: 'alerts@example.com', html: '<p>Verification code: <strong>ab12-cd34</strong></p>' }, ['alerts@example.com']))
      .toBe('AB12-CD34');
  });

  it('normalizes a valid From header and rejects malformed addresses', () => {
    expect(normalizeSender(' Alerts <ALERTS@Example.com> ')).toBe('alerts@example.com');
    expect(normalizeSender('not an address')).toBeNull();
  });

  it('supports an explicitly allowlisted sender domain and rejects ambiguous codes', () => {
    expect(extractEmailCode({ from: 'Disney <otp@notify.disneyplus.com>', text: 'Tu código de verificación es 987654' }, ['@notify.disneyplus.com']))
      .toBe('987654');
    expect(extractEmailCode({ from: 'otp@example.com', text: 'Verification code: 123456. Security code: 654321.' }, ['otp@example.com']))
      .toBeNull();
  });
});
