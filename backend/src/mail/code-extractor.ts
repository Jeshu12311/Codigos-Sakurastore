export interface MailCodeMessage {
  from: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}

/** Extracts the mailbox address from a RFC 5322-style From header. */
export function normalizeSender(value: string): string | null {
  const match = value.trim().match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/) ?? value.trim().match(/^([^\s<>]+@[^\s<>]+)$/);
  if (!match) return null;
  const email = match[1].trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()] ?? `&${name};`));
}

function firstCode(content: string): string | null {
  const keyword = /\b(?:verification|security|one[ -]?time|access|login|authentication|otp|passcode|c[oó]digo|verificaci[oó]n|clave|pin)\b/iu;
  if (!keyword.test(content)) return null;

  const candidates = new Set<string>();
  const contextual = /\b(?:verification|security|one[ -]?time|access|login|authentication|otp|passcode|c[oó]digo|verificaci[oó]n|clave|pin)\b(?:\s+(?:code|de seguridad|de acceso))?\s*(?:is|es|:|-)?\s*([a-z0-9]{4,12}(?:-[a-z0-9]{2,12})?)\b/giu;
  for (const match of content.matchAll(contextual)) candidates.add(match[1].toUpperCase());

  // Many providers place the OTP on its own line after a contextual sentence.
  // A keyword is still mandatory, and multiple distinct values are rejected.
  const standalone = /(?:^|\s)(?=[a-z0-9-]{4,12}(?=\s|$))(?=[a-z0-9-]*\d)([a-z0-9]{4,12}(?:-[a-z0-9]{2,12})?)(?=\s|$)/gimu;
  for (const match of content.matchAll(standalone)) {
    const value = match[1].toUpperCase();
    if (!['CODE', 'CODIGO', 'CÓDIGO', 'ACCESS', 'LOGIN'].includes(value)) candidates.add(value);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

/**
 * Pure extraction gate: only an explicitly allowlisted sender can yield a
 * code. It intentionally does not fetch email or mutate persistence.
 */
export function extractEmailCode(message: MailCodeMessage, senderAllowlist: readonly string[]): string | null {
  const sender = normalizeSender(message.from);
  const allowedSenders = new Set(senderAllowlist.map(normalizeSender).filter((value): value is string => value !== null));
  const allowedDomains = senderAllowlist
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^@[a-z0-9.-]+\.[a-z]{2,}$/u.test(value));
  if (!sender || (!allowedSenders.has(sender) && !allowedDomains.some((domain) => sender.endsWith(domain)))) return null;

  const content = [message.subject, message.text, message.html ? plainText(message.html) : null]
    .filter((value): value is string => Boolean(value))
    .join('\n');
  return firstCode(content);
}
