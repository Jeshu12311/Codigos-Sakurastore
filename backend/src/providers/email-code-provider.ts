import type { TemporaryCode } from '@prisma/client';
import type { CodeProvider, SaveCodeInput } from './code-provider.js';

/**
 * Punto de extensión para una futura integración autorizada. Debe implementarse
 * únicamente mediante la API oficial del proveedor, OAuth y permisos explícitos.
 */
export class EmailCodeProvider implements CodeProvider {
  async getLatestCode(_accountId: string): Promise<TemporaryCode | null> {
    throw new Error('EmailCodeProvider todavía no está configurado.');
  }

  validateCode(code: string): boolean {
    return /^[A-Za-z0-9-]{4,32}$/.test(code);
  }

  async saveCode(_input: SaveCodeInput): Promise<TemporaryCode> {
    throw new Error('EmailCodeProvider todavía no está configurado.');
  }
}

