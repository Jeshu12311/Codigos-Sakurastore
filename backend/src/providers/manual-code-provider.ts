import type { PrismaClient, TemporaryCode } from '@prisma/client';
import type { CodeProvider, SaveCodeInput } from './code-provider.js';

export class ManualCodeProvider implements CodeProvider {
  constructor(private readonly db: PrismaClient) {}

  getLatestCode(accountId: string): Promise<TemporaryCode | null> {
    return this.db.temporaryCode.findFirst({
      where: { accountId, used: false, invalidatedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  validateCode(code: string): boolean {
    return /^[A-Za-z0-9-]{4,32}$/.test(code);
  }

  saveCode(input: SaveCodeInput): Promise<TemporaryCode> {
    return this.db.temporaryCode.create({ data: input });
  }
}

