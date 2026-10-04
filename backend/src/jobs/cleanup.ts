import cron from 'node-cron';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export function startCleanupJob(): void {
  cron.schedule('17 3 * * *', async () => {
    const cutoff = new Date(Date.now() - env.CODE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
      const result = await prisma.temporaryCode.deleteMany({ where: { expiresAt: { lt: cutoff } } });
      if (result.count > 0) console.info(`Limpieza: ${result.count} códigos antiguos eliminados.`);
    } catch (error) {
      console.error('No se pudo completar la limpieza de códigos:', error);
    }
  });
}

