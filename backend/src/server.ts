import { app } from './app.js';
import { env } from './config/env.js';
import { startCleanupJob } from './jobs/cleanup.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  console.info(`API disponible en http://localhost:${env.PORT}`);
  startCleanupJob();
});

async function shutdown(signal: string) {
  console.info(`${signal} recibido. Cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

