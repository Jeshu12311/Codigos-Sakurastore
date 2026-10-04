import type { TemporaryCode } from '@prisma/client';

export interface SaveCodeInput {
  accountId: string;
  code: string;
  expiresAt: Date;
  createdBy: string;
}

export interface CodeProvider {
  getLatestCode(accountId: string): Promise<TemporaryCode | null>;
  validateCode(code: string): boolean;
  saveCode(input: SaveCodeInput): Promise<TemporaryCode>;
}

