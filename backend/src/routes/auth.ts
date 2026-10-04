import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';
import { createCsrfToken, requireCsrf, setCsrfCookie } from '../middleware/csrf.js';
import { validateBody } from '../middleware/validate.js';
import { writeAudit } from '../services/audit.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { signAdminToken } from '../utils/tokens.js';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
}).strict();

const DUMMY_HASH = '$2b$12$2A9fWzVkGD6Wz1iIFZYEUuFcY/8ZacNJo1E4kONZgZFy5vCUdcPvG';

router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await prisma.userAdmin.findUnique({ where: { email } });
  const validPassword = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !validPassword) {
    await writeAudit({ action: 'ADMIN_LOGIN_FAILED', ip: req.ip ?? 'unknown' });
    throw new AppError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
  }

  const token = signAdminToken({ sub: admin.id, email: admin.email });
  const csrfToken = createCsrfToken();
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  setCsrfCookie(res, csrfToken);
  await writeAudit({ action: 'ADMIN_LOGIN', ip: req.ip ?? 'unknown', metadata: { adminId: admin.id } });
  res.json({ success: true, admin: { id: admin.id, email: admin.email }, csrfToken });
}));

router.get('/me', requireAdmin, (req, res) => {
  res.json({ success: true, admin: { id: req.admin!.sub, email: req.admin!.email } });
});

router.post('/logout', requireAdmin, requireCsrf, asyncHandler(async (req, res) => {
  res.clearCookie('admin_token', { path: '/', sameSite: 'strict', secure: env.COOKIE_SECURE });
  res.clearCookie('csrf_token', { path: '/', sameSite: 'strict', secure: env.COOKIE_SECURE });
  await writeAudit({ action: 'ADMIN_LOGOUT', ip: req.ip ?? 'unknown', metadata: { adminId: req.admin!.sub } });
  res.json({ success: true });
}));

export default router;

