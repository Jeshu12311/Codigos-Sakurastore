import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const requestedPage = Number(req.query.page ?? 1);
  const requestedLimit = Number(req.query.limit ?? 50);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const action = typeof req.query.action === 'string' ? req.query.action.trim().slice(0, 80) : '';
  const where = action ? { action: { contains: action, mode: 'insensitive' as const } } : undefined;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { account: { select: { email: true } }, sale: { select: { saleCode: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ success: true, logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

export default router;
