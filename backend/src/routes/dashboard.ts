import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [activeSales, activeAccounts, activeCodes, codesDeliveredToday, queriesToday, recentCodes, recentLogs] = await Promise.all([
    prisma.sale.count({ where: { active: true, expiresAt: { gt: now } } }),
    prisma.account.count({ where: { status: 'ACTIVE' } }),
    prisma.temporaryCode.count({ where: { used: false, invalidatedAt: null, expiresAt: { gt: now } } }),
    prisma.auditLog.count({ where: { action: 'PUBLIC_CODE_DELIVERED', createdAt: { gte: startOfToday } } }),
    prisma.auditLog.count({ where: { action: { startsWith: 'PUBLIC_' }, createdAt: { gte: startOfToday } } }),
    prisma.temporaryCode.findMany({
      include: { account: { select: { email: true, service: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.auditLog.findMany({
      include: { account: { select: { email: true } }, sale: { select: { saleCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  res.json({
    success: true,
    stats: { activeSales, activeAccounts, activeCodes, codesDeliveredToday, queriesToday },
    recentCodes,
    recentLogs,
  });
}));

export default router;
