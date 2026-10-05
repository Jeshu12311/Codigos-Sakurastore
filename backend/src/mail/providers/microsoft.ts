import type { MailMessage } from './types.js';

const MICROSOFT_OAUTH_ROOT = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const MICROSOFT_AUTHORIZATION_ENDPOINT = `${MICROSOFT_OAUTH_ROOT}/authorize`;
const MICROSOFT_TOKEN_ENDPOINT = `${MICROSOFT_OAUTH_ROOT}/token`;
const MICROSOFT_GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

const GRAPH_MAIL_SCOPE = 'https://graph.microsoft.com/Mail.Read';
const GRAPH_USER_SCOPE = 'https://graph.microsoft.com/User.Read';
const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  GRAPH_USER_SCOPE,
  GRAPH_MAIL_SCOPE,
] as const;
const MAX_MESSAGES = 20;
const MAX_BODY_CHARACTERS = 128 * 1024;

export interface MicrosoftAuthorizationOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}

export interface MicrosoftCodeExchangeOptions {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  scopes?: readonly string[];
}

export interface MicrosoftRefreshOptions {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scopes?: readonly string[];
}

export interface MicrosoftAuthorization {
  refreshToken: string;
  accessToken: string;
  email: string;
  providerSubject: string;
  scopes: string[];
  expiresIn?: number;
}

export interface MicrosoftAccessToken {
  accessToken: string;
  /** Microsoft can rotate refresh tokens. Persist this value when present. */
  refreshToken?: string;
  scopes: string[];
  expiresIn?: number;
}

export type MicrosoftMessage = MailMessage;

interface MicrosoftTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
}

interface MicrosoftProfileResponse {
  id?: unknown;
  mail?: unknown;
  userPrincipalName?: unknown;
}

interface GraphEmailAddress {
  name?: unknown;
  address?: unknown;
}

interface GraphMessage {
  id?: unknown;
  subject?: unknown;
  receivedDateTime?: unknown;
  bodyPreview?: unknown;
  body?: {
    contentType?: unknown;
    content?: unknown;
  };
  from?: {
    emailAddress?: GraphEmailAddress;
  };
  sender?: {
    emailAddress?: GraphEmailAddress;
  };
}

interface GraphMessageListResponse {
  value?: GraphMessage[];
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Falta ${label} para conectar Microsoft.`);
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

function normalizeScopes(scopes?: readonly string[]): string[] {
  const selected = scopes?.length ? scopes : DEFAULT_SCOPES;
  return [...new Set(selected.map((scope) => scope.trim()).filter(Boolean))];
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

async function requestJson<T>(url: string, init: RequestInit, operation: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`No se pudo contactar a Microsoft durante: ${operation}.`);
  }

  if (!response.ok) {
    // Do not include response bodies: identity providers can echo codes or token details.
    throw new Error(`${operation} falló (HTTP ${response.status}).`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${operation} devolvió una respuesta inválida.`);
  }
}

function bearerHeaders(accessToken: string, textBody = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${requireNonEmpty(accessToken, 'el token de acceso')}`,
  };

  if (textBody) {
    headers.Prefer = 'outlook.body-content-type="text"';
  }

  return headers;
}

function assertRequiredScopes(scopes: readonly string[]): void {
  if (!scopes.includes('openid') || !scopes.includes('email')) {
    throw new Error('La autorización de Microsoft requiere los permisos openid y email.');
  }

  if (!scopes.includes('offline_access')) {
    throw new Error('La autorización de Microsoft requiere el permiso offline_access.');
  }

  if (!scopes.includes(GRAPH_MAIL_SCOPE)) {
    throw new Error('La autorización de Microsoft requiere el permiso Mail.Read.');
  }

  if (!scopes.includes(GRAPH_USER_SCOPE)) {
    throw new Error('La autorización de Microsoft requiere el permiso User.Read.');
  }
}

export function buildMicrosoftAuthorizationUrl(options: MicrosoftAuthorizationOptions): string {
  const scopes = normalizeScopes(options.scopes);
  assertRequiredScopes(scopes);

  const url = new URL(MICROSOFT_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', requireNonEmpty(options.clientId, 'el client ID'));
  url.searchParams.set('redirect_uri', requireNonEmpty(options.redirectUri, 'la URL de retorno'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', requireNonEmpty(options.state, 'el estado OAuth'));
  url.searchParams.set('code_challenge', requireNonEmpty(options.codeChallenge, 'el desafío PKCE'));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');

  return url.toString();
}

export async function exchangeMicrosoftCode(
  options: MicrosoftCodeExchangeOptions,
): Promise<MicrosoftAuthorization> {
  const scopes = normalizeScopes(options.scopes);
  assertRequiredScopes(scopes);
  const form = new URLSearchParams({
    client_id: requireNonEmpty(options.clientId, 'el client ID'),
    redirect_uri: requireNonEmpty(options.redirectUri, 'la URL de retorno'),
    code: requireNonEmpty(options.code, 'el código de autorización'),
    code_verifier: requireNonEmpty(options.codeVerifier, 'el verificador PKCE'),
    grant_type: 'authorization_code',
    scope: scopes.join(' '),
  });
  optionalFormField(form, 'client_secret', options.clientSecret);

  const tokenData = await requestJson<MicrosoftTokenResponse>(
    MICROSOFT_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
    'El intercambio del código de Microsoft',
  );

  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw new Error('Microsoft no devolvió un token de acceso válido.');
  }

  if (typeof tokenData.refresh_token !== 'string' || !tokenData.refresh_token) {
    throw new Error(
      'Microsoft no devolvió un token de actualización. Vuelve a autorizar la cuenta con acceso sin conexión.',
    );
  }

  const profileUrl = new URL(`${MICROSOFT_GRAPH_ROOT}/me`);
  profileUrl.searchParams.set('$select', 'id,mail,userPrincipalName');
  const profile = await requestJson<MicrosoftProfileResponse>(
    profileUrl.toString(),
    { method: 'GET', headers: bearerHeaders(tokenData.access_token) },
    'La consulta del perfil de Microsoft',
  );

  const email =
    typeof profile.mail === 'string' && profile.mail.trim()
      ? profile.mail.trim()
      : typeof profile.userPrincipalName === 'string'
        ? profile.userPrincipalName.trim()
        : '';

  if (!email) {
    throw new Error('Microsoft no devolvió el correo de la cuenta autorizada.');
  }

  if (typeof profile.id !== 'string' || !profile.id.trim()) {
    throw new Error('Microsoft no devolvió el identificador de la cuenta autorizada.');
  }

  return {
    refreshToken: tokenData.refresh_token,
    accessToken: tokenData.access_token,
    email: email.toLowerCase(),
    providerSubject: profile.id.trim(),
    scopes: parseScopes(tokenData.scope),
    expiresIn: asPositiveNumber(tokenData.expires_in),
  };
}

export async function refreshMicrosoftAccessToken(
  options: MicrosoftRefreshOptions,
): Promise<MicrosoftAccessToken> {
  const scopes = normalizeScopes(options.scopes);
  assertRequiredScopes(scopes);
  const form = new URLSearchParams({
    client_id: requireNonEmpty(options.clientId, 'el client ID'),
    refresh_token: requireNonEmpty(options.refreshToken, 'el token de actualización'),
    grant_type: 'refresh_token',
    scope: scopes.join(' '),
  });
  optionalFormField(form, 'client_secret', options.clientSecret);

  const tokenData = await requestJson<MicrosoftTokenResponse>(
    MICROSOFT_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
    'La renovación del acceso a Microsoft',
  );

  if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw new Error('Microsoft no devolvió un token de acceso renovado válido.');
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken:
      typeof tokenData.refresh_token === 'string' && tokenData.refresh_token
        ? tokenData.refresh_token
        : undefined,
    scopes: parseScopes(tokenData.scope),
    expiresIn: asPositiveNumber(tokenData.expires_in),
  };
}

function htmlToText(html: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  const withoutTags = html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ')
    .replace(/<br\s*\/?\s*>/giu, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ');

  return withoutTags
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/giu, (entity, code: string) => {
      if (!code.startsWith('#')) {
        return entities[code.toLowerCase()] ?? entity;
      }

      const hexadecimal = code[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);

      if (!Number.isInteger(point) || point < 0 || point > 0x10ffff) {
        return entity;
      }

      try {
        return String.fromCodePoint(point);
      } catch {
        return entity;
      }
    })
    .replace(/[\t ]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function normalizedSender(message: GraphMessage): string {
  const source = message.from?.emailAddress ?? message.sender?.emailAddress;
  const address = typeof source?.address === 'string' ? source.address.trim() : '';
  const name = typeof source?.name === 'string' ? source.name.trim() : '';

  if (name && address) {
    return `${name} <${address}>`;
  }

  return address || name;
}

function normalizedBody(message: GraphMessage): string {
  const content = typeof message.body?.content === 'string' ? message.body.content : '';
  const contentType =
    typeof message.body?.contentType === 'string' ? message.body.contentType.toLowerCase() : '';
  const normalized = contentType === 'html' ? htmlToText(content) : content.trim();

  if (normalized) {
    return normalized.slice(0, MAX_BODY_CHARACTERS);
  }

  return typeof message.bodyPreview === 'string'
    ? message.bodyPreview.trim().slice(0, MAX_BODY_CHARACTERS)
    : '';
}

function normalizedDate(value: unknown): Date {
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
      return new Date(timestamp);
    }
  }

  return new Date(0);
}

function normalizeMessage(message: GraphMessage): MicrosoftMessage | null {
  if (typeof message.id !== 'string' || !message.id) {
    return null;
  }

  return {
    id: message.id,
    sender: normalizedSender(message),
    subject: typeof message.subject === 'string' ? message.subject.trim() : '',
    text: normalizedBody(message),
    receivedAt: normalizedDate(message.receivedDateTime),
  };
}

export async function listMicrosoftMessages(
  accessToken: string,
  since: Date,
): Promise<MicrosoftMessage[]> {
  if (!(since instanceof Date) || !Number.isFinite(since.getTime())) {
    throw new Error('La fecha inicial para consultar Microsoft no es válida.');
  }

  const url = new URL(`${MICROSOFT_GRAPH_ROOT}/me/mailFolders/inbox/messages`);
  url.searchParams.set('$top', String(MAX_MESSAGES));
  url.searchParams.set(
    '$select',
    'id,from,sender,subject,body,bodyPreview,receivedDateTime',
  );
  url.searchParams.set('$filter', `receivedDateTime ge ${since.toISOString()}`);
  url.searchParams.set('$orderby', 'receivedDateTime desc');

  const result = await requestJson<GraphMessageListResponse>(
    url.toString(),
    { method: 'GET', headers: bearerHeaders(accessToken, true) },
    'La consulta de mensajes de Microsoft',
  );

  return (result.value ?? [])
    .slice(0, MAX_MESSAGES)
    .map(normalizeMessage)
    .filter((message): message is MicrosoftMessage => message !== null)
    .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime());
}
