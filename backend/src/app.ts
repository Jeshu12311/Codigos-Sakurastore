import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requireAdmin } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import accountsRouter from './routes/accounts.js';
import authRouter from './routes/auth.js';
import codesRouter from './routes/codes.js';
import dashboardRouter from './routes/dashboard.js';
import logsRouter from './routes/logs.js';
import { mailAdminRouter, mailCallbackRouter } from './routes/mail.js';
import { createPublicRouter } from './routes/public.js';
import salesRouter from './routes/sales.js';

export interface AppOptions {
  publicRateLimitMax?: number;
  attemptMaxFailures?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
    strictTransportSecurity: env.NODE_ENV === 'production' ? undefined : false,
  }));
  app.use(cors({
    origin(origin, callback) {
      const allowedOrigins = [env.FRONTEND_URL, env.RENDER_EXTERNAL_URL].filter(Boolean);
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'test') return callback(null, true);
      return callback(new Error('Origen no permitido.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use(cookieParser());

  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.publicRateLimitMax ?? 80,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      success: false,
      status: 'blocked',
      message: 'Demasiadas consultas. Inténtalo nuevamente más tarde.',
    }),
  });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.use('/api/public', publicLimiter, createPublicRouter(options.attemptMaxFailures));
  app.use('/api/admin/auth/login', loginLimiter);
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/mail/oauth', mailCallbackRouter);
  app.use('/api/admin/dashboard', requireAdmin, dashboardRouter);
  app.use('/api/admin/accounts', requireAdmin, accountsRouter);
  app.use('/api/admin/sales', requireAdmin, salesRouter);
  app.use('/api/admin/codes', requireAdmin, codesRouter);
  app.use('/api/admin/logs', requireAdmin, logsRouter);
  app.use('/api/admin/mail', requireAdmin, mailAdminRouter);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(currentDir, '../../frontend/dist');
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { index: false, maxAge: env.NODE_ENV === 'production' ? '1d' : 0 }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
