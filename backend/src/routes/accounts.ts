import { AccountStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';
import { normalizedEmailSchema } from '../schemas/email.js';
import { writeAudit } from '../services/audit.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const accountSchema = z.object({
  email: normalizedEmailSchema,
  service: z.string().trim().min(2).max(80),
}).strict();
const updateSchema = z.object({
  email: normalizedEmailSchema.optional(),
  service: z.string().trim().min(2).max(80).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.');

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const accounts = await prisma.account.findMany({
    where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { service: { contains: search, mode: 'insensitive' } }] } : undefined,
    include: { _count: { select: { sales: true, temporaryCodes: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, accounts });
}));

router.post('/', requireCsrf, validateBody(accountSchema), asyncHandler(async (req, res) => {
  const account = await prisma.account.create({ data: req.body });
  await writeAudit({ action: 'ACCOUNT_CREATED', ip: req.ip ?? 'unknown', accountId: account.id, metadata: { adminId: req.admin!.sub } });
  res.status(201).json({ success: true, account });
}));

router.patch('/:id', requireCsrf, validateBody(updateSchema), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Cuenta no encontrada.', 'NOT_FOUND');
  const account = await prisma.account.update({ where: { id }, data: req.body });
  await writeAudit({ action: 'ACCOUNT_UPDATED', ip: req.ip ?? 'unknown', accountId: account.id, metadata: { adminId: req.admin!.sub } });
  res.json({ success: true, account });
}));

export default router;
