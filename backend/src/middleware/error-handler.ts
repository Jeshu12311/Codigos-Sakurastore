import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'Ruta no encontrada.', 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.', fields: error.flatten().fieldErrors },
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'El registro ya existe.' } });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (process.env.NODE_ENV !== 'test') console.error(error);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
  });
};

