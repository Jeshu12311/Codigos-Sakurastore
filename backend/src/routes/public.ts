import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createAttemptGuard } from '../middleware/attempt-guard.js';
import { validateBody } from '../middleware/validate.js';
import { ManualCodeProvider } from '../providers/manual-code-provider.js';
import { syncMailboxForAccount } from '../mail/sync.js';
import { normalizedEmailSchema } from '../schemas/email.js';
import { writeAudit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';

const querySchema = z.object({
  email: normalizedEmailSchema,
  saleCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/),
}).strict();

const GENERIC_NOT_FOUND = 'No se encontró una solicitud activa con esos datos.';

async function ensureSaleRequest(sale: { id: string; accountId: string; expiresAt: Date }) {
  const now = new Date();
  await prisma.codeRequest.updateMany({
    where: { accountId: sale.accountId, status: 'WAITING', expiresAt: { lte: now } },
    data: { status: 'EXPIRED' },
  });
  const existing = await prisma.codeRequest.findFirst({
    where: { accountId: sale.accountId, status: 'WAITING', expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  const expiresAt = new Date(Math.min(sale.expiresAt.getTime(), now.getTime() + 3 * 60_000));
  try {
    return await prisma.codeRequest.create({
      data: { saleId: sale.id, accountId: sale.accountId, expiresAt },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    return prisma.codeRequest.findFirst({
      where: { accountId: sale.accountId, status: 'WAITING', expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export function createPublicRouter(maxFailures = 8): Router {
  const router = Router();
  const guard = createAttemptGuard(maxFailures);
  const provider = new ManualCodeProvider(prisma);

  router.post('/code', validateBody(querySchema), guard.middleware, asyncHandler(async (req, res) => {
    const { email, saleCode } = req.body;
    const ip = req.ip ?? 'unknown';
    const now = new Date();
    const sale = await prisma.sale.findFirst({
      where: {
        saleCode,
        active: true,
        expiresAt: { gt: now },
        account: { email, status: 'ACTIVE' },
      },
      include: { account: { select: { id: true } } },
    });

    if (!sale) {
      guard.recordFailure(ip, saleCode);
      await writeAudit({ action: 'PUBLIC_QUERY_REJECTED', ip, metadata: { reason: 'no_active_match' } });
      return res.status(404).json({ success: false, status: 'not_found', message: GENERIC_NOT_FOUND });
    }

    guard.clear(ip, saleCode);
    let temporaryCode = await provider.getLatestCode(sale.accountId, sale.id);
    if (!temporaryCode) {
      const connection = await prisma.mailboxConnection.findUnique({
        where: { accountId: sale.accountId },
        select: { status: true },
      });
      if (connection?.status === 'ACTIVE') {
        const codeRequest = await ensureSaleRequest(sale);
        if (codeRequest?.saleId === sale.id) {
          await syncMailboxForAccount(sale.accountId).catch(() => undefined);
          temporaryCode = await provider.getLatestCode(sale.accountId, sale.id);
        }
      }
    }
    if (!temporaryCode || temporaryCode.expiresAt.getTime() <= now.getTime() || temporaryCode.used || temporaryCode.invalidatedAt) {
      await writeAudit({ action: 'PUBLIC_CODE_WAITING', ip, accountId: sale.accountId, saleId: sale.id });
      return res.json({ success: false, status: 'waiting', message: 'Todavía no hay un código disponible.' });
    }

    const secondsRemaining = Math.max(0, Math.floor((temporaryCode.expiresAt.getTime() - now.getTime()) / 1000));
    await writeAudit({
      action: 'PUBLIC_CODE_DELIVERED',
      ip,
      accountId: sale.accountId,
      saleId: sale.id,
      metadata: { codeId: temporaryCode.id },
    });
    return res.json({
      success: true,
      code: temporaryCode.code,
      expiresAt: temporaryCode.expiresAt.toISOString(),
      secondsRemaining,
    });
  }));

  return router;
}
