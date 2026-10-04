import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

interface AttemptState {
  failures: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const attempts = new Map<string, AttemptState>();
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function getKey(ip: string, saleCode: string): string {
  return createHash('sha256').update(`${ip}:${saleCode.trim().toUpperCase()}`).digest('hex');
}

export function createAttemptGuard(maxFailures = 8): {
  middleware: RequestHandler;
  recordFailure: (ip: string, saleCode: string) => void;
  clear: (ip: string, saleCode: string) => void;
} {
  const middleware: RequestHandler = (req, res, next) => {
    const saleCode = typeof req.body?.saleCode === 'string' ? req.body.saleCode : '';
    const key = getKey(req.ip ?? 'unknown', saleCode);
    const state = attempts.get(key);
    const now = Date.now();
    if (state?.blockedUntil && state.blockedUntil > now) {
      res.setHeader('Retry-After', Math.ceil((state.blockedUntil - now) / 1000));
      return res.status(429).json({
        success: false,
        status: 'blocked',
        message: 'Demasiados intentos. Inténtalo nuevamente más tarde.',
      });
    }
    if (state && now - state.firstAttemptAt > WINDOW_MS) attempts.delete(key);
    next();
  };

  return {
    middleware,
    recordFailure(ip, saleCode) {
      const key = getKey(ip, saleCode);
      const now = Date.now();
      const current = attempts.get(key);
      const state = !current || now - current.firstAttemptAt > WINDOW_MS
        ? { failures: 0, firstAttemptAt: now }
        : current;
      state.failures += 1;
      if (state.failures >= maxFailures) state.blockedUntil = now + BLOCK_MS;
      attempts.set(key, state);
    },
    clear(ip, saleCode) {
      attempts.delete(getKey(ip, saleCode));
    },
  };
}

