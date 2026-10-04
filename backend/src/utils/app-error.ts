export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'REQUEST_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

