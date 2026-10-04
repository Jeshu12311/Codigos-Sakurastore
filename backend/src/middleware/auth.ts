import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
import { verifyAdminToken } from '../utils/tokens.js';

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.admin_token as string | undefined;
  if (!token) {
    return next(new AppError(401, 'Autenticación requerida.', 'UNAUTHORIZED'));
  }
  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    next(new AppError(401, 'La sesión no es válida o ha expirado.', 'UNAUTHORIZED'));
  }
};

