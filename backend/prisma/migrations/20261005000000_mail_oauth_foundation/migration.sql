-- Foundation for an official OAuth mail integration. No routes or provider
-- implementation are introduced by this migration.
CREATE TYPE "MailProvider" AS ENUM ('GOOGLE', 'MICROSOFT');
CREATE TYPE "MailConnectionStatus" AS ENUM ('ACTIVE', 'REAUTH_REQUIRED', 'REVOKED', 'ERROR');
CREATE TYPE "CodeSource" AS ENUM ('MANUAL', 'EMAIL');
CREATE TYPE "CodeRequestStatus" AS ENUM ('WAITING', 'FULFILLED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "TemporaryCode"
  ALTER COLUMN "createdBy" DROP NOT NULL,
  ADD COLUMN "source" "CodeSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "saleId" TEXT,
  ADD COLUMN "externalMessageId" TEXT;

ALTER TABLE "TemporaryCode"
  DROP CONSTRAINT "TemporaryCode_createdBy_fkey",
  ADD CONSTRAINT "TemporaryCode_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "UserAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TemporaryCode_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TemporaryCode_accountId_externalMessageId_key"
  ON "TemporaryCode"("accountId", "externalMessageId");
CREATE INDEX "TemporaryCode_saleId_idx" ON "TemporaryCode"("saleId");

CREATE TABLE "CodeRequest" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "status" "CodeRequestStatus" NOT NULL DEFAULT 'WAITING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMP(3),
  CONSTRAINT "CodeRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CodeRequest"
  ADD CONSTRAINT "CodeRequest_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CodeRequest_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CodeRequest_saleId_idx" ON "CodeRequest"("saleId");
CREATE INDEX "CodeRequest_expiresAt_idx" ON "CodeRequest"("expiresAt");
CREATE INDEX "CodeRequest_accountId_status_idx" ON "CodeRequest"("accountId", "status");
-- This closes the race between concurrent polling/ingestion workers.
CREATE UNIQUE INDEX "CodeRequest_one_waiting_per_account_key"
  ON "CodeRequest"("accountId") WHERE "status" = 'WAITING';

CREATE TABLE "OAuthAttempt" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "provider" "MailProvider" NOT NULL,
  "accountId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "pkceVerifierEnvelope" TEXT NOT NULL,
  "senderAllowlist" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAttempt_stateHash_key" ON "OAuthAttempt"("stateHash");
CREATE INDEX "OAuthAttempt_accountId_expiresAt_idx" ON "OAuthAttempt"("accountId", "expiresAt");
CREATE INDEX "OAuthAttempt_adminId_expiresAt_idx" ON "OAuthAttempt"("adminId", "expiresAt");
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");

ALTER TABLE "OAuthAttempt"
  ADD CONSTRAINT "OAuthAttempt_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OAuthAttempt_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "UserAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MailboxConnection" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" "MailProvider" NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "externalEmail" TEXT NOT NULL,
  "credentialEnvelope" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "status" "MailConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "senderAllowlist" TEXT[] NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "syncLockUntil" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MailboxConnection_accountId_key" ON "MailboxConnection"("accountId");
CREATE UNIQUE INDEX "MailboxConnection_provider_providerSubject_key"
  ON "MailboxConnection"("provider", "providerSubject");
CREATE INDEX "MailboxConnection_status_idx" ON "MailboxConnection"("status");
CREATE INDEX "MailboxConnection_syncLockUntil_idx" ON "MailboxConnection"("syncLockUntil");

ALTER TABLE "MailboxConnection"
  ADD CONSTRAINT "MailboxConnection_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
