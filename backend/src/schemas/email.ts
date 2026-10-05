import { z } from 'zod';

export const normalizedEmailSchema = z.string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Ingresa un correo electrónico válido.');
