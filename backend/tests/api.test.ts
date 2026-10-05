import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getPrismaMock } from './setup.js';

const prismaMock = getPrismaMock();

const ADMIN_PASSWORD = 'correct-password';
const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 4),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const account = {
  id: 'account-1',
  email: 'cliente@example.com',
  service: 'Streaming',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function validSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-1',
    saleCode: 'F8K2-XP91',
    accountId: account.id,
    customerReference: 'pedido-42',
    active: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    account,
    ...overrides,
  };
}

function validCode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'code-1',
    accountId: account.id,
    code: '483921',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3 * 60 * 1000),
    used: false,
    invalidatedAt: null,
    createdBy: admin.id,
    ...overrides,
  };
}

async function authenticatedAgent(): Promise<{ agent: ReturnType<typeof request.agent>; csrfToken: string }> {
  prismaMock.userAdmin.findUnique.mockResolvedValue(admin);
  prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-login' });
  const agent = request.agent(createApp());
  const response = await agent
    .post('/api/admin/auth/login')
    .send({ email: admin.email, password: ADMIN_PASSWORD });

  expect(response.status).toBe(200);
  expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
    expect.stringContaining('admin_token='),
    expect.stringContaining('csrf_token='),
  ]));
  return { agent, csrfToken: response.body.csrfToken as string };
}

function mockPublicSale(result: ReturnType<typeof validSale> | null): void {
  // Supporting both lookup shapes keeps these tests focused on the public API
  // contract while still asserting the exact account/sale pair below.
  prismaMock.sale.findFirst.mockResolvedValue(result);
  prismaMock.sale.findUnique.mockResolvedValue(result);
}

describe.sequential('API backend', () => {
  it('inicia sesión de administrador y emite cookies seguras', async () => {
    prismaMock.userAdmin.findUnique.mockResolvedValue(admin);
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const response = await request(createApp())
      .post('/api/admin/auth/login')
      .send({ email: 'ADMIN@example.com', password: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      admin: { id: admin.id, email: admin.email },
    });
    expect(response.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const cookieHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(prismaMock.userAdmin.findUnique).toHaveBeenCalledWith({ where: { email: admin.email } });
  });

  it('crea una venta autenticada asociada a una cuenta activa', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const sale = validSale();
    prismaMock.account.findUnique.mockResolvedValue(account);
    prismaMock.sale.create.mockResolvedValue(sale);

    const response = await agent
      .post('/api/admin/sales')
      .set('x-csrf-token', csrfToken)
      .send({
        accountId: account.id,
        saleCode: sale.saleCode,
        customerReference: sale.customerReference,
        expiresAt: sale.expiresAt.toISOString(),
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, sale: { id: sale.id, saleCode: sale.saleCode } });
    expect(prismaMock.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accountId: account.id, saleCode: sale.saleCode }),
    }));
  });

  it('crea una cuenta con el correo normalizado', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const createdAccount = { ...account, email: 'cliente.nuevo@example.com' };
    prismaMock.account.create.mockResolvedValue(createdAccount);

    const response = await agent
      .post('/api/admin/accounts')
      .set('x-csrf-token', csrfToken)
      .send({ email: '  Cliente.Nuevo@Example.COM ', service: 'Disney+' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, account: { email: createdAccount.email } });
    expect(prismaMock.account.create).toHaveBeenCalledWith({
      data: { email: createdAccount.email, service: 'Disney+' },
    });
  });

  it('rechaza un correo inválido al crear una cuenta', async () => {
    const { agent, csrfToken } = await authenticatedAgent();

    const response = await agent
      .post('/api/admin/accounts')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'correo-invalido', service: 'Disney+' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(prismaMock.account.create).not.toHaveBeenCalled();
  });

  it('registra un código temporal autenticado', async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const code = validCode();
    prismaMock.account.findUnique.mockResolvedValue(account);
    prismaMock.temporaryCode.create.mockResolvedValue(code);

    const response = await agent
      .post('/api/admin/codes')
      .set('x-csrf-token', csrfToken)
      .send({ accountId: account.id, code: code.code, expiresAt: code.expiresAt.toISOString() });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, code: { id: code.id, code: code.code } });
    expect(prismaMock.temporaryCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: account.id, code: code.code, createdBy: admin.id }),
    });
  });

  it('no entrega un código expirado', async () => {
    mockPublicSale(validSale());
    const expired = validCode({ expiresAt: new Date(Date.now() - 1000) });
    prismaMock.temporaryCode.findFirst.mockImplementation(async (query: { where?: { expiresAt?: { gt?: Date } } }) => {
      const minimumExpiry = query.where?.expiresAt?.gt;
      return minimumExpiry && expired.expiresAt > minimumExpiry ? expired : null;
    });

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: account.email, saleCode: 'F8K2-XP91' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: false,
      status: 'waiting',
      message: 'Todavía no hay un código disponible.',
    });
    expect(response.body.code).toBeUndefined();
    expect(prismaMock.temporaryCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { gt: expect.any(Date) }, used: false, invalidatedAt: null }),
    }));
  });

  it('responde de forma genérica ante una venta incorrecta', async () => {
    mockPublicSale(null);

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: account.email, saleCode: 'ZZZZ-ZZZZ' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'No se encontró una solicitud activa con esos datos.',
    });
    expect(response.body).not.toHaveProperty('reason');
  });

  it('responde con el mismo mensaje genérico ante una cuenta incorrecta', async () => {
    mockPublicSale(null);

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: 'otra-cuenta@example.com', saleCode: 'F8K2-XP91' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'No se encontró una solicitud activa con esos datos.',
    });
  });

  it('aplica rate limiting por IP al portal público', async () => {
    const app = createApp({ publicRateLimitMax: 2, attemptMaxFailures: 100 });
    mockPublicSale(null);

    const first = await request(app).post('/api/public/code').send({ email: account.email, saleCode: 'RATE-LM01' });
    const second = await request(app).post('/api/public/code').send({ email: account.email, saleCode: 'RATE-LM02' });
    const blocked = await request(app).post('/api/public/code').send({ email: account.email, saleCode: 'RATE-LM03' });

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(blocked.status).toBe(429);
  });

  it('entrega una consulta pública válida con el tiempo restante', async () => {
    const sale = validSale();
    const code = validCode({ expiresAt: new Date(Date.now() + 173 * 1000) });
    mockPublicSale(sale);
    prismaMock.temporaryCode.findFirst.mockResolvedValue(code);

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: `  ${account.email.toUpperCase()}  `, saleCode: sale.saleCode.toLowerCase() });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      code: code.code,
      expiresAt: code.expiresAt.toISOString(),
    });
    expect(response.body.secondsRemaining).toBeGreaterThanOrEqual(171);
    expect(response.body.secondsRemaining).toBeLessThanOrEqual(173);
    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        saleCode: sale.saleCode,
        account: { email: account.email, status: 'ACTIVE' },
      }),
    }));
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('rechaza un correo invalido antes de consultar ventas', async () => {
    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: 'no-es-un-correo', saleCode: 'F8K2-XP91' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(prismaMock.sale.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza el contrato público anterior basado en account', async () => {
    const response = await request(createApp())
      .post('/api/public/code')
      .send({ account: account.email, saleCode: 'F8K2-XP91' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(prismaMock.sale.findFirst).not.toHaveBeenCalled();
  });

  it('no consulta el buzón cuando la venta es inválida', async () => {
    mockPublicSale(null);

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: account.email, saleCode: 'NOPE-0000' });

    expect(response.status).toBe(404);
    expect(prismaMock.mailboxConnection.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.codeRequest.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.temporaryCode.findFirst).not.toHaveBeenCalled();
  });

  it('no entrega un código de correo ligado a otra venta', async () => {
    const sale = validSale();
    const codeFromAnotherSale = validCode({
      id: 'email-code-other-sale',
      source: 'EMAIL',
      saleId: 'sale-2',
      createdBy: null,
    });
    mockPublicSale(sale);
    prismaMock.temporaryCode.findFirst.mockImplementation(async (query: {
      where?: { OR?: Array<{ source?: string; saleId?: string }> };
    }) => {
      const allowed = query.where?.OR ?? [];
      const matches = allowed.some((condition) => (
        condition.source === codeFromAnotherSale.source
        || condition.saleId === codeFromAnotherSale.saleId
      ));
      return matches ? codeFromAnotherSale : null;
    });
    prismaMock.mailboxConnection.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post('/api/public/code')
      .send({ email: account.email, saleCode: sale.saleCode });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: false, status: 'waiting' });
    expect(response.body).not.toHaveProperty('code');
    expect(prismaMock.temporaryCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ source: 'MANUAL' }, { saleId: sale.id }]),
      }),
    }));
  });

  it('protege los endpoints administrativos de correo con autenticación y CSRF', async () => {
    const unauthenticated = await request(createApp())
      .get(`/api/admin/mail/accounts/${account.id}/status`);

    expect(unauthenticated.status).toBe(401);

    const { agent } = await authenticatedAgent();
    const connect = await agent
      .post(`/api/admin/mail/accounts/${account.id}/connect/google`)
      .send({ senderAllowlist: ['no-reply@example.com'] });
    const sync = await agent
      .post(`/api/admin/mail/accounts/${account.id}/sync`)
      .send({});
    const disconnect = await agent
      .delete(`/api/admin/mail/accounts/${account.id}/connection`);

    expect(connect.status).toBe(403);
    expect(sync.status).toBe(403);
    expect(disconnect.status).toBe(403);
    expect(prismaMock.oAuthAttempt.create).not.toHaveBeenCalled();
    expect(prismaMock.mailboxConnection.findUnique).not.toHaveBeenCalled();
  });
});
