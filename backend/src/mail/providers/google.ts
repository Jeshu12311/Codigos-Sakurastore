import type { MailMessage } from './types.js';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const DEFAULT_SCOPES = ['openid', 'email', GMAIL_READONLY_SCOPE] as const;
const MAX_MESSAGES = 20;
const MAX_MIME_DEPTH = 12;
const MAX_MIME_PARTS = 100;
const MAX_BODY_BYTES = 128 * 1024;

export interface GoogleAuthorizationOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}

export interface GoogleCodeExchangeOptions {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}

export interface GoogleRefreshOptions {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}

export interface GoogleAuthorization {
  refreshToken: string;
  accessToken: string;
  email: string;
  providerSubject: string;
  scopes: string[];
  expiresIn?: number;
}

export interface GoogleAccessToken {
  accessToken: string;
  scopes: string[];
  expiresIn?: number;
}

export type GoogleMessage = MailMessage;

interface GoogleTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
}

interface GoogleUserInfoResponse {
  sub?: unknown;
  email?: unknown;
}

interface GmailMessageListResponse {
  messages?: Array<{ id?: unknown }>;
}

interface GmailHeader {
  name?: unknown;
  value?: unknown;
}

interface GmailMessagePart {
  mimeType?: unknown;
  filename?: unknown;
  headers?: GmailHeader[];
  body?: {
    data?: unknown;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id?: unknown;
  internalDate?: unknown;
  snippet?: unknown;
  payload?: GmailMessagePart;
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Falta ${label} para conectar Google.`);
  }

  return normalized;
}

function optionalFormField(form: URLSearchParams, key: string, value?: string): void {
  const normalized = value?.trim();

  if (normalized) {
    form.set(key, normalized);
  }
}

function parseScopes(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return [...new Set(value.split(/\s+/u).map((scope) => scope.trim()).filter(Boolean))];
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

async function readJson<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) {
    // Deliberately omit Google's response body: it can echo credentials or tokens.
    throw new Error(`${operation} falló (HTTP ${response.status}).`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${operation} devolvió una respuesta inválida.`);
  }
}

async function requestJson<T>(url: string, init: RequestInit, operation: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`No se pudo contactar a Google durante: ${operation}.`);
  }

  return readJson<T>(response, operation);
}

function bearerHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${requireNonEmpty(accessToken, 'el token de acceso')}`,
  };
}

export function buildGoogleAuthorizationUrl(options: GoogleAuthorizationOptions): string {
  const scopes = options.scopes?.length ? options.scopes : DEFAULT_SCOPES;
  const normalizedScopes = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];

  if (!normalizedScopes.includes('openid') || !normalizedScopes.includes('email')) {
    throw new Error('La autorización de Google requiere los permisos openid y email.');
  }

  if (!normalizedScopes.includes(GMAIL_READONLY_SCOPE)) {
    throw new Error('La autorización de Google requiere el permiso gmail.readonly.');
  }

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', requireNonEmpty(options.clientId, 'el client ID'));
  url.searchParams.set('redirect_uri', requireNonEmpty(options.redirectUri, 'la URL de retorno'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', normalizedScopes.join(' '));
  url.searchParams.set('state', requireNonEmpty(options.state, 'el estado OAuth'));
  url.searchParams.set('code_challenge', requireNonEmpty(options.codeChallenge, 'el desafío PKCE'));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');

  return url.toString();
}

export async function exchangeGoogleCode(
  options: GoogleCodeExchangeOptions,
): Promise<GoogleAuthorization> {
  const form = new URLSearchParams({
    client_id: requireNonEmpty(options.clientId, 'el client ID'),
    redirect_uri: requireNonEmpty(options.redirectUri, 'la URL de retorno'),
    code: requireNonEmpty(options.code, 'el código de autorización'),
    code_verifier: requireNonEmpty(options.codeVerifier, 'el verificador PKCE'),
    grant_type: 'authorization_code',
  });
  optionalFormField(form, 'client_secret', options.clientSecret);

  const tokenData = await requestJson<GoogleTokenResponse>(
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
    'El intercambio del código de Google',
  );

  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw new Error('Google no devolvió un token de acceso válido.');
  }

  if (typeof tokenData.refresh_token !== 'string' || !tokenData.refresh_token) {
    throw new Error(
      'Google no devolvió un token de actualización. Revoca el acceso anterior y vuelve a autorizar la cuenta.',
    );
  }

  const userInfo = await requestJson<GoogleUserInfoResponse>(
    GOOGLE_USERINFO_ENDPOINT,
    {
      method: 'GET',
      headers: bearerHeaders(tokenData.access_token),
    },
    'La consulta del perfil de Google',
  );

  if (typeof userInfo.email !== 'string' || !userInfo.email.trim()) {
    throw new Error('Google no devolvió el correo de la cuenta autorizada.');
  }

  if (typeof userInfo.sub !== 'string' || !userInfo.sub.trim()) {
    throw new Error('Google no devolvió el identificador de la cuenta autorizada.');
  }

  return {
    refreshToken: tokenData.refresh_token,
    accessToken: tokenData.access_token,
    email: userInfo.email.trim().toLowerCase(),
    providerSubject: userInfo.sub.trim(),
    scopes: parseScopes(tokenData.scope),
    expiresIn: asPositiveNumber(tokenData.expires_in),
  };
}

export async function refreshGoogleAccessToken(
  options: GoogleRefreshOptions,
): Promise<GoogleAccessToken> {
  const form = new URLSearchParams({
    client_id: requireNonEmpty(options.clientId, 'el client ID'),
    refresh_token: requireNonEmpty(options.refreshToken, 'el token de actualización'),
    grant_type: 'refresh_token',
  });
  optionalFormField(form, 'client_secret', options.clientSecret);

  const tokenData = await requestJson<GoogleTokenResponse>(
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
    'La renovación del acceso a Google',
  );

  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw new Error('Google no devolvió un token de acceso renovado válido.');
  }

  return {
    accessToken: tokenData.access_token,
    scopes: parseScopes(tokenData.scope),
    expiresIn: asPositiveNumber(tokenData.expires_in),
  };
}

function findHeader(part: GmailMessagePart | undefined, name: string): string {
  const header = part?.headers?.find(
    (candidate) =>
      typeof candidate.name === 'string' && candidate.name.toLowerCase() === name.toLowerCase(),
  );

  return typeof header?.value === 'string' ? decodeMimeWords(header.value).trim() : '';
}

function decodeBase64Url(data: string, maxBytes: number): Buffer {
  if (!/^[A-Za-z0-9_-]*={0,2}$/u.test(data)) {
    return Buffer.alloc(0);
  }

  // Four base64 characters encode at most three bytes. Avoid allocating the full
  // body when a provider returns unexpectedly large inline content.
  const maxEncodedLength = Math.ceil(maxBytes / 3) * 4;
  const bounded = data.slice(0, maxEncodedLength).replace(/-/gu, '+').replace(/_/gu, '/');
  const padding = (4 - (bounded.length % 4)) % 4;

  try {
    return Buffer.from(`${bounded}${'='.repeat(padding)}`, 'base64').subarray(0, maxBytes);
  } catch {
    return Buffer.alloc(0);
  }
}

function charsetFromPart(part: GmailMessagePart): string {
  const contentType = findHeader(part, 'content-type');
  const match = /charset\s*=\s*(?:"([^"]+)"|([^;\s]+))/iu.exec(contentType);
  return (match?.[1] ?? match?.[2] ?? 'utf-8').trim().toLowerCase();
}

function decodePartText(part: GmailMessagePart, remainingBytes: number): string {
  if (typeof part.body?.data !== 'string' || remainingBytes <= 0) {
    return '';
  }

  const bytes = decodeBase64Url(part.body.data, remainingBytes);

  if (!bytes.length) {
    return '';
  }

  try {
    return new TextDecoder(charsetFromPart(part), { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function collectTextParts(
  part: GmailMessagePart | undefined,
  plainParts: GmailMessagePart[],
  htmlParts: GmailMessagePart[],
  state: { visited: number },
  depth = 0,
): void {
  if (!part || depth > MAX_MIME_DEPTH || state.visited >= MAX_MIME_PARTS) {
    return;
  }

  state.visited += 1;
  const mimeType = typeof part.mimeType === 'string' ? part.mimeType.toLowerCase() : '';
  const hasFilename = typeof part.filename === 'string' && part.filename.trim().length > 0;

  if (!hasFilename && mimeType === 'text/plain' && typeof part.body?.data === 'string') {
    plainParts.push(part);
  } else if (!hasFilename && mimeType === 'text/html' && typeof part.body?.data === 'string') {
    htmlParts.push(part);
  }

  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      collectTextParts(child, plainParts, htmlParts, state, depth + 1);

      if (state.visited >= MAX_MIME_PARTS) {
        break;
      }
    }
  }
}

function decodeParts(parts: GmailMessagePart[]): string {
  const chunks: string[] = [];
  let remaining = MAX_BODY_BYTES;

  for (const part of parts) {
    const text = decodePartText(part, remaining);

    if (text) {
      chunks.push(text);
      remaining -= Buffer.byteLength(text, 'utf8');
    }

    if (remaining <= 0) {
      break;
    }
  }

  return chunks.join('\n').slice(0, MAX_BODY_BYTES).trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/giu, (entity, code: string) => {
    if (code.startsWith('#')) {
      const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
      const rawNumber = radix === 16 ? code.slice(2) : code.slice(1);
      const point = Number.parseInt(rawNumber, radix);

      if (Number.isInteger(point) && point >= 0 && point <= 0x10ffff) {
        try {
          return String.fromCodePoint(point);
        } catch {
          return entity;
        }
      }

      return entity;
    }

    return named[code.toLowerCase()] ?? entity;
  });
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ')
      .replace(/<br\s*\/?\s*>/giu, '\n')
      .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/giu, '\n')
      .replace(/<[^>]+>/gu, ' '),
  )
    .replace(/[\t ]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?\s]+)\?([bq])\?([^?]*)\?=/giu,
    (whole, charset: string, encoding: string, encoded: string) => {
      let bytes: Buffer;

      try {
        if (encoding.toLowerCase() === 'b') {
          bytes = Buffer.from(encoded, 'base64');
        } else {
          const decoded = encoded
            .replace(/_/gu, ' ')
            .replace(/=([\da-f]{2})/giu, (_match: string, hex: string) =>
              String.fromCharCode(Number.parseInt(hex, 16)),
            );
          bytes = Buffer.from(decoded, 'latin1');
        }

        return new TextDecoder(charset, { fatal: false }).decode(bytes);
      } catch {
        return whole;
      }
    },
  );
}

function messageText(message: GmailMessageResponse): string {
  const plainParts: GmailMessagePart[] = [];
  const htmlParts: GmailMessagePart[] = [];
  collectTextParts(message.payload, plainParts, htmlParts, { visited: 0 });

  const plain = decodeParts(plainParts);

  if (plain) {
    return plain;
  }

  const html = decodeParts(htmlParts);

  if (html) {
    return htmlToText(html).slice(0, MAX_BODY_BYTES);
  }

  return typeof message.snippet === 'string' ? message.snippet.slice(0, MAX_BODY_BYTES).trim() : '';
}

function messageDate(message: GmailMessageResponse): Date {
  if (typeof message.internalDate === 'string') {
    const milliseconds = Number(message.internalDate);

    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      return new Date(milliseconds);
    }
  }

  const dateHeader = findHeader(message.payload, 'date');
  const parsed = Date.parse(dateHeader);
  return Number.isFinite(parsed) ? new Date(parsed) : new Date(0);
}

async function getGoogleMessage(accessToken: string, id: string): Promise<GoogleMessage> {
  const url = new URL(`${GOOGLE_GMAIL_API}/messages/${encodeURIComponent(id)}`);
  url.searchParams.set('format', 'full');

  const message = await requestJson<GmailMessageResponse>(
    url.toString(),
    { method: 'GET', headers: bearerHeaders(accessToken) },
    'La lectura de un mensaje de Gmail',
  );

  return {
    id: typeof message.id === 'string' && message.id ? message.id : id,
    sender: findHeader(message.payload, 'from'),
    subject: findHeader(message.payload, 'subject'),
    text: messageText(message),
    receivedAt: messageDate(message),
  };
}

export async function listGoogleMessages(
  accessToken: string,
  since: Date,
): Promise<GoogleMessage[]> {
  if (!(since instanceof Date) || !Number.isFinite(since.getTime())) {
    throw new Error('La fecha inicial para consultar Gmail no es válida.');
  }

  const normalizedToken = requireNonEmpty(accessToken, 'el token de acceso');
  const url = new URL(`${GOOGLE_GMAIL_API}/messages`);
  url.searchParams.set('maxResults', String(MAX_MESSAGES));
  url.searchParams.set('includeSpamTrash', 'false');
  url.searchParams.set('q', `after:${Math.floor(since.getTime() / 1000)}`);

  const result = await requestJson<GmailMessageListResponse>(
    url.toString(),
    { method: 'GET', headers: bearerHeaders(normalizedToken) },
    'La consulta de mensajes de Gmail',
  );
  const ids = (result.messages ?? [])
    .map((message) => message.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, MAX_MESSAGES);

  const messages = await Promise.all(ids.map((id) => getGoogleMessage(normalizedToken, id)));
  return messages.sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime());
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const normalized = token.trim();

  if (!normalized) {
    return;
  }

  try {
    await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: normalized }),
    });
  } catch {
    // Revocation is intentionally best-effort (for disconnect/cleanup paths).
  }
}
