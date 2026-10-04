import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie('csrf_token', token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.csrf_token as string | undefined;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) {
    return next(new AppError(403, 'Token CSRF ausente.', 'CSRF_INVALID'));
  }
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    return next(new AppError(403, 'Token CSRF inválido.', 'CSRF_INVALID'));
  }
  next();
};

