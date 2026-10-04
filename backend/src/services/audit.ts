import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface AuditInput {
  action: string;
  ip: string;
  accountId?: string | null;
  saleId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        ip: input.ip,
        accountId: input.accountId ?? null,
        saleId: input.saleId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') console.error('No se pudo escribir el registro de auditoría:', error);
  }
}

