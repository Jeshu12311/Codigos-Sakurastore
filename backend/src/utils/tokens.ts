import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string;
  email: string;
}

export function signAdminToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'clave-temporal',
    audience: 'admin',
  });
}

export function verifyAdminToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'clave-temporal',
    audience: 'admin',
  });
  if (typeof decoded === 'string' || !decoded.sub || typeof decoded.email !== 'string') {
    throw new Error('Token inválido');
  }
  return { sub: decoded.sub, email: decoded.email };
}

