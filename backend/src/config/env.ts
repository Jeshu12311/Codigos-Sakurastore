import 'dotenv/config';
import { z } from 'zod';

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
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('development-only')) {
  throw new Error('JWT_SECRET debe configurarse de forma segura en producción.');
}
