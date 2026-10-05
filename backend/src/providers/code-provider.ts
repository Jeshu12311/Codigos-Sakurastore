import type { TemporaryCode } from '@prisma/client';

export interface SaveCodeInput {
  accountId: string;
  code: string;
  expiresAt: Date;
  createdBy?: string | null;
  saleId?: string | null;
}

export interface CodeProvider {
  getLatestCode(accountId: string, saleId?: string): Promise<TemporaryCode | null>;
  validateCode(code: string): boolean;
  saveCode(input: SaveCodeInput): Promise<TemporaryCode>;
}
