import { MailConnectionStatus, MailProvider } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { createOAuthState, createPkcePair, hashOAuthState, openSecret, sealSecret } from '../mail/crypto.js';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCode,
  revokeGoogleToken,
} from '../mail/providers/google.js';
import {
  buildMicrosoftAuthorizationUrl,
  exchangeMicrosoftCode,
} from '../mail/providers/microsoft.js';
import { createCredentialEnvelope, syncMailboxForAccount } from '../mail/sync.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';
import { writeAudit } from '../services/audit.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const providerSchema = z.enum(['google', 'microsoft']);
const senderSchema = z.string().trim().toLowerCase().refine(
  (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) || /^@[a-z0-9.-]+\.[a-z]{2,}$/u.test(value),
  'Remitente no válido.',
);
const connectSchema = z.object({
  senderAllowlist: z.array(senderSchema).min(1).max(30),
}).strict();

function providerFromParam(value: unknown): MailProvider {
  const parsed = providerSchema.safeParse(value);
  if (!parsed.success) throw new AppError(404, 'Proveedor de correo no disponible.', 'NOT_FOUND');
  return parsed.data === 'google' ? MailProvider.GOOGLE : MailProvider.MICROSOFT;
}

function providerPath(provider: MailProvider): string {
  return provider === MailProvider.GOOGLE ? 'google' : 'microsoft';
}

function backendBaseUrl(): string {
  return (env.RENDER_EXTERNAL_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/u, '');
}

function callbackUrl(provider: MailProvider): string {
  return `${backendBaseUrl()}/api/admin/mail/oauth/${providerPath(provider)}/callback`;
}

function frontendResult(status: 'connected' | 'error'): string {
  const url = new URL('/admin/accounts', env.FRONTEND_URL);
  url.searchParams.set('mailbox', status);
  return url.toString();
}

function oauthAad(stateHash: string, provider: MailProvider): string {
  return `oauth:${stateHash}:${provider}:v1`;
}

function assertConfigured(provider: MailProvider): void {
  if (!env.MAIL_TOKEN_KEY_B64) {
    throw new AppError(503, 'La integración de correo aún no está configurada.', 'MAIL_NOT_CONFIGURED');
  }
  if (provider === MailProvider.GOOGLE && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
    throw new AppError(503, 'La conexión con Gmail aún no está configurada.', 'MAIL_NOT_CONFIGURED');
  }
  if (provider === MailProvider.MICROSOFT && (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET)) {
    throw new AppError(503, 'La conexión con Outlook/Hotmail aún no está configurada.', 'MAIL_NOT_CONFIGURED');
  }
}

export const mailAdminRouter = Router();
export const mailCallbackRouter = Router();

mailAdminRouter.get('/config', asyncHandler(async (_req, res) => {
  const encryptionKeyConfigured = Boolean(env.MAIL_TOKEN_KEY_B64);
  res.json({
    success: true,
    encryptionKeyConfigured,
    providers: {
      google: {
        configured: encryptionKeyConfigured && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        redirectUri: callbackUrl(MailProvider.GOOGLE),
      },
      microsoft: {
        configured: encryptionKeyConfigured && Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
        redirectUri: callbackUrl(MailProvider.MICROSOFT),
      },
    },
  });
}));

mailAdminRouter.post('/accounts/:id/connect/:provider', requireCsrf, validateBody(connectSchema), asyncHandler(async (req, res) => {
  const accountId = String(req.params.id);
  const provider = providerFromParam(req.params.provider);
  assertConfigured(provider);
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.status !== 'ACTIVE') {
    throw new AppError(404, 'Cuenta activa no encontrada.', 'NOT_FOUND');
  }

  const senderAllowlist = [...new Set((req.body.senderAllowlist as string[]).map((value) => value.toLowerCase()))];
  const state = createOAuthState();
  const stateHash = hashOAuthState(state);
  const pkce = createPkcePair();
  await prisma.oAuthAttempt.create({
    data: {
      stateHash,
      provider,
      accountId,
      adminId: req.admin!.sub,
      pkceVerifierEnvelope: sealSecret(pkce.verifier, env.MAIL_TOKEN_KEY_B64!, oauthAad(stateHash, provider)),
      senderAllowlist,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  const redirectUri = callbackUrl(provider);
  const authorizationUrl = provider === MailProvider.GOOGLE
    ? buildGoogleAuthorizationUrl({ clientId: env.GOOGLE_CLIENT_ID!, redirectUri, state, codeChallenge: pkce.challenge })
    : buildMicrosoftAuthorizationUrl({ clientId: env.MICROSOFT_CLIENT_ID!, redirectUri, state, codeChallenge: pkce.challenge });
  await writeAudit({
    action: 'MAIL_OAUTH_STARTED',
    ip: req.ip ?? 'unknown',
    accountId,
    metadata: { adminId: req.admin!.sub, provider },
  });
  res.json({ success: true, authorizationUrl });
}));

mailAdminRouter.get('/accounts/:id/status', asyncHandler(async (req, res) => {
  const accountId = String(req.params.id);
  const connection = await prisma.mailboxConnection.findUnique({
    where: { accountId },
    select: {
      id: true,
      provider: true,
      externalEmail: true,
      status: true,
      senderAllowlist: true,
      lastSyncAt: true,
      lastErrorCode: true,
      updatedAt: true,
    },
  });
  res.json({ success: true, connection });
}));

mailAdminRouter.post('/accounts/:id/sync', requireCsrf, asyncHandler(async (req, res) => {
  const accountId = String(req.params.id);
  const result = await syncMailboxForAccount(accountId, true);
  if (result.status === 'not_connected') throw new AppError(404, 'Esta cuenta no tiene un buzón conectado.', 'NOT_FOUND');
  if (result.status === 'disabled') throw new AppError(503, 'La integración de correo no está configurada.', 'MAIL_NOT_CONFIGURED');
  await writeAudit({
    action: 'MAIL_SYNC_REQUESTED',
    ip: req.ip ?? 'unknown',
    accountId,
    metadata: { adminId: req.admin!.sub, result: result.status },
  });
  res.json({ success: true, result });
}));

mailAdminRouter.delete('/accounts/:id/connection', requireCsrf, asyncHandler(async (req, res) => {
  const accountId = String(req.params.id);
  const connection = await prisma.mailboxConnection.findUnique({ where: { accountId } });
  if (!connection) throw new AppError(404, 'Esta cuenta no tiene un buzón conectado.', 'NOT_FOUND');

  if (connection.provider === MailProvider.GOOGLE && env.MAIL_TOKEN_KEY_B64) {
    try {
      const plaintext = openSecret(
        connection.credentialEnvelope,
        env.MAIL_TOKEN_KEY_B64,
        `mailbox:${accountId}:${connection.provider}:v1`,
      );
      const parsed = JSON.parse(plaintext) as { refreshToken?: unknown };
      if (typeof parsed.refreshToken === 'string') await revokeGoogleToken(parsed.refreshToken);
    } catch {
      // Local deletion must still succeed if the remote token is already invalid.
    }
  }

  await prisma.$transaction([
    prisma.codeRequest.updateMany({
      where: { accountId, status: 'WAITING' },
      data: { status: 'CANCELLED' },
    }),
    prisma.mailboxConnection.delete({ where: { id: connection.id } }),
  ]);
  await writeAudit({
    action: 'MAIL_DISCONNECTED',
    ip: req.ip ?? 'unknown',
    accountId,
    metadata: { adminId: req.admin!.sub, provider: connection.provider },
  });
  res.status(204).end();
}));

mailCallbackRouter.get('/:provider/callback', asyncHandler(async (req, res) => {
  const provider = providerFromParam(req.params.provider);
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!state || state.length > 256) return res.redirect(frontendResult('error'));
  const stateHash = hashOAuthState(state);
  const attempt = await prisma.oAuthAttempt.findUnique({
    where: { stateHash },
    include: { account: { select: { id: true, email: true, status: true } } },
  });
  if (!attempt || attempt.provider !== provider) return res.redirect(frontendResult('error'));

  const consumed = await prisma.oAuthAttempt.updateMany({
    where: { id: attempt.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1 || req.query.error || attempt.account.status !== 'ACTIVE') {
    return res.redirect(frontendResult('error'));
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code || code.length > 4096) return res.redirect(frontendResult('error'));
  try {
    assertConfigured(provider);
    const verifier = openSecret(
      attempt.pkceVerifierEnvelope,
      env.MAIL_TOKEN_KEY_B64!,
      oauthAad(stateHash, provider),
    );
    const redirectUri = callbackUrl(provider);
    const authorization = provider === MailProvider.GOOGLE
      ? await exchangeGoogleCode({
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri,
        code,
        codeVerifier: verifier,
      })
      : await exchangeMicrosoftCode({
        clientId: env.MICROSOFT_CLIENT_ID!,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        redirectUri,
        code,
        codeVerifier: verifier,
      });

    if (authorization.email.toLowerCase() !== attempt.account.email.toLowerCase()) {
      if (provider === MailProvider.GOOGLE) await revokeGoogleToken(authorization.refreshToken);
      await writeAudit({
        action: 'MAIL_OAUTH_EMAIL_MISMATCH',
        ip: req.ip ?? 'unknown',
        accountId: attempt.accountId,
        metadata: { adminId: attempt.adminId, provider },
      });
      return res.redirect(frontendResult('error'));
    }

    await prisma.mailboxConnection.upsert({
      where: { accountId: attempt.accountId },
      create: {
        accountId: attempt.accountId,
        provider,
        providerSubject: authorization.providerSubject,
        externalEmail: authorization.email,
        credentialEnvelope: createCredentialEnvelope(authorization.refreshToken, attempt.accountId, provider),
        scopes: authorization.scopes,
        status: MailConnectionStatus.ACTIVE,
        senderAllowlist: attempt.senderAllowlist,
      },
      update: {
        provider,
        providerSubject: authorization.providerSubject,
        externalEmail: authorization.email,
        credentialEnvelope: createCredentialEnvelope(authorization.refreshToken, attempt.accountId, provider),
        scopes: authorization.scopes,
        status: MailConnectionStatus.ACTIVE,
        senderAllowlist: attempt.senderAllowlist,
        lastErrorCode: null,
        lastSyncAt: null,
        syncLockUntil: null,
      },
    });
    await writeAudit({
      action: 'MAIL_CONNECTED',
      ip: req.ip ?? 'unknown',
      accountId: attempt.accountId,
      metadata: { adminId: attempt.adminId, provider },
    });
    return res.redirect(frontendResult('connected'));
  } catch {
    await writeAudit({
      action: 'MAIL_OAUTH_FAILED',
      ip: req.ip ?? 'unknown',
      accountId: attempt.accountId,
      metadata: { adminId: attempt.adminId, provider },
    }).catch(() => undefined);
    return res.redirect(frontendResult('error'));
  }
}));
