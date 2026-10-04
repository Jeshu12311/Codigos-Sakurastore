import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createAttemptGuard } from '../middleware/attempt-guard.js';
import { validateBody } from '../middleware/validate.js';
import { ManualCodeProvider } from '../providers/manual-code-provider.js';
import { writeAudit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';

const querySchema = z.object({
  account: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9._-]+$/),
  saleCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/),
}).strict();

const GENERIC_NOT_FOUND = 'No se encontró una solicitud activa con esos datos.';

export function createPublicRouter(maxFailures = 8): Router {
  const router = Router();
  const guard = createAttemptGuard(maxFailures);
  const provider = new ManualCodeProvider(prisma);

  router.post('/code', validateBody(querySchema), guard.middleware, asyncHandler(async (req, res) => {
    const { account, saleCode } = req.body;
    const ip = req.ip ?? 'unknown';
    const now = new Date();
    const sale = await prisma.sale.findFirst({
      where: {
        saleCode,
        active: true,
        expiresAt: { gt: now },
        account: { alias: account, status: 'ACTIVE' },
      },
      include: { account: { select: { id: true } } },
    });

    if (!sale) {
      guard.recordFailure(ip, saleCode);
      await writeAudit({ action: 'PUBLIC_QUERY_REJECTED', ip, metadata: { reason: 'no_active_match' } });
      return res.status(404).json({ success: false, status: 'not_found', message: GENERIC_NOT_FOUND });
    }

    guard.clear(ip, saleCode);
    const temporaryCode = await provider.getLatestCode(sale.accountId);
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

