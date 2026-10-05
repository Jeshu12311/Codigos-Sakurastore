import { CodeRequestStatus, CodeSource, MailConnectionStatus, MailProvider, Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { extractEmailCode } from './code-extractor.js';
import { openSecret, sealSecret } from './crypto.js';
import { listGoogleMessages, refreshGoogleAccessToken } from './providers/google.js';
import { listMicrosoftMessages, refreshMicrosoftAccessToken } from './providers/microsoft.js';
import type { MailMessage } from './providers/types.js';

const LEASE_MILLISECONDS = 30_000;
const MIN_SYNC_INTERVAL_MILLISECONDS = 15_000;
const INITIAL_LOOKBACK_MILLISECONDS = 15 * 60_000;
const OVERLAP_MILLISECONDS = 2 * 60_000;

interface StoredCredentials {
  refreshToken: string;
}

export interface MailSyncResult {
  status: 'disabled' | 'not_connected' | 'cooldown' | 'no_request' | 'waiting' | 'fulfilled';
  codeCreated: boolean;
}

function credentialAad(accountId: string, provider: MailProvider): string {
  return `mailbox:${accountId}:${provider}:v1`;
}

function credentialsFromEnvelope(envelope: string, accountId: string, provider: MailProvider): StoredCredentials {
  if (!env.MAIL_TOKEN_KEY_B64) throw new Error('La clave de cifrado del correo no está configurada.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(openSecret(envelope, env.MAIL_TOKEN_KEY_B64, credentialAad(accountId, provider)));
  } catch {
    throw new Error('No se pudieron abrir las credenciales del buzón.');
  }
  if (!parsed || typeof parsed !== 'object' || typeof (parsed as StoredCredentials).refreshToken !== 'string') {
    throw new Error('Las credenciales guardadas del buzón no son válidas.');
  }
  return parsed as StoredCredentials;
}

function sealCredentials(credentials: StoredCredentials, accountId: string, provider: MailProvider): string {
  if (!env.MAIL_TOKEN_KEY_B64) throw new Error('La clave de cifrado del correo no está configurada.');
  return sealSecret(
    JSON.stringify(credentials),
    env.MAIL_TOKEN_KEY_B64,
    credentialAad(accountId, provider),
  );
}

function providerConfigured(provider: MailProvider): boolean {
  if (!env.MAIL_TOKEN_KEY_B64) return false;
  return provider === MailProvider.GOOGLE
    ? Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    : Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
}

async function fetchMessages(
  provider: MailProvider,
  credentials: StoredCredentials,
  scopes: string[],
  since: Date,
): Promise<{ messages: MailMessage[]; credentials: StoredCredentials; scopes: string[] }> {
  if (provider === MailProvider.GOOGLE) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google no está configurado.');
    const refreshed = await refreshGoogleAccessToken({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken: credentials.refreshToken,
    });
    return {
      messages: await listGoogleMessages(refreshed.accessToken, since),
      credentials,
      scopes: refreshed.scopes.length ? refreshed.scopes : scopes,
    };
  }

  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) throw new Error('Microsoft no está configurado.');
  const refreshed = await refreshMicrosoftAccessToken({
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    refreshToken: credentials.refreshToken,
  });
  return {
    messages: await listMicrosoftMessages(refreshed.accessToken, since),
    credentials: { refreshToken: refreshed.refreshToken ?? credentials.refreshToken },
    scopes: refreshed.scopes.length ? refreshed.scopes : scopes,
  };
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/HTTP 40[013]|token|credencial|autoriz|renovaci[oó]n/i.test(message)) return 'REAUTH_REQUIRED';
  if (/configurad|clave de cifrado/i.test(message)) return 'NOT_CONFIGURED';
  return 'PROVIDER_ERROR';
}

/**
 * Pulls recent messages for one authorized mailbox. A database lease keeps
 * public polling and manual syncs from reading the provider concurrently.
 */
export async function syncMailboxForAccount(accountId: string, force = false): Promise<MailSyncResult> {
  const connection = await prisma.mailboxConnection.findUnique({ where: { accountId } });
  if (!connection || connection.status !== MailConnectionStatus.ACTIVE) {
    return { status: 'not_connected', codeCreated: false };
  }
  if (!providerConfigured(connection.provider)) return { status: 'disabled', codeCreated: false };

  const now = new Date();
  const availableAt = new Date(now.getTime() - MIN_SYNC_INTERVAL_MILLISECONDS);
  const leaseUntil = new Date(now.getTime() + LEASE_MILLISECONDS);
  const lease = await prisma.mailboxConnection.updateMany({
    where: {
      id: connection.id,
      status: MailConnectionStatus.ACTIVE,
      OR: [{ syncLockUntil: null }, { syncLockUntil: { lt: now } }],
      ...(force ? {} : { AND: [{ OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: availableAt } }] }] }),
    },
    data: { syncLockUntil: leaseUntil },
  });
  if (lease.count === 0) return { status: 'cooldown', codeCreated: false };

  try {
    await prisma.codeRequest.updateMany({
      where: { accountId, status: CodeRequestStatus.WAITING, expiresAt: { lte: now } },
      data: { status: CodeRequestStatus.EXPIRED },
    });
    const request = await prisma.codeRequest.findFirst({
      where: { accountId, status: CodeRequestStatus.WAITING, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });

    const credentials = credentialsFromEnvelope(
      connection.credentialEnvelope,
      connection.accountId,
      connection.provider,
    );
    const sinceBase = connection.lastSyncAt ?? new Date(connection.createdAt.getTime() - INITIAL_LOOKBACK_MILLISECONDS);
    const since = new Date(sinceBase.getTime() - OVERLAP_MILLISECONDS);
    const fetched = await fetchMessages(connection.provider, credentials, connection.scopes, since);
    const credentialEnvelope = sealCredentials(fetched.credentials, connection.accountId, connection.provider);

    if (!request) {
      await prisma.mailboxConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now, syncLockUntil: null, lastErrorCode: null, credentialEnvelope, scopes: fetched.scopes },
      });
      return { status: 'no_request', codeCreated: false };
    }

    // The provider query overlaps to avoid missing messages between polls, but
    // an OTP is eligible only after this sale established its waiting request.
    // Without that boundary an earlier OTP could be assigned to a later buyer.
    const oldestAccepted = request.createdAt;
    let created = false;
    const messages = [...fetched.messages].sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime());
    for (const message of messages) {
      if (message.receivedAt < oldestAccepted || message.receivedAt > new Date(now.getTime() + 60_000)) continue;
      const code = extractEmailCode(
        { from: message.sender, subject: message.subject, text: message.text },
        connection.senderAllowlist,
      );
      if (!code) continue;
      const expiresAt = new Date(message.receivedAt.getTime() + env.EMAIL_CODE_TTL_MINUTES * 60_000);
      if (expiresAt <= now) continue;

      try {
        created = await prisma.$transaction(async (tx) => {
          const claimed = await tx.codeRequest.updateMany({
            where: { id: request.id, status: CodeRequestStatus.WAITING, expiresAt: { gt: now } },
            data: { status: CodeRequestStatus.FULFILLED, fulfilledAt: now },
          });
          if (claimed.count !== 1) return false;
          await tx.temporaryCode.create({
            data: {
              accountId,
              saleId: request.saleId,
              code,
              expiresAt,
              source: CodeSource.EMAIL,
              createdBy: null,
              externalMessageId: `${connection.provider}:${message.id}`,
            },
          });
          return true;
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      }
      if (created) break;
    }

    await prisma.mailboxConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: now, syncLockUntil: null, lastErrorCode: null, credentialEnvelope, scopes: fetched.scopes },
    });
    return { status: created ? 'fulfilled' : 'waiting', codeCreated: created };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    await prisma.mailboxConnection.update({
      where: { id: connection.id },
      data: {
        syncLockUntil: null,
        lastErrorCode: errorCode,
        status: errorCode === 'REAUTH_REQUIRED' ? MailConnectionStatus.REAUTH_REQUIRED : MailConnectionStatus.ACTIVE,
      },
    }).catch(() => undefined);
    throw new Error('No se pudo sincronizar el buzón autorizado.');
  }
}

export function createCredentialEnvelope(refreshToken: string, accountId: string, provider: MailProvider): string {
  return sealCredentials({ refreshToken }, accountId, provider);
}
