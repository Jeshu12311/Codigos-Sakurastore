-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "UserAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "saleCode" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customerReference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporaryCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "invalidatedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "TemporaryCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "accountId" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAdmin_email_key" ON "UserAdmin"("email");
CREATE UNIQUE INDEX "Account_alias_key" ON "Account"("alias");
CREATE INDEX "Account_status_idx" ON "Account"("status");
CREATE UNIQUE INDEX "Sale_saleCode_key" ON "Sale"("saleCode");
CREATE INDEX "Sale_accountId_active_idx" ON "Sale"("accountId", "active");
CREATE INDEX "Sale_expiresAt_idx" ON "Sale"("expiresAt");
CREATE INDEX "TemporaryCode_accountId_expiresAt_idx" ON "TemporaryCode"("accountId", "expiresAt");
CREATE INDEX "TemporaryCode_expiresAt_used_idx" ON "TemporaryCode"("expiresAt", "used");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_accountId_createdAt_idx" ON "AuditLog"("accountId", "createdAt");
CREATE INDEX "AuditLog_saleId_createdAt_idx" ON "AuditLog"("saleId", "createdAt");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryCode" ADD CONSTRAINT "TemporaryCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemporaryCode" ADD CONSTRAINT "TemporaryCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "UserAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

