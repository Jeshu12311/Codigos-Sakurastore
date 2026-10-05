import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';
import { ManualCodeProvider } from '../providers/manual-code-provider.js';
import { writeAudit } from '../services/audit.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const provider = new ManualCodeProvider(prisma);
const codeSchema = z.object({
  accountId: z.string().trim().min(1),
  code: z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9-]+$/),
  expiresAt: z.coerce.date(),
}).strict().refine((data) => data.expiresAt.getTime() > Date.now(), { path: ['expiresAt'], message: 'La expiración debe estar en el futuro.' });

router.get('/', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const now = new Date();
  const statusWhere = status === 'active'
    ? { expiresAt: { gt: now }, used: false, invalidatedAt: null }
    : status === 'expired'
      ? { OR: [{ expiresAt: { lte: now } }, { used: true }, { invalidatedAt: { not: null } }] }
      : {};
  const codes = await prisma.temporaryCode.findMany({
    where: {
      ...statusWhere,
      ...(search ? { account: { email: { contains: search, mode: 'insensitive' } } } : {}),
    },
    include: {
      account: { select: { id: true, email: true, service: true } },
      creator: { select: { email: true } },
      sale: { select: { saleCode: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });
  res.json({ success: true, codes });
}));

router.post('/', requireCsrf, validateBody(codeSchema), asyncHandler(async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.body.accountId } });
  if (!account || account.status !== 'ACTIVE') throw new AppError(400, 'Selecciona una cuenta activa.', 'ACCOUNT_INACTIVE');
  if (!provider.validateCode(req.body.code)) throw new AppError(400, 'El formato del código no es válido.', 'VALIDATION_ERROR');
  const code = await provider.saveCode({ ...req.body, createdBy: req.admin!.sub });
  await writeAudit({ action: 'CODE_CREATED', ip: req.ip ?? 'unknown', accountId: account.id, metadata: { adminId: req.admin!.sub, codeId: code.id } });
  res.status(201).json({ success: true, code });
}));

router.patch('/:id/invalidate', requireCsrf, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.temporaryCode.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Código no encontrado.', 'NOT_FOUND');
  const code = await prisma.temporaryCode.update({ where: { id: existing.id }, data: { invalidatedAt: new Date() } });
  await writeAudit({ action: 'CODE_INVALIDATED', ip: req.ip ?? 'unknown', accountId: code.accountId, metadata: { adminId: req.admin!.sub, codeId: code.id } });
  res.json({ success: true, code });
}));

router.patch('/:id/use', requireCsrf, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.temporaryCode.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Código no encontrado.', 'NOT_FOUND');
  const code = await prisma.temporaryCode.update({ where: { id: existing.id }, data: { used: true } });
  await writeAudit({ action: 'CODE_MARKED_USED', ip: req.ip ?? 'unknown', accountId: code.accountId, metadata: { adminId: req.admin!.sub, codeId: code.id } });
  res.json({ success: true, code });
}));

export default router;
