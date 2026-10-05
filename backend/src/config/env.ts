import 'dotenv/config';
import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional(),
);
const optionalMailKey = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional().refine((value) => {
    if (!value) return true;
    if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value) || value.length % 4 !== 0) return false;
    return Buffer.from(value, 'base64').length === 32 && Buffer.from(value, 'base64').toString('base64') === value;
  }, 'MAIL_TOKEN_KEY_B64 debe ser una clave AES-256 de 32 bytes en base64.'),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('postgresql://otp_user:otp_password@localhost:5432/otp_portal?schema=public'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-me-123456'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: z.string().default('false').transform((value) => value === 'true'),
  TRUST_PROXY: z.string().default('false').transform((value) => value === 'true'),
  CODE_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  MICROSOFT_CLIENT_ID: optionalSecret,
  MICROSOFT_CLIENT_SECRET: optionalSecret,
  MAIL_TOKEN_KEY_B64: optionalMailKey,
  EMAIL_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('development-only')) {
  throw new Error('JWT_SECRET debe configurarse de forma segura en producción.');
}
