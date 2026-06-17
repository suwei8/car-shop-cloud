-- TASK-H-010: Login phone unique constraint
-- Adds a global unique constraint on users.phone to prevent race conditions.
-- Step 1: Fail-fast check for duplicate phone numbers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add users_phone_key: duplicate users.phone values exist. Run pnpm audit:login-phones -- --strict and clean duplicates first.';
  END IF;
END $$;

-- Step 2: Drop the old non-unique index
DROP INDEX IF EXISTS "users_phone_idx";

-- Step 3: Create the global unique index on phone
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
