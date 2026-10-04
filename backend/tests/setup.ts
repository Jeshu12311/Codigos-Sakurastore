import { beforeEach, vi } from 'vitest';

// Keep every API test hermetic: importing the application must never create a
// real Prisma client or require a running PostgreSQL server.
const prismaMock = vi.hoisted(() => {
  const mock = {
    userAdmin: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    sale: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    temporaryCode: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };

  mock.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === 'function') {
      return operation(mock);
    }
    return Promise.all(operation as Promise<unknown>[]);
  });

  return mock;
});

export function getPrismaMock() {
  return prismaMock;
}

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('@prisma/client', () => ({
  AccountStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, options: { code: string }) {
        super(message);
        this.code = options.code;
      }
    },
  },
}));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.COOKIE_SECURE = 'false';
process.env.FRONTEND_URL = 'http://localhost:5173';

beforeEach(() => {
  vi.clearAllMocks();
});
