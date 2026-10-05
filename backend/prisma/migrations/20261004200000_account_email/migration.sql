-- Preserve every existing account and all of its relations while replacing
-- the old alias identifier with a normalized email address.
ALTER TABLE "Account" RENAME COLUMN "alias" TO "email";

DROP INDEX IF EXISTS "Account_alias_key";

-- Values created by previous application versions could not contain "@".
-- They receive a deterministic address in the reserved .invalid namespace so
-- administrators can identify and replace them without losing sales/codes.
-- Already-valid emails are normalized; case-insensitive collisions retain one
-- address and safely move the remaining rows to the legacy namespace.
WITH candidates AS (
  SELECT
    "id",
    LOWER(BTRIM("email")) AS normalized,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM("email"))
      ORDER BY "createdAt", "id"
    ) AS duplicate_number
  FROM "Account"
), prepared AS (
  SELECT
    "id",
    CASE
      WHEN normalized ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$'
        AND LENGTH(normalized) <= 254
        AND duplicate_number = 1
      THEN normalized
      ELSE
        LEFT(
          COALESCE(
            NULLIF(REGEXP_REPLACE(normalized, '[^a-z0-9]+', '-', 'g'), ''),
            'account'
          ),
          40
        ) || '+' || SUBSTRING(MD5("id") FROM 1 FOR 10) || '@legacy.invalid'
    END AS normalized_email
  FROM candidates
)
UPDATE "Account" AS account
SET "email" = prepared.normalized_email
FROM prepared
WHERE account."id" = prepared."id";

CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_email_normalized_check"
  CHECK (
    "email" = LOWER(BTRIM("email"))
    AND LENGTH("email") <= 254
    AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );
