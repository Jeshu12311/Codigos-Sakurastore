import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireCsrf } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';
import { writeAudit } from '../services/audit.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { generateSaleCode } from '../utils/sale-code.js';

const router = Router();
const saleSchema = z.object({
  accountId: z.string().trim().min(1),
  customerReference: z.string().trim().max(120).optional().nullable(),
  expiresAt: z.coerce.date(),
  saleCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}-[A-Z0-9]{4,8}$/).optional(),
}).strict().refine((data) => data.expiresAt.getTime() > Date.now(), { path: ['expiresAt'], message: 'La expiración debe estar en el futuro.' });
const updateSchema = z.object({
  active: z.boolean().optional(),
  customerReference: z.string().trim().max(120).optional().nullable(),
  expiresAt: z.coerce.date().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.');

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
  const sales = await prisma.sale.findMany({
    where: {
      active,
      ...(search ? { OR: [
        { saleCode: { contains: search, mode: 'insensitive' } },
        { customerReference: { contains: search, mode: 'insensitive' } },
        { account: { alias: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    },
    include: { account: { select: { id: true, alias: true, service: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, sales });
}));

router.post('/', requireCsrf, validateBody(saleSchema), asyncHandler(async (req, res) => {
  const account = await prisma.account.findUnique({ where: { id: req.body.accountId } });
  if (!account || account.status !== 'ACTIVE') throw new AppError(400, 'Selecciona una cuenta activa.', 'ACCOUNT_INACTIVE');

  let saleCode = req.body.saleCode;
  if (!saleCode) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateSaleCode();
      const exists = await prisma.sale.findUnique({ where: { saleCode: candidate } });
      if (!exists) { saleCode = candidate; break; }
    }
  }
  if (!saleCode) throw new AppError(500, 'No se pudo generar un código de venta.', 'GENERATION_FAILED');

  const sale = await prisma.sale.create({
    data: { ...req.body, saleCode, customerReference: req.body.customerReference || null },
    include: { account: { select: { id: true, alias: true, service: true, status: true } } },
  });
  await writeAudit({ action: 'SALE_CREATED', ip: req.ip ?? 'unknown', accountId: account.id, saleId: sale.id, metadata: { adminId: req.admin!.sub } });
  res.status(201).json({ success: true, sale });
}));

router.patch('/:id', requireCsrf, validateBody(updateSchema), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Venta no encontrada.', 'NOT_FOUND');
  const sale = await prisma.sale.update({
    where: { id }, data: req.body,
    include: { account: { select: { id: true, alias: true, service: true, status: true } } },
  });
  await writeAudit({ action: 'SALE_UPDATED', ip: req.ip ?? 'unknown', accountId: sale.accountId, saleId: sale.id, metadata: { adminId: req.admin!.sub } });
  res.json({ success: true, sale });
}));

export default router;
